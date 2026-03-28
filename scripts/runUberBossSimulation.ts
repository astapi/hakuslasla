/**
 * Uberボス戦闘シミュレーション
 * - 複数ビルド（装備セット × パッシブプリセット）
 * - ランダムビルド
 *
 * 使用方法:
 *   npx tsx scripts/runUberBossSimulation.ts [level] [runs] [randomBuilds] [randomRuns] [seed]
 *
 * 例:
 *   npx tsx scripts/runUberBossSimulation.ts 60 300 20 150 12345
 */

import { runGaugeSimulation, createRng, pickRandom } from '../core/simulation';
import { INITIAL_STATS, calculateBaseStatsForLevel, LEVEL_BASED_PRESETS } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods, getAttackSpeedFromMods } from '../core/modEffects';
import {
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  EquipmentSetType,
} from '../core/equipmentSets';
import { EnemyConfig, DungeonConfig, Stats, CombinedModEffects } from '../core/types';
import { calculatePassiveEffects, getUnlockableNodes } from '../data/passiveTree';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';
import modsData from '../data/json/mods.json';

// ========================================
// コマンドライン引数
// ========================================

const args = process.argv.slice(2);
const inputLevel = args[0] ? parseInt(args[0], 10) : 60;
const runs = args[1] ? parseInt(args[1], 10) : 300;
const randomBuilds = args[2] ? parseInt(args[2], 10) : 20;
const randomRuns = args[3] ? parseInt(args[3], 10) : 150;
const seed = args[4] ? parseInt(args[4], 10) : 12345;

if (isNaN(inputLevel) || inputLevel < 1 || inputLevel > 99) {
  console.error('エラー: レベルは1〜99の整数で指定してください');
  process.exit(1);
}
if (isNaN(runs) || runs <= 0) {
  console.error('エラー: runsは1以上の整数で指定してください');
  process.exit(1);
}
if (isNaN(randomBuilds) || randomBuilds < 0) {
  console.error('エラー: randomBuildsは0以上の整数で指定してください');
  process.exit(1);
}
if (isNaN(randomRuns) || randomRuns <= 0) {
  console.error('エラー: randomRunsは1以上の整数で指定してください');
  process.exit(1);
}
if (isNaN(seed) || seed <= 0) {
  console.error('エラー: seedは1以上の整数で指定してください');
  process.exit(1);
}

// ========================================
// データ準備
// ========================================

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
    enemies: dungeon.monsters.flatMap(m => Array(m.spawnRate).fill(m.monsterId)),
    dropTable: allDrops.map(d => d.itemId),
  };

  if ('boss' in dungeon && dungeon.boss) {
    config.boss = {
      monsterId: (dungeon.boss as { monsterId: string; floor: number }).monsterId,
      floor: (dungeon.boss as { monsterId: string; floor: number }).floor,
    };
  }

  return config;
}

const uberBossIds = [
  'uber_goblin_king',
  'uber_bandit_leader',
  'uber_vampire',
  'uber_kraken',
  'uber_demon_lord',
  'uber_true_final_boss',
] as const;

const uberBossConfigs: Record<string, DungeonConfig> = {};
for (const id of uberBossIds) {
  const dungeon = dungeonsData.dungeons[id];
  if (!dungeon) continue;
  uberBossConfigs[id] = toDungeonConfig(dungeon as typeof dungeonsData.dungeons.grassland);
}

// ========================================
// ヘルパー関数
// ========================================

function getPassiveLevel(level: number): 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 {
  if (level >= 50) return 50;
  if (level >= 45) return 45;
  if (level >= 40) return 40;
  if (level >= 35) return 35;
  if (level >= 30) return 30;
  if (level >= 25) return 25;
  if (level >= 20) return 20;
  if (level >= 15) return 15;
  if (level >= 10) return 10;
  return 5;
}

function calculateEquipmentBaseStats(set: EquipmentSet): { atk: number; def: number } {
  let atk = 0;
  let def = 0;
  const items = [set.weapon, set.armor, set.gloves, set.boots, set.accessory];
  for (const item of items) {
    if (item) {
      atk += item.atk;
      def += item.def;
    }
  }
  return { atk, def };
}

function calculateFinalStatsWithPassives(
  baseStats: Stats,
  passiveEffects: ReturnType<typeof calculatePassiveEffects>
): Stats {
  return {
    maxHp: applyPercentageScaling(
      baseStats.maxHp,
      passiveEffects.hp_increased_pct,
      passiveEffects.hp_more_pct
    ),
    atk: applyPercentageScaling(
      baseStats.atk,
      passiveEffects.atk_increased_pct,
      passiveEffects.atk_more_pct
    ),
    def: applyPercentageScaling(
      baseStats.def,
      passiveEffects.def_increased_pct,
      passiveEffects.def_more_pct
    ),
  };
}

function createPlayerStatsWithEquipmentAndPassives(
  level: number,
  equipmentSet: EquipmentSet,
  passiveNodeIds: string[]
): { stats: Stats; modEffects: CombinedModEffects } {
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);
  const equipBaseStats = calculateEquipmentBaseStats(equipmentSet);
  const levelBonus = calculateBaseStatsForLevel(level);

  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp + (levelBonus.maxHp - INITIAL_STATS.maxHp),
    atk: INITIAL_STATS.atk + passiveEffects.atk + equipBaseStats.atk + (levelBonus.atk - INITIAL_STATS.atk),
    def: INITIAL_STATS.def + passiveEffects.def + equipBaseStats.def + (levelBonus.def - INITIAL_STATS.def),
  };

  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);

  const equipmentItems = [equipmentSet.weapon, equipmentSet.armor, equipmentSet.gloves, equipmentSet.boots, equipmentSet.accessory];
  const combinedModEffects = combineMods(equipmentItems, passiveEffects);

  return { stats: finalStats, modEffects: combinedModEffects };
}

function calculateNodeCount(level: number): number {
  return Math.min(level, 50);
}

function generateRandomPassiveNodes(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];
  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;
    const index = Math.floor(rng() * unlockable.length);
    unlocked.push(unlockable[index].id);
  }
  return unlocked;
}

function withSeededMathRandom<T>(rng: () => number, fn: () => T): T {
  const original = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// ========================================
// ランダムMOD（T1〜T3限定）装備生成
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

const modConfigs: ModConfig[] = (modsData as { modConfigs: ModConfig[] }).modConfigs;
const ALLOWED_TIERS = new Set([1, 2, 3]);
let randomInstanceCounter = 0;

function getTierConfigForSlot(config: ModConfig, slot: EquipmentSlot): ModTierConfig {
  return (config.slotTiers && config.slotTiers[slot]) || config.tiers;
}

function getAvailableTiers(config: ModConfig, slot: EquipmentSlot): number[] {
  const tiers = Object.keys(getTierConfigForSlot(config, slot)).map((t) => parseInt(t, 10));
  return tiers.filter((t) => ALLOWED_TIERS.has(t));
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function generateRandomModsForSlot(
  rng: () => number,
  count: number,
  slot: EquipmentSlot
): import('../types').ItemMod[] {
  const mods: import('../types').ItemMod[] = [];

  const availableConfigs = modConfigs.filter((config) => {
    if (config.slots && !config.slots.includes(slot)) return false;
    return getAvailableTiers(config, slot).length > 0;
  });

  if (availableConfigs.length === 0) return mods;

  const totalWeight = availableConfigs.reduce((sum, config) => sum + config.weight, 0);
  const usedTypes = new Set<string>();

  for (let i = 0; i < count; i++) {
    let random = rng() * totalWeight;
    let selected: ModConfig | null = null;

    for (const config of availableConfigs) {
      random -= config.weight;
      if (random <= 0) {
        selected = config;
        break;
      }
    }

    if (!selected || usedTypes.has(selected.type)) continue;
    usedTypes.add(selected.type);

    const validTiers = getAvailableTiers(selected, slot);
    if (validTiers.length === 0) continue;

    const tier = validTiers[Math.floor(rng() * validTiers.length)];
    const tierConfigs = getTierConfigForSlot(selected, slot);
    const tierConfig = tierConfigs[tier.toString()];
    if (!tierConfig) continue;

    const value = randomIntInclusive(rng, tierConfig.min, tierConfig.max);
    mods.push({ type: selected.type as import('../types').ModType, value, tier });
  }

  return mods;
}

function getDungeonModCountRange(dungeonId: string): { min: number; max: number } {
  const dungeon = (dungeonsData.dungeons as Record<string, { modCountRange?: { min: number; max: number } }>)[dungeonId];
  return dungeon?.modCountRange ?? { min: 2, max: 4 };
}

const FINAL_LAND_BASE_STATS = {
  weapon: { id: 'apocalypse_blade', name: '終焉の剣', atk: 220, def: 0 },
  armor: { id: 'end_armor', name: '終末の鎧', atk: 0, def: 180 },
  gloves: { id: 'titan_gauntlets', name: '泰坦の篭手', atk: 70, def: 80 },
  boots: { id: 'end_walker_boots', name: '終末を歩む者のブーツ', atk: 48, def: 120 },
  accessory: { id: 'oblivion_ring', name: '忘却の指輪', atk: 88, def: 88 },
} as const;

function createRandomModItemWithTierRange(
  rng: () => number,
  slot: EquipmentSlot,
  base: { id: string; name: string; atk: number; def: number },
  modCountRange: { min: number; max: number }
) {
  const modCount = randomIntInclusive(rng, modCountRange.min, modCountRange.max);
  const mods = generateRandomModsForSlot(rng, modCount, slot);
  randomInstanceCounter += 1;

  return {
    id: base.id,
    instanceId: `sim_random_${base.id}_${randomInstanceCounter}`,
    name: base.name,
    slot,
    atk: base.atk,
    def: base.def,
    mods,
  };
}

function generateRandomFinalLandEquipmentSet(
  rng: () => number,
  setName: string,
  dungeonId: 'final_land'
): EquipmentSet {
  const modCountRange = getDungeonModCountRange(dungeonId);

  return {
    name: setName,
    weapon: createRandomModItemWithTierRange(rng, 'weapon', FINAL_LAND_BASE_STATS.weapon, modCountRange),
    armor: createRandomModItemWithTierRange(rng, 'armor', FINAL_LAND_BASE_STATS.armor, modCountRange),
    gloves: createRandomModItemWithTierRange(rng, 'gloves', FINAL_LAND_BASE_STATS.gloves, modCountRange),
    boots: createRandomModItemWithTierRange(rng, 'boots', FINAL_LAND_BASE_STATS.boots, modCountRange),
    accessory: createRandomModItemWithTierRange(rng, 'accessory', FINAL_LAND_BASE_STATS.accessory, modCountRange),
  };
}

function formatMods(mods: { type: string; value: number; tier?: number }[]): string {
  if (!mods || mods.length === 0) return 'MODなし';
  return mods
    .map((mod) => `${mod.type}+${mod.value}${mod.tier ? `(T${mod.tier})` : ''}`)
    .join(', ');
}

function formatEquipmentSetDetail(set: EquipmentSet): string {
  const lines: string[] = [];
  const items = [set.weapon, set.armor, set.gloves, set.boots, set.accessory];
  for (const item of items) {
    if (!item) continue;
    lines.push(`${item.name}: ${formatMods(item.mods)}`);
  }
  return lines.join(' / ');
}

function formatCombinedStats(finalStats: Stats, mods: CombinedModEffects): string[] {
  const attackSpeedFinal = getAttackSpeedFromMods(mods, 1.0);
  const poisonMoreTotal = mods.poisonDamageMorePct.reduce((sum, v) => sum + v, 0);
  const attackSpeedMoreTotal = mods.attackSpeedMorePct.reduce((sum, v) => sum + v, 0);

  return [
    `最終ステ: HP${finalStats.maxHp}, ATK${finalStats.atk}, DEF${finalStats.def}`,
    `クリ率${mods.criticalChance}% / クリ倍率${mods.criticalDamage}%`,
    `毒付与率${mods.poisonChance}% / 毒倍率+${mods.poisonDamagePct}% / 毒more+${poisonMoreTotal}% / 毒最大${mods.poisonMaxStacks}`,
    `毒被ダメ軽減${mods.poisonDamageReduction}% / 毒吸収${mods.poisonLifesteal}% / 直接ダメ無効${mods.noDirectDamage ? 'ON' : 'OFF'}`,
    `毎秒回復+${mods.hpRegen} / 回復%+${mods.hpRegenPct}% / HIT回復+${mods.hpOnHit} / クリ回復+${mods.hpOnCrit}`,
    `被ダメ軽減${mods.damageDeferPct}% / 攻撃速度+${mods.attackSpeedPct}% / 攻速more+${attackSpeedMoreTotal}% / 最終AS${attackSpeedFinal.toFixed(2)}`,
  ];
}

// ========================================
// 設定
// ========================================

const passiveLevel = getPassiveLevel(inputLevel);
const nodeCount = calculateNodeCount(inputLevel);

const EQUIPMENT_DUNGEON_IDS = ['final_land'] as const;

type BuildRecipe = {
  label: string;
  equipType: EquipmentSetType;
  passiveType: keyof typeof LEVEL_BASED_PRESETS;
};

const BUILD_RECIPES: BuildRecipe[] = [
  { label: 'ATK+速度', equipType: 'ATK', passiveType: 'SPEED' },
  { label: 'ATK+吸血', equipType: 'ATK', passiveType: 'VAMP' },
  { label: 'ATK+回復', equipType: 'ATK', passiveType: 'REGEN' },
  { label: 'DEF+防御', equipType: 'DEF', passiveType: 'GUARD' },
  { label: 'DEF+回復', equipType: 'DEF', passiveType: 'REGEN' },
  { label: 'DEF+速度', equipType: 'DEF', passiveType: 'SPEED' },
  { label: 'CRIT+クリ', equipType: 'CRIT', passiveType: 'CRIT' },
  { label: 'CRIT+速度', equipType: 'CRIT', passiveType: 'SPEED' },
  { label: 'POISON+毒', equipType: 'POISON', passiveType: 'POISON' },
  { label: 'POISON+回復', equipType: 'POISON', passiveType: 'REGEN' },
];

// ========================================
// 実行
// ========================================

console.log('='.repeat(70));
console.log('Uberボス シミュレーション');
console.log(`レベル: ${inputLevel} / パッシブLV: ${passiveLevel}`);
console.log(`runs: ${runs} / ランダムビルド: ${randomBuilds}件 (runs=${randomRuns})`);
console.log(`seed: ${seed}`);
console.log('='.repeat(70));
console.log('');

let bossIndex = 0;
for (const bossId of uberBossIds) {
  const dungeonConfig = uberBossConfigs[bossId];
  if (!dungeonConfig) continue;
  bossIndex++;
  const isGoblinKing = bossId === 'uber_goblin_king';
  const failedFixedSamples: { label: string; equipName: string; equipDetail: string; passiveName: string; finalStats: Stats; modEffects: CombinedModEffects }[] = [];
  const failedRandomSamples: { equipDetail: string; finalStats: Stats; modEffects: CombinedModEffects }[] = [];

  console.log('='.repeat(70));
  console.log(`▼ ${dungeonConfig.name} (${bossId})`);
  console.log('='.repeat(70));
  console.log('');

  // ========================================
  // 1) 装備セット × パッシブプリセット
  // ========================================

  console.log('【装備セット × パッシブプリセット】');
  console.log('');

  for (const equipmentDungeonId of EQUIPMENT_DUNGEON_IDS) {
    const dungeonSets = DUNGEON_EQUIPMENT_SETS[equipmentDungeonId];
    if (!dungeonSets) continue;

    console.log(`-- 装備基準: ${dungeonSets.dungeonId} (推奨Lv.${dungeonSets.recommendedLevel}, Tier${dungeonSets.maxTier}, MOD${dungeonSets.maxModCount})`);
    console.log('ビルド         | 勝率 | 平均時間 | 平均残HP');
    console.log('---------------|------|----------|----------');

    for (const recipe of BUILD_RECIPES) {
      const equipSet = dungeonSets.sets[recipe.equipType];
      const passivePreset = LEVEL_BASED_PRESETS[recipe.passiveType]?.[passiveLevel];
      if (!passivePreset) continue;

      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        inputLevel,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulation(
        {
          playerStats: stats,
          modEffects,
          dungeonId: bossId,
          runs,
          seed,
        },
        dungeonConfig,
        enemyMap
      );

      if (isGoblinKing && result.stats.winRate === 0 && failedFixedSamples.length < 3) {
        failedFixedSamples.push({
          label: recipe.label,
          equipName: equipSet.name,
          equipDetail: formatEquipmentSetDetail(equipSet),
          passiveName: passivePreset.name,
          finalStats: stats,
          modEffects,
        });
      }

      console.log(
        `${recipe.label.padEnd(14)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)}`
      );
    }

    console.log('');
  }

  // ========================================
  // 2) ランダムビルド
  // ========================================

  if (randomBuilds > 0) {
    console.log('【ランダムビルド】');
    console.log('No | 装備基準      | 勝率 | 平均時間 | 平均残HP');
    console.log('---|---------------|------|----------|----------');

    const rng = createRng(seed + bossIndex * 10000);
    let totalWinRate = 0;

    for (let i = 0; i < randomBuilds; i++) {
      const equipmentDungeonId = pickRandom([...EQUIPMENT_DUNGEON_IDS], rng);
      const passiveNodes = generateRandomPassiveNodes(nodeCount, rng);

      const equipSet = withSeededMathRandom(rng, () =>
        generateRandomFinalLandEquipmentSet(rng, `Random${i + 1}`, equipmentDungeonId)
      );

      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        inputLevel,
        equipSet,
        passiveNodes
      );

      const result = runGaugeSimulation(
        {
          playerStats: stats,
          modEffects,
          dungeonId: bossId,
          runs: randomRuns,
          seed: seed + i + 1,
        },
        dungeonConfig,
        enemyMap
      );

      if (isGoblinKing && result.stats.winRate === 0 && failedRandomSamples.length < 3) {
        failedRandomSamples.push({
          equipDetail: formatEquipmentSetDetail(equipSet),
          finalStats: stats,
          modEffects,
        });
      }

      totalWinRate += result.stats.winRate;

      console.log(
        `${String(i + 1).padStart(2)} | ` +
        `${equipmentDungeonId.padEnd(13)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)}`
      );
    }

    const avgWinRate = totalWinRate / randomBuilds;
    console.log('');
    console.log(`ランダムビルド平均勝率: ${(avgWinRate * 100).toFixed(1)}%`);
    console.log('');
  }

  if (isGoblinKing) {
    console.log('【Uberゴブリンキング 敗北ビルド例】');
    console.log('');
    console.log('固定ビルド（3件）:');
    for (const sample of failedFixedSamples) {
      console.log(`- ${sample.label} / 装備: ${sample.equipName}`);
      console.log(`  装備MOD: ${sample.equipDetail}`);
      console.log(`  パッシブ: ${sample.passiveName}`);
      for (const line of formatCombinedStats(sample.finalStats, sample.modEffects)) {
        console.log(`  ${line}`);
      }
    }
    console.log('');
    console.log('ランダムビルド（3件）:');
    for (const sample of failedRandomSamples) {
      console.log(`- 装備MOD: ${sample.equipDetail}`);
      for (const line of formatCombinedStats(sample.finalStats, sample.modEffects)) {
        console.log(`  ${line}`);
      }
    }
    console.log('');
  }
}

console.log('='.repeat(70));
console.log('Uberボス シミュレーション完了');
console.log('='.repeat(70));
