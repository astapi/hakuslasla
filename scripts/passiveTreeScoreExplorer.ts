import {
  applyPercentageScaling,
  applyPetBuff,
  calculateBattleHpAndShield,
  calculateDamage,
  combineMods,
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  generateRandomEquipmentSet,
  getAttackSpeedFromMods,
} from '../core';
import { CLASS_ABILITIES, CLASS_INITIAL_STATS } from '../core/player';
import { DEFAULT_BATTLE_CONFIG } from '../core/types';
import type { CombinedModEffects, DungeonConfig, EnemyConfig, Stats } from '../core/types';
import { getIgniteDamageFromMods } from '../core/modEffects';
import { getDimensionalRushEnemy } from '../data/endContents';
import {
  getBaseBossId,
  getEnemyAtkMultiplier,
  getEnemyAttackSpeedMultiplier,
  getEnemyDamageReductionPct,
  getEnemyHpOnHit,
  getEnemyRegenPerSecond,
  getPlayerAtkMultiplier,
  getPlayerAttackSpeedMultiplier,
  getPlayerDefMultiplier,
  getPlayerPoisonFromBoss,
  isEndContentDungeon,
  isUberBoss,
  isUberUberBoss,
} from '../core/endContent';
import { getPetLevelFactor } from '../data/pets';
import {
  calculatePassiveEffects,
  getPassiveNode,
  getStartNodeId,
  getUnlockableNodes,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../data/passiveTree';
import { calculateUberTreeEffects } from '../data/uberTree';
import type { CharacterType, Item, PassiveNode } from '../types';

import dungeonsData from '../data/json/dungeons.json';
import monstersData from '../data/json/monsters.json';
import petsData from '../data/json/pets.json';

export type BuildKind = 'crit' | 'poison' | 'ignite' | 'frost' | 'tamer' | 'shield';

export interface BuildSpec {
  label: string;
  classType: CharacterType;
  kind: BuildKind;
  equipmentType: 'ATK' | 'DEF' | 'CRIT' | 'POISON';
  petId?: string;
  petLevel?: number;
  offenseWeight: number;
  defenseWeight: number;
}

export interface TargetScenario {
  level: number;
  dungeonId: string;
  dungeon: DungeonConfig;
  equipmentSource: keyof typeof DUNGEON_EQUIPMENT_SETS;
  equipmentSamples: number;
  resolveEnemy?: (floor: number) => EnemyConfig | undefined;
}

export interface BuildState {
  nodes: string[];
  uberNodes: string[];
  stats: Stats;
  mods: CombinedModEffects;
  vitals: { maxHp: number; maxShield: number };
}

export interface CombatScore {
  dps: number;
  directDps: number;
  poisonDps: number;
  igniteDps: number;
  petDps: number;
  defenseScore: number;
  survivalSeconds: number;
  sustainPerSecond: number;
  bossPenaltyNotes: string[];
}

export interface DungeonRequirement {
  dungeonId: string;
  name: string;
  requiredDps: number;
  requiredDefense: number;
  enemyHp: number;
  incomingDps: number;
  enemyEffectiveHp: number;
  enemyHealingDps: number;
  enemyDamageReductionPct: number;
  enemyAtkMultiplier: number;
  playerAtkMultiplier: number;
  playerAttackSpeedMultiplier: number;
}

export function passiveNodeBudget(level: number): number {
  return Math.max(0, level - 1);
}

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

export const builds: BuildSpec[] = [
  { label: 'Warrior Crit', classType: 'warrior', kind: 'crit', equipmentType: 'CRIT', petId: 'pet_void_walker', petLevel: 4, offenseWeight: 1.25, defenseWeight: 0.75 },
  { label: 'Ranger Poison', classType: 'ranger', kind: 'poison', equipmentType: 'POISON', petId: 'pet_forest_witch', petLevel: 4, offenseWeight: 1.15, defenseWeight: 0.85 },
  { label: 'Elementalist Ignite', classType: 'elementalist', kind: 'ignite', equipmentType: 'ATK', petId: 'pet_phoenix', petLevel: 4, offenseWeight: 1.2, defenseWeight: 0.8 },
  { label: 'Frostmage Control', classType: 'frostmage', kind: 'frost', equipmentType: 'DEF', petId: 'pet_ice_dragon', petLevel: 4, offenseWeight: 0.9, defenseWeight: 1.1 },
  { label: 'Tamer Pet', classType: 'tamer', kind: 'tamer', equipmentType: 'DEF', petId: 'pet_end_bringer', petLevel: 6, offenseWeight: 1, defenseWeight: 1 },
  { label: 'Guard Shield', classType: 'warrior', kind: 'shield', equipmentType: 'DEF', petId: 'pet_gargoyle', petLevel: 4, offenseWeight: 0.7, defenseWeight: 1.3 },
];

export function toDungeonConfig(dungeon: typeof dungeonsData.dungeons.grassland): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap((m) => Array(m.spawnRate).fill(m.monsterId)),
    dropTable: allDrops.map((d) => d.itemId),
  };
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = {
      monsterId: (dungeon.boss as { monsterId: string; floor: number }).monsterId,
      floor: (dungeon.boss as { monsterId: string; floor: number }).floor,
    };
  }
  return config;
}

export const targetScenarios: TargetScenario[] = [
  { level: 50, dungeonId: 'hell_gate', dungeon: toDungeonConfig(dungeonsData.dungeons.hell_gate), equipmentSource: 'sky_tower', equipmentSamples: 80 },
  { level: 80, dungeonId: 'final_land', dungeon: toDungeonConfig(dungeonsData.dungeons.final_land), equipmentSource: 'final_land', equipmentSamples: 120 },
  { level: 80, dungeonId: 'uber_goblin_king', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_goblin_king), equipmentSource: 'final_land', equipmentSamples: 120 },
  { level: 80, dungeonId: 'uber_demon_lord', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_demon_lord), equipmentSource: 'final_land', equipmentSamples: 120 },
  { level: 80, dungeonId: 'uber_true_final_boss', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_true_final_boss), equipmentSource: 'final_land', equipmentSamples: 120 },
  { level: 80, dungeonId: 'uber_uber_goblin_king', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_uber_goblin_king), equipmentSource: 'final_land', equipmentSamples: 160 },
  { level: 80, dungeonId: 'uber_uber_bandit_leader', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_uber_bandit_leader), equipmentSource: 'final_land', equipmentSamples: 160 },
  { level: 80, dungeonId: 'uber_uber_kraken', dungeon: toDungeonConfig(dungeonsData.dungeons.uber_uber_kraken), equipmentSource: 'final_land', equipmentSamples: 160 },
  {
    level: 80,
    dungeonId: 'dimensional_rush_full',
    dungeon: {
      id: 'dimensional_rush_full',
      name: '異次元ラッシュ全域',
      maxFloor: 200,
      enemies: [],
      dropTable: [],
      boss: { monsterId: 'true_final_boss', floor: 200 },
    },
    equipmentSource: 'final_land',
    equipmentSamples: 160,
    resolveEnemy: (floor) => getDimensionalRushEnemy(floor, () => 0.5) as EnemyConfig,
  },
];

function equipmentBaseAndIncreased(set: EquipmentSet): {
  base: Stats;
  increased: { hp: number; atk: number; def: number };
} {
  const base = { maxHp: 0, atk: 0, def: 0 };
  const increased = { hp: 0, atk: 0, def: 0 };

  for (const item of Object.values(set) as Array<Item | string>) {
    if (!item || typeof item === 'string') continue;
    base.atk += item.atk;
    base.def += item.def;
    for (const mod of item.mods ?? []) {
      if (mod.type === 'hp_bonus') base.maxHp += mod.value;
      if (mod.type === 'atk_bonus') base.atk += mod.value;
      if (mod.type === 'def_bonus') base.def += mod.value;
      if (mod.type === 'hp_increased_pct') increased.hp += mod.value;
      if (mod.type === 'atk_increased_pct') increased.atk += mod.value;
      if (mod.type === 'def_increased_pct') increased.def += mod.value;
    }
  }

  return { base, increased };
}

export function createBuildState(level: number, spec: BuildSpec, equipment: EquipmentSet, nodes: string[], uberNodes: string[] = []): BuildState {
  setActivePassiveSeason(3);
  setActivePassiveClass(spec.classType);

  const passive = calculatePassiveEffects(nodes);
  const uber = calculateUberTreeEffects(uberNodes);
  const eq = equipmentBaseAndIncreased(equipment);
  const classStats = CLASS_INITIAL_STATS[spec.classType];
  const flatStats: Stats = {
    maxHp: classStats.maxHp + (level - 1) * 5 + passive.hp + uber.hp + eq.base.maxHp,
    atk: classStats.atk + passive.atk + uber.atk + eq.base.atk,
    def: classStats.def + passive.def + uber.def + eq.base.def,
  };

  let stats: Stats = {
    maxHp: applyPercentageScaling(flatStats.maxHp, passive.hp_increased_pct + uber.hp_increased_pct + eq.increased.hp, [...passive.hp_more_pct, ...uber.hp_more_pct]),
    atk: applyPercentageScaling(flatStats.atk, passive.atk_increased_pct + uber.atk_increased_pct + eq.increased.atk, [...passive.atk_more_pct, ...uber.atk_more_pct]),
    def: applyPercentageScaling(flatStats.def, passive.def_increased_pct + uber.def_increased_pct + eq.increased.def, [...passive.def_more_pct, ...uber.def_more_pct]),
  };

  let mods = combineMods(
    [equipment.weapon, equipment.armor, equipment.gloves, equipment.boots, equipment.accessory],
    passive
  );

  mods = {
    ...mods,
    poisonChance: mods.poisonChance + uber.poison_chance,
    poisonDamagePct: mods.poisonDamagePct + uber.poison_damage_pct,
    poisonDamageMorePct: [...mods.poisonDamageMorePct, ...uber.poison_damage_more_pct],
    igniteChance: mods.igniteChance + uber.ignite_chance,
    igniteDamagePct: mods.igniteDamagePct + uber.ignite_damage_pct,
    igniteDamageMorePct: [...mods.igniteDamageMorePct, ...uber.ignite_damage_more_pct],
    criticalChance: mods.criticalChance + uber.critical_chance,
    criticalDamage: mods.criticalDamage + uber.critical_damage,
    hpRegen: mods.hpRegen + uber.hp_regen,
    hpOnHit: mods.hpOnHit + uber.hp_on_hit,
    damageDeferPct: mods.damageDeferPct + uber.damage_defer_pct,
    attackSpeedPct: mods.attackSpeedPct + uber.attack_speed_pct,
    attackSpeedMorePct: [...mods.attackSpeedMorePct, ...uber.attack_speed_more_pct],
    chillChance: mods.chillChance + uber.chill_chance,
    chillEffectPct: mods.chillEffectPct + uber.chill_effect_pct,
    freezeChance: mods.freezeChance + uber.freeze_chance,
    heavyStrike: mods.heavyStrike || uber.heavy_strike,
    defHpToAtk: mods.defHpToAtk || uber.def_hp_to_atk,
    uberCriticalFollowUp: mods.uberCriticalFollowUp || uber.uber_critical_follow_up,
    poisonMultiStack: Math.max(mods.poisonMultiStack, uber.poison_multi_stack),
    igniteIntensify: mods.igniteIntensify || uber.ignite_intensify,
    chillFreezeDamageMult: Math.max(mods.chillFreezeDamageMult, uber.chill_freeze_damage_mult),
  };

  const classAbility = CLASS_ABILITIES[spec.classType];
  mods = {
    ...mods,
    igniteChance: mods.igniteChance + (classAbility.igniteChance ?? 0),
    criticalChance: mods.criticalChance + (classAbility.criticalChance ?? 0),
    attackSpeedPct: mods.attackSpeedPct + (classAbility.attackSpeedPct ?? 0),
    poisonChance: mods.poisonChance + (classAbility.poisonChance ?? 0),
    chillChance: mods.chillChance + (classAbility.chillChance ?? 0),
  };

  if (spec.petId) {
    const pet = (petsData.pets as Record<string, { buff?: Record<string, number> }>)[spec.petId];
    const petFactor =
      (classAbility.petEffectMultiplier ?? 1) *
      getPetLevelFactor(spec.petLevel ?? 1) *
      (1 + mods.petEffectPct / 100);
    if (pet?.buff) {
      stats = {
        maxHp: stats.maxHp + Math.floor((pet.buff.maxHp ?? 0) * petFactor),
        atk: Math.floor(stats.atk * (1 + ((pet.buff.atkIncreasedPct ?? 0) * petFactor) / 100)),
        def: Math.floor(stats.def * (1 + ((pet.buff.defIncreasedPct ?? 0) * petFactor) / 100)),
      };
      mods = applyPetBuff(mods, pet.buff, petFactor);
    }
  }

  if (mods.defHpToAtk) {
    stats = {
      ...stats,
      atk: stats.atk + Math.floor(stats.def + stats.maxHp / 2),
    };
  }

  return {
    nodes,
    uberNodes,
    stats,
    mods,
    vitals: calculateBattleHpAndShield(stats.maxHp, mods),
  };
}

type BossScoreContext = {
  dungeonId?: string;
};

type BossScoreModifiers = {
  playerAtkMult: number;
  playerDefMult: number;
  playerAttackSpeedMult: number;
  playerCritChanceMult: number;
  playerPoisonChanceMult: number;
  playerHealingMult: number;
  playerDamageTakenMult: number;
  enemyAtkMult: number;
  enemyAttackSpeedMult: number;
  enemyDamageReductionPct: number;
  enemyHpOnHitBonus: number;
  enemyRegenMult: number;
  enemyIgniteDamageMult: number;
  enemyFreezeResistPct: number;
  playerChillChanceOnEnemyHit: number;
  playerFreezeChanceOnEnemyHit: number;
  incomingDotDps: number;
  ultimateIncomingDps: number;
  reflectPctOfDirectDps: number;
  notes: string[];
};

function bossScoreModifiers(enemy: EnemyConfig, context?: BossScoreContext): BossScoreModifiers {
  const enemyId = enemy.id;
  const isEndContent = Boolean(context?.dungeonId && isEndContentDungeon(context.dungeonId));
  const baseBossId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  const poison = isEndContent ? getPlayerPoisonFromBoss(enemyId) : null;
  const mods: BossScoreModifiers = {
    playerAtkMult: isEndContent ? getPlayerAtkMultiplier(enemyId) : 1,
    playerDefMult: isEndContent ? getPlayerDefMultiplier(enemyId) : 1,
    playerAttackSpeedMult: isEndContent ? getPlayerAttackSpeedMultiplier(enemyId) : 1,
    playerCritChanceMult: 1,
    playerPoisonChanceMult: 1,
    playerHealingMult: 1,
    playerDamageTakenMult: 1,
    enemyAtkMult: isEndContent ? getEnemyAtkMultiplier(enemyId) : 1,
    enemyAttackSpeedMult: isEndContent ? getEnemyAttackSpeedMultiplier(enemyId) : 1,
    enemyDamageReductionPct: isEndContent ? getEnemyDamageReductionPct(enemyId) : 0,
    enemyHpOnHitBonus: 0,
    enemyRegenMult: 1,
    enemyIgniteDamageMult: 1,
    enemyFreezeResistPct: 0,
    playerChillChanceOnEnemyHit: 0,
    playerFreezeChanceOnEnemyHit: 0,
    incomingDotDps: poison ? poison.damage : 0,
    ultimateIncomingDps: 0,
    reflectPctOfDirectDps: 0,
    notes: [],
  };

  if (!isEndContent) return mods;

  if (baseBossId === 'goblin_king') {
    mods.notes.push('ATK低下');
    if (isUberUberBoss(enemyId)) {
      // UberUberは盾/会心毒低下/ウォーロードが常時。
      mods.enemyDamageReductionPct += 20;
      mods.playerCritChanceMult *= 0.5;
      mods.playerPoisonChanceMult *= 0.5;
      mods.enemyAttackSpeedMult *= 1.3;
      mods.enemyHpOnHitBonus += 500;
      mods.ultimateIncomingDps += enemy.atk * mods.enemyAtkMult * mods.enemyAttackSpeedMult * 0.6;
      mods.notes.push('常時盾/常時会心毒低下/常時加速/常時吸収');
    } else {
      // 3回に1回の盾を平均化。Uberは50%以降に攻撃速度+30%とHP吸収+500。
      mods.enemyDamageReductionPct += 7;
      mods.playerCritChanceMult *= 0.85;
      mods.playerPoisonChanceMult *= 0.85;
    }
    if (uber && !isUberUberBoss(enemyId)) {
      mods.enemyAttackSpeedMult *= 1.15;
      mods.enemyHpOnHitBonus += 250;
      mods.notes.push('盾/会心毒低下/後半加速/吸収');
    }
  }

  if (baseBossId === 'bandit_leader') {
    mods.playerAttackSpeedMult *= isUberUberBoss(enemyId) ? 0.7 : 0.9;
    mods.playerHealingMult *= isUberUberBoss(enemyId) ? 0.75 : uber ? 0.75 : 1;
    if (isUberUberBoss(enemyId)) {
      mods.ultimateIncomingDps += enemy.atk * mods.enemyAtkMult * 0.9;
    }
    mods.notes.push('攻撃速度低下');
  }

  if (baseBossId === 'kraken') {
    mods.playerAttackSpeedMult *= isUberUberBoss(enemyId) ? 0.85 : uber ? 0.9 : 0.95;
    mods.playerDamageTakenMult *= isUberUberBoss(enemyId) ? 1.18 : 1.1;
    mods.playerHealingMult *= 0.9;
    if (isUberUberBoss(enemyId)) {
      mods.enemyAttackSpeedMult *= 1.35;
      mods.enemyIgniteDamageMult *= 2 / 3;
      mods.enemyFreezeResistPct = 70;
      mods.playerChillChanceOnEnemyHit = 20;
      mods.playerFreezeChanceOnEnemyHit = 10;
      mods.ultimateIncomingDps += enemy.atk * mods.enemyAtkMult * mods.enemyAttackSpeedMult * 2.6;
    }
    mods.notes.push('攻撃速度低下/被ダメ増加');
  }

  if (baseBossId === 'demon_lord') {
    // 50%以降の黒炎(+10%軽減)とUber王冠(リジェネ倍化)を戦闘全体へ平均化。
    mods.enemyDamageReductionPct += 5;
    mods.playerHealingMult *= 0.8;
    mods.reflectPctOfDirectDps = 0.025;
    if (uber) mods.enemyRegenMult *= 2;
    mods.notes.push('回復阻害/毒/後半DR/反射');
  }

  if (baseBossId === 'true_final_boss') {
    // 3回に1回のゲージリセットを実効攻撃頻度低下として扱う。
    if (uber) {
      mods.playerAttackSpeedMult *= 0.85;
      mods.notes.push('ゲージリセット');
    }
  }

  return mods;
}

export function scoreCombat(state: BuildState, enemy: EnemyConfig, spec: BuildSpec, context?: BossScoreContext): CombatScore {
  const { stats, mods, vitals } = state;
  const bossMods = bossScoreModifiers(enemy, context);
  const averageTimeStacks = 2;
  const effectiveStats: Stats = {
    maxHp: stats.maxHp,
    atk: Math.floor(stats.atk * bossMods.playerAtkMult * (1 + (mods.timeAtkIncPct * averageTimeStacks) / 100)),
    def: Math.floor(stats.def * bossMods.playerDefMult * (1 + (mods.timeDefIncPct * averageTimeStacks) / 100)),
  };
  const attackSpeed = getAttackSpeedFromMods(mods) * bossMods.playerAttackSpeedMult * (mods.heavyStrike ? 0.8 : 1);
  const attacksPerSecond = 2 * attackSpeed;
  const baseHit = calculateDamage(effectiveStats.atk, enemy.def, bossMods.enemyDamageReductionPct);
  const critChance = Math.min(100, Math.max(0, mods.criticalChance * bossMods.playerCritChanceMult)) / 100;
  const critMultiplier = DEFAULT_BATTLE_CONFIG.baseCriticalMultiplier + mods.criticalDamage / 100;
  const expectedHit = baseHit * (1 + critChance * (critMultiplier - 1));
  const followUpMultiplier =
    1 +
    mods.followUpAttackPct / 100 +
    (mods.criticalFollowUpAttack ? critChance * 0.5 : 0) +
    (mods.uberCriticalFollowUp ? critChance : 0);
  const heavyStrikeWoundMult = mods.heavyStrike ? 1.6 : 1;
  const chillFreezeUptime = Math.min(1, (mods.chillChance / 100) * attacksPerSecond * 3 + (mods.freezeChance / 100) * attacksPerSecond * 1.5);
  const chillFreezeDamageMult = 1 + (mods.chillFreezeDamageMult - 1) * chillFreezeUptime;
  const directDps = mods.noDirectDamage ? 0 : expectedHit * attacksPerSecond * followUpMultiplier * heavyStrikeWoundMult * chillFreezeDamageMult;

  const poisonChance = Math.min(100, Math.max(0, mods.poisonChance * bossMods.playerPoisonChanceMult)) / 100;
  const poisonMaxStacks = Math.max(1, DEFAULT_BATTLE_CONFIG.basePoisonMaxStacks + mods.poisonMaxStacks);
  const poisonHit = Math.max(1, Math.floor(baseHit * DEFAULT_BATTLE_CONFIG.poisonDamageRatio));
  const poisonDamage = Math.floor(poisonHit * (1 + mods.poisonDamagePct / 100) * (1 + mods.poisonDamageMorePct.reduce((a, b) => a + b, 0) / 100));
  const maintainedPoisonStacks = Math.min(poisonMaxStacks, poisonChance * attacksPerSecond * DEFAULT_BATTLE_CONFIG.poisonDuration * mods.poisonMultiStack);
  const poisonDps = poisonDamage * maintainedPoisonStacks * Math.min(2, attackSpeed);

  const igniteChance = Math.min(100, Math.max(0, mods.igniteChance)) / 100;
  const igniteBase = Math.max(1, Math.floor(baseHit * DEFAULT_BATTLE_CONFIG.igniteDamageRatio));
  const igniteDamage = getIgniteDamageFromMods(igniteBase, mods, mods.igniteStackingDamage ? 50 : 0);
  const igniteDurationSec = (DEFAULT_BATTLE_CONFIG.igniteDurationMs * (1 + mods.igniteDurationPct / 100)) / 1000;
  const igniteIntensifyMult = mods.igniteIntensify ? 2 : 1;
  const igniteTickSec = Math.max(0.25, (DEFAULT_BATTLE_CONFIG.igniteTickIntervalMs ?? 1000) / (1000 * igniteIntensifyMult * (1 + mods.igniteTickSpeedPct / 100)));
  const igniteUptime = Math.min(1, igniteChance * attacksPerSecond * igniteDurationSec);
  const igniteDps = igniteDamage * bossMods.enemyIgniteDamageMult * (1 / igniteTickSec) * igniteUptime * (mods.igniteSpread ? 1.15 : 1) * chillFreezeDamageMult;

  const petDps = (spec.kind === 'tamer' ? effectiveStats.atk * attacksPerSecond * (0.18 + mods.petEffectPct / 400) : effectiveStats.atk * attacksPerSecond * (mods.petEffectPct / 1000)) * chillFreezeDamageMult;
  const dps = directDps + poisonDps + igniteDps + petDps;

  const enemyAttackSpeed = (enemy as EnemyConfig & { attackSpeed?: number }).attackSpeed ?? 1;
  const enemyAttacksPerSecond = 2 * enemyAttackSpeed * bossMods.enemyAttackSpeedMult;
  const playerFreezeChance =
    (bossMods.playerFreezeChanceOnEnemyHit / 100) *
    (1 - Math.min(90, mods.freezeResistPct) / 100);
  const playerChillChance =
    (bossMods.playerChillChanceOnEnemyHit / 100) *
    (1 - Math.min(90, mods.chillResistPct) / 100);
  const cleanseRate = mods.autoCleanseIntervalMs > 0 ? 1000 / mods.autoCleanseIntervalMs : 0;
  const playerFreezeUptime = Math.min(
    0.65,
    (enemyAttacksPerSecond * playerFreezeChance * 1.5) / (1 + cleanseRate * 2)
  );
  const playerChillUptime = Math.min(
    0.45,
    (enemyAttacksPerSecond * playerChillChance * 3 * (1 - playerFreezeUptime)) / (1 + cleanseRate)
  );
  const playerControlThroughput = Math.max(0.15, 1 - playerFreezeUptime - playerChillUptime * 0.2);
  const effectiveDirectDps = directDps * playerControlThroughput;
  const effectivePoisonDps = poisonDps * playerControlThroughput;
  const effectiveIgniteDps = igniteDps * playerControlThroughput;
  const effectivePetDps = petDps * playerControlThroughput;
  const effectiveDps = dps * playerControlThroughput;
  const enemyAtk = Math.floor(enemy.atk * bossMods.enemyAtkMult);
  const rawDamageTaken = calculateDamage(enemyAtk, effectiveStats.def, mods.damageReductionPct) * bossMods.playerDamageTakenMult;
  const blockReduction = Math.min(0.5, Math.max(0, mods.blockChance) / 100);
  const repeatedReduction = mods.repeatHitDamageReductionPct > 0 ? mods.repeatHitDamageReductionPct / 300 : 0;
  const lowHpReduction = mods.lowHpDamageReductionPct > 0 ? mods.lowHpDamageReductionPct / 400 : 0;
  const poisonControlReduction =
    mods.poisonDamageReduction > 0
      ? Math.min(0.3, (mods.poisonDamageReduction / 100) * Math.min(1, maintainedPoisonStacks))
      : 0;
  const damageTaken = rawDamageTaken * Math.max(0.05, 1 - blockReduction - repeatedReduction - lowHpReduction - poisonControlReduction);
  const freezeCap = DEFAULT_BATTLE_CONFIG.freezeChanceCap + (mods.freezeChanceCapPct ?? 0);
  const freezeChance =
    (Math.min(freezeCap, Math.max(0, mods.freezeChance)) / 100) *
    (1 - Math.min(90, bossMods.enemyFreezeResistPct) / 100);
  const freezeCanResetUltimate = getBaseBossId(enemy.id) === 'goblin_king' && isUberUberBoss(enemy.id);
  const ultimateWindowSeconds = freezeCanResetUltimate && bossMods.ultimateIncomingDps > 0
    ? Math.max(0.5, 10 / Math.max(0.1, enemyAttacksPerSecond))
    : 0;
  const freezeAttemptsBeforeUltimate = attacksPerSecond * ultimateWindowSeconds;
  const freezeResetChance = ultimateWindowSeconds > 0
    ? 1 - Math.pow(1 - freezeChance, freezeAttemptsBeforeUltimate)
    : 0;
  const freezeCancelCoverage = Math.min(0.75, freezeResetChance);
  const chillControlCoverage = Math.min(
    0.3,
    (mods.chillChance / 100) *
      attacksPerSecond *
      (1 - Math.max(0.5, DEFAULT_BATTLE_CONFIG.chillBaseSpeedMultiplier - mods.chillEffectPct / 100)) *
      0.35
  );
  const statusResistCoverage = Math.min(0.35, (mods.chillResistPct + mods.freezeResistPct) / 300);
  const cleanseCoverage = mods.autoCleanseIntervalMs > 0
    ? Math.min(0.2, 1200 / mods.autoCleanseIntervalMs)
    : 0;
  const ultimateMitigation = Math.min(
    0.9,
    freezeCancelCoverage +
      chillControlCoverage +
      statusResistCoverage +
      cleanseCoverage +
      Math.min(0.25, mods.repeatHitDamageReductionPct / 160) +
      Math.min(0.15, mods.lowHpDamageReductionPct / 200)
  );
  const ultimateIncomingDps = bossMods.ultimateIncomingDps * Math.max(0.1, 1 - ultimateMitigation);
  const incomingDps =
    damageTaken * enemyAttacksPerSecond +
    ultimateIncomingDps +
    bossMods.incomingDotDps +
    effectiveDirectDps * bossMods.reflectPctOfDirectDps;
  const hpRegen = mods.hpToShield ? 0 : mods.hpRegen + mods.timeHpRegen * averageTimeStacks + (vitals.maxHp * mods.hpRegenPct) / 100;
  const hpOnHit = mods.hpToShield ? 0 : mods.hpOnHit * attacksPerSecond;
  const lifesteal =
    (effectiveDps * mods.lifestealPct) / 100 +
    (effectiveDirectDps * mods.critLifestealPct * critChance) / 100 +
    (effectivePoisonDps * mods.poisonLifesteal) / 100 +
    (effectiveIgniteDps * mods.igniteLifesteal) / 100;
  const shieldRecharge = mods.shieldRechargePct > 0 ? (vitals.maxShield * mods.shieldRechargePct) / 100 : 0;
  const shieldOnHit = mods.shieldOn10AttacksPct > 0 ? (vitals.maxShield * mods.shieldOn10AttacksPct) / 100 * (attacksPerSecond / 10) : 0;
  const sustainPerSecond =
    ((hpRegen + hpOnHit + lifesteal) * bossMods.playerHealingMult + shieldRecharge + shieldOnHit) *
    playerControlThroughput;
  const deferPct = Math.min(0.5, Math.max(0, mods.damageDeferPct) / 100);
  const effectivePool = vitals.maxHp + vitals.maxShield * (mods.shieldBlocksDot ? 1 : 0.92) + incomingDps * 4 * deferPct;
  const netIncoming = Math.max(1, incomingDps - sustainPerSecond);
  const survivalSeconds = effectivePool / netIncoming;
  const defenseScore =
    effectivePool +
    sustainPerSecond * 30 +
    Math.min(60, survivalSeconds) * incomingDps +
    incomingDps * 30 * deferPct * 0.6;

  return {
    dps: effectiveDps,
    directDps: effectiveDirectDps,
    poisonDps: effectivePoisonDps,
    igniteDps: effectiveIgniteDps,
    petDps: effectivePetDps,
    defenseScore,
    survivalSeconds,
    sustainPerSecond,
    bossPenaltyNotes: bossMods.notes,
  };
}

export function representativeEnemy(scenario: TargetScenario): EnemyConfig {
  if (scenario.resolveEnemy) {
    return scenario.resolveEnemy(Math.floor(scenario.dungeon.maxFloor * 0.75)) ?? scenario.resolveEnemy(scenario.dungeon.maxFloor)!;
  }
  if (scenario.dungeon.boss) {
    const boss = enemyMap.get(scenario.dungeon.boss.monsterId);
    if (boss) return boss;
  }
  const enemies = scenario.dungeon.enemies.map((id) => enemyMap.get(id)).filter(Boolean) as EnemyConfig[];
  return enemies.reduce((best, enemy) => (enemy.maxHp + enemy.atk > best.maxHp + best.atk ? enemy : best), enemies[0]);
}

export function dungeonRequirement(dungeon: DungeonConfig, resolveEnemy?: (floor: number) => EnemyConfig | undefined): DungeonRequirement {
  const enemies: EnemyConfig[] = [];
  if (resolveEnemy) {
    for (const floor of [1, 20, 40, 60, 80, 100, 150, 200].filter((f) => f <= dungeon.maxFloor)) {
      const enemy = resolveEnemy(floor);
      if (enemy) enemies.push(enemy);
    }
  } else {
    for (const id of new Set(dungeon.enemies)) {
      const enemy = enemyMap.get(id);
      if (enemy) enemies.push(enemy);
    }
    if (dungeon.boss) {
      const boss = enemyMap.get(dungeon.boss.monsterId);
      if (boss) enemies.push(boss);
    }
  }

  if (enemies.length === 0) {
    throw new Error(`No representative enemy for dungeon: ${dungeon.id}`);
  }

  const keyEnemy = enemies.reduce((best, enemy) => {
    const score = enemy.maxHp * 0.65 + enemy.atk * 5 + enemy.def * 2;
    const bestScore = best.maxHp * 0.65 + best.atk * 5 + best.def * 2;
    return score > bestScore ? enemy : best;
  }, enemies[0]);
  const targetKillSeconds = dungeon.maxFloor >= 100 ? 18 : dungeon.boss ? 12 : 8;
  const targetSurvivalSeconds = dungeon.maxFloor >= 100 ? 30 : dungeon.boss ? 22 : 16;
  const isEndContent = isEndContentDungeon(dungeon.id);
  const enemyId = keyEnemy.id;
  const bossMods = bossScoreModifiers(keyEnemy, { dungeonId: dungeon.id });
  const damageReductionPct = bossMods.enemyDamageReductionPct;
  const damageReductionMultiplier = Math.max(0.05, 1 - damageReductionPct / 100);
  const enemyAttackSpeed =
    ((keyEnemy as EnemyConfig & { attackSpeed?: number }).attackSpeed ?? 1) *
    bossMods.enemyAttackSpeedMult;
  const enemyAttacksPerSecond = 2 * enemyAttackSpeed;
  let enemyRegenPerSecond = isEndContent ? getEnemyRegenPerSecond(enemyId) : 0;
  enemyRegenPerSecond *= bossMods.enemyRegenMult;
  const enemyHpOnHitPerSecond = isEndContent ? (getEnemyHpOnHit(enemyId) + bossMods.enemyHpOnHitBonus) * enemyAttacksPerSecond : 0;
  const enemyHealingDps = enemyRegenPerSecond + enemyHpOnHitPerSecond;
  const enemyEffectiveHp = (keyEnemy.maxHp + keyEnemy.def * 2) / damageReductionMultiplier;
  const incomingDps =
    keyEnemy.atk *
    bossMods.enemyAtkMult *
    enemyAttacksPerSecond *
    bossMods.playerDamageTakenMult +
    bossMods.ultimateIncomingDps +
    bossMods.incomingDotDps;

  return {
    dungeonId: dungeon.id,
    name: dungeon.name,
    requiredDps: Math.ceil(enemyEffectiveHp / targetKillSeconds + enemyHealingDps),
    requiredDefense: Math.ceil(incomingDps * targetSurvivalSeconds),
    enemyHp: keyEnemy.maxHp,
    incomingDps: Math.ceil(incomingDps),
    enemyEffectiveHp: Math.ceil(enemyEffectiveHp),
    enemyHealingDps: Math.ceil(enemyHealingDps),
    enemyDamageReductionPct: damageReductionPct,
    enemyAtkMultiplier: bossMods.enemyAtkMult,
    playerAtkMultiplier: bossMods.playerAtkMult,
    playerAttackSpeedMultiplier: bossMods.playerAttackSpeedMult,
  };
}

export function objectiveScore(combat: CombatScore, req: DungeonRequirement, spec: BuildSpec): number {
  const offenseRatio = combat.dps / Math.max(1, req.requiredDps);
  const defenseRatio = combat.defenseScore / Math.max(1, req.requiredDefense);
  const cappedOffense = Math.min(3, offenseRatio);
  const cappedDefense = Math.min(3, defenseRatio);
  return cappedOffense * spec.offenseWeight + cappedDefense * spec.defenseWeight + Math.min(1, combat.survivalSeconds / 30) * 0.2;
}

export function explorePassivePath(
  scenario: TargetScenario,
  spec: BuildSpec,
  equipment: EquipmentSet,
  req: DungeonRequirement,
  beamWidth = 60
): { state: BuildState; combat: CombatScore; score: number } {
  setActivePassiveSeason(3);
  setActivePassiveClass(spec.classType);

  const enemy = representativeEnemy(scenario);
  const budget = passiveNodeBudget(scenario.level);
  let beam = [{ nodes: [] as string[], score: 0, combat: undefined as CombatScore | undefined }];

  for (let step = 0; step < budget; step++) {
    const next = new Map<string, { nodes: string[]; score: number; combat: CombatScore }>();
    for (const candidate of beam) {
      const unlockable = getUnlockableNodes(candidate.nodes).filter((node) => !candidate.nodes.includes(node.id));
      for (const node of unlockable) {
        const nodes = [...candidate.nodes, node.id];
        const key = nodes.slice().sort().join(',');
        if (next.has(key)) continue;
        const state = createBuildState(scenario.level, spec, equipment, nodes);
        const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
        const score = objectiveScore(combat, req, spec);
        next.set(key, { nodes, score, combat });
      }
    }
    beam = [...next.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth);
    if (beam.length === 0) break;
  }

  const best = beam[0];
  const state = createBuildState(scenario.level, spec, equipment, best.nodes);
  const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
  return { state, combat, score: objectiveScore(combat, req, spec) };
}

export function chooseEquipmentForExplorer(scenario: TargetScenario, spec: BuildSpec, req: DungeonRequirement): EquipmentSet {
  const startNode = (() => {
    setActivePassiveSeason(3);
    setActivePassiveClass(spec.classType);
    return getStartNodeId();
  })();
  const budget = passiveNodeBudget(scenario.level);
  let best = DUNGEON_EQUIPMENT_SETS[scenario.equipmentSource].sets[spec.equipmentType];
  let bestScore = -Infinity;
  const enemy = representativeEnemy(scenario);

  for (let i = -1; i < scenario.equipmentSamples; i++) {
    const equipment = i < 0
      ? best
      : generateRandomEquipmentSet(`${scenario.dungeonId}-${spec.kind}-${i}`, scenario.equipmentSource, scenario.equipmentSource);
    const state = createBuildState(scenario.level, spec, equipment, budget > 0 ? [startNode] : []);
    const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
    const score = objectiveScore(combat, req, spec);
    if (score > bestScore) {
      best = equipment;
      bestScore = score;
    }
  }

  return best;
}

export function summarizeNodes(nodes: string[]): string {
  const notable = nodes
    .map((id) => getPassiveNode(id))
    .filter((node): node is PassiveNode => {
      if (!node) return false;
      return node.nodeType === 'notable' || node.nodeType === 'keystone';
    })
    .map((node) => node.name);
  return notable.slice(-7).join(' / ');
}

export function fmt(value: number): string {
  return Math.round(value).toLocaleString('ja-JP');
}

function allRequirementTargets(): Array<{ dungeon: DungeonConfig; resolveEnemy?: (floor: number) => EnemyConfig | undefined }> {
  const standard = Object.values(dungeonsData.dungeons)
    .filter((dungeon) => !dungeon.id.startsWith('debug_'))
    .filter((dungeon) => dungeon.monsters.length > 0 || ('boss' in dungeon && Boolean(dungeon.boss)))
    .map((dungeon) => ({ dungeon: toDungeonConfig(dungeon as typeof dungeonsData.dungeons.grassland) }));
  return [
    ...standard,
    {
      dungeon: {
        id: 'dimensional_rush_full',
        name: '異次元ラッシュ全域',
        maxFloor: 200,
        enemies: [],
        dropTable: [],
      },
      resolveEnemy: (floor: number) => getDimensionalRushEnemy(floor, () => 0.5) as EnemyConfig,
    },
  ];
}

function main(): void {
  console.log('S3 パッシブツリー取得探索スコア');
  console.log('DPS: 攻撃速度/クリティカル/毒/発火/ペットを近似加算');
  console.log('防御: HP/シールド/ブロック/回復/吸収/ダメージ遅延/軽減を生存秒と防御スコアに変換');
  console.log('');

  console.log('## ダンジョン要求値');
  console.log('Dungeon | 必要DPS | 必要防御 | 代表HP | 代表被DPS');
  console.log('---|---:|---:|---:|---:');
  for (const target of allRequirementTargets()) {
    const req = dungeonRequirement(target.dungeon, target.resolveEnemy);
    console.log(`${req.name} | ${fmt(req.requiredDps)} | ${fmt(req.requiredDefense)} | ${fmt(req.enemyHp)} | ${fmt(req.incomingDps)}`);
  }
  console.log('');

  for (const scenario of targetScenarios) {
    const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
    console.log(`## Lv${scenario.level} ${scenario.dungeon.name} 探索`);
    console.log('Build | Score | DPS/Req | Def/Req | 生存秒 | DPS内訳 | HP/Shield | ATK/DEF | 主な取得ノード');
    console.log('---|---:|---:|---:|---:|---|---:|---:|---');
    for (const spec of builds) {
      const equipment = chooseEquipmentForExplorer(scenario, spec, req);
      const result = explorePassivePath(scenario, spec, equipment, req);
      const dpsRatio = result.combat.dps / req.requiredDps;
      const defRatio = result.combat.defenseScore / req.requiredDefense;
      const breakdown = [
        `直${fmt(result.combat.directDps)}`,
        `毒${fmt(result.combat.poisonDps)}`,
        `火${fmt(result.combat.igniteDps)}`,
        `Pet${fmt(result.combat.petDps)}`,
      ].join(' ');
      console.log([
        spec.label,
        result.score.toFixed(2),
        `${dpsRatio.toFixed(2)}x`,
        `${defRatio.toFixed(2)}x`,
        result.combat.survivalSeconds.toFixed(1),
        breakdown,
        `${fmt(result.state.vitals.maxHp)}/${fmt(result.state.vitals.maxShield)}`,
        `${fmt(result.state.stats.atk)}/${fmt(result.state.stats.def)}`,
        summarizeNodes(result.state.nodes),
      ].join(' | '));
    }
    console.log('');
  }
}

if (require.main === module) {
  main();
}
