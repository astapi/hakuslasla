/**
 * 戦闘効果ロジック
 * 攻撃、毒、回復、ライフスティール等の戦闘中の効果計算
 */

import {
  CombinedModEffects,
  GaugeBattleState,
  PoisonStack,
  IgniteState,
  BattleEvent,
  BattleConfig,
  DEFAULT_BATTLE_CONFIG,
} from './types';
import { calculateDamage } from './battle';
import { getPoisonDamageFromMods, getIgniteDamageFromMods } from './modEffects';

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
  const events: BattleEvent[] = [];

  // クリティカル判定
  const isCritical = mods.criticalChance > 0 && rng() * 100 < mods.criticalChance;
  const criticalMultiplier = isCritical
    ? config.baseCriticalMultiplier + mods.criticalDamage / 100
    : 1;

  // 基本ダメージ計算（DEF減衰式）
  const baseDamage = calculateDamage(playerAtk, state.enemy.def, enemyDamageReductionPct);

  // 通常ダメージ無効化チェック（キーストーン効果）
  const finalDamage = mods.noDirectDamage
    ? 0
    : Math.floor(baseDamage * criticalMultiplier);

  // イベント生成（ダメージ0でも攻撃イベントは発火）
  if (isCritical && finalDamage > 0) {
    events.push({
      type: 'critical_hit',
      tick: state.elapsedTicks,
      data: { damage: finalDamage, target: 'enemy' },
    });
  } else {
    events.push({
      type: 'player_attack',
      tick: state.elapsedTicks,
      data: { damage: finalDamage },
    });
  }

  // クリティカル追撃判定
  let hasFollowUp = false;
  let followUpDamage = 0;

  if (isCritical && mods.criticalFollowUpAttack && !mods.noDirectDamage) {
    hasFollowUp = true;
    // 追撃ダメージ = ATK × 0.5（DEF減衰あり）
    const followUpBase = calculateDamage(playerAtk * 0.5, state.enemy.def, enemyDamageReductionPct);
    followUpDamage = Math.floor(followUpBase);

    events.push({
      type: 'player_attack',  // 追撃も通常攻撃扱い
      tick: state.elapsedTicks,
      data: { damage: followUpDamage },
    });
  }

  return { damage: finalDamage, isCritical, hasFollowUp, followUpDamage, events };
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
  // スタック上限チェック
  const maxStacks = config.basePoisonMaxStacks + mods.poisonMaxStacks;
  if (state.enemyPoisonStacks.length >= maxStacks) {
    return { poisonStack: null, event: null };
  }

  // 毒付与判定
  if (mods.poisonChance <= 0 || rng() * 100 >= mods.poisonChance) {
    return { poisonStack: null, event: null };
  }

  // 毒ダメージ計算
  const rawPoisonDamage = Math.max(1, Math.floor(baseDamage * config.poisonDamageRatio));
  const poisonDamage = getPoisonDamageFromMods(rawPoisonDamage, mods);

  const poisonStack: PoisonStack = {
    damagePerTick: poisonDamage,
    remainingTicks: config.poisonDuration,
  };

  const currentStacks = state.enemyPoisonStacks.length;
  const event: BattleEvent = {
    type: 'poison_applied',
    tick: state.elapsedTicks,
    data: {
      damage: poisonDamage,
      duration: config.poisonDuration,
      stackCount: currentStacks + 1,
    },
  };

  return { poisonStack, event };
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
  if (state.enemyPoisonStacks.length === 0) {
    return { totalDamage: 0, healAmount: 0, updatedStacks: [], events: [] };
  }

  const events: BattleEvent[] = [];

  // 全スタックのダメージを合計
  const totalDamage = state.enemyPoisonStacks.reduce(
    (sum, p) => sum + p.damagePerTick,
    0
  );

  // 毒ダメージ吸収による回復量計算
  const healAmount = mods.poisonLifesteal > 0
    ? Math.floor(totalDamage * mods.poisonLifesteal / 100)
    : 0;

  // 各スタックの残りティックを減らし、0以下になったものを除去
  const updatedStacks = state.enemyPoisonStacks
    .map((p) => ({ ...p, remainingTicks: p.remainingTicks - 1 }))
    .filter((p) => p.remainingTicks > 0);

  const stacksRemoved = state.enemyPoisonStacks.length - updatedStacks.length;

  // ダメージイベント
  if (totalDamage > 0) {
    events.push({
      type: 'poison_damage',
      tick,
      data: {
        damage: totalDamage,
        remainingStacks: updatedStacks.length,
        healAmount,
      },
    });
  }

  // スタック消失イベント
  if (stacksRemoved > 0 && updatedStacks.length === 0) {
    events.push({
      type: 'poison_expired',
      tick,
      data: { stacksRemoved },
    });
  }

  return { totalDamage, healAmount, updatedStacks, events };
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
  // 発火付与判定
  if (mods.igniteChance <= 0 || rng() * 100 >= mods.igniteChance) {
    return { igniteState: null, event: null };
  }

  // 発火ダメージ計算（毒より少し弱い）
  const rawIgniteDamage = Math.max(1, Math.floor(baseDamage * config.igniteDamageRatio));
  const igniteDamage = getIgniteDamageFromMods(rawIgniteDamage, mods);

  // 継続時間計算（MODで延長可能）
  const durationMs = Math.floor(
    config.igniteDurationMs * (1 + mods.igniteDurationPct / 100)
  );

  // ダメージ間隔計算（MODで短縮可能）
  // igniteTickSpeedPct が高いほど間隔が短くなる
  const tickIntervalMs = Math.max(
    100, // 最低100ms
    Math.floor(config.igniteTickIntervalMs / (1 + mods.igniteTickSpeedPct / 100))
  );

  // 経過時間をミリ秒に変換（1ティック = 1/30秒 ≈ 33.3ms）
  const currentTimeMs = Math.floor((state.elapsedTicks / config.ticksPerSecond) * 1000);

  const igniteState: IgniteState = {
    damage: igniteDamage,
    remainingMs: durationMs,
    tickIntervalMs,
    lastTickMs: currentTimeMs, // 付与時点から最初のダメージまでinterval待つ
  };

  const event: BattleEvent = {
    type: 'ignite_applied',
    tick: state.elapsedTicks,
    data: {
      damage: igniteDamage,
      durationMs,
      tickIntervalMs,
    },
  };

  return { igniteState, event };
}

/**
 * 発火ダメージ処理結果
 */
export interface IgniteDamageResult {
  totalDamage: number;
  updatedState: IgniteState | null;
  events: BattleEvent[];
}

/**
 * 発火ダメージを処理
 * @param state 現在の戦闘状態
 * @param tick 現在のティック
 * @param config 戦闘設定
 * @returns 処理結果
 */
export function processIgniteDamage(
  state: GaugeBattleState,
  tick: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): IgniteDamageResult {
  if (!state.enemyIgniteState) {
    return { totalDamage: 0, updatedState: null, events: [] };
  }

  const events: BattleEvent[] = [];
  const ignite = state.enemyIgniteState;

  // 経過時間をミリ秒に変換
  const currentTimeMs = Math.floor((tick / config.ticksPerSecond) * 1000);

  // 最後のダメージからの経過時間
  const timeSinceLastTick = currentTimeMs - ignite.lastTickMs;

  // ダメージ発生回数を計算
  const ticksToApply = Math.floor(timeSinceLastTick / ignite.tickIntervalMs);

  let totalDamage = 0;

  if (ticksToApply > 0) {
    // ダメージ適用
    totalDamage = ignite.damage * ticksToApply;

    events.push({
      type: 'ignite_damage',
      tick,
      data: {
        damage: totalDamage,
        tickCount: ticksToApply,
      },
    });
  }

  // 経過時間を減算（1ティック分 = 1/30秒 ≈ 33.3ms）
  const deltaMs = 1000 / config.ticksPerSecond;
  const newRemainingMs = ignite.remainingMs - deltaMs;

  // 発火状態を更新
  let updatedState: IgniteState | null = null;

  if (newRemainingMs > 0) {
    updatedState = {
      ...ignite,
      remainingMs: newRemainingMs,
      lastTickMs: ticksToApply > 0
        ? ignite.lastTickMs + ticksToApply * ignite.tickIntervalMs
        : ignite.lastTickMs,
    };
  } else {
    // 発火終了
    events.push({
      type: 'ignite_expired',
      tick,
      data: {},
    });
  }

  return { totalDamage, updatedState, events };
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
  const flatRegen = mods.hpRegen;
  const pctRegen = Math.floor(maxHp * mods.hpRegenPct / 100);
  const totalRegen = flatRegen + pctRegen;

  // 最大HPを超えない
  const actualRegen = Math.min(totalRegen, maxHp - currentHp);
  return Math.max(0, actualRegen);
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
  if (damage <= 0) return 0;

  // HIT時HP回復（固定値）
  let totalRecovery = mods.hpOnHit;

  // クリティカル時の追加HP回復（固定値）
  if (isCritical && mods.hpOnCrit > 0) {
    totalRecovery += mods.hpOnCrit;
  }

  return totalRecovery;
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
 * @returns ダメージ量
 */
export function calculateEnemyDamage(
  enemyAtk: number,
  playerDef: number,
  mods: CombinedModEffects,
  isEnemyPoisoned: boolean
): number {
  // 追加ダメージ軽減
  let totalDamageReduction = mods.damageReductionPct;

  // 敵が毒状態時の追加軽減
  if (isEnemyPoisoned) {
    totalDamageReduction += mods.poisonDamageReduction;
  }

  return calculateDamage(enemyAtk, playerDef, totalDamageReduction);
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
