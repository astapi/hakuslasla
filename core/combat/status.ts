/**
 * 中立の状態異常ルール: チル / フリーズ
 *
 * 「付与する側のMOD」と「付与される側に既に乗っている状態」だけを受け取り、
 * player / enemy のどちらかに固定された参照を持たない。
 * 式・丸め・RNGの呼び出し順序は core/combatEffects.ts の元実装と完全に同一。
 */

import {
  BattleConfig,
  ChillState,
  CombinedModEffects,
  DEFAULT_BATTLE_CONFIG,
  FreezeState,
} from '../types';

// ========================================
// チル
// ========================================

/**
 * チルの速度倍率を計算する
 * 基本0.8 → chillEffectPct で強化（下げる）、最低は config.chillMinSpeedMultiplier
 */
function calculateChillSpeedMultiplier(
  attackerMods: CombinedModEffects,
  config: BattleConfig
): number {
  const effectReduction = attackerMods.chillEffectPct / 100;  // 例: 30% → 0.3
  return Math.max(
    config.chillMinSpeedMultiplier,
    config.chillBaseSpeedMultiplier - effectReduction * (1 - config.chillBaseSpeedMultiplier)
  );
}

/** チル持続時間を計算する */
function calculateChillDurationMs(
  attackerMods: CombinedModEffects,
  config: BattleConfig
): number {
  return Math.floor(config.chillDurationMs * (1 + attackerMods.chillDurationPct / 100));
}

/**
 * 状態異常耐性を「確率減算型」で適用する
 *
 * `chance * (1 - min(cap, max(0, resist)) / 100)`
 * PvE の battleEngine.ts:1240,1254（クラーケンのフリーズ/チル付与）と同一の式。
 * `resistPct = 0` のときは `chance * 1` となり、値は1ビットも変わらない。
 */
function applyResistToChance(chance: number, resistPct: number, resistCapPct: number): number {
  if (resistPct <= 0) return chance;
  return chance * (1 - Math.min(resistCapPct, Math.max(0, resistPct)) / 100);
}

/**
 * チル付与を試行する（上書き式）
 *
 * 返る `ChillState` の `speedMultiplier` / `remainingMs` がそのままイベント用の値になる。
 *
 * @param attackerMods 付与側のMOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @param targetChillResistPct 対象のチル耐性%（既定0＝耐性なし。PvEは常に0で挙動不変）
 * @param resistCapPct 耐性の上限%（既定90）
 */
export function tryApplyChill(
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random,
  targetChillResistPct: number = 0,
  resistCapPct: number = 90
): ChillState | null {
  const effectiveChance = applyResistToChance(
    attackerMods.chillChance,
    targetChillResistPct,
    resistCapPct
  );
  if (effectiveChance <= 0 || rng() * 100 >= effectiveChance) {
    return null;
  }

  return {
    speedMultiplier: calculateChillSpeedMultiplier(attackerMods, config),
    remainingMs: calculateChillDurationMs(attackerMods, config),
  };
}

/** チル持続処理の結果（イベントは含まない） */
export interface ChillProcessOutcome {
  updatedState: ChillState | null;
  expired: boolean;
}

/**
 * チル状態を時間経過で1ティック分更新する
 *
 * @param chillState 対象に乗っているチル状態
 * @param config 戦闘設定
 */
export function processChillState(
  chillState: ChillState | null,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): ChillProcessOutcome {
  if (!chillState) {
    return { updatedState: null, expired: false };
  }

  const deltaMs = 1000 / config.ticksPerSecond;
  const newRemainingMs = chillState.remainingMs - deltaMs;

  if (newRemainingMs <= 0) {
    return { updatedState: null, expired: true };
  }

  return {
    updatedState: { ...chillState, remainingMs: newRemainingMs },
    expired: false,
  };
}

// ========================================
// フリーズ
// ========================================

/** フリーズ付与の結果（イベントは含まない） */
export interface FreezeApplyOutcome {
  freezeState: FreezeState | null;
  /** フリーズ解除後に移行するチル状態 */
  chillAfterFreeze: ChillState | null;
}

/**
 * フリーズ付与を試行する（独立判定、発生率にハードキャップあり）
 *
 * 返る `freezeState.remainingMs` がそのままイベント用の持続時間になる。
 *
 * @param isTargetFrozen 対象が既にフリーズ中か（フリーズ中は再フリーズしない）
 * @param attackerMods 付与側のMOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @param targetFreezeResistPct 対象のフリーズ耐性%（既定0＝耐性なし。PvEは常に0で挙動不変）
 * @param resistCapPct 耐性の上限%（既定90）
 */
export function tryApplyFreeze(
  isTargetFrozen: boolean,
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random,
  targetFreezeResistPct: number = 0,
  resistCapPct: number = 90
): FreezeApplyOutcome {
  // フリーズ中は再フリーズしない（RNGを消費しない）
  if (isTargetFrozen) {
    return { freezeState: null, chillAfterFreeze: null };
  }

  // 発生率にハードキャップ適用（ペットバフ freezeChanceCapPct で上限を引き上げ可能）
  const cappedChance = Math.min(
    attackerMods.freezeChance,
    config.freezeChanceCap + (attackerMods.freezeChanceCapPct ?? 0)
  );
  // 対象のフリーズ耐性を確率減算型で適用（既定0のときは値が変わらない）
  const effectiveChance = applyResistToChance(cappedChance, targetFreezeResistPct, resistCapPct);
  if (effectiveChance <= 0 || rng() * 100 >= effectiveChance) {
    return { freezeState: null, chillAfterFreeze: null };
  }

  // フリーズ持続時間
  const durationMs = Math.floor(
    config.freezeDurationMs * (1 + attackerMods.freezeDurationPct / 100)
  );

  const freezeState: FreezeState = {
    remainingMs: durationMs,
  };

  // フリーズ解除後にチルに移行するための状態を準備
  const chillAfterFreeze: ChillState = {
    speedMultiplier: calculateChillSpeedMultiplier(attackerMods, config),
    remainingMs: calculateChillDurationMs(attackerMods, config),
  };

  return { freezeState, chillAfterFreeze };
}

/** フリーズ持続処理の結果（イベントは含まない） */
export interface FreezeProcessOutcome {
  updatedState: FreezeState | null;
  /** フリーズ解除時に移行するチル状態 */
  chillTransition: ChillState | null;
  expired: boolean;
}

/**
 * フリーズ状態を時間経過で1ティック分更新する
 *
 * @param freezeState 対象に乗っているフリーズ状態
 * @param pendingChillAfterFreeze フリーズ解除時に移行するチル状態
 * @param config 戦闘設定
 */
export function processFreezeState(
  freezeState: FreezeState | null,
  pendingChillAfterFreeze: ChillState | null,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): FreezeProcessOutcome {
  if (!freezeState) {
    return { updatedState: null, chillTransition: null, expired: false };
  }

  const deltaMs = 1000 / config.ticksPerSecond;
  const newRemainingMs = freezeState.remainingMs - deltaMs;

  if (newRemainingMs <= 0) {
    return {
      updatedState: null,
      chillTransition: pendingChillAfterFreeze,
      expired: true,
    };
  }

  return {
    updatedState: { ...freezeState, remainingMs: newRemainingMs },
    chillTransition: null,
    expired: false,
  };
}
