/**
 * シミュレーション実行ロジック
 * React/DB依存なし、UIなしで高速実行可能
 */

import {
  Stats,
  PlayerConfig,
  DungeonConfig,
  EnemyConfig,
  DungeonResult,
  SimulationConfig,
  SimulationStats,
  SimulationResult,
} from './types';
import { getPlayerCombatStats } from './player';
import { runDungeon } from './battle';

// ========================================
// 乱数生成（シード対応）
// ========================================

/**
 * シード付き乱数生成器（xorshift）
 */
export function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/**
 * 配列からランダムに1つ選択
 */
export function pickRandom<T>(array: T[], rng: () => number): T {
  const index = Math.floor(rng() * array.length);
  return array[index];
}

// ========================================
// シミュレーション実行
// ========================================

/**
 * 複数回のダンジョン攻略をシミュレート
 */
export function runSimulation(
  config: SimulationConfig,
  dungeonData: DungeonConfig,
  enemyData: Map<string, EnemyConfig>,
  initialSeed?: number
): SimulationResult {
  const seed = initialSeed ?? config.seed ?? Date.now();
  const rng = createRng(seed);

  const playerStats = getPlayerCombatStats(config.playerConfig);
  const results: DungeonResult[] = [];

  // シミュレーション実行
  for (let i = 0; i < config.runs; i++) {
    const result = runDungeon(
      playerStats,
      dungeonData,
      (id) => enemyData.get(id),
      (enemyIds) => pickRandom(enemyIds, rng),
      (dropTable) => dropTable.length > 0 ? pickRandom(dropTable, rng) : undefined
    );
    results.push(result);
  }

  // 統計計算
  const stats = calculateSimulationStats(results);

  return {
    config,
    stats,
    results,
  };
}

/**
 * シミュレーション結果から統計を計算
 */
export function calculateSimulationStats(results: DungeonResult[]): SimulationStats {
  if (results.length === 0) {
    return {
      winRate: 0,
      avgTurns: 0,
      avgExpGained: 0,
      avgFloorsCleared: 0,
      avgPlayerHpRemaining: 0,
      minTurns: 0,
      maxTurns: 0,
      totalRuns: 0,
      wins: 0,
      losses: 0,
    };
  }

  const wins = results.filter((r) => r.cleared).length;
  const losses = results.length - wins;

  const totalTurns = results.reduce((sum, r) => sum + r.totalTurns, 0);
  const totalExp = results.reduce((sum, r) => sum + r.totalExp, 0);
  const totalFloorsCleared = results.reduce((sum, r) => sum + r.floorsCleared, 0);
  const totalHpRemaining = results.reduce((sum, r) => sum + r.playerHpRemaining, 0);

  const turns = results.map((r) => r.totalTurns);
  const minTurns = Math.min(...turns);
  const maxTurns = Math.max(...turns);

  return {
    winRate: wins / results.length,
    avgTurns: totalTurns / results.length,
    avgExpGained: totalExp / results.length,
    avgFloorsCleared: totalFloorsCleared / results.length,
    avgPlayerHpRemaining: totalHpRemaining / results.length,
    minTurns,
    maxTurns,
    totalRuns: results.length,
    wins,
    losses,
  };
}

// ========================================
// バッチシミュレーション（難易度調整用）
// ========================================

export interface BalanceTestConfig {
  playerLevels: number[];
  dungeonId: string;
  runsPerLevel: number;
  seed?: number;
}

export interface BalanceTestResult {
  dungeonId: string;
  levelResults: {
    level: number;
    stats: SimulationStats;
  }[];
}

/**
 * 複数レベルでの難易度バランステスト
 */
export function runBalanceTest(
  config: BalanceTestConfig,
  dungeonData: DungeonConfig,
  enemyData: Map<string, EnemyConfig>,
  createPlayerConfig: (level: number) => PlayerConfig
): BalanceTestResult {
  const seed = config.seed ?? Date.now();
  let currentSeed = seed;

  const levelResults = config.playerLevels.map((level) => {
    const playerConfig = createPlayerConfig(level);
    const simConfig: SimulationConfig = {
      playerConfig,
      dungeonId: config.dungeonId,
      runs: config.runsPerLevel,
      seed: currentSeed,
    };

    const result = runSimulation(simConfig, dungeonData, enemyData, currentSeed);
    currentSeed += 1000; // 次のレベルでは異なるシード

    return {
      level,
      stats: result.stats,
    };
  });

  return {
    dungeonId: config.dungeonId,
    levelResults,
  };
}

// ========================================
// レポート生成
// ========================================

/**
 * シミュレーション結果をテキストレポートに変換
 */
export function generateSimulationReport(result: SimulationResult): string {
  const { config, stats } = result;
  const lines: string[] = [];

  lines.push('=== シミュレーション結果 ===');
  lines.push(`ダンジョンID: ${config.dungeonId}`);
  lines.push(`プレイヤーレベル: ${config.playerConfig.level}`);
  lines.push(`実行回数: ${stats.totalRuns}`);
  lines.push('');
  lines.push('--- 統計 ---');
  lines.push(`勝率: ${(stats.winRate * 100).toFixed(1)}%`);
  lines.push(`勝利: ${stats.wins} / 敗北: ${stats.losses}`);
  lines.push(`平均ターン数: ${stats.avgTurns.toFixed(1)} (${stats.minTurns}〜${stats.maxTurns})`);
  lines.push(`平均獲得EXP: ${stats.avgExpGained.toFixed(1)}`);
  lines.push(`平均クリア階層: ${stats.avgFloorsCleared.toFixed(1)}`);
  lines.push(`平均残りHP: ${stats.avgPlayerHpRemaining.toFixed(1)}`);

  return lines.join('\n');
}

/**
 * バランステスト結果をテキストレポートに変換
 */
export function generateBalanceReport(result: BalanceTestResult): string {
  const lines: string[] = [];

  lines.push('=== バランステスト結果 ===');
  lines.push(`ダンジョンID: ${result.dungeonId}`);
  lines.push('');
  lines.push('レベル | 勝率 | 平均ターン | 平均EXP | 平均残HP');
  lines.push('-------|------|------------|---------|--------');

  for (const lr of result.levelResults) {
    const { level, stats } = lr;
    lines.push(
      `Lv${level.toString().padStart(3)} | ` +
      `${(stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${stats.avgExpGained.toFixed(0).padStart(7)} | ` +
      `${stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  return lines.join('\n');
}
