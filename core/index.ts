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
  calculateBattleHpAndShield,
  calculatePoisonDamage,
  getPoisonDamageFromMods,
} from './modEffects';

// ペット効果
export { applyPetBuff } from './petEffects';

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
  calculateEnemyHitChance,
  rollEnemyHit,
  createEnemyAttackEvent,
} from './combatEffects';

export type {
  PlayerAttackResult,
  PoisonApplyResult,
  PoisonDamageResult,
} from './combatEffects';

// 中立の戦闘ルール層（PvE / PvP 共有）
// combatEffects と同名の関数を含むため、名前空間として再エクスポートする
import * as combat from './combat';
export { combat };

export type {
  CombatantView,
  StatusView,
  AttackOutcome,
  PoisonApplyOutcome,
  PoisonDamageOutcome,
  IgniteDamageOutcome,
  ChillProcessOutcome,
  FreezeApplyOutcome,
  FreezeProcessOutcome,
} from './combat';

// ゲージ制戦闘関連
export {
  createGaugeBattleState,
  createGaugeBattleStateWithHp,
  runGaugeBattle,
  runGaugeDungeon,
  ticksToSeconds,
  formatBattleTime,
} from './gaugeBattle';

// 共通バトルエンジン
export {
  createBattleEngine,
  runBattleEngineToEnd,
} from './battleEngine';
export type {
  BattleEngine,
  BattleEngineConfig,
} from './battleEngine';

// PvP対称エンジン
export {
  createPvpEngine,
  runPvpBattle,
  resolveActionOrder,
  computeSuddenDeathMult,
  woundMultiplier,
  clonePvpMods,
} from './pvpEngine';

export {
  PVP_RULESET_V1,
  PVP_RULESET_LATEST,
  getPvpRuleset,
  listPvpRulesetVersions,
} from './pvp/ruleset';

export type {
  PvpRuleset,
  PvpStatusResistMode,
  PvpPoisonResistTarget,
  PvpWarlordEnragePhase,
} from './pvp/ruleset';

export {
  createPvpRngStreams,
  derivePvpSeed,
  assertValidPvpSeed,
} from './pvp/rng';

export type { PvpRngStreams } from './pvp/rng';

export type {
  PvpBattleInput,
  PvpBattleState,
  PvpBuildSnapshot,
  PvpCombatant,
  PvpEndReason,
  PvpEngine,
  PvpEvent,
  PvpEventType,
  PvpResult,
  PvpSideIndex,
  PvpWinner,
} from './pvp/types';

// ボス行動（ID定義）
export type { BossSkillId } from './bossBehaviors';

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
