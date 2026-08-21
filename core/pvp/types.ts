/**
 * PvP対称エンジンの型定義
 *
 * 設計書 docs/pvp-design.md §3.1 に、
 * 監査（docs/pvp-p1-engine-spec.md §7）で判明した「片側専用stateの両側化分」を足したもの。
 *
 * ボス関連（BossEffectState）は一切持ち込まない。
 */

import type {
  ChillState,
  CombinedModEffects,
  DeferredDamage,
  FreezeState,
  IgniteState,
  PoisonStack,
  Stats,
} from '../types';

/** 側の番号。[0]=挑戦者 [1]=防衛者 */
export type PvpSideIndex = 0 | 1;

/** 勝敗 */
export type PvpWinner = PvpSideIndex | 'draw';

/** 決着理由 */
export type PvpEndReason = 'ko' | 'timeout' | 'draw';

/**
 * 戦闘に投入するビルドのスナップショット
 *
 * `stats` は getTotalStats() 相当の最終ステータス（defHpToAtk はここに畳み込み済み）。
 * `mods` は装備+パッシブ+クラス能力+Uberツリーを合成した CombinedModEffects。
 */
export interface PvpBuildSnapshot {
  stats: Stats;
  mods: CombinedModEffects;
}

/** PvP戦闘の入力。この3つだけで全イベントが再生成できる */
export interface PvpBattleInput {
  /** [0]=挑戦者 [1]=防衛者 */
  sides: [PvpBuildSnapshot, PvpBuildSnapshot];
  /** 乱数シード。0 は禁止（createRng の不動点） */
  seed: number;
  /** 使用するルールセットのバージョン */
  rulesetVersion: number;
}

/**
 * PvPの戦闘参加者。全フィールドが両側対称。
 */
export interface PvpCombatant {
  // --- 素の戦闘力 ---
  currentHp: number;
  maxHp: number;
  /** 素のATK（時間バフ前・damageScale前） */
  atk: number;
  /** 素のDEF（時間バフ前） */
  def: number;
  /** ruleset.playerAccuracy */
  accuracy: number;
  /** getAttackSpeedFromMods(mods) * (heavyStrike ? 0.8 : 1)。warlordEnrageで再計算される */
  attackSpeedBase: number;
  gauge: number;
  /** 入力から必ずディープコピーしたもの（warlordEnrage が破壊的に変更するため） */
  mods: CombinedModEffects;

  // --- ティックごとに再計算される派生値 ---
  /** 時間バフ適用後の実効ATK（damageScale 適用前） */
  effectiveAtk: number;
  /** 時間バフ適用後の実効ATK × ruleset.damageScale。全ダメージ算出はここから派生する */
  scaledAtk: number;
  /** 時間バフ適用後の実効DEF */
  effectiveDef: number;
  /** チル/フリーズ反映後の実効攻撃速度（行動順の判定に使う） */
  effectiveAttackSpeed: number;
  /** 5秒ごとに増える timeHpRegen ボーナス */
  timeHpRegenBonus: number;

  // --- シールド ---
  shield: number;
  maxShield: number;
  lastShieldDamageTick: number | null;
  lastHitDamageTick: number | null;
  lastAutoCleanseTick: number | null;

  // --- 自分に乗っている状態異常 ---
  poisonStacks: PoisonStack[];
  igniteState: IgniteState | null;
  chillState: ChillState | null;
  freezeState: FreezeState | null;
  /** フリーズ解除時に移行するチル（PvEではエンジンローカル・敵側のみ） */
  pendingChillAfterFreeze: ChillState | null;
  /** 自分に乗っている重傷スタック */
  woundStacks: number;
  /** 自分が行動した回数のカウンタ（4で重傷1減少） */
  woundActionCounter: number;

  // --- カウンタ ---
  attackCount: number;
  consecutiveEvades: number;
  /** 自分が発火を付与した回数（緩慢なる炎キーストーン用） */
  igniteApplyCount: number;
  /** 毒マルチスタックの端数蓄積 */
  poisonStackAccumulator: number;
  deferredDamages: DeferredDamage[];
  /** 1秒周期の位相 */
  regenCounter: number;
  warlordEnrageActivated: boolean;

  // --- RNG（側ごと独立ストリーム） ---
  rng: () => number;
}

/** PvP戦闘の状態 */
export interface PvpBattleState {
  sides: [PvpCombatant, PvpCombatant];
  elapsedTicks: number;
  isFinished: boolean;
  winner: PvpWinner | null;
  reason: PvpEndReason | null;
}

/** PvPイベントの種類 */
export type PvpEventType =
  | 'attack'
  | 'poison_applied'
  | 'poison_damage'
  | 'ignite_applied'
  | 'ignite_damage'
  | 'ignite_expired'
  | 'chill_applied'
  | 'chill_expired'
  | 'freeze_applied'
  | 'freeze_expired'
  | 'wound_applied'
  | 'wound_decayed'
  | 'heal'
  | 'shield_restored'
  | 'damage'
  | 'cleanse'
  | 'warlord_enrage'
  | 'defeated';

/**
 * PvPイベント（中立形）
 *
 * `side` の意味は **「そのイベントの主体＝状態が変化した側」** で統一する。
 * - `attack` … 攻撃した側（ダメージは相手が受ける）
 * - `poison_damage` / `chill_applied` / `wound_applied` … 効果を受けた側
 * - `heal` / `shield_restored` / `cleanse` / `warlord_enrage` … 回復・変化した側
 * - `defeated` … 倒れた側
 *
 * この規約により「sidesを入れ替えるとイベントの side が 1-s に反転する」だけになり、
 * 対称性テストが機械的に書ける。
 */
export interface PvpEvent {
  type: PvpEventType;
  tick: number;
  side: PvpSideIndex;
  data: Record<string, unknown>;
}

/** PvP戦闘の結果 */
export interface PvpResult {
  winner: PvpWinner;
  elapsedTicks: number;
  /** [side0, side1] の最終HP */
  finalHp: [number, number];
  /** [side0, side1] の最終シールド */
  finalShield: [number, number];
  /**
   * [side0, side1] の最終残存割合 `(currentHp + shield) / (maxHp + maxShield)`
   *
   * 時間切れの判定にもこの値を使う。HPだけで判定すると、シールドで全ダメージを
   * 吸収しきったビルド同士が「両者HP満タン＝完全同値」になり、実際には削られている側が
   * 防衛側というだけで不戦勝になってしまうため（P1の総当たりで全体の8.2%が該当）。
   */
  finalHpPct: [number, number];
  reason: PvpEndReason;
  events: PvpEvent[];
}

/** PvPエンジン */
export interface PvpEngine {
  advanceTicks: (ticks: number) => PvpEvent[];
  runToEnd: () => PvpResult;
  getState: () => PvpBattleState;
  isFinished: () => boolean;
}
