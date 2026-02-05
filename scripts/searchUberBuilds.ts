/**
 * Uberボス向けビルド探索（Lv60想定）
 * - パッシブ: ランダム取得（解放条件準拠）
 * - 装備MOD: T1〜T3のみ、各装備4MOD固定、T1を必ず1つ含む
 * - 目的: uber_true_final_boss以外で勝率85%+ / uber_true_final_bossで勝率50%前後
 *
 * 使用方法:
 *   npx tsx scripts/searchUberBuilds.ts [iterations] [runs] [seed] [targetBoss] [mutations] [pool]
 *
 * 例:
 *   npx tsx scripts/searchUberBuilds.ts 2000 200 12345
 */

import {
  runGaugeSimulation,
} from '../core/simulation';
import { EnemyConfig, DungeonConfig } from '../core/types';
import { DEFAULT_BATTLE_CONFIG } from '../core/types';
import {
  INITIAL_STATS,
  calculateBaseStatsForLevel,
} from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects, getUnlockableNodes } from '../data/passiveTree';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';
import modsData from '../data/json/mods.json';
import itemsData from '../data/json/items.json';

// ========================================
// 設定
// ========================================

const args = process.argv.slice(2);
const iterations = args[0] ? parseInt(args[0], 10) : 2000;
const runs = args[1] ? parseInt(args[1], 10) : 200;
const seed = args[2] ? parseInt(args[2], 10) : 12345;
const targetBoss = (args[3] as typeof uberBossIds[number]) ?? 'uber_true_final_boss';
const mutations = args[4] ? parseInt(args[4], 10) : 2000;
const poolSize = args[5] ? parseInt(args[5], 10) : 30;
const level = 60;
const STRATEGY = process.env.SEARCH_STRATEGY ?? 'balanced';

const uberBossIds = [
  'uber_goblin_king',
  'uber_bandit_leader',
  'uber_vampire',
  'uber_kraken',
  'uber_demon_lord',
  'uber_true_final_boss',
] as const;

// ========================================
// 型
// ========================================

type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';

type ModTierConfig = Record<string, { min: number; max: number }>;

type ModConfig = {
  type: string;
  weight: number;
  tiers: ModTierConfig;
  slotTiers?: Record<EquipmentSlot, ModTierConfig>;
  slots?: EquipmentSlot[];
};

type ItemMod = { type: string; value: number; tier: number };

type Item = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  atk: number;
  def: number;
  instanceId: string;
  mods: ItemMod[];
};

type Equipment = {
  weapon: Item | null;
  armor: Item | null;
  gloves: Item | null;
  boots: Item | null;
  accessory: Item | null;
};

// ========================================
// 乱数
// ========================================

function createRng(seedValue: number): () => number {
  let state = seedValue;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function pickRandom<T>(array: T[], rng: () => number): T {
  const index = Math.floor(rng() * array.length);
  return array[index];
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

// ========================================
// データ準備
// ========================================

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries((monstersData as any).monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

function toDungeonConfig(dungeon: any): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap((m: any) => Array(m.spawnRate).fill(m.monsterId)),
    dropTable: allDrops.map((d: any) => d.itemId),
  };
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = { monsterId: dungeon.boss.monsterId, floor: dungeon.boss.floor };
  }
  return config;
}

const dungeonConfigs: Record<string, DungeonConfig> = {};
for (const id of uberBossIds) {
  dungeonConfigs[id] = toDungeonConfig((dungeonsData as any).dungeons[id]);
}

const modConfigs: ModConfig[] = (modsData as { modConfigs: ModConfig[] }).modConfigs;
const ALLOWED_TIERS = new Set([1, 2, 3]);
const REQUIRE_T1 = false;

const BASE_MOD_WEIGHT_MULTIPLIER: Record<string, number> = {
  atk_bonus: 2.5,
  atk_increased_pct: 2.5,
  critical_chance: 2.5,
  critical_damage: 2.5,
  attack_speed_pct: 2.5,
  poison_chance: 2.0,
  lifesteal: 2.0,
  damage_reduction_pct: 2.0,
  hp_regen: 1.5,
  hp_regen_pct: 1.5,
  hp_bonus: 1.2,
  def_bonus: 1.2,
  def_increased_pct: 1.2,
  hp_increased_pct: 1.2,
};

const MOD_WEIGHT_MULTIPLIER: Record<string, number> = STRATEGY === 'tank_time_atk'
  ? {
      ...BASE_MOD_WEIGHT_MULTIPLIER,
      hp_bonus: 2.8,
      def_bonus: 2.8,
      def_increased_pct: 2.6,
      hp_increased_pct: 2.4,
      hp_regen: 3.2,
      hp_regen_pct: 3.2,
      damage_reduction_pct: 2.8,
      atk_bonus: 1.2,
      atk_increased_pct: 1.0,
      critical_chance: 0.6,
      critical_damage: 0.6,
      poison_chance: 0.4,
      attack_speed_pct: 1.4,
    }
  : BASE_MOD_WEIGHT_MULTIPLIER;

const FINAL_LAND_BASE_STATS = {
  weapon: { id: 'apocalypse_blade', name: '終焉の剣', atk: 220, def: 0 },
  armor: { id: 'end_armor', name: '終末の鎧', atk: 0, def: 180 },
  gloves: { id: 'titan_gauntlets', name: '泰坦の篭手', atk: 70, def: 80 },
  boots: { id: 'end_walker_boots', name: '終末を歩む者のブーツ', atk: 48, def: 120 },
  accessory: { id: 'oblivion_ring', name: '忘却の指輪', atk: 88, def: 88 },
} as const;

const FINAL_LAND_ACCESSORY_IDS = new Set(
  [
    ...(dungeonsData as any).dungeons.final_land.dropTable.common,
    ...(dungeonsData as any).dungeons.final_land.dropTable.dungeon,
  ].map((entry: any) => entry.itemId)
);

type ItemBaseLite = { id: string; name: string; slot: EquipmentSlot; atk: number; def: number; fixedMods?: ItemMod[] };

const ALL_ITEMS = Object.values((itemsData as any).items).filter(
  (item: any) => item && typeof item.id === 'string'
) as ItemBaseLite[];
const UBER_UNIQUES = ALL_ITEMS.filter((item) =>
  item.id.startsWith('uber_')
  && !item.id.startsWith('uber_end')
  && item.id !== 'uber_crown_of_end'
);

const UNIQUE_BY_SLOT: Record<EquipmentSlot, ItemBaseLite[]> = {
  weapon: [],
  armor: [],
  gloves: [],
  boots: [],
  accessory: [],
};

for (const item of UBER_UNIQUES) {
  UNIQUE_BY_SLOT[item.slot].push(item);
}

const FINAL_LAND_ACCESSORIES = ALL_ITEMS.filter(
  (item) => item.slot === 'accessory' && FINAL_LAND_ACCESSORY_IDS.has(item.id)
);

const ALL_ACCESSORIES = [
  ...FINAL_LAND_ACCESSORIES,
  ...UNIQUE_BY_SLOT.accessory,
];

const REQUIRE_TIME_ATK = process.env.REQUIRE_TIME_ATK === '1' || STRATEGY === 'tank_time_atk';

// ========================================
// 装備生成
// ========================================

function getTierConfigForSlot(config: ModConfig, slot: EquipmentSlot): ModTierConfig {
  return (config.slotTiers && config.slotTiers[slot]) || config.tiers;
}

function getAvailableTiers(config: ModConfig, slot: EquipmentSlot): number[] {
  const tiers = Object.keys(getTierConfigForSlot(config, slot)).map((t) => parseInt(t, 10));
  return tiers.filter((t) => ALLOWED_TIERS.has(t));
}

function generateRandomModsForSlot(
  rng: () => number,
  count: number,
  slot: EquipmentSlot
): ItemMod[] {
  const mods: ItemMod[] = [];

  const availableConfigs = modConfigs.filter((config) => {
    if (config.slots && !config.slots.includes(slot)) return false;
    return getAvailableTiers(config, slot).length > 0;
  });

  if (availableConfigs.length === 0) return mods;

  const totalWeight = availableConfigs.reduce((sum, config) => {
    const mult = MOD_WEIGHT_MULTIPLIER[config.type] ?? 1;
    return sum + config.weight * mult;
  }, 0);
  const usedTypes = new Set<string>();

  // T1を最低1つ保証
  let t1Added = false;
  for (let i = 0; i < count; i++) {
    let selected: ModConfig | null = null;

    for (let tries = 0; tries < 20; tries++) {
      let random = rng() * totalWeight;
      for (const config of availableConfigs) {
        const mult = MOD_WEIGHT_MULTIPLIER[config.type] ?? 1;
        random -= config.weight * mult;
        if (random <= 0) {
          selected = config;
          break;
        }
      }
      if (!selected || usedTypes.has(selected.type)) {
        selected = null;
        continue;
      }
      break;
    }

    if (!selected || usedTypes.has(selected.type)) continue;
    usedTypes.add(selected.type);

    const validTiers = getAvailableTiers(selected, slot);
    if (validTiers.length === 0) continue;

    let tier = validTiers[Math.floor(rng() * validTiers.length)];
    if (REQUIRE_T1 && !t1Added && i === count - 1 && validTiers.includes(1)) {
      tier = 1;
    }

    if (tier === 1) t1Added = true;

    const tierConfigs = getTierConfigForSlot(selected, slot);
    const tierConfig = tierConfigs[tier.toString()];
    if (!tierConfig) continue;

    const value = randomIntInclusive(rng, tierConfig.min, tierConfig.max);
    mods.push({ type: selected.type, value, tier });
  }

  // T1が入ってなければ、最後のMODをT1に置換
  if (REQUIRE_T1 && !t1Added) {
    const candidateConfigs = availableConfigs.filter((config) => getAvailableTiers(config, slot).includes(1));
    if (candidateConfigs.length > 0) {
      const selected = pickRandom(candidateConfigs, rng);
      const tierConfigs = getTierConfigForSlot(selected, slot);
      const tierConfig = tierConfigs['1'];
      if (tierConfig) {
        const value = randomIntInclusive(rng, tierConfig.min, tierConfig.max);
        mods.pop();
        mods.push({ type: selected.type, value, tier: 1 });
      }
    }
  }

  return mods;
}

let instanceCounter = 0;
function createRandomModItem(
  rng: () => number,
  slot: EquipmentSlot,
  base: { id: string; name: string; atk: number; def: number },
  modCount: number
): Item {
  instanceCounter += 1;
  return {
    id: base.id,
    name: base.name,
    slot,
    atk: base.atk,
    def: base.def,
    instanceId: `search_${base.id}_${instanceCounter}`,
    mods: generateRandomModsForSlot(rng, modCount, slot),
  };
}

function createUniqueItem(base: ItemBaseLite): Item {
  instanceCounter += 1;
  const fixedMods = (base.fixedMods ?? []).map((mod) => ({
    ...mod,
    tier: 0,
  })) as ItemMod[];
  return {
    id: base.id,
    name: base.name,
    slot: base.slot,
    atk: base.atk ?? 0,
    def: base.def ?? 0,
    instanceId: `search_${base.id}_${instanceCounter}`,
    mods: fixedMods,
  };
}

function pickItemForSlot(rng: () => number, slot: EquipmentSlot): Item {
  const uniquePool = UNIQUE_BY_SLOT[slot];
  if (uniquePool.length > 0 && rng() < 0.35) {
    return createUniqueItem(pickRandom(uniquePool, rng));
  }
  const base = (FINAL_LAND_BASE_STATS as Record<EquipmentSlot, { id: string; name: string; atk: number; def: number }>)[slot];
  return createRandomModItem(rng, slot, base, 4);
}

function generateEquipment(rng: () => number): Equipment {
  const accessoryBase = pickRandom(ALL_ACCESSORIES, rng);
  const fixedMods = (accessoryBase?.fixedMods ?? []) as ItemMod[];
  const isUniqueAccessory = accessoryBase.id.startsWith('uber_');
  const accessoryMods = isUniqueAccessory
    ? fixedMods.map((mod) => ({ ...mod, tier: 0 }))
    : fixedMods.length >= 4
      ? fixedMods.slice(0, 4)
      : [...fixedMods, ...generateRandomModsForSlot(rng, 4 - fixedMods.length, 'accessory')];

  return {
    weapon: pickItemForSlot(rng, 'weapon'),
    armor: pickItemForSlot(rng, 'armor'),
    gloves: pickItemForSlot(rng, 'gloves'),
    boots: pickItemForSlot(rng, 'boots'),
    accessory: {
      id: accessoryBase.id,
      name: accessoryBase.name,
      slot: 'accessory',
      atk: accessoryBase.atk ?? 0,
      def: accessoryBase.def ?? 0,
      instanceId: `search_${accessoryBase.id}_${instanceCounter++}`,
      mods: accessoryMods,
    },
  };
}

function mutateEquipment(base: Equipment, rng: () => number): Equipment {
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots'];
  const slot = pickRandom(slots, rng);
  const item = base[slot];
  if (!item) return base;

  const newMods = [...item.mods];
  const modIndex = Math.floor(rng() * newMods.length);
  const replacement = generateRandomModsForSlot(rng, 1, slot)[0];
  if (replacement) {
    newMods[modIndex] = replacement;
  }

  const mutated: Equipment = {
    ...base,
    [slot]: {
      ...item,
      instanceId: `${item.instanceId}_m${Math.floor(rng() * 10000)}`,
      mods: newMods,
    },
  };

  return mutated;
}

// ========================================
// パッシブ生成
// ========================================

function generateRandomPassiveNodes(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];
  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;
    const node = pickRandom(unlockable, rng);
    unlocked.push(node.id);
  }
  return unlocked;
}

const PASSIVE_PRIORITY_PREFIXES = STRATEGY === 'tank_time_atk'
  ? ['regen_', 'guard_', 'vamp_', 'speed_']
  : ['poison_', 'crit_', 'regen_', 'guard_', 'speed_', 'vamp_'];

function hasTimeAtkMod(equipment: Equipment): boolean {
  return Object.values(equipment).some((item) =>
    item?.mods?.some((mod) => mod.type === 'time_atk_inc_pct')
  );
}

function generateBiasedPassiveNodes(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];
  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;
    const weighted = unlockable.map((node) => {
      const weight = PASSIVE_PRIORITY_PREFIXES.some((p) => node.id.startsWith(p)) ? 3 : 1;
      return { node, weight };
    });
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    let selected = weighted[0].node;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) {
        selected = entry.node;
        break;
      }
    }
    unlocked.push(selected.id);
  }
  return unlocked;
}

// ========================================
// ステータス計算
// ========================================

function calculateFinalStats(levelValue: number, equipment: Equipment, unlockedSkills: string[]) {
  const levelBonus = calculateBaseStatsForLevel(levelValue);
  let baseAtk = levelBonus.atk;
  let baseDef = levelBonus.def;
  let baseMaxHp = levelBonus.maxHp;

  let equipHpIncPct = 0;
  let equipAtkIncPct = 0;
  let equipDefIncPct = 0;

  const items = Object.values(equipment).filter(Boolean) as Item[];
  for (const item of items) {
    baseAtk += item.atk;
    baseDef += item.def;
    if (item.mods) {
      for (const mod of item.mods) {
        if (mod.type === 'atk_bonus') baseAtk += mod.value;
        if (mod.type === 'def_bonus') baseDef += mod.value;
        if (mod.type === 'hp_bonus') baseMaxHp += mod.value;
        if (mod.type === 'hp_increased_pct') equipHpIncPct += mod.value;
        if (mod.type === 'atk_increased_pct') equipAtkIncPct += mod.value;
        if (mod.type === 'def_increased_pct') equipDefIncPct += mod.value;
      }
    }
  }

  const passiveEffects = calculatePassiveEffects(unlockedSkills);
  const flatStats = {
    maxHp: baseMaxHp + passiveEffects.hp,
    atk: baseAtk + passiveEffects.atk,
    def: baseDef + passiveEffects.def,
  };

  const finalStats = {
    maxHp: applyPercentageScaling(flatStats.maxHp, passiveEffects.hp_increased_pct + equipHpIncPct, passiveEffects.hp_more_pct),
    atk: applyPercentageScaling(flatStats.atk, passiveEffects.atk_increased_pct + equipAtkIncPct, passiveEffects.atk_more_pct),
    def: applyPercentageScaling(flatStats.def, passiveEffects.def_increased_pct + equipDefIncPct, passiveEffects.def_more_pct),
  };

  const modEffects = combineMods(items, passiveEffects);
  return { finalStats, modEffects };
}

function computeQuickScore(stats: { maxHp: number; atk: number; def: number }, mods: ReturnType<typeof combineMods>): number {
  const critMultiplier = 1 + (mods.criticalChance / 100) * (DEFAULT_BATTLE_CONFIG.baseCriticalMultiplier - 1 + mods.criticalDamage / 100);
  const attackSpeed = 1 + mods.attackSpeedPct / 100 + mods.attackSpeedMorePct.reduce((acc, v) => acc * (1 + v / 100), 1) - 1;
  const poisonUptime = Math.min(1, mods.poisonChance / 100);
  const poisonPower = 1 + (mods.poisonDamagePct / 100) + mods.poisonDamageMorePct.reduce((acc, v) => acc * (1 + v / 100), 1) - 1;
  const dpsScore = stats.atk * Math.max(0.5, attackSpeed) * critMultiplier * (1 + poisonUptime * poisonPower);
  const sustainScore = (mods.hpRegen + Math.floor(stats.maxHp * mods.hpRegenPct / 100) + mods.hpOnHit);
  const tankScore = stats.maxHp + stats.def * (1 + mods.damageReductionPct / 100);
  return dpsScore * 0.0001 + sustainScore * 0.5 + tankScore * 0.01;
}

// ========================================
// 評価
// ========================================

type BuildResult = {
  score: number;
  winRates: Record<string, number>;
  build: { level: number; equipment: Equipment; unlockedSkills: string[] };
};

function simulateWinRate(
  build: { level: number; equipment: Equipment; unlockedSkills: string[] },
  bossId: typeof uberBossIds[number],
  customStats?: { atkMult?: number; defMult?: number; hpMult?: number }
): number {
  const { finalStats, modEffects } = calculateFinalStats(build.level, build.equipment, build.unlockedSkills);
  const scaledStats = {
    maxHp: Math.max(1, Math.floor(finalStats.maxHp * (customStats?.hpMult ?? 1))),
    atk: Math.max(1, Math.floor(finalStats.atk * (customStats?.atkMult ?? 1))),
    def: Math.max(0, Math.floor(finalStats.def * (customStats?.defMult ?? 1))),
  };
  const dungeonConfig = dungeonConfigs[bossId];
  const result = runGaugeSimulation(
    { playerStats: scaledStats, modEffects, dungeonId: bossId, runs: Math.max(30, Math.floor(runs / 4)), seed },
    dungeonConfig,
    enemyMap
  );
  return result.stats.winRate;
}

function estimateAtkMultiplierForWin(
  build: { level: number; equipment: Equipment; unlockedSkills: string[] },
  bossId: typeof uberBossIds[number]
): number | null {
  let lo = 1;
  let hi = 20;
  const hiRate = simulateWinRate(build, bossId, { atkMult: hi });
  if (hiRate < 0.5) return null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const rate = simulateWinRate(build, bossId, { atkMult: mid });
    if (rate >= 0.5) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function estimateDefMultiplierForWin(
  build: { level: number; equipment: Equipment; unlockedSkills: string[] },
  bossId: typeof uberBossIds[number]
): number | null {
  let lo = 1;
  let hi = 20;
  const hiRate = simulateWinRate(build, bossId, { defMult: hi });
  if (hiRate < 0.5) return null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const rate = simulateWinRate(build, bossId, { defMult: mid });
    if (rate >= 0.5) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function estimateHpMultiplierForWin(
  build: { level: number; equipment: Equipment; unlockedSkills: string[] },
  bossId: typeof uberBossIds[number]
): number | null {
  let lo = 1;
  let hi = 20;
  const hiRate = simulateWinRate(build, bossId, { hpMult: hi });
  if (hiRate < 0.5) return null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const rate = simulateWinRate(build, bossId, { hpMult: mid });
    if (rate >= 0.5) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function estimateAtkDefHpMultiplierForWin(
  build: { level: number; equipment: Equipment; unlockedSkills: string[] },
  bossId: typeof uberBossIds[number]
): number | null {
  let lo = 1;
  let hi = 20;
  const hiRate = simulateWinRate(build, bossId, { atkMult: hi, defMult: hi, hpMult: hi });
  if (hiRate < 0.5) return null;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const rate = simulateWinRate(build, bossId, { atkMult: mid, defMult: mid, hpMult: mid });
    if (rate >= 0.5) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return hi;
}

function evaluateBuild(build: { level: number; equipment: Equipment; unlockedSkills: string[] }): BuildResult {
  const { finalStats, modEffects } = calculateFinalStats(build.level, build.equipment, build.unlockedSkills);

  const winRates: Record<string, number> = {};
  let score = 0;

  if (REQUIRE_TIME_ATK && !hasTimeAtkMod(build.equipment)) {
    return { score: 0, winRates: { [targetBoss]: 0 }, build };
  }

  const targets = targetBoss ? [targetBoss] : uberBossIds;

  // 事前スコアが低すぎる場合はシミュレーションを省略
  const quickScore = computeQuickScore(finalStats, modEffects);
  if (targetBoss && quickScore < 120) {
    return { score: 0, winRates: { [targetBoss]: 0 }, build };
  }

  const prefilterRuns = targetBoss ? Math.max(30, Math.floor(runs / 4)) : runs;
  for (const bossId of targets) {
    const dungeonConfig = dungeonConfigs[bossId];
    const result = runGaugeSimulation(
      { playerStats: finalStats, modEffects, dungeonId: bossId, runs: prefilterRuns, seed },
      dungeonConfig,
      enemyMap
    );
    winRates[bossId] = result.stats.winRate;
  }

  if (targetBoss) {
    const preRate = winRates[targetBoss] ?? 0;
    if (prefilterRuns < runs && preRate >= 0.1) {
      const dungeonConfig = dungeonConfigs[targetBoss];
      const result = runGaugeSimulation(
        { playerStats: finalStats, modEffects, dungeonId: targetBoss, runs, seed },
        dungeonConfig,
        enemyMap
      );
      winRates[targetBoss] = result.stats.winRate;
    }
  }

  if (targetBoss) {
    score = winRates[targetBoss] ?? 0;
  } else {
    const nonTrueBoss = uberBossIds.filter((id) => id !== 'uber_true_final_boss');
    const nonTrueAvg = nonTrueBoss.reduce((sum, id) => sum + winRates[id], 0) / nonTrueBoss.length;
    const trueRate = winRates.uber_true_final_boss ?? 0;
    score = nonTrueAvg * 0.4 + trueRate * 0.6;
  }

  return { score, winRates, build };
}

// ========================================
// 実行
// ========================================

console.log('='.repeat(70));
console.log('Uberビルド探索');
console.log(`iterations=${iterations}, runs=${runs}, seed=${seed}`);
console.log(`targetBoss=${targetBoss}, mutations=${mutations}, pool=${poolSize}`);
console.log(`条件: T1〜T3, 4MOD固定, T1必須=${REQUIRE_T1 ? 'ON' : 'OFF'}`);
console.log(`アクセ: final_land + Uber終焉以外ユニーク`);
console.log(`strategy=${STRATEGY}, time_atk必須=${REQUIRE_TIME_ATK ? 'ON' : 'OFF'}`);
console.log('='.repeat(70));

const rng = createRng(seed);
const maxNodes = Math.min(level, 50);

let bestOverall: BuildResult | null = null;
let bestTrueBoss: BuildResult | null = null;
let bestNonTrue: BuildResult | null = null;
let bestTrueBoss50: BuildResult | null = null;
const pool: BuildResult[] = [];

for (let i = 0; i < iterations; i++) {
  const equipment = generateEquipment(rng);
  const unlockedSkills = generateBiasedPassiveNodes(maxNodes, rng);
  const build = { level, equipment, unlockedSkills };

  const result = evaluateBuild(build);

  if (!bestOverall || result.score > bestOverall.score) bestOverall = result;

  if (targetBoss) {
    if (!bestTrueBoss || result.score > bestTrueBoss.score) bestTrueBoss = result;
  } else {
    const nonTrueBoss = uberBossIds.filter((id) => id !== 'uber_true_final_boss');
    const nonTrueAvg = nonTrueBoss.reduce((sum, id) => sum + (result.winRates[id] ?? 0), 0) / nonTrueBoss.length;
    const trueRate = result.winRates.uber_true_final_boss ?? 0;
    if (!bestTrueBoss || trueRate > (bestTrueBoss.winRates.uber_true_final_boss ?? 0)) bestTrueBoss = result;
    if (!bestNonTrue || nonTrueAvg > nonTrueBoss.reduce((sum, id) => sum + (bestNonTrue!.winRates[id] ?? 0), 0) / nonTrueBoss.length) {
      bestNonTrue = result;
    }
    if (trueRate >= 0.45 && trueRate <= 0.55) {
      if (!bestTrueBoss50 || Math.abs(0.5 - trueRate) < Math.abs(0.5 - (bestTrueBoss50.winRates.uber_true_final_boss ?? 0))) {
        bestTrueBoss50 = result;
      }
    }
  }

  // エリートプール
  pool.push(result);
  pool.sort((a, b) => b.score - a.score);
  if (pool.length > poolSize) pool.pop();

  if (i % 100 === 0) {
    console.log(`progress ${i}/${iterations}`);
  }

  // 目標に到達したら一旦候補として記録
  if (!targetBoss) {
    const nonTrueBoss = uberBossIds.filter((id) => id !== 'uber_true_final_boss');
    const nonTrueAvg = nonTrueBoss.reduce((sum, id) => sum + (result.winRates[id] ?? 0), 0) / nonTrueBoss.length;
    const trueRate = result.winRates.uber_true_final_boss ?? 0;
    if (nonTrueAvg >= 0.85 && trueRate >= 0.5) {
      console.log('🎯 目標達成候補を発見');
      console.log(JSON.stringify({ winRates: result.winRates }, null, 2));
      console.log('build:');
      console.log(JSON.stringify(build, null, 2));
      break;
    }
  } else if (result.score >= 0.5) {
    console.log('🎯 目標達成候補を発見');
    console.log(JSON.stringify({ winRates: result.winRates }, null, 2));
    console.log('build:');
    console.log(JSON.stringify(build, null, 2));
    break;
  }
}

console.log('\n=== MUTATION PHASE ===');
for (let i = 0; i < mutations; i++) {
  if (pool.length === 0) break;
  const base = pool[Math.floor(rng() * pool.length)].build;
  const equipment = mutateEquipment(base.equipment, rng);
  const unlockedSkills = rng() < 0.4
    ? generateBiasedPassiveNodes(maxNodes, rng)
    : base.unlockedSkills.slice();
  const build = { level, equipment, unlockedSkills };
  const result = evaluateBuild(build);

  if (!bestOverall || result.score > bestOverall.score) bestOverall = result;
  if (targetBoss) {
    if (!bestTrueBoss || result.score > bestTrueBoss.score) bestTrueBoss = result;
  }

  pool.push(result);
  pool.sort((a, b) => b.score - a.score);
  if (pool.length > poolSize) pool.pop();

  if (i % 200 === 0) {
    console.log(`mutation ${i}/${mutations}`);
  }

  if (targetBoss && result.score >= 0.5) {
    console.log('🎯 目標達成候補を発見（mutation）');
    console.log(JSON.stringify({ winRates: result.winRates }, null, 2));
    console.log('build:');
    console.log(JSON.stringify(build, null, 2));
    break;
  }
}

console.log('\n=== BEST OVERALL ===');
if (bestOverall) {
  console.log(JSON.stringify({ winRates: bestOverall.winRates, score: bestOverall.score }, null, 2));
  console.log(JSON.stringify(bestOverall.build, null, 2));
}

console.log('\n=== BEST TRUE FINAL BOSS ===');
if (bestTrueBoss) {
  console.log(JSON.stringify({ winRates: bestTrueBoss.winRates }, null, 2));
  console.log(JSON.stringify(bestTrueBoss.build, null, 2));
  const requiredAtkMult = estimateAtkMultiplierForWin(bestTrueBoss.build, 'uber_true_final_boss');
  const requiredDefMult = estimateDefMultiplierForWin(bestTrueBoss.build, 'uber_true_final_boss');
  const requiredHpMult = estimateHpMultiplierForWin(bestTrueBoss.build, 'uber_true_final_boss');
  const requiredAllMult = estimateAtkDefHpMultiplierForWin(bestTrueBoss.build, 'uber_true_final_boss');
  console.log('\n=== ESTIMATED MULTIPLIERS (winRate>=50%) ===');
  if (requiredAtkMult === null) {
    console.log('atkMult: 20xでも勝率50%に届かず');
  } else {
    console.log(`atkMult ~= ${requiredAtkMult.toFixed(2)}x`);
  }
  if (requiredDefMult === null) {
    console.log('defMult: 20xでも勝率50%に届かず');
  } else {
    console.log(`defMult ~= ${requiredDefMult.toFixed(2)}x`);
  }
  if (requiredHpMult === null) {
    console.log('hpMult: 20xでも勝率50%に届かず');
  } else {
    console.log(`hpMult ~= ${requiredHpMult.toFixed(2)}x`);
  }
  if (requiredAllMult === null) {
    console.log('atk/def/hp同時: 20xでも勝率50%に届かず');
  } else {
    console.log(`atk/def/hp同時 ~= ${requiredAllMult.toFixed(2)}x`);
  }
}

console.log('\n=== BEST NON-TRUE BOSSES ===');
if (bestNonTrue) {
  console.log(JSON.stringify({ winRates: bestNonTrue.winRates }, null, 2));
  console.log(JSON.stringify(bestNonTrue.build, null, 2));
}

console.log('\n=== BEST TRUE FINAL BOSS ~50% ===');
if (bestTrueBoss50) {
  console.log(JSON.stringify({ winRates: bestTrueBoss50.winRates }, null, 2));
  console.log(JSON.stringify(bestTrueBoss50.build, null, 2));
}
