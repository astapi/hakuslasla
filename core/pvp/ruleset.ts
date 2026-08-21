/**
 * PvPルールセット（エンジン外の設定）
 *
 * docs/pvp-design.md §3.5 と docs/pvp-p1-engine-spec.md §8 の定義。
 * 係数を1箇所に集約し、`version` を申告に含めることで
 * 「係数を調整しても過去の試合が検証不能にならない」ようにする。
 *
 * 値を変えるときは新しい version を足す。既存の version は絶対に書き換えない。
 */

export type PvpStatusResistMode = 'roll' | 'chanceReduction';
export type PvpPoisonResistTarget = 'apply' | 'damage' | 'both';
export type PvpWarlordEnragePhase = 'tick' | 'onDefend';

export interface PvpRuleset {
  /** ルールセットのバージョン。申告に含める */
  version: number;

  // --- 設計書 §3.5 ---
  /** 全ダメージに掛ける係数。実効ATK算出時に1回だけ掛ける */
  damageScale: number;
  /** PvP中のプレイヤーに一律付与する命中レーティング（敵モンスターの最大値と同値） */
  playerAccuracy: number;
  /** サドンデス開始秒 */
  suddenDeathStartSec: number;
  /** サドンデスの被ダメージ倍率上昇率（%/秒） */
  suddenDeathRampPctPerSec: number;
  /** 制限時間（秒）。到達したら残HP割合で判定 */
  timeLimitSec: number;

  // --- 仕様メモ §8 で追加が必要と判明したもの ---
  /**
   * チル/フリーズ耐性の適用形式。
   * 'chanceReduction' = `chance * (1 - min(cap, resist)/100)`（確率減算型・RNG消費が増えない）
   * 'roll' は現行PvEのボス由来判定と同形だが決定性検証が煩雑なのでPvPでは採らない。
   */
  statusResistMode: PvpStatusResistMode;
  /** 状態異常耐性の上限%（現行の `min(90, …)` を外出ししたもの） */
  statusResistCapPct: number;
  /** 毒耐性をどこに効かせるか。PvEの二重適用は持ち込まず 'damage' に統一 */
  poisonResistAppliesTo: PvpPoisonResistTarget;
  /** `igniteResistPct`（PvEでは死に効果）を発火ダメージ軽減として有効化するか */
  igniteResistEnabled: boolean;
  /** 王の咆哮が発火も解除するか（PvEでは発火stateが片側に無いため解除していない） */
  royalRoarCleansesIgnite: boolean;
  /** 永久凍土の自動解除が発火も解除するか */
  autoCleanseCleansesIgnite: boolean;
  /** 乱軍の王の発動判定タイミング。PvPは毎ティック両側判定 */
  warlordEnrageCheckPhase: PvpWarlordEnragePhase;
  /** 1ティックあたりの最大行動回数（PvEは 5 でハードコード） */
  maxActionsPerTick: number;
  /** 安全のための絶対上限ティック数 */
  maxTicks: number;
  /** 反撃ダメージ（`retaliateDefPct`）にも damageScale を掛けるか */
  damageScaleAppliesToRetaliate: boolean;
  /**
   * サドンデス倍率を継続ダメージ（毒・発火・遅延ダメージの消化）にも掛けるか
   *
   * 設計書 §3.4(c) は「両者の**被ダメージ倍率**」と規定しているので true が正。
   * false にすると P1初版の挙動（スイングにしか掛からない）に戻せる。
   *
   * true のとき、遅延ダメージは**素の値でキューに積み、消化時に倍率を掛ける**。
   * 生成時と消化時の二重適用（倍率の2乗）を避けるため。
   */
  suddenDeathAppliesToDot: boolean;
}

/**
 * v1: P1実装時の暫定値。
 * damageScale / playerAccuracy / サドンデスの3値は P2 で実ビルド総当たりの分布を見て決める。
 */
export const PVP_RULESET_V1: PvpRuleset = Object.freeze({
  version: 1,
  damageScale: 0.15,
  playerAccuracy: 500,
  suddenDeathStartSec: 45,
  suddenDeathRampPctPerSec: 5,
  timeLimitSec: 90,
  statusResistMode: 'chanceReduction',
  statusResistCapPct: 90,
  poisonResistAppliesTo: 'damage',
  igniteResistEnabled: true,
  royalRoarCleansesIgnite: true,
  autoCleanseCleansesIgnite: true,
  warlordEnrageCheckPhase: 'tick',
  maxActionsPerTick: 5,
  maxTicks: 30000,
  damageScaleAppliesToRetaliate: true,
  suddenDeathAppliesToDot: true,
});

/** 現行の最新ルールセット */
export const PVP_RULESET_LATEST: PvpRuleset = PVP_RULESET_V1;

const PVP_RULESETS: ReadonlyMap<number, PvpRuleset> = new Map<number, PvpRuleset>([
  [PVP_RULESET_V1.version, PVP_RULESET_V1],
]);

/** バージョン番号からルールセットを引く。未知のバージョンは例外 */
export function getPvpRuleset(version: number): PvpRuleset {
  const ruleset = PVP_RULESETS.get(version);
  if (!ruleset) {
    const known = [...PVP_RULESETS.keys()].join(', ');
    throw new Error(`unknown PvP ruleset version: ${version} (known: ${known})`);
  }
  return ruleset;
}

/** 既知のバージョン一覧（昇順） */
export function listPvpRulesetVersions(): number[] {
  return [...PVP_RULESETS.keys()].sort((a, b) => a - b);
}
