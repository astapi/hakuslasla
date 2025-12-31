/**
 * Core Game Logic
 * UIなしでシミュレーション可能な純粋計算ロジック
 */

// 型定義
export * from './types';

// プレイヤー関連
export {
  INITIAL_STATS,
  LEVEL_UP_BONUS,
  getExpToNextLevel,
  calculateLevelUp,
  calculateTotalStats,
  calculateBaseStatsForLevel,
  getPlayerCombatStats,
  createDefaultPlayerConfig,
} from './player';

// 戦闘関連
export {
  calculateDamage,
  executeTurn,
  runBattle,
  runDungeon,
  estimateWinChance,
} from './battle';

// シミュレーション関連
export {
  createRng,
  pickRandom,
  runSimulation,
  calculateSimulationStats,
  runBalanceTest,
  generateSimulationReport,
  generateBalanceReport,
} from './simulation';

export type { BalanceTestConfig, BalanceTestResult } from './simulation';
