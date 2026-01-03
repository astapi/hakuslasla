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
  PASSIVE_PRESETS,
  PassivePresetKey,
  INITIAL_STATS,
  runSimulation,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';

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
  return {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap(m =>
      Array(m.spawnRate).fill(m.monsterId)
    ),
    dropTable: allDrops.map(d => d.itemId),
  };
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
};

// ダンジョン情報（推奨レベル付き）
const dungeonInfo = {
  grassland: { name: '始まりの草原', recommendedLevel: 1 },
  cave: { name: '地底洞窟', recommendedLevel: 5 },
  ruins: { name: '忘却の遺跡', recommendedLevel: 10 },
};

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

console.log('='.repeat(60));
console.log('シミュレーション完了');
console.log('='.repeat(60));
