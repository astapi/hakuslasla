/**
 * core/combat の中立ビュー型
 *
 * ここに置くのは「どちら側に効くか」に依存しない形の状態ビューだけ。
 * PvE（GaugeBattleState）も PvP（PvpCombatant）も、この形に射影して
 * core/combat の関数を呼べるようにするのが目的。
 *
 * 注意: core/combat の関数はビュー型を丸ごと受け取らず、
 *       「本当に必要な値だけ」をスカラで受け取る設計にしている。
 *       ビュー型はエンジン側が状態を組み立てるときの共通語彙として使う。
 */

import type {
  ChillState,
  FreezeState,
  IgniteState,
  PoisonStack,
} from '../types';

/**
 * 戦闘参加者の中立ビュー（素の戦闘力のみ）
 *
 * `GaugeCombatant` から gauge / attackSpeed / accuracy を除いた最小集合。
 * 攻撃側・防御側のどちらにも同じ型を使える。
 */
export interface CombatantView {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
}

/**
 * 「自分に乗っている状態異常」の中立ビュー
 *
 * PvE では player 側 / enemy 側それぞれの状態がこの形に対応する。
 * PvP では両側が同じ形で持つ。
 */
export interface StatusView {
  poisonStacks: PoisonStack[];
  igniteState: IgniteState | null;
  chillState: ChillState | null;
  freezeState: FreezeState | null;
  /** 発火付与回数（緩慢なる炎キーストーンのスタック計算用） */
  igniteApplyCount: number;
}

/** 空の状態ビューを生成する */
export function createEmptyStatusView(): StatusView {
  return {
    poisonStacks: [],
    igniteState: null,
    chillState: null,
    freezeState: null,
    igniteApplyCount: 0,
  };
}
