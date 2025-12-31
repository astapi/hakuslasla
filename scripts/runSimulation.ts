/**
 * シミュレーション実行スクリプト
 *
 * 使用方法:
 *   npx ts-node --esm scripts/runSimulation.ts
 *
 * または tsconfig でパスを設定後:
 *   npx tsx scripts/runSimulation.ts
 */

import {
  runSimulation,
  runBalanceTest,
  generateSimulationReport,
  generateBalanceReport,
  createDefaultPlayerConfig,
  EnemyConfig,
  DungeonConfig,
  SimulationConfig,
} from '../core';

// ========================================
// マスターデータ（data/からコピー）
// ========================================

const enemies: Record<string, EnemyConfig> = {
  slime: {
    id: 'slime',
    name: 'スライム',
    maxHp: 20,
    atk: 5,
    def: 2,
    exp: 10,
  },
  goblin: {
    id: 'goblin',
    name: 'ゴブリン',
    maxHp: 30,
    atk: 8,
    def: 3,
    exp: 15,
  },
  wolf: {
    id: 'wolf',
    name: 'オオカミ',
    maxHp: 25,
    atk: 10,
    def: 2,
    exp: 12,
  },
  skeleton: {
    id: 'skeleton',
    name: 'スケルトン',
    maxHp: 35,
    atk: 12,
    def: 5,
    exp: 20,
  },
  orc: {
    id: 'orc',
    name: 'オーク',
    maxHp: 50,
    atk: 15,
    def: 8,
    exp: 30,
  },
  troll: {
    id: 'troll',
    name: 'トロール',
    maxHp: 80,
    atk: 20,
    def: 10,
    exp: 50,
  },
};

const dungeons: Record<string, DungeonConfig> = {
  beginners_forest: {
    id: 'beginners_forest',
    name: '初心者の森',
    maxFloor: 5,
    enemies: ['slime', 'slime', 'goblin'],
    dropTable: ['wooden_sword', 'leather_armor'],
  },
  goblin_cave: {
    id: 'goblin_cave',
    name: 'ゴブリンの洞窟',
    maxFloor: 5,
    enemies: ['goblin', 'goblin', 'wolf', 'skeleton'],
    dropTable: ['iron_sword', 'leather_armor'],
  },
  ancient_ruins: {
    id: 'ancient_ruins',
    name: '古代遺跡',
    maxFloor: 5,
    enemies: ['skeleton', 'orc', 'troll'],
    dropTable: ['steel_sword', 'iron_armor'],
  },
};

// EnemyConfigのMapを作成
const enemyMap = new Map<string, EnemyConfig>(Object.entries(enemies));

// ========================================
// シミュレーション実行
// ========================================

console.log('='.repeat(60));
console.log('ハクスラダンジョン シミュレーション');
console.log('='.repeat(60));
console.log('');

// 単一シミュレーション
const playerConfig = createDefaultPlayerConfig(5); // レベル5
const simConfig: SimulationConfig = {
  playerConfig,
  dungeonId: 'beginners_forest',
  runs: 1000,
  seed: 12345,
};

console.log('【単一シミュレーション】');
const result = runSimulation(
  simConfig,
  dungeons.beginners_forest,
  enemyMap
);
console.log(generateSimulationReport(result));
console.log('');

// バランステスト
console.log('【バランステスト: 初心者の森】');
const balanceResult1 = runBalanceTest(
  {
    playerLevels: [1, 3, 5, 7, 10],
    dungeonId: 'beginners_forest',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeons.beginners_forest,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult1));
console.log('');

console.log('【バランステスト: ゴブリンの洞窟】');
const balanceResult2 = runBalanceTest(
  {
    playerLevels: [3, 5, 7, 10, 15],
    dungeonId: 'goblin_cave',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeons.goblin_cave,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult2));
console.log('');

console.log('【バランステスト: 古代遺跡】');
const balanceResult3 = runBalanceTest(
  {
    playerLevels: [5, 10, 15, 20, 25],
    dungeonId: 'ancient_ruins',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeons.ancient_ruins,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult3));
console.log('');

console.log('='.repeat(60));
console.log('シミュレーション完了');
console.log('='.repeat(60));
