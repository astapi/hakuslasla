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
} from '../core';

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
  // 共通とダンジョン固有のドロップを結合
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  return {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    // モンスター出現確率から敵IDリストを生成（確率に応じて重複させる）
    enemies: dungeon.monsters.flatMap(m =>
      Array(m.spawnRate).fill(m.monsterId)
    ),
    dropTable: allDrops.map(d => d.itemId),
  };
}

// ========================================
// シミュレーション実行
// ========================================

console.log('='.repeat(60));
console.log('ハクスラダンジョン シミュレーション');
console.log('='.repeat(60));
console.log('');

// 各ダンジョンのバランステスト
const dungeonConfigs = {
  grassland: toDungeonConfig(dungeonsData.dungeons.grassland),
  cave: toDungeonConfig(dungeonsData.dungeons.cave),
  ruins: toDungeonConfig(dungeonsData.dungeons.ruins),
};

console.log('【バランステスト: 始まりの草原】');
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

console.log('【バランステスト: 地底洞窟】');
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

console.log('【バランステスト: 忘却の遺跡】');
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

console.log('='.repeat(60));
console.log('シミュレーション完了');
console.log('='.repeat(60));
