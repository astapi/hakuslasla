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
  LEVEL_BASED_PRESETS,
  getLevelBasedPreset,
} from './player';

export type { PassivePresetKey, PassivePreset } from './player';

// 戦闘関連（ターン制）
export {
  applyPercentageScaling,
  calculateFinalStats,
  calculateDamage,
  executeTurn,
  runBattle,
  runDungeon,
  estimateWinChance,
} from './battle';

// MOD効果関連
export {
  createEmptyModEffects,
  combineMods,
  calculateAttackSpeed,
  getAttackSpeedFromMods,
  calculatePoisonDamage,
  getPoisonDamageFromMods,
} from './modEffects';

export type {
  ItemModData,
  EquipmentItemData,
  PassiveEffectsData,
} from './modEffects';

// 戦闘効果関連
export {
  executePlayerAttack,
  tryApplyPoison,
  processPoisonDamage,
  calculateHpRegen,
  createHpRegenEvent,
  calculateLifesteal,
  createLifestealEvent,
  calculateEnemyDamage,
  createEnemyAttackEvent,
} from './combatEffects';

export type {
  PlayerAttackResult,
  PoisonApplyResult,
  PoisonDamageResult,
} from './combatEffects';

// ゲージ制戦闘関連
export {
  createGaugeBattleState,
  createGaugeBattleStateWithHp,
  runGaugeBattle,
  runGaugeDungeon,
  ticksToSeconds,
  formatBattleTime,
} from './gaugeBattle';

// エンドコンテンツ関連
export * from './endContent';

// シミュレーション関連（ターン制）
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

// シミュレーション関連（ゲージ制）
export {
  runGaugeSimulation,
  calculateGaugeSimulationStats,
  runGaugeBalanceTest,
  generateGaugeSimulationReport,
  generateGaugeBalanceReport,
} from './simulation';

export type {
  GaugeSimulationConfig,
  GaugeSimulationStats,
  GaugeSimulationResult,
  GaugeBalanceTestConfig,
  GaugeBalanceTestResult,
} from './simulation';

// 装備セット（シミュレーション用）
export {
  DUNGEON_EQUIPMENT_SETS,
  getDungeonEquipmentSet,
  getEquipmentSetForLevel,
  extractModsFromEquipmentSet,
  generateRandomEquipmentSet,
  generateSimulationMods,
} from './equipmentSets';

export type {
  EquipmentSet,
  DungeonEquipmentSets,
  EquipmentSetType,
} from './equipmentSets';
