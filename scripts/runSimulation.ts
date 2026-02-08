/**
 * シミュレーション実行スクリプト（ゲージ制戦闘対応）
 * 装備セット × パッシブプリセット の組み合わせでダンジョン攻略をシミュレート
 *
 * 使用方法:
 *   npx tsx scripts/runSimulation.ts
 */

import {
  runGaugeSimulation,
  EnemyConfig,
  DungeonConfig,
  Stats,
  CombinedModEffects,
  INITIAL_STATS,
  calculateBaseStatsForLevel,
  applyPercentageScaling,
  LEVEL_BASED_PRESETS,
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  EquipmentSetType,
  combineMods,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';
import { isDimensionalRushDungeon, toOriginalDimensionalRushFloor, getDimensionalRushEnemy } from '../data/endContents';

// JSONファイルを直接読み込み
import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// EnemyConfigのMapを作成
const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

const runGaugeSimulationWithEndContent = (
  config: Parameters<typeof runGaugeSimulation>[0],
  dungeonConfig: DungeonConfig
) => {
  const resolveEnemyForFloor = isDimensionalRushDungeon(config.dungeonId)
    ? (floor: number, rng: () => number) => {
        const originalFloor = toOriginalDimensionalRushFloor(config.dungeonId, floor);
        return getDimensionalRushEnemy(originalFloor, rng) as EnemyConfig;
      }
    : undefined;

  return runGaugeSimulation(
    { ...config, resolveEnemyForFloor },
    dungeonConfig,
    enemyMap
  );
};

// DungeonConfigに変換（core用の形式に）
function toDungeonConfig(dungeon: typeof dungeonsData.dungeons.grassland): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap(m =>
      Array(m.spawnRate).fill(m.monsterId)
    ),
    dropTable: allDrops.map(d => d.itemId),
  };

  // ボス情報があれば追加
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = {
      monsterId: (dungeon.boss as { monsterId: string; floor: number }).monsterId,
      floor: (dungeon.boss as { monsterId: string; floor: number }).floor,
    };
  }

  return config;
}

// ダンジョン設定
const dungeonConfigs = {
  grassland: toDungeonConfig(dungeonsData.dungeons.grassland),
  cave: toDungeonConfig(dungeonsData.dungeons.cave),
  ruins: toDungeonConfig(dungeonsData.dungeons.ruins),
  goblin_fort: toDungeonConfig(dungeonsData.dungeons.goblin_fort),
  demon_castle: toDungeonConfig(dungeonsData.dungeons.demon_castle),
  ice_cave: toDungeonConfig(dungeonsData.dungeons.ice_cave),
  volcano: toDungeonConfig(dungeonsData.dungeons.volcano),
  dark_forest: toDungeonConfig(dungeonsData.dungeons.dark_forest),
  sky_tower: toDungeonConfig(dungeonsData.dungeons.sky_tower),
  hell_gate: toDungeonConfig(dungeonsData.dungeons.hell_gate),
  dragon_nest: toDungeonConfig(dungeonsData.dungeons.dragon_nest),
  sacred_temple: toDungeonConfig(dungeonsData.dungeons.sacred_temple),
  chaos_realm: toDungeonConfig(dungeonsData.dungeons.chaos_realm),
  final_land: toDungeonConfig(dungeonsData.dungeons.final_land),
  // 分割された異次元ラッシュ
  dimensional_rush_1: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_1),
  dimensional_rush_2: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_2),
  dimensional_rush_3: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_3),
  dimensional_rush_4: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_4),
  dimensional_rush_5: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_5),
  dimensional_rush_6: toDungeonConfig(dungeonsData.dungeons.dimensional_rush_6),
};

// ダンジョン情報（推奨レベル、前ダンジョン）
const dungeonInfo: Record<string, {
  name: string;
  recommendedLevel: number;
  previousDungeon: string | null;
}> = {
  grassland: { name: '始まりの草原', recommendedLevel: 1, previousDungeon: null },
  cave: { name: '地底洞窟', recommendedLevel: 5, previousDungeon: 'grassland' },
  ruins: { name: '忘却の遺跡', recommendedLevel: 10, previousDungeon: 'cave' },
  goblin_fort: { name: 'ゴブリンの砦', recommendedLevel: 15, previousDungeon: 'ruins' },
  demon_castle: { name: '魔王城', recommendedLevel: 20, previousDungeon: 'goblin_fort' },
  ice_cave: { name: '氷結の洞窟', recommendedLevel: 25, previousDungeon: 'demon_castle' },
  volcano: { name: '灼熱の火山', recommendedLevel: 30, previousDungeon: 'ice_cave' },
  dark_forest: { name: '深淵の森', recommendedLevel: 35, previousDungeon: 'volcano' },
  sky_tower: { name: '天空の塔', recommendedLevel: 40, previousDungeon: 'dark_forest' },
  hell_gate: { name: '地獄の門', recommendedLevel: 50, previousDungeon: 'sky_tower' },
  dragon_nest: { name: '竜の巣穴', recommendedLevel: 60, previousDungeon: 'hell_gate' },
  sacred_temple: { name: '神域の神殿', recommendedLevel: 70, previousDungeon: 'dragon_nest' },
  chaos_realm: { name: '混沌の領域', recommendedLevel: 80, previousDungeon: 'sacred_temple' },
  final_land: { name: '終焉の地', recommendedLevel: 99, previousDungeon: 'chaos_realm' },
  // 分割された異次元ラッシュ（累積的階層構成）
  dimensional_rush_1: { name: '異次元ラッシュI (1-50階)', recommendedLevel: 60, previousDungeon: 'final_land' },
  dimensional_rush_2: { name: '異次元ラッシュII (1-70階)', recommendedLevel: 60, previousDungeon: 'dimensional_rush_1' },
  dimensional_rush_3: { name: '異次元ラッシュIII (1-90階)', recommendedLevel: 60, previousDungeon: 'dimensional_rush_2' },
  dimensional_rush_4: { name: '異次元ラッシュIV (1-110階)', recommendedLevel: 60, previousDungeon: 'dimensional_rush_3' },
  dimensional_rush_5: { name: '異次元ラッシュV (1-120階)', recommendedLevel: 60, previousDungeon: 'dimensional_rush_4' },
  dimensional_rush_6: { name: '異次元ラッシュVI (1-200階)', recommendedLevel: 60, previousDungeon: 'dimensional_rush_5' },
};

// レベルとパッシブレベルのマッピング
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

/**
 * PoE式: base × (1 + total_increased%) × more1 × more2 × ...
 * パッシブ効果を反映した最終ステータスを計算
 */
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

/**
 * 装備セットから基本ステータスボーナスを計算
 */
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

/**
 * 装備セット＋パッシブ付きのStats + CombinedModEffectsを作成
 */
function createPlayerStatsWithEquipmentAndPassives(
  level: number,
  equipmentSet: EquipmentSet,
  passiveNodeIds: string[]
): { stats: Stats; modEffects: CombinedModEffects } {
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);
  const equipBaseStats = calculateEquipmentBaseStats(equipmentSet);
  const levelBonus = calculateBaseStatsForLevel(level);

  // Step 1: フラット加算で基礎ステータスを計算
  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp + (levelBonus.maxHp - INITIAL_STATS.maxHp),
    atk: INITIAL_STATS.atk + passiveEffects.atk + equipBaseStats.atk + (levelBonus.atk - INITIAL_STATS.atk),
    def: INITIAL_STATS.def + passiveEffects.def + equipBaseStats.def + (levelBonus.def - INITIAL_STATS.def),
  };

  // Step 2: PoE式で%効果を適用
  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);

  // Step 3: 装備アイテムとパッシブ効果を合成
  const equipmentItems = [equipmentSet.weapon, equipmentSet.armor, equipmentSet.gloves, equipmentSet.boots, equipmentSet.accessory];
  const combinedModEffects = combineMods(equipmentItems, passiveEffects);

  return { stats: finalStats, modEffects: combinedModEffects };
}

// ========================================
// シミュレーション実行
// ========================================

console.log('='.repeat(70));
console.log('ハクスラダンジョン シミュレーション');
console.log('装備セット × パッシブプリセット の組み合わせ検証');
console.log('='.repeat(70));
console.log('');

// 装備セットタイプ
const EQUIPMENT_SET_TYPES: EquipmentSetType[] = ['ATK', 'DEF', 'CRIT', 'POISON'];

// パッシブプリセットタイプ（装備と同じ方向性のものを使用）
const PASSIVE_PRESET_TYPES = ['POISON', 'CRIT', 'REGEN', 'VAMP', 'GUARD', 'SPEED'] as const;

// バランスパッシブプリセットタイプ
const BALANCE_PASSIVE_TYPES = ['REGEN_GUARD', 'SPEED_REGEN', 'VAMP_SPEED', 'VAMP_REGEN', 'SPEED_GUARD', 'POISON_GUARD', 'POISON_REGEN'] as const;

// ========================================
// 1. 各ダンジョン × 装備セット × パッシブプリセット
// ========================================

console.log('【各ダンジョン攻略シミュレーション】');
console.log('前ダンジョンの装備セット × パッシブプリセットの組み合わせで検証');
console.log('');

// ダンジョン順序
const dungeonOrder = [
  'cave', 'ruins', 'goblin_fort', 'demon_castle', 'ice_cave',
  'volcano', 'dark_forest', 'sky_tower', 'hell_gate', 'dragon_nest',
  'sacred_temple', 'chaos_realm', 'final_land',
];

for (const dungeonId of dungeonOrder) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  console.log('='.repeat(70));
  console.log(`▼ ${info.name} (推奨Lv.${level}, ${dungeonConfig.maxFloor}階層)`);
  console.log(`  使用装備: ${previousEquipmentSets.dungeonId}の装備 (Tier${previousEquipmentSets.maxTier}, MOD${previousEquipmentSets.maxModCount}個)`);
  console.log(`  パッシブレベル: LV${passiveLevel}`);
  console.log('='.repeat(70));
  console.log('');

  // ========================================
  // 特化パッシブ × 装備セット
  // ========================================
  console.log('【特化パッシブ × 装備セット】');
  console.log('');
  console.log('装備タイプ | パッシブタイプ   | 勝率 | 平均時間 | 平均残HP | 平均階層');
  console.log('-----------|------------------|------|----------|----------|--------');

  for (const equipType of EQUIPMENT_SET_TYPES) {
    const equipSet = previousEquipmentSets.sets[equipType];

    for (const passiveType of PASSIVE_PRESET_TYPES) {
      const passivePreset = LEVEL_BASED_PRESETS[passiveType]?.[passiveLevel];
      if (!passivePreset) continue;

      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        {
          playerStats: stats,
          modEffects,
          dungeonId,
          runs: 300,
          seed: 12345,
        },
        dungeonConfig
      );

      console.log(
        `${equipType.padEnd(10)} | ` +
        `${passivePreset.name.padEnd(16)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  console.log('');

  // ========================================
  // バランスパッシブ × 装備セット（DEFまたはATK装備のみ）
  // ========================================
  console.log('【バランスパッシブ × 装備セット（ATK/DEF装備）】');
  console.log('');
  console.log('装備タイプ | パッシブタイプ   | 勝率 | 平均時間 | 平均残HP | 平均階層');
  console.log('-----------|------------------|------|----------|----------|--------');

  for (const equipType of ['ATK', 'DEF'] as EquipmentSetType[]) {
    const equipSet = previousEquipmentSets.sets[equipType];

    for (const passiveType of BALANCE_PASSIVE_TYPES) {
      const passivePreset = LEVEL_BASED_PRESETS[passiveType]?.[passiveLevel];
      if (!passivePreset) continue;

      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        {
          playerStats: stats,
          modEffects,
          dungeonId,
          runs: 300,
          seed: 12345,
        },
        dungeonConfig
      );

      console.log(
        `${equipType.padEnd(10)} | ` +
        `${passivePreset.name.padEnd(16)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  console.log('');

  // ========================================
  // 推奨組み合わせ（装備とパッシブが同じ方向性）
  // ========================================
  console.log('【推奨組み合わせ（装備とパッシブが同じ方向性）】');
  console.log('');

  const recommendedCombinations: { equipType: EquipmentSetType; passiveType: string }[] = [
    { equipType: 'POISON', passiveType: 'POISON' },
    { equipType: 'POISON', passiveType: 'POISON_GUARD' },
    { equipType: 'POISON', passiveType: 'POISON_REGEN' },
    { equipType: 'CRIT', passiveType: 'CRIT' },
    { equipType: 'DEF', passiveType: 'GUARD' },
    { equipType: 'DEF', passiveType: 'REGEN' },
    { equipType: 'ATK', passiveType: 'SPEED' },
    { equipType: 'ATK', passiveType: 'VAMP' },
  ];

  console.log('装備タイプ | パッシブタイプ   | 勝率 | 平均時間 | 平均残HP | 平均階層');
  console.log('-----------|------------------|------|----------|----------|--------');

  for (const combo of recommendedCombinations) {
    const equipSet = previousEquipmentSets.sets[combo.equipType];
    const passivePreset = LEVEL_BASED_PRESETS[combo.passiveType]?.[passiveLevel];
    if (!passivePreset) continue;

    const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
      level,
      equipSet,
      passivePreset.nodes
    );

    const result = runGaugeSimulationWithEndContent(
      {
        playerStats: stats,
        modEffects,
        dungeonId,
        runs: 300,
        seed: 12345,
      },
      dungeonConfig
    );

    console.log(
      `${combo.equipType.padEnd(10)} | ` +
      `${passivePreset.name.padEnd(16)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
      `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
    );
  }

  console.log('');
  console.log('');
}

// ========================================
// 2. 勝率サマリー（全ダンジョン × 推奨組み合わせ）
// ========================================

console.log('='.repeat(70));
console.log('【勝率サマリー】全ダンジョン × 推奨組み合わせ');
console.log('='.repeat(70));
console.log('');

console.log('ダンジョン         | POISON+毒 | CRIT+クリ | DEF+防御 | DEF+回復 | ATK+速度 | ATK+吸血');
console.log('-------------------|-----------|-----------|----------|----------|----------|----------');

for (const dungeonId of dungeonOrder) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  const combinations: { equipType: EquipmentSetType; passiveType: string }[] = [
    { equipType: 'POISON', passiveType: 'POISON' },
    { equipType: 'CRIT', passiveType: 'CRIT' },
    { equipType: 'DEF', passiveType: 'GUARD' },
    { equipType: 'DEF', passiveType: 'REGEN' },
    { equipType: 'ATK', passiveType: 'SPEED' },
    { equipType: 'ATK', passiveType: 'VAMP' },
  ];

  const winRates: string[] = [];

  for (const combo of combinations) {
    const equipSet = previousEquipmentSets.sets[combo.equipType];
    const passivePreset = LEVEL_BASED_PRESETS[combo.passiveType]?.[passiveLevel];

    if (!passivePreset) {
      winRates.push('  N/A   ');
      continue;
    }

    const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
      level,
      equipSet,
      passivePreset.nodes
    );

    const result = runGaugeSimulationWithEndContent(
      {
        playerStats: stats,
        modEffects,
        dungeonId,
        runs: 300,
        seed: 12345,
      },
      dungeonConfig
    );

    winRates.push(`${(result.stats.winRate * 100).toFixed(0).padStart(4)}%   `);
  }

  console.log(
    `${info.name.padEnd(18)} | ${winRates.join(' | ')}`
  );
}

console.log('');

// ========================================
// 3. 装備なし vs 装備あり 比較
// ========================================

console.log('='.repeat(70));
console.log('【装備なし vs 装備あり 比較】');
console.log('='.repeat(70));
console.log('');

const comparisonDungeons = ['cave', 'ruins', 'goblin_fort', 'demon_castle'];

for (const dungeonId of comparisonDungeons) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  console.log(`▼ ${info.name} (推奨Lv.${level})`);
  console.log('');
  console.log('装備       | パッシブ         | 勝率 | 平均時間 | 平均残HP');
  console.log('-----------|------------------|------|----------|--------');

  // 装備なし
  const noEquipSet: EquipmentSet = {
    name: '装備なし',
    weapon: null,
    armor: null,
    gloves: null,
    boots: null,
    accessory: null,
  };

  for (const passiveType of ['REGEN', 'SPEED', 'GUARD'] as const) {
    const passivePreset = LEVEL_BASED_PRESETS[passiveType]?.[passiveLevel];
    if (!passivePreset) continue;

    const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
      level,
      noEquipSet,
      passivePreset.nodes
    );

    const result = runGaugeSimulationWithEndContent(
      {
        playerStats: stats,
        modEffects,
        dungeonId,
        runs: 300,
        seed: 12345,
      },
      dungeonConfig
    );

    console.log(
      `${'なし'.padEnd(9)} | ` +
      `${passivePreset.name.padEnd(16)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  // 装備あり（ATK装備）
  const atkEquipSet = previousEquipmentSets.sets.ATK;

  for (const passiveType of ['REGEN', 'SPEED', 'GUARD'] as const) {
    const passivePreset = LEVEL_BASED_PRESETS[passiveType]?.[passiveLevel];
    if (!passivePreset) continue;

    const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
      level,
      atkEquipSet,
      passivePreset.nodes
    );

    const result = runGaugeSimulationWithEndContent(
      {
        playerStats: stats,
        modEffects,
        dungeonId,
        runs: 300,
        seed: 12345,
      },
      dungeonConfig
    );

    console.log(
      `${atkEquipSet.name.slice(0, 9).padEnd(9)} | ` +
      `${passivePreset.name.padEnd(16)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  console.log('');
}

// ========================================
// 4. 高レベルパッシブの効果検証
// ========================================

console.log('='.repeat(70));
console.log('【高レベルパッシブの効果検証】');
console.log('パッシブレベル別の勝率比較');
console.log('='.repeat(70));
console.log('');

const highLevelTestDungeons = ['volcano', 'dark_forest', 'sky_tower'];

for (const dungeonId of highLevelTestDungeons) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const equipSet = previousEquipmentSets.sets.ATK;

  console.log(`▼ ${info.name} (推奨Lv.${level})`);
  console.log('');
  console.log('パッシブLV | 速度特化   | 吸血特化   | 回復特化   | 防御特化');
  console.log('-----------|------------|------------|------------|----------');

  for (const passiveLv of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const) {
    const results: string[] = [];

    for (const passiveType of ['SPEED', 'VAMP', 'REGEN', 'GUARD'] as const) {
      const passivePreset = LEVEL_BASED_PRESETS[passiveType]?.[passiveLv];
      if (!passivePreset) {
        results.push('   N/A    ');
        continue;
      }

      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        {
          playerStats: stats,
          modEffects,
          dungeonId,
          runs: 300,
          seed: 12345,
        },
        dungeonConfig
      );

      results.push(`${(result.stats.winRate * 100).toFixed(0).padStart(5)}%    `);
    }

    console.log(
      `LV${passiveLv.toString().padStart(2)}      | ${results.join(' | ')}`
    );
  }

  console.log('');
}

// ========================================
// 5. 毒・クリ特化ビルドの効果検証
// ========================================

console.log('='.repeat(70));
console.log('【毒・クリ特化ビルドの効果検証】');
console.log('装備とパッシブを揃えた特化ビルド');
console.log('='.repeat(70));
console.log('');

const specializedTestDungeons = ['goblin_fort', 'demon_castle', 'ice_cave', 'volcano'];

for (const dungeonId of specializedTestDungeons) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  console.log(`▼ ${info.name} (推奨Lv.${level}, パッシブLV${passiveLevel})`);
  console.log('');
  console.log('ビルドタイプ       | 勝率 | 平均時間 | 平均残HP | 平均階層');
  console.log('-------------------|------|----------|----------|--------');

  // 毒特化（POISON装備 + POISON パッシブ）
  {
    const equipSet = previousEquipmentSets.sets.POISON;
    const passivePreset = LEVEL_BASED_PRESETS.POISON?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        { playerStats: stats, modEffects, dungeonId, runs: 300, seed: 12345 },
        dungeonConfig
      );

      console.log(
        `${'毒装備+毒パッシブ'.padEnd(18)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  // クリ特化（CRIT装備 + CRIT パッシブ）
  {
    const equipSet = previousEquipmentSets.sets.CRIT;
    const passivePreset = LEVEL_BASED_PRESETS.CRIT?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        { playerStats: stats, modEffects, dungeonId, runs: 300, seed: 12345 },
        dungeonConfig
      );

      console.log(
        `${'クリ装備+クリパッシブ'.padEnd(18)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  // 比較: ATK装備 + 速度パッシブ
  {
    const equipSet = previousEquipmentSets.sets.ATK;
    const passivePreset = LEVEL_BASED_PRESETS.SPEED?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        { playerStats: stats, modEffects, dungeonId, runs: 300, seed: 12345 },
        dungeonConfig
      );

      console.log(
        `${'ATK装備+速度パッシブ'.padEnd(18)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  // 比較: DEF装備 + 回復パッシブ
  {
    const equipSet = previousEquipmentSets.sets.DEF;
    const passivePreset = LEVEL_BASED_PRESETS.REGEN?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(
        level,
        equipSet,
        passivePreset.nodes
      );

      const result = runGaugeSimulationWithEndContent(
        { playerStats: stats, modEffects, dungeonId, runs: 300, seed: 12345 },
        dungeonConfig
      );

      console.log(
        `${'DEF装備+回復パッシブ'.padEnd(18)} | ` +
        `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
      );
    }
  }

  console.log('');
}

console.log('='.repeat(70));
console.log('シミュレーション完了');
console.log('='.repeat(70));
