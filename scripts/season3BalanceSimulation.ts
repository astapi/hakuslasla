import {
  applyPercentageScaling,
  applyPetBuff,
  calculateBattleHpAndShield,
  combineMods,
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  generateRandomEquipmentSet,
  runGaugeSimulation,
} from '../core';
import { CLASS_ABILITIES, CLASS_INITIAL_STATS } from '../core/player';
import { getPetLevelFactor } from '../data/pets';
import {
  calculatePassiveEffects,
  getPassiveNode,
  getStartNodeId,
  getUnlockableNodes,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../data/passiveTree';
import { getDimensionalRushEnemy } from '../data/endContents';
import type {
  CharacterType,
  EquipmentSlot,
  Item,
  PassiveEffect,
} from '../types';
import type { CombinedModEffects, DungeonConfig, EnemyConfig, Stats } from '../core/types';

import dungeonsData from '../data/json/dungeons.json';
import monstersData from '../data/json/monsters.json';
import petsData from '../data/json/pets.json';

type BuildKind = 'crit' | 'poison' | 'ignite' | 'frost' | 'tamer' | 'shield';

interface BuildSpec {
  label: string;
  classType: CharacterType;
  kind: BuildKind;
  equipmentType: 'ATK' | 'DEF' | 'CRIT' | 'POISON';
  petId?: string;
  petLevel?: number;
}

interface LevelScenario {
  level: number;
  dungeonId: string;
  dungeon: DungeonConfig;
  equipmentSource: keyof typeof DUNGEON_EQUIPMENT_SETS;
  equipmentSamples: number;
  runs: number;
  seed: number;
  resolveEnemyForFloor?: (floor: number, rng: () => number) => EnemyConfig | undefined;
}

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

function toDungeonConfig(dungeon: typeof dungeonsData.dungeons.grassland): DungeonConfig {
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

const dimensionalRushFull: DungeonConfig = {
  id: 'dimensional_rush_full',
  name: '異次元ラッシュ全域',
  maxFloor: 200,
  enemies: [],
  dropTable: [],
  boss: { monsterId: 'true_final_boss', floor: 200 },
};

const scenarios: LevelScenario[] = [
  {
    level: 50,
    dungeonId: 'hell_gate',
    dungeon: toDungeonConfig(dungeonsData.dungeons.hell_gate),
    equipmentSource: 'sky_tower',
    equipmentSamples: 80,
    runs: 30,
    seed: 503,
  },
  {
    level: 60,
    dungeonId: 'final_land',
    dungeon: toDungeonConfig(dungeonsData.dungeons.final_land),
    equipmentSource: 'final_land',
    equipmentSamples: 140,
    runs: 30,
    seed: 603,
  },
  {
    level: 80,
    dungeonId: 'dimensional_rush_full',
    dungeon: dimensionalRushFull,
    equipmentSource: 'final_land',
    equipmentSamples: 220,
    runs: 20,
    seed: 803,
    resolveEnemyForFloor: (floor, rng) => getDimensionalRushEnemy(floor, rng) as EnemyConfig,
  },
];

const builds: BuildSpec[] = [
  { label: 'Warrior Crit', classType: 'warrior', kind: 'crit', equipmentType: 'CRIT', petId: 'pet_void_walker', petLevel: 4 },
  { label: 'Ranger Poison', classType: 'ranger', kind: 'poison', equipmentType: 'POISON', petId: 'pet_forest_witch', petLevel: 4 },
  { label: 'Elementalist Ignite', classType: 'elementalist', kind: 'ignite', equipmentType: 'ATK', petId: 'pet_phoenix', petLevel: 4 },
  { label: 'Frostmage Control', classType: 'frostmage', kind: 'frost', equipmentType: 'DEF', petId: 'pet_ice_dragon', petLevel: 4 },
  { label: 'Tamer Pet', classType: 'tamer', kind: 'tamer', equipmentType: 'DEF', petId: 'pet_end_bringer', petLevel: 6 },
  { label: 'Guard Shield', classType: 'warrior', kind: 'shield', equipmentType: 'DEF', petId: 'pet_gargoyle', petLevel: 4 },
];

function n(v: number | undefined): number {
  return v ?? 0;
}

function b(v: boolean | undefined): number {
  return v ? 1 : 0;
}

function effectScore(effect: PassiveEffect, kind: BuildKind): number {
  const generic =
    n(effect.hp) * 0.12 +
    n(effect.atk) * 0.28 +
    n(effect.def) * 0.18 +
    n(effect.hp_increased_pct) * 1.2 +
    n(effect.atk_increased_pct) * 1.5 +
    n(effect.def_increased_pct) * 1.2 +
    n(effect.hp_more_pct) * 5 +
    n(effect.atk_more_pct) * 6 +
    n(effect.def_more_pct) * 5 +
    n(effect.block_chance) * 8 +
    n(effect.repeat_hit_damage_reduction_pct) * 5 +
    n(effect.low_hp_damage_reduction_pct) * 4 +
    (n(effect.auto_cleanse_interval_ms) > 0 ? 80 : 0);

  switch (kind) {
    case 'crit':
      return generic +
        n(effect.critical_chance) * 24 +
        n(effect.critical_damage) * 3 +
        n(effect.attack_speed_pct) * 7 +
        n(effect.attack_speed_more_pct) * 14 +
        n(effect.hp_on_crit) * 0.35 +
        n(effect.critical_lifesteal_pct) * 7;
    case 'poison':
      return generic +
        n(effect.poison_chance) * 18 +
        n(effect.poison_damage_pct) * 5 +
        n(effect.poison_damage_more_pct) * 16 +
        n(effect.poison_max_stacks) * 90 +
        n(effect.poison_lifesteal) * 5 +
        n(effect.poison_resist_pct) * 5 +
        b(effect.no_direct_damage) * 140 +
        b(effect.shield_blocks_dot) * 90;
    case 'ignite':
      return generic +
        n(effect.ignite_chance) * 18 +
        n(effect.ignite_damage_pct) * 5 +
        n(effect.ignite_damage_more_pct) * 16 +
        n(effect.ignite_duration_pct) * 2 +
        n(effect.ignite_lifesteal) * 5 +
        b(effect.ignite_spread) * 100 +
        b(effect.ignite_stacking_damage) * 90;
    case 'frost':
      return generic +
        n(effect.chill_chance) * 14 +
        n(effect.chill_effect_pct) * 8 +
        n(effect.chill_duration_pct) * 2 +
        n(effect.freeze_chance) * 35 +
        n(effect.freeze_duration_pct) * 5 +
        n(effect.chill_resist_pct) * 5 +
        n(effect.freeze_resist_pct) * 7;
    case 'tamer':
      return generic +
        n(effect.pet_effect_pct) * 22 +
        n(effect.pet_drop_rate_pct) * 500 +
        n(effect.hp_on_hit) * 2 +
        n(effect.hp_regen) * 0.25 +
        n(effect.attack_speed_pct) * 5;
    case 'shield':
      return generic +
        n(effect.shield) * 0.3 +
        n(effect.shield_increased_pct) * 8 +
        n(effect.shield_more_pct) * 14 +
        b(effect.hp_to_shield) * 250 +
        n(effect.shield_on_10_attacks_pct) * 10 +
        n(effect.shield_recharge_pct) * 12 +
        (n(effect.shield_recharge_delay_ms) > 0 ? 90 : 0) +
        b(effect.shield_blocks_dot) * 90 +
        n(effect.poison_resist_pct) * 5 +
        n(effect.freeze_resist_pct) * 5;
  }
}

function buildNodes(classType: CharacterType, kind: BuildKind, budget: number): string[] {
  setActivePassiveSeason(3);
  setActivePassiveClass(classType);
  const unlocked: string[] = [];
  while (unlocked.length < budget) {
    const unlockable = getUnlockableNodes(unlocked).filter((node) => !unlocked.includes(node.id));
    if (unlockable.length === 0) break;
    unlockable.sort((a, bNode) => {
      const diff = effectScore(bNode.effect, kind) - effectScore(a.effect, kind);
      return diff !== 0 ? diff : a.id.localeCompare(bNode.id);
    });
    unlocked.push(unlockable[0].id);
  }
  return unlocked;
}

function equipmentBaseAndMods(set: EquipmentSet): {
  base: Stats;
  inc: { hp: number; atk: number; def: number };
} {
  const base = { maxHp: 0, atk: 0, def: 0 };
  const inc = { hp: 0, atk: 0, def: 0 };
  for (const item of Object.values(set) as Array<Item | string>) {
    if (!item || typeof item === 'string') continue;
    base.atk += item.atk;
    base.def += item.def;
    for (const mod of item.mods ?? []) {
      if (mod.type === 'atk_bonus') base.atk += mod.value;
      if (mod.type === 'def_bonus') base.def += mod.value;
      if (mod.type === 'hp_bonus') base.maxHp += mod.value;
      if (mod.type === 'atk_increased_pct') inc.atk += mod.value;
      if (mod.type === 'def_increased_pct') inc.def += mod.value;
      if (mod.type === 'hp_increased_pct') inc.hp += mod.value;
    }
  }
  return { base, inc };
}

function createBuildState(level: number, spec: BuildSpec, equipment: EquipmentSet): {
  nodes: string[];
  stats: Stats;
  mods: CombinedModEffects;
  vitals: { maxHp: number; maxShield: number };
} {
  const nodeBudget = Math.max(0, level - 1);
  const nodes = buildNodes(spec.classType, spec.kind, nodeBudget);
  const passive = calculatePassiveEffects(nodes);
  const eq = equipmentBaseAndMods(equipment);
  const classStats = CLASS_INITIAL_STATS[spec.classType];
  const flatStats: Stats = {
    maxHp: classStats.maxHp + (level - 1) * 5 + passive.hp + eq.base.maxHp,
    atk: classStats.atk + passive.atk + eq.base.atk,
    def: classStats.def + passive.def + eq.base.def,
  };

  let stats: Stats = {
    maxHp: applyPercentageScaling(flatStats.maxHp, passive.hp_increased_pct + eq.inc.hp, passive.hp_more_pct),
    atk: applyPercentageScaling(flatStats.atk, passive.atk_increased_pct + eq.inc.atk, passive.atk_more_pct),
    def: applyPercentageScaling(flatStats.def, passive.def_increased_pct + eq.inc.def, passive.def_more_pct),
  };

  let mods = combineMods(
    [equipment.weapon, equipment.armor, equipment.gloves, equipment.boots, equipment.accessory],
    passive
  );
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
      (CLASS_ABILITIES[spec.classType].petEffectMultiplier ?? 1) *
      getPetLevelFactor(spec.petLevel ?? 1) *
      (1 + mods.petEffectPct / 100);
    if (pet?.buff) {
      stats = {
        ...stats,
        maxHp: stats.maxHp + Math.floor((pet.buff.maxHp ?? 0) * petFactor),
        atk: Math.floor(stats.atk * (1 + ((pet.buff.atkIncreasedPct ?? 0) * petFactor) / 100)),
        def: Math.floor(stats.def * (1 + ((pet.buff.defIncreasedPct ?? 0) * petFactor) / 100)),
      };
      mods = applyPetBuff(mods, pet.buff, petFactor);
    }
  }

  return {
    nodes,
    stats,
    mods,
    vitals: calculateBattleHpAndShield(stats.maxHp, mods),
  };
}

function buildPowerScore(state: ReturnType<typeof createBuildState>, kind: BuildKind): number {
  const { stats, mods, vitals } = state;
  const base =
    vitals.maxHp * 1.2 +
    vitals.maxShield * 0.9 +
    stats.atk * 3.5 +
    stats.def * 2.2 +
    mods.blockChance * 30 +
    Math.min(50, mods.blockChance) * 8 +
    mods.repeatHitDamageReductionPct * 18 +
    mods.lowHpDamageReductionPct * 14 +
    mods.chillResistPct * 4 +
    mods.freezeResistPct * 6;

  const offense = {
    crit: mods.criticalChance * 90 + mods.criticalDamage * 9 + mods.attackSpeedPct * 18,
    poison: mods.poisonChance * 65 + mods.poisonDamagePct * 18 + mods.poisonDamageMorePct.reduce((a, b) => a + b, 0) * 45 + mods.poisonMaxStacks * 250,
    ignite: mods.igniteChance * 65 + mods.igniteDamagePct * 18 + mods.igniteDamageMorePct.reduce((a, b) => a + b, 0) * 45,
    frost: mods.chillChance * 35 + mods.chillEffectPct * 25 + mods.freezeChance * 140 + mods.freezeDurationPct * 15,
    tamer: mods.petEffectPct * 65 + stats.atk * 2 + mods.attackSpeedPct * 16,
    shield: vitals.maxShield * 1.5 + mods.shieldRechargePct * 45 + mods.shieldOn10AttacksPct * 40,
  } satisfies Record<BuildKind, number>;

  return base + offense[kind];
}

function chooseRealisticEquipment(scenario: LevelScenario, spec: BuildSpec, nodesLevel: number): {
  equipment: EquipmentSet;
  state: ReturnType<typeof createBuildState>;
} {
  let bestEquipment = DUNGEON_EQUIPMENT_SETS[scenario.equipmentSource].sets[spec.equipmentType];
  let bestState = createBuildState(nodesLevel, spec, bestEquipment);
  let bestScore = buildPowerScore(bestState, spec.kind);

  for (let i = 0; i < scenario.equipmentSamples; i++) {
    const candidate = generateRandomEquipmentSet(
      `${scenario.equipmentSource}-${spec.kind}-${i}`,
      scenario.equipmentSource,
      scenario.equipmentSource
    );
    const state = createBuildState(nodesLevel, spec, candidate);
    const score = buildPowerScore(state, spec.kind);
    if (score > bestScore) {
      bestEquipment = candidate;
      bestState = state;
      bestScore = score;
    }
  }

  return { equipment: bestEquipment, state: bestState };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function summarizeNodes(nodes: string[]): string {
  const notable = nodes
    .map((id) => getPassiveNode(id))
    .filter((node) => node && (node.nodeType === 'notable' || node.nodeType === 'keystone'))
    .map((node) => node!.name);
  return notable.slice(-5).join('/');
}

console.log('S3 Lv50/Lv60/Lv80 バランスシミュレーション');
console.log('nodeBudget = level - 1（ゲーム本体のSP数。スタートノードも1SP消費）');
console.log('実プレイ寄せ: ランダムMOD装備を複数生成してビルド別に採用、各ビルドにペット、テイマーはLv6ペット');
console.log('');

for (const scenario of scenarios) {
  console.log(`## Lv${scenario.level} / ${scenario.dungeonId} / 装備:${scenario.equipmentSource}`);
  console.log('Build | 勝率 | 平均階層 | 平均秒 | HP/Shield | ATK/DEF | 主要防御 | 主な取得ノード');
  console.log('---|---:|---:|---:|---:|---:|---|---');
  for (const build of builds) {
    const { state } = chooseRealisticEquipment(scenario, build, scenario.level);
    const result = runGaugeSimulation(
      {
        playerStats: state.stats,
        modEffects: state.mods,
        dungeonId: scenario.dungeonId,
        runs: scenario.runs,
        seed: scenario.seed + build.label.length * 17,
        resolveEnemyForFloor: scenario.resolveEnemyForFloor,
      },
      scenario.dungeon,
      enemyMap
    );
    const s = result.stats;
    const defense = [
      `Blk ${Math.min(50, state.mods.blockChance).toFixed(0)}`,
      `Ch/Fz ${state.mods.chillResistPct.toFixed(0)}/${state.mods.freezeResistPct.toFixed(0)}`,
      `Rep ${state.mods.repeatHitDamageReductionPct.toFixed(0)}`,
      `Pet ${state.mods.petEffectPct.toFixed(0)}`,
    ].join(' ');
    console.log([
      build.label,
      formatPct(s.winRate),
      s.avgFloorsCleared.toFixed(1),
      s.avgSeconds.toFixed(1),
      `${state.vitals.maxHp}/${state.vitals.maxShield}`,
      `${state.stats.atk}/${state.stats.def}`,
      defense,
      summarizeNodes(state.nodes),
    ].join(' | '));
  }
  console.log('');
}
