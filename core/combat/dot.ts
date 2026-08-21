/**
 * 中立の継続ダメージ（DoT）ルール: 毒 / 発火
 *
 * 「付与する側のMOD」と「付与される側に既に乗っている状態」だけを受け取り、
 * player / enemy のどちらかに固定された参照を持たない。
 * 式・丸め・RNGの呼び出し順序は core/combatEffects.ts の元実装と完全に同一。
 */

import { getIgniteDamageFromMods, getPoisonDamageFromMods } from '../modEffects';
import {
  BattleConfig,
  CombinedModEffects,
  DEFAULT_BATTLE_CONFIG,
  IgniteState,
  PoisonStack,
} from '../types';
import type { StatusView } from './types';

// ========================================
// 毒
// ========================================

/** 毒付与の結果（イベントは含まない） */
export interface PoisonApplyOutcome {
  /** 付与された毒スタック。付与されなかった場合は null */
  poisonStack: PoisonStack | null;
  /** 付与後のスタック数（付与されなかった場合は付与前と同じ） */
  stackCount: number;
}

/**
 * 毒付与を試行する
 *
 * @param targetPoisonStackCount 対象に既に乗っている毒スタック数
 * @param baseDamage 毒ダメージ計算の基準となる基本ダメージ
 * @param attackerMods 付与側のMOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 */
export function tryApplyPoison(
  targetPoisonStackCount: number,
  baseDamage: number,
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): PoisonApplyOutcome {
  // スタック上限チェック（上限に達している場合はRNGを消費しない）
  const maxStacks = config.basePoisonMaxStacks + attackerMods.poisonMaxStacks;
  if (targetPoisonStackCount >= maxStacks) {
    return { poisonStack: null, stackCount: targetPoisonStackCount };
  }

  // 毒付与判定
  if (attackerMods.poisonChance <= 0 || rng() * 100 >= attackerMods.poisonChance) {
    return { poisonStack: null, stackCount: targetPoisonStackCount };
  }

  // 毒ダメージ計算
  const rawPoisonDamage = Math.max(1, Math.floor(baseDamage * config.poisonDamageRatio));
  const poisonDamage = getPoisonDamageFromMods(rawPoisonDamage, attackerMods);

  const poisonStack: PoisonStack = {
    damagePerTick: poisonDamage,
    remainingTicks: config.poisonDuration,
  };

  return { poisonStack, stackCount: targetPoisonStackCount + 1 };
}

/** 毒ダメージ処理の結果（イベントは含まない） */
export interface PoisonDamageOutcome {
  totalDamage: number;
  healAmount: number;
  updatedStacks: PoisonStack[];
  /** このティックで消滅したスタック数 */
  stacksRemoved: number;
  /** 消滅が発生し、かつスタックが全て無くなったか */
  expired: boolean;
}

/**
 * 毒ダメージを1ティック分処理する
 *
 * @param poisonStacks 対象に乗っている毒スタック
 * @param attackerMods 毒を付与した側のMOD効果（毒ダメージ吸収の計算に使う）
 */
export function processPoisonDamage(
  poisonStacks: PoisonStack[],
  attackerMods: CombinedModEffects
): PoisonDamageOutcome {
  if (poisonStacks.length === 0) {
    return {
      totalDamage: 0,
      healAmount: 0,
      updatedStacks: [],
      stacksRemoved: 0,
      expired: false,
    };
  }

  // 全スタックのダメージを合計
  const totalDamage = poisonStacks.reduce((sum, p) => sum + p.damagePerTick, 0);

  // 毒ダメージ吸収による回復量計算
  const healAmount = attackerMods.poisonLifesteal > 0
    ? Math.floor(totalDamage * attackerMods.poisonLifesteal / 100)
    : 0;

  // 各スタックの残りティックを減らし、0以下になったものを除去
  const updatedStacks = poisonStacks
    .map((p) => ({ ...p, remainingTicks: p.remainingTicks - 1 }))
    .filter((p) => p.remainingTicks > 0);

  const stacksRemoved = poisonStacks.length - updatedStacks.length;

  return {
    totalDamage,
    healAmount,
    updatedStacks,
    stacksRemoved,
    expired: stacksRemoved > 0 && updatedStacks.length === 0,
  };
}

// ========================================
// 発火
// ========================================

/**
 * 発火付与を試行する（上書き式）
 *
 * 付与に成功した場合、返る `IgniteState` の `remainingMs` がそのまま持続時間、
 * `damage` / `tickIntervalMs` がそのままイベント用の値になる。
 *
 * @param baseDamage 発火ダメージ計算の基準となる基本ダメージ
 * @param igniteApplyCount これまでの発火付与回数（緩慢なる炎キーストーン用）
 * @param elapsedTicks 現在の経過ティック（lastTickMs の基準）
 * @param attackerMods 付与側のMOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 */
export function tryApplyIgnite(
  baseDamage: number,
  igniteApplyCount: number,
  elapsedTicks: number,
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): IgniteState | null {
  // 発火付与判定
  if (attackerMods.igniteChance <= 0 || rng() * 100 >= attackerMods.igniteChance) {
    return null;
  }

  // 発火ダメージ計算（緩慢なる炎キーストーンのスタック効果を含む）
  // 今回の付与を含めたカウントで計算（5回目の付与で+10%になるように+1）
  const rawIgniteDamage = Math.max(1, Math.floor(baseDamage * config.igniteDamageRatio));
  const igniteDamage = getIgniteDamageFromMods(rawIgniteDamage, attackerMods, igniteApplyCount + 1);

  // 継続時間計算（MODで延長可能）
  const durationMs = Math.floor(
    config.igniteDurationMs * (1 + attackerMods.igniteDurationPct / 100)
  );

  // ダメージ間隔計算（MODで短縮可能）
  // igniteTickSpeedPct が高いほど間隔が短くなる
  const tickIntervalMs = Math.max(
    100, // 最低100ms
    Math.floor(config.igniteTickIntervalMs / (1 + attackerMods.igniteTickSpeedPct / 100))
  );

  // 経過時間をミリ秒に変換（1ティック = 1/30秒 ≈ 33.3ms）
  const currentTimeMs = Math.floor((elapsedTicks / config.ticksPerSecond) * 1000);

  return {
    damage: igniteDamage,
    remainingMs: durationMs,
    tickIntervalMs,
    lastTickMs: currentTimeMs, // 付与時点から最初のダメージまでinterval待つ
  };
}

/** 発火ダメージ処理の結果（イベントは含まない） */
export interface IgniteDamageOutcome {
  totalDamage: number;
  healAmount: number;
  updatedState: IgniteState | null;
  /** このティックで発生したダメージ回数 */
  tickCount: number;
  /** イベントに載せる残り時間（0未満は0にクランプ済み） */
  remainingMs: number;
  /** 発火が終了したか */
  expired: boolean;
}

/**
 * 発火ダメージを1ティック分処理する
 *
 * @param igniteState 対象に乗っている発火状態
 * @param tick 現在のティック
 * @param attackerMods 発火を付与した側のMOD効果（発火ダメージ吸収の計算に使う）
 * @param config 戦闘設定
 */
export function processIgniteDamage(
  igniteState: IgniteState | null,
  tick: number,
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): IgniteDamageOutcome {
  if (!igniteState) {
    return {
      totalDamage: 0,
      healAmount: 0,
      updatedState: null,
      tickCount: 0,
      remainingMs: 0,
      expired: false,
    };
  }

  const ignite = igniteState;

  // 経過時間をミリ秒に変換
  const currentTimeMs = Math.floor((tick / config.ticksPerSecond) * 1000);

  // 最後のダメージからの経過時間
  const timeSinceLastTick = currentTimeMs - ignite.lastTickMs;

  // ダメージ発生回数を計算
  const ticksToApply = Math.floor(timeSinceLastTick / ignite.tickIntervalMs);

  // 経過時間を減算（1ティック分 = 1/30秒 ≈ 33.3ms）
  const deltaMs = 1000 / config.ticksPerSecond;
  const newRemainingMs = ignite.remainingMs - deltaMs;

  let totalDamage = 0;

  if (ticksToApply > 0) {
    // ダメージ適用
    totalDamage = ignite.damage * ticksToApply;
  }

  // 発火ダメージ吸収による回復量計算
  const healAmount = attackerMods.igniteLifesteal > 0
    ? Math.floor(totalDamage * attackerMods.igniteLifesteal / 100)
    : 0;

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
  }

  return {
    totalDamage,
    healAmount,
    updatedState,
    tickCount: ticksToApply,
    remainingMs: Math.max(0, newRemainingMs),
    expired: newRemainingMs <= 0,
  };
}

// ========================================
// 状態の判定ヘルパー
// ========================================

/** 毒状態か */
export function isPoisoned(status: Pick<StatusView, 'poisonStacks'>): boolean {
  return status.poisonStacks.length > 0;
}

/** 発火状態か */
export function isIgnited(status: Pick<StatusView, 'igniteState'>): boolean {
  return status.igniteState !== null;
}
