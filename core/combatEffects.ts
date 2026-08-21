/**
 * 戦闘効果ロジック（PvE / GaugeBattleState 用の薄いラッパ）
 *
 * 実際の計算式は core/combat/ の中立関数に委譲している。
 * このファイルの役割は次の2つだけ:
 *   1. GaugeBattleState から中立関数が必要とする値を取り出す
 *   2. 中立関数が返した数値結果から、従来どおりの BattleEvent を組み立てる
 *
 * BattleEvent の型名（'player_attack' / 'enemy_attack' / target:'enemy'）は
 * PvE固有の語彙なので、中立層ではなくここで組み立てる。
 *
 * 既存のエクスポート関数はシグネチャを完全に維持している。
 */

import {
  CombinedModEffects,
  GaugeBattleState,
  PoisonStack,
  IgniteState,
  ChillState,
  FreezeState,
  BattleEvent,
  BattleConfig,
  DEFAULT_BATTLE_CONFIG,
} from './types';
import {
  executeAttack,
  calculateIncomingDamage,
  calculateHitChance,
  rollHit,
  calculateLifesteal as calculateLifestealNeutral,
  calculateHpRegen as calculateHpRegenNeutral,
  tryApplyPoison as tryApplyPoisonNeutral,
  processPoisonDamage as processPoisonDamageNeutral,
  tryApplyIgnite as tryApplyIgniteNeutral,
  processIgniteDamage as processIgniteDamageNeutral,
  tryApplyChill as tryApplyChillNeutral,
  processChillState as processChillStateNeutral,
  tryApplyFreeze as tryApplyFreezeNeutral,
  processFreezeState as processFreezeStateNeutral,
} from './combat';

// ========================================
// プレイヤー攻撃
// ========================================

/**
 * プレイヤー攻撃結果
 */
export interface PlayerAttackResult {
  damage: number;
  isCritical: boolean;
  hasFollowUp: boolean;  // 追撃が発生したか
  followUpDamage: number;  // 追撃ダメージ
  events: BattleEvent[];
}

/**
 * プレイヤーの攻撃を実行
 * @param state 現在の戦闘状態
 * @param playerAtk プレイヤーの攻撃力
 * @param mods MOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @returns 攻撃結果
 */
export function executePlayerAttack(
  state: GaugeBattleState,
  playerAtk: number,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random,
  enemyDamageReductionPct: number = 0
): PlayerAttackResult {
  const outcome = executeAttack(
    playerAtk,
    state.enemy.def,
    mods,
    config,
    rng,
    enemyDamageReductionPct
  );

  const events: BattleEvent[] = [];

  // イベント生成（ダメージ0でも攻撃イベントは発火）
  if (outcome.isCritical && outcome.damage > 0) {
    events.push({
      type: 'critical_hit',
      tick: state.elapsedTicks,
      data: { damage: outcome.damage, target: 'enemy' },
    });
  } else {
    events.push({
      type: 'player_attack',
      tick: state.elapsedTicks,
      data: { damage: outcome.damage },
    });
  }

  if (outcome.hasFollowUp) {
    events.push({
      type: 'player_attack',  // 追撃も通常攻撃扱い
      tick: state.elapsedTicks,
      data: { damage: outcome.followUpDamage },
    });
  }

  return {
    damage: outcome.damage,
    isCritical: outcome.isCritical,
    hasFollowUp: outcome.hasFollowUp,
    followUpDamage: outcome.followUpDamage,
    events,
  };
}

// ========================================
// 毒システム
// ========================================

/**
 * 毒付与結果
 */
export interface PoisonApplyResult {
  poisonStack: PoisonStack | null;
  event: BattleEvent | null;
}

/**
 * 毒付与を試行
 * @param state 現在の戦闘状態
 * @param baseDamage プレイヤーの基本ダメージ（毒ダメージ計算用）
 * @param mods MOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @returns 付与結果
 */
export function tryApplyPoison(
  state: GaugeBattleState,
  baseDamage: number,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): PoisonApplyResult {
  const outcome = tryApplyPoisonNeutral(
    state.enemyPoisonStacks.length,
    baseDamage,
    mods,
    config,
    rng
  );

  if (!outcome.poisonStack) {
    return { poisonStack: null, event: null };
  }

  const event: BattleEvent = {
    type: 'poison_applied',
    tick: state.elapsedTicks,
    data: {
      damage: outcome.poisonStack.damagePerTick,
      duration: outcome.poisonStack.remainingTicks,
      stackCount: outcome.stackCount,
    },
  };

  return { poisonStack: outcome.poisonStack, event };
}

/**
 * 毒ダメージ処理結果
 */
export interface PoisonDamageResult {
  totalDamage: number;
  healAmount: number;
  updatedStacks: PoisonStack[];
  events: BattleEvent[];
}

/**
 * 毒ダメージを処理
 * @param state 現在の戦闘状態
 * @param tick 現在のティック
 * @param mods MOD効果（毒ダメージ吸収用）
 * @returns 処理結果
 */
export function processPoisonDamage(
  state: GaugeBattleState,
  tick: number,
  mods: CombinedModEffects
): PoisonDamageResult {
  const outcome = processPoisonDamageNeutral(state.enemyPoisonStacks, mods);

  const events: BattleEvent[] = [];

  // ダメージイベント
  if (outcome.totalDamage > 0) {
    events.push({
      type: 'poison_damage',
      tick,
      data: {
        damage: outcome.totalDamage,
        remainingStacks: outcome.updatedStacks.length,
        healAmount: outcome.healAmount,
      },
    });
  }

  // スタック消失イベント
  if (outcome.expired) {
    events.push({
      type: 'poison_expired',
      tick,
      data: { stacksRemoved: outcome.stacksRemoved },
    });
  }

  return {
    totalDamage: outcome.totalDamage,
    healAmount: outcome.healAmount,
    updatedStacks: outcome.updatedStacks,
    events,
  };
}

// ========================================
// 発火システム
// ========================================

/**
 * 発火付与結果
 */
export interface IgniteApplyResult {
  igniteState: IgniteState | null;
  event: BattleEvent | null;
}

/**
 * 発火付与を試行（上書き式）
 * @param state 現在の戦闘状態
 * @param baseDamage プレイヤーの基本ダメージ（発火ダメージ計算用）
 * @param mods MOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @returns 付与結果
 */
export function tryApplyIgnite(
  state: GaugeBattleState,
  baseDamage: number,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): IgniteApplyResult {
  const igniteState = tryApplyIgniteNeutral(
    baseDamage,
    state.igniteApplyCount,
    state.elapsedTicks,
    mods,
    config,
    rng
  );

  if (!igniteState) {
    return { igniteState: null, event: null };
  }

  const event: BattleEvent = {
    type: 'ignite_applied',
    tick: state.elapsedTicks,
    data: {
      damage: igniteState.damage,
      durationMs: igniteState.remainingMs,
      tickIntervalMs: igniteState.tickIntervalMs,
    },
  };

  return { igniteState, event };
}

/**
 * 発火ダメージ処理結果
 */
export interface IgniteDamageResult {
  totalDamage: number;
  healAmount: number;
  updatedState: IgniteState | null;
  events: BattleEvent[];
}

/**
 * 発火ダメージを処理
 * @param state 現在の戦闘状態
 * @param tick 現在のティック
 * @param mods MOD効果（発火ダメージ吸収用）
 * @param config 戦闘設定
 * @returns 処理結果
 */
export function processIgniteDamage(
  state: GaugeBattleState,
  tick: number,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): IgniteDamageResult {
  if (!state.enemyIgniteState) {
    return { totalDamage: 0, healAmount: 0, updatedState: null, events: [] };
  }

  const outcome = processIgniteDamageNeutral(state.enemyIgniteState, tick, mods, config);
  const events: BattleEvent[] = [];

  if (outcome.tickCount > 0) {
    events.push({
      type: 'ignite_damage',
      tick,
      data: {
        damage: outcome.totalDamage,
        tickCount: outcome.tickCount,
        remainingMs: outcome.remainingMs,
      },
    });
  }

  if (outcome.expired) {
    // 発火終了
    events.push({
      type: 'ignite_expired',
      tick,
      data: {},
    });
  }

  return {
    totalDamage: outcome.totalDamage,
    healAmount: outcome.healAmount,
    updatedState: outcome.updatedState,
    events,
  };
}

// ========================================
// HP回復
// ========================================

/**
 * HP回復量を計算
 * @param currentHp 現在のHP
 * @param maxHp 最大HP
 * @param mods MOD効果
 * @returns 回復量（上限考慮済み）
 */
export function calculateHpRegen(
  currentHp: number,
  maxHp: number,
  mods: CombinedModEffects
): number {
  return calculateHpRegenNeutral(currentHp, maxHp, mods);
}

/**
 * HP回復イベントを生成
 */
export function createHpRegenEvent(
  tick: number,
  amount: number
): BattleEvent | null {
  if (amount <= 0) return null;
  return {
    type: 'hp_regen',
    tick,
    data: { amount },
  };
}

// ========================================
// HIT時HP回復
// ========================================

/**
 * HIT時HP回復量を計算（固定値）
 * @param damage 与えたダメージ（0以上でないと回復しない）
 * @param isCritical クリティカルかどうか
 * @param mods MOD効果
 * @returns 回復量
 */
export function calculateLifesteal(
  damage: number,
  isCritical: boolean,
  mods: CombinedModEffects
): number {
  return calculateLifestealNeutral(damage, isCritical, mods);
}

/**
 * ライフスティールイベントを生成
 */
export function createLifestealEvent(
  tick: number,
  amount: number
): BattleEvent | null {
  if (amount <= 0) return null;
  return {
    type: 'lifesteal',
    tick,
    data: { amount },
  };
}

// ========================================
// 敵の攻撃
// ========================================

/**
 * 敵の攻撃ダメージを計算
 * @param enemyAtk 敵の攻撃力
 * @param playerDef プレイヤーの防御力
 * @param mods MOD効果
 * @param isEnemyPoisoned 敵が毒状態かどうか
 * @param isEnemyIgnited 敵が発火状態かどうか
 * @returns ダメージ量
 */
export function calculateEnemyDamage(
  enemyAtk: number,
  playerDef: number,
  mods: CombinedModEffects,
  isEnemyPoisoned: boolean,
  isEnemyIgnited = false
): number {
  return calculateIncomingDamage(enemyAtk, playerDef, mods, isEnemyPoisoned, isEnemyIgnited);
}

export function calculateEnemyHitChance(enemyAccuracy: number = 100, playerEvasion: number = 0): number {
  return calculateHitChance(enemyAccuracy, playerEvasion);
}

export function rollEnemyHit(
  enemyAccuracy: number | undefined,
  playerEvasion: number,
  rng: () => number
): boolean {
  return rollHit(enemyAccuracy, playerEvasion, rng);
}

/**
 * 敵攻撃イベントを生成
 */
export function createEnemyAttackEvent(
  tick: number,
  damage: number
): BattleEvent {
  return {
    type: 'enemy_attack',
    tick,
    data: { damage },
  };
}

// ========================================
// チルシステム
// ========================================

/**
 * チル付与結果
 */
export interface ChillApplyResult {
  chillState: ChillState | null;
  event: BattleEvent | null;
}

/**
 * チル付与を試行（上書き式）
 */
export function tryApplyChill(
  state: GaugeBattleState,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): ChillApplyResult {
  const chillState = tryApplyChillNeutral(mods, config, rng);

  if (!chillState) {
    return { chillState: null, event: null };
  }

  const event: BattleEvent = {
    type: 'chill_applied',
    tick: state.elapsedTicks,
    data: {
      speedMultiplier: chillState.speedMultiplier,
      durationMs: chillState.remainingMs,
    },
  };

  return { chillState, event };
}

/**
 * チル持続管理結果
 */
export interface ChillProcessResult {
  updatedState: ChillState | null;
  event: BattleEvent | null;
}

/**
 * チル状態を時間経過で更新
 */
export function processChillState(
  chillState: ChillState | null,
  tick: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): ChillProcessResult {
  const outcome = processChillStateNeutral(chillState, config);

  if (outcome.expired) {
    return {
      updatedState: null,
      event: {
        type: 'chill_expired',
        tick,
        data: {},
      },
    };
  }

  return { updatedState: outcome.updatedState, event: null };
}

// ========================================
// フリーズシステム
// ========================================

/**
 * フリーズ付与結果
 */
export interface FreezeApplyResult {
  freezeState: FreezeState | null;
  chillAfterFreeze: ChillState | null;  // フリーズ解除後に移行するチル状態
  event: BattleEvent | null;
}

/**
 * フリーズ付与を試行（独立判定、上限10%）
 */
export function tryApplyFreeze(
  state: GaugeBattleState,
  mods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): FreezeApplyResult {
  const outcome = tryApplyFreezeNeutral(Boolean(state.enemyFreezeState), mods, config, rng);

  if (!outcome.freezeState) {
    return { freezeState: null, chillAfterFreeze: null, event: null };
  }

  const event: BattleEvent = {
    type: 'freeze_applied',
    tick: state.elapsedTicks,
    data: { durationMs: outcome.freezeState.remainingMs },
  };

  return {
    freezeState: outcome.freezeState,
    chillAfterFreeze: outcome.chillAfterFreeze,
    event,
  };
}

/**
 * フリーズ持続管理結果
 */
export interface FreezeProcessResult {
  updatedState: FreezeState | null;
  chillTransition: ChillState | null;  // フリーズ解除時にチルに移行
  event: BattleEvent | null;
}

/**
 * フリーズ状態を時間経過で更新
 */
export function processFreezeState(
  freezeState: FreezeState | null,
  pendingChillAfterFreeze: ChillState | null,
  tick: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): FreezeProcessResult {
  const outcome = processFreezeStateNeutral(freezeState, pendingChillAfterFreeze, config);

  if (outcome.expired) {
    return {
      updatedState: null,
      chillTransition: outcome.chillTransition,
      event: {
        type: 'freeze_expired',
        tick,
        data: {},
      },
    };
  }

  return {
    updatedState: outcome.updatedState,
    chillTransition: null,
    event: null,
  };
}
