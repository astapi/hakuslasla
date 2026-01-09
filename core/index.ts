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
  MAX_LEVEL,
  INVENTORY_MAX_SIZE,
  getExpToNextLevel,
  calculateLevelUp,
  calculateTotalStats,
  calculateBaseStatsForLevel,
  getPlayerCombatStats,
  createDefaultPlayerConfig,
  PASSIVE_ROUTES,
  PASSIVE_PRESETS,
} from './player';

export type { PassivePresetKey } from './player';

// 戦闘関連
export {
  applyPercentageScaling,
  calculateFinalStats,
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
