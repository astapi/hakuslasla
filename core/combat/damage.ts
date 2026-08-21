/**
 * 中立の攻撃・被ダメージ・回復ルール
 *
 * 「攻撃側」「防御側」という役割だけで記述されており、
 * player / enemy のどちらかに固定された参照を一切持たない。
 * 式・丸め・RNGの呼び出し順序は core/combatEffects.ts の元実装と完全に同一。
 */

import { calculateDamage } from '../battle';
import {
  BattleConfig,
  CombinedModEffects,
  DEFAULT_BATTLE_CONFIG,
} from '../types';

/**
 * 攻撃の結果（イベントは含まない）
 *
 * イベント生成は呼び出し側（PvEなら combatEffects.ts、PvPなら pvpEngine.ts）が行う。
 * 中立側は「数値としてどうなったか」だけを返す。
 */
export interface AttackOutcome {
  /** 本体ダメージ（noDirectDamage なら 0） */
  damage: number;
  isCritical: boolean;
  /** クリティカル追撃が発生したか */
  hasFollowUp: boolean;
  /** 追撃ダメージ */
  followUpDamage: number;
}

/**
 * 攻撃を実行する（クリティカル判定・クリティカル追撃を含む）
 *
 * @param attackerAtk 攻撃側の攻撃力
 * @param defenderDef 防御側の防御力
 * @param attackerMods 攻撃側のMOD効果
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @param defenderDamageReductionPct 防御側の追加ダメージ軽減%
 */
export function executeAttack(
  attackerAtk: number,
  defenderDef: number,
  attackerMods: CombinedModEffects,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random,
  defenderDamageReductionPct: number = 0
): AttackOutcome {
  // クリティカル判定
  const isCritical = attackerMods.criticalChance > 0 && rng() * 100 < attackerMods.criticalChance;
  const criticalMultiplier = isCritical
    ? config.baseCriticalMultiplier + attackerMods.criticalDamage / 100
    : 1;

  // 基本ダメージ計算（DEF減衰式）
  const baseDamage = calculateDamage(attackerAtk, defenderDef, defenderDamageReductionPct);

  // 通常ダメージ無効化チェック（キーストーン効果）
  const damage = attackerMods.noDirectDamage
    ? 0
    : Math.floor(baseDamage * criticalMultiplier);

  // クリティカル追撃判定
  let hasFollowUp = false;
  let followUpDamage = 0;

  if (isCritical && attackerMods.criticalFollowUpAttack && !attackerMods.noDirectDamage) {
    hasFollowUp = true;
    // 追撃ダメージ = ATK × 0.5（DEF減衰あり）
    const followUpBase = calculateDamage(attackerAtk * 0.5, defenderDef, defenderDamageReductionPct);
    followUpDamage = Math.floor(followUpBase);
  }

  return { damage, isCritical, hasFollowUp, followUpDamage };
}

/**
 * 被ダメージを計算する
 *
 * 防御側のMODによる軽減（通常軽減 + 攻撃側が毒/発火状態のときの追加軽減）を適用する。
 *
 * @param attackerAtk 攻撃側の攻撃力
 * @param defenderDef 防御側の防御力
 * @param defenderMods 防御側のMOD効果
 * @param isAttackerPoisoned 攻撃側が毒状態か
 * @param isAttackerIgnited 攻撃側が発火状態か
 */
export function calculateIncomingDamage(
  attackerAtk: number,
  defenderDef: number,
  defenderMods: CombinedModEffects,
  isAttackerPoisoned: boolean,
  isAttackerIgnited = false
): number {
  // 防具MODのダメージ軽減（ダメージ遅延は別処理）
  let totalDamageReduction = defenderMods.damageReductionPct;

  // 攻撃側が毒状態時の追加軽減
  if (isAttackerPoisoned) {
    totalDamageReduction += defenderMods.poisonDamageReduction;
  }
  if (isAttackerIgnited) {
    totalDamageReduction += defenderMods.igniteDamageReduction;
  }

  return calculateDamage(attackerAtk, defenderDef, totalDamageReduction);
}

/**
 * 命中率を計算する（%、5〜95にクランプ）
 *
 * @param accuracy 攻撃側の命中レーティング
 * @param evasion 防御側の回避レーティング
 */
export function calculateHitChance(accuracy: number = 100, evasion: number = 0): number {
  const acc = Math.max(1, accuracy);
  const eva = Math.max(0, evasion);
  const hitChance = Math.round((acc / (acc + eva)) * 100);
  return Math.min(95, Math.max(5, hitChance));
}

/**
 * 命中判定を行う
 *
 * @param accuracy 攻撃側の命中レーティング（未指定なら100）
 * @param evasion 防御側の回避レーティング
 * @param rng 乱数生成関数
 */
export function rollHit(
  accuracy: number | undefined,
  evasion: number,
  rng: () => number
): boolean {
  return rng() * 100 < calculateHitChance(accuracy ?? 100, evasion);
}

/**
 * HIT時のHP回復量を計算する
 *
 * @param damage 与えたダメージ（0以下なら回復しない）
 * @param isCritical クリティカルだったか
 * @param attackerMods 攻撃側のMOD効果
 */
export function calculateLifesteal(
  damage: number,
  isCritical: boolean,
  attackerMods: CombinedModEffects
): number {
  if (damage <= 0) return 0;

  // HIT時HP回復（固定値）
  let totalRecovery = attackerMods.hpOnHit;

  // 与ダメージのX%回復（ライフスティール、ペットバフ由来）
  if (attackerMods.lifestealPct > 0) {
    totalRecovery += Math.floor(damage * attackerMods.lifestealPct / 100);
  }

  // クリティカル時の追加HP回復（固定値）
  if (isCritical && attackerMods.hpOnCrit > 0) {
    totalRecovery += attackerMods.hpOnCrit;
  }

  return totalRecovery;
}

/**
 * 毎秒HP回復量を計算する（最大HP超過分は切り捨て）
 *
 * @param currentHp 現在HP
 * @param maxHp 最大HP
 * @param mods 自分のMOD効果
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
