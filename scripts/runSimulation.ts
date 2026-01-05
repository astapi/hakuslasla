/**
 * シミュレーション実行スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/runSimulation.ts
 */

import {
  runBalanceTest,
  generateBalanceReport,
  createDefaultPlayerConfig,
  EnemyConfig,
  DungeonConfig,
  PlayerConfig,
  EquipmentConfig,
  ItemConfig,
  PASSIVE_PRESETS,
  PassivePresetKey,
  INITIAL_STATS,
  runSimulation,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';
import itemsData from '../data/json/items.json';

// JSONファイルを直接読み込み
import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// EnemyConfigのMapを作成
const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

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

/**
 * パッシブ効果を反映したPlayerConfigを作成
 */
function createPlayerConfigWithPassives(
  level: number,
  passiveNodeIds: string[]
): PlayerConfig {
  const baseConfig = createDefaultPlayerConfig(level);
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);

  return {
    ...baseConfig,
    baseStats: {
      maxHp: INITIAL_STATS.maxHp + passiveEffects.hp,
      atk: INITIAL_STATS.atk + passiveEffects.atk,
      def: INITIAL_STATS.def + passiveEffects.def,
    },
    unlockedSkills: passiveNodeIds,
  };
}

// ダンジョン設定
const dungeonConfigs = {
  grassland: toDungeonConfig(dungeonsData.dungeons.grassland),
  cave: toDungeonConfig(dungeonsData.dungeons.cave),
  ruins: toDungeonConfig(dungeonsData.dungeons.ruins),
  goblin_fort: toDungeonConfig(dungeonsData.dungeons.goblin_fort),
};

// ダンジョン情報（推奨レベル付き）
const dungeonInfo = {
  grassland: { name: '始まりの草原', recommendedLevel: 1 },
  cave: { name: '地底洞窟', recommendedLevel: 5 },
  ruins: { name: '忘却の遺跡', recommendedLevel: 10 },
  goblin_fort: { name: 'ゴブリンの砦', recommendedLevel: 15 },
};

// ========================================
// 装備セット定義
// ========================================

/**
 * アイテムIDからItemConfigを取得
 */
function getItemConfig(itemId: string): ItemConfig | null {
  const item = (itemsData.items as Record<string, { id: string; atk: number; def: number }>)[itemId];
  if (!item) return null;
  return {
    id: item.id,
    atk: item.atk,
    def: item.def,
  };
}

/**
 * 装備セット定義
 * MODなしの基本装備
 */
const EQUIPMENT_SETS: Record<string, { name: string; equipment: EquipmentConfig }> = {
  NONE: {
    name: '装備なし',
    equipment: {
      weapon: null,
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    },
  },
  GRASSLAND: {
    name: '草原装備',
    equipment: {
      weapon: getItemConfig('grassland_sword'),   // ATK+5
      armor: getItemConfig('light_leather'),       // DEF+4
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('rabbit_boots'),        // ATK+1, DEF+3
      accessory: getItemConfig('copper_ring'),     // ATK+1, DEF+1
    },
  },
  CAVE: {
    name: '洞窟装備',
    equipment: {
      weapon: getItemConfig('cave_iron_sword'),    // ATK+8
      armor: getItemConfig('bat_mantle'),          // ATK+1, DEF+5
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('leather_boots'),       // DEF+2
      accessory: getItemConfig('warrior_ring'),    // ATK+3, DEF+1
    },
  },
  RUINS: {
    name: '遺跡装備',
    equipment: {
      weapon: getItemConfig('ruins_magic_sword'),  // ATK+12
      armor: getItemConfig('cursed_robe'),         // ATK+3, DEF+8
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('gargoyle_boots'),      // ATK+2, DEF+6
      accessory: getItemConfig('ancient_ring'),    // ATK+4, DEF+4
    },
  },
  // MOD付き装備を想定（固定MOD装備一式）
  RUINS_WITH_MODS: {
    name: '遺跡装備+MOD',
    equipment: {
      weapon: { id: 'ruins_magic_sword', atk: 12 + 5, def: 0 },      // +ATK MOD
      armor: { id: 'cursed_robe', atk: 3, def: 8 + 5 },              // +DEF MOD
      gloves: { id: 'curse_bandage', atk: 5, def: 4 },               // ユニーク
      boots: { id: 'stone_wing_boots', atk: 3, def: 8 + 5 },         // ユニーク+MOD
      accessory: { id: 'lost_grimoire', atk: 8, def: 0 },            // ユニーク
    },
  },
};

type EquipmentSetKey = keyof typeof EQUIPMENT_SETS;

/**
 * 装備の合計ステータスを計算
 */
function calculateEquipmentStats(equipment: EquipmentConfig): { atk: number; def: number } {
  let atk = 0;
  let def = 0;
  const slots = ['weapon', 'armor', 'gloves', 'boots', 'accessory'] as const;
  for (const slot of slots) {
    const item = equipment[slot];
    if (item) {
      atk += item.atk;
      def += item.def;
    }
  }
  return { atk, def };
}

/**
 * 装備＋パッシブ付きのPlayerConfigを作成
 */
function createPlayerConfigWithEquipmentAndPassives(
  level: number,
  equipmentSet: EquipmentConfig,
  passiveNodeIds: string[]
): PlayerConfig {
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);

  return {
    level,
    baseStats: {
      maxHp: INITIAL_STATS.maxHp + passiveEffects.hp,
      atk: INITIAL_STATS.atk + passiveEffects.atk,
      def: INITIAL_STATS.def + passiveEffects.def,
    },
    equipment: equipmentSet,
    unlockedSkills: passiveNodeIds,
  };
}

// ========================================
// シミュレーション実行
// ========================================

console.log('='.repeat(60));
console.log('ハクスラダンジョン シミュレーション');
console.log('='.repeat(60));
console.log('');

// ========================================
// 1. 基本バランステスト（パッシブなし）
// ========================================

console.log('【基本バランステスト（パッシブなし）】');
console.log('');

console.log('▼ 始まりの草原');
const balanceResult1 = runBalanceTest(
  {
    playerLevels: [1, 2, 3, 5, 7],
    dungeonId: 'grassland',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.grassland,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult1));
console.log('');

console.log('▼ 地底洞窟');
const balanceResult2 = runBalanceTest(
  {
    playerLevels: [3, 5, 7, 10, 12],
    dungeonId: 'cave',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.cave,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult2));
console.log('');

console.log('▼ 忘却の遺跡');
const balanceResult3 = runBalanceTest(
  {
    playerLevels: [8, 10, 12, 15, 20],
    dungeonId: 'ruins',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.ruins,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult3));
console.log('');

// ========================================
// 2. パッシブルート別シミュレーション
// ========================================

console.log('='.repeat(60));
console.log('【パッシブルート別シミュレーション】');
console.log('='.repeat(60));
console.log('');

// 各ダンジョンの推奨レベルでパッシブルート別のシミュレーションを実行
const presetKeys: PassivePresetKey[] = [
  'NONE',
  'ATK_POISON', 'ATK_CRIT', 'ATK_REGEN',
  'HP_POISON', 'HP_CRIT', 'HP_REGEN',
];

for (const [dungeonKey, config] of Object.entries(dungeonConfigs)) {
  const info = dungeonInfo[dungeonKey as keyof typeof dungeonInfo];
  const level = info.recommendedLevel;

  console.log(`▼ ${info.name} (推奨Lv.${level})`);
  console.log('');
  console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
  console.log('-----------------|------|------------|----------|------');

  for (const presetKey of presetKeys) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithPassives(level, preset.nodes);
    const passiveEffects = calculatePassiveEffects(preset.nodes);

    const result = runSimulation(
      {
        playerConfig,
        dungeonId: dungeonKey,
        runs: 500,
        seed: 12345,
      },
      config,
      enemyMap
    );

    // 効果サマリー
    const effects: string[] = [];
    if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
    if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
    if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
    if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
    if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
    if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);

    const effectStr = effects.length > 0 ? effects.join(', ') : '-';

    console.log(
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
      effectStr
    );
  }

  console.log('');
}

// ========================================
// 3. 高レベル帯でのパッシブ効果検証
// ========================================

console.log('='.repeat(60));
console.log('【高レベル帯パッシブ効果検証】');
console.log('='.repeat(60));
console.log('');

const highLevelTests = [
  { dungeon: 'cave', level: 10 },
  { dungeon: 'ruins', level: 15 },
  { dungeon: 'ruins', level: 20 },
];

for (const test of highLevelTests) {
  const config = dungeonConfigs[test.dungeon as keyof typeof dungeonConfigs];
  const info = dungeonInfo[test.dungeon as keyof typeof dungeonInfo];

  console.log(`▼ ${info.name} Lv.${test.level}`);
  console.log('');
  console.log('ルート           | 勝率 | 平均ターン | 平均残HP');
  console.log('-----------------|------|------------|--------');

  for (const presetKey of presetKeys) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithPassives(test.level, preset.nodes);

    const result = runSimulation(
      {
        playerConfig,
        dungeonId: test.dungeon,
        runs: 500,
        seed: 12345,
      },
      config,
      enemyMap
    );

    console.log(
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  console.log('');
}

// ========================================
// 4. 装備＋パッシブ組み合わせシミュレーション
// ========================================

console.log('='.repeat(60));
console.log('【装備＋パッシブ組み合わせシミュレーション】');
console.log('='.repeat(60));
console.log('');

// 地底洞窟: 草原装備（ATK+8, DEF+9）× パッシブ各パターン
console.log('▼ 地底洞窟（草原装備一式）');
const grasslandEquip = EQUIPMENT_SETS.GRASSLAND;
const grasslandStats = calculateEquipmentStats(grasslandEquip.equipment);
console.log(`  装備効果: ATK+${grasslandStats.atk}, DEF+${grasslandStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
console.log('-----------------|------|------------|----------|------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    5, // 推奨レベル
    grasslandEquip.equipment,
    preset.nodes
  );
  const passiveEffects = calculatePassiveEffects(preset.nodes);

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'cave',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.cave,
    enemyMap
  );

  // 効果サマリー
  const effects: string[] = [];
  if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
  if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
  if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
  if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
  if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
  if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);
  const effectStr = effects.length > 0 ? effects.join(', ') : '-';

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    effectStr
  );
}

console.log('');

// 忘却の遺跡: 洞窟装備（ATK+13, DEF+9）× パッシブ各パターン
console.log('▼ 忘却の遺跡（洞窟装備一式）');
const caveEquip = EQUIPMENT_SETS.CAVE;
const caveStats = calculateEquipmentStats(caveEquip.equipment);
console.log(`  装備効果: ATK+${caveStats.atk}, DEF+${caveStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
console.log('-----------------|------|------------|----------|------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    10, // 推奨レベル
    caveEquip.equipment,
    preset.nodes
  );
  const passiveEffects = calculatePassiveEffects(preset.nodes);

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'ruins',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.ruins,
    enemyMap
  );

  // 効果サマリー
  const effects: string[] = [];
  if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
  if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
  if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
  if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
  if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
  if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);
  const effectStr = effects.length > 0 ? effects.join(', ') : '-';

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    effectStr
  );
}

console.log('');

// ========================================
// 5. 装備あり/なし比較（推奨レベル）
// ========================================

console.log('='.repeat(60));
console.log('【装備あり/なし比較】');
console.log('='.repeat(60));
console.log('');

const comparisonTests = [
  { dungeon: 'cave', level: 5, equipKey: 'GRASSLAND' as EquipmentSetKey },
  { dungeon: 'ruins', level: 10, equipKey: 'CAVE' as EquipmentSetKey },
];

for (const test of comparisonTests) {
  const dungeonConfig = dungeonConfigs[test.dungeon as keyof typeof dungeonConfigs];
  const info = dungeonInfo[test.dungeon as keyof typeof dungeonInfo];
  const equipSet = EQUIPMENT_SETS[test.equipKey];
  const equipStats = calculateEquipmentStats(equipSet.equipment);

  console.log(`▼ ${info.name} Lv.${test.level}`);
  console.log(`  ${equipSet.name}: ATK+${equipStats.atk}, DEF+${equipStats.def}`);
  console.log('');
  console.log('装備       | パッシブ         | 勝率 | 平均ターン | 平均残HP');
  console.log('-----------|------------------|------|------------|--------');

  // 装備なし × 各パッシブ
  for (const presetKey of ['NONE', 'ATK_CRIT', 'HP_REGEN'] as PassivePresetKey[]) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithEquipmentAndPassives(
      test.level,
      EQUIPMENT_SETS.NONE.equipment,
      preset.nodes
    );

    const result = runSimulation(
      { playerConfig, dungeonId: test.dungeon, runs: 500, seed: 12345 },
      dungeonConfig,
      enemyMap
    );

    console.log(
      `${'なし'.padEnd(9)} | ` +
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  // 装備あり × 各パッシブ
  for (const presetKey of ['NONE', 'ATK_CRIT', 'HP_REGEN'] as PassivePresetKey[]) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithEquipmentAndPassives(
      test.level,
      equipSet.equipment,
      preset.nodes
    );

    const result = runSimulation(
      { playerConfig, dungeonId: test.dungeon, runs: 500, seed: 12345 },
      dungeonConfig,
      enemyMap
    );

    console.log(
      `${equipSet.name.slice(0, 9).padEnd(9)} | ` +
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  console.log('');
}

// ========================================
// 6. ゴブリンの砦 難易度検証（20階層目にゴブリンキング）
// ========================================

console.log('='.repeat(60));
console.log('【ゴブリンの砦 難易度検証】');
console.log('  ※20階層目にボス「ゴブリンキング」(HP300, ATK32, DEF18)');
console.log('='.repeat(60));
console.log('');

// 遺跡装備（MODなし）でゴブリンの砦に挑戦
console.log('▼ ゴブリンの砦（遺跡装備一式・MODなし）');
const ruinsEquip = EQUIPMENT_SETS.RUINS;
const ruinsStats = calculateEquipmentStats(ruinsEquip.equipment);
console.log(`  装備効果: ATK+${ruinsStats.atk}, DEF+${ruinsStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 平均階層');
console.log('-----------------|------|------------|----------|--------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    15, // 推奨レベル
    ruinsEquip.equipment,
    preset.nodes
  );

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'goblin_fort',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.goblin_fort,
    enemyMap
  );

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
  );
}

console.log('');

// 遺跡装備（MOD付き）でゴブリンの砦に挑戦
console.log('▼ ゴブリンの砦（遺跡装備一式・MOD付き + ユニーク装備）');
const ruinsModEquip = EQUIPMENT_SETS.RUINS_WITH_MODS;
const ruinsModStats = calculateEquipmentStats(ruinsModEquip.equipment);
console.log(`  装備効果: ATK+${ruinsModStats.atk}, DEF+${ruinsModStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 平均階層');
console.log('-----------------|------|------------|----------|--------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    15, // 推奨レベル
    ruinsModEquip.equipment,
    preset.nodes
  );

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'goblin_fort',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.goblin_fort,
    enemyMap
  );

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
  );
}

console.log('');

console.log('='.repeat(60));
console.log('シミュレーション完了');
console.log('='.repeat(60));
