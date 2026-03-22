/**
 * Uberツリーロジック
 * Uberボス撃破で得たポイントで解放する、パッシブツリーとは別のツリー
 */

import { PassiveEffect, PassiveNodeData } from '@/types';
import uberTreeData from './json/uberTree.json';

export interface UberTreeNode extends PassiveNodeData {
  route: string;
}

export const UBER_TREE_START_NODE_ID = uberTreeData.startNodeId;

// ノードデータをロード
const nodes: Map<string, UberTreeNode> = new Map();
for (const node of uberTreeData.nodes as UberTreeNode[]) {
  nodes.set(node.id, node);
}

export const getUberTreeNode = (nodeId: string): UberTreeNode | undefined => {
  return nodes.get(nodeId);
};

export const getAllUberTreeNodes = (): UberTreeNode[] => {
  return Array.from(nodes.values());
};

/**
 * スタートノードは常に解放済みとして扱う
 */
function isNodeUnlocked(nodeId: string, unlockedNodes: string[]): boolean {
  if (nodeId === UBER_TREE_START_NODE_ID) return true;
  return unlockedNodes.includes(nodeId);
}

/**
 * Uberツリーノードを解放可能か判定
 */
export function canUnlockUberNode(nodeId: string, unlockedNodes: string[]): boolean {
  // スタートノードは解放不要
  if (nodeId === UBER_TREE_START_NODE_ID) return false;
  if (unlockedNodes.includes(nodeId)) return false;

  const node = nodes.get(nodeId);
  if (!node) return false;

  // 前提ノードなし → 解放可能
  if (node.requiredNodes.length === 0) return true;

  // 全前提ノードが解放済みか（スタートノードは常に解放済み）
  return node.requiredNodes.every(req => {
    if (typeof req === 'string') {
      return isNodeUnlocked(req, unlockedNodes);
    }
    // OR条件
    return (req as string[]).some(r => isNodeUnlocked(r, unlockedNodes));
  });
}

/**
 * Uberツリーノードを返却可能か判定
 * - スタートノードは返却不可
 * - 未解放ノードは返却不可
 * - 依存している解放済みノードがある場合は返却不可
 */
export function canRefundUberNode(nodeId: string, unlockedNodes: string[]): boolean {
  if (nodeId === UBER_TREE_START_NODE_ID) return false;
  if (!unlockedNodes.includes(nodeId)) return false;

  // このノードを除外した場合に、他の解放済みノードの前提が壊れないかチェック
  const remaining = unlockedNodes.filter((id) => id !== nodeId);
  for (const otherId of remaining) {
    const otherNode = nodes.get(otherId);
    if (!otherNode) continue;
    // otherNode の requiredNodes にこのノードが含まれているか確認
    const dependsOnThis = otherNode.requiredNodes.some(req => {
      if (typeof req === 'string') return req === nodeId;
      return (req as string[]).includes(nodeId);
    });
    if (!dependsOnThis) continue;
    // 依存している場合、残りのノードで前提条件を満たせるかチェック
    const stillMet = otherNode.requiredNodes.every(req => {
      if (typeof req === 'string') {
        return isNodeUnlocked(req, remaining);
      }
      // OR条件: いずれか1つが解放済みならOK
      return (req as string[]).some(r => isNodeUnlocked(r, remaining));
    });
    if (!stillMet) return false;
  }

  return true;
}

/**
 * Uberツリーの効果を計算
 * パッシブツリーのcalculatePassiveEffectsと同様のパターン
 */
export interface UberTreeEffects {
  hp: number;
  atk: number;
  def: number;
  hp_increased_pct: number;
  atk_increased_pct: number;
  def_increased_pct: number;
  hp_more_pct: number[];
  atk_more_pct: number[];
  def_more_pct: number[];
  poison_chance: number;
  poison_damage_pct: number;
  poison_damage_more_pct: number[];
  ignite_chance: number;
  ignite_damage_pct: number;
  ignite_damage_more_pct: number[];
  critical_chance: number;
  critical_damage: number;
  hp_regen: number;
  hp_on_hit: number;
  damage_reduction_pct: number;
  attack_speed_pct: number;
  attack_speed_more_pct: number[];
  chill_chance: number;
  chill_effect_pct: number;
  freeze_chance: number;
  // 最終ノード固有能力
  heavy_strike: boolean;
  def_hp_to_atk: boolean;
  uber_critical_follow_up: boolean;
  poison_multi_stack: number;
  ignite_intensify: boolean;
  chill_freeze_damage_mult: number;
}

export function calculateUberTreeEffects(unlockedNodeIds: string[]): UberTreeEffects {
  let hp = 0, atk = 0, def = 0;
  let hp_increased_pct = 0, atk_increased_pct = 0, def_increased_pct = 0;
  const hp_more_pct: number[] = [];
  const atk_more_pct: number[] = [];
  const def_more_pct: number[] = [];
  let poison_chance = 0, poison_damage_pct = 0;
  const poison_damage_more_pct: number[] = [];
  let ignite_chance = 0, ignite_damage_pct = 0;
  const ignite_damage_more_pct: number[] = [];
  let critical_chance = 0, critical_damage = 0;
  let hp_regen = 0, hp_on_hit = 0, damage_reduction_pct = 0;
  let attack_speed_pct = 0;
  const attack_speed_more_pct: number[] = [];
  let chill_chance = 0, chill_effect_pct = 0, freeze_chance = 0;
  // 最終ノード固有能力
  let heavy_strike = false;
  let def_hp_to_atk = false;
  let uber_critical_follow_up = false;
  let poison_multi_stack = 1;  // デフォルト1（通常）
  let ignite_intensify = false;
  let chill_freeze_damage_mult = 1;  // デフォルト1（通常）

  // スタートノードの効果を常に含める
  const effectiveNodeIds = new Set(unlockedNodeIds);
  effectiveNodeIds.add(UBER_TREE_START_NODE_ID);

  for (const nodeId of effectiveNodeIds) {
    const node = nodes.get(nodeId);
    if (!node) continue;
    const e = node.effect;

    hp += e.hp || 0;
    atk += e.atk || 0;
    def += e.def || 0;
    hp_increased_pct += e.hp_increased_pct || 0;
    atk_increased_pct += e.atk_increased_pct || 0;
    def_increased_pct += e.def_increased_pct || 0;
    if (e.hp_more_pct) hp_more_pct.push(e.hp_more_pct);
    if (e.atk_more_pct) atk_more_pct.push(e.atk_more_pct);
    if (e.def_more_pct) def_more_pct.push(e.def_more_pct);
    poison_chance += e.poison_chance || 0;
    poison_damage_pct += e.poison_damage_pct || 0;
    if (e.poison_damage_more_pct) poison_damage_more_pct.push(e.poison_damage_more_pct);
    ignite_chance += e.ignite_chance || 0;
    ignite_damage_pct += e.ignite_damage_pct || 0;
    if (e.ignite_damage_more_pct) ignite_damage_more_pct.push(e.ignite_damage_more_pct);
    critical_chance += e.critical_chance || 0;
    critical_damage += e.critical_damage || 0;
    hp_regen += e.hp_regen || 0;
    hp_on_hit += e.hp_on_hit || 0;
    damage_reduction_pct += e.damage_reduction_pct || 0;
    attack_speed_pct += e.attack_speed_pct || 0;
    if (e.attack_speed_more_pct) attack_speed_more_pct.push(e.attack_speed_more_pct);
    chill_chance += e.chill_chance || 0;
    chill_effect_pct += e.chill_effect_pct || 0;
    freeze_chance += e.freeze_chance || 0;
    // 最終ノード固有能力
    if (e.heavy_strike) heavy_strike = true;
    if (e.def_hp_to_atk) def_hp_to_atk = true;
    if (e.uber_critical_follow_up) uber_critical_follow_up = true;
    if (e.poison_multi_stack) poison_multi_stack = e.poison_multi_stack;
    if (e.ignite_intensify) ignite_intensify = true;
    if (e.chill_freeze_damage_mult) chill_freeze_damage_mult = e.chill_freeze_damage_mult;
  }

  return {
    hp, atk, def,
    hp_increased_pct, atk_increased_pct, def_increased_pct,
    hp_more_pct, atk_more_pct, def_more_pct,
    poison_chance, poison_damage_pct, poison_damage_more_pct,
    ignite_chance, ignite_damage_pct, ignite_damage_more_pct,
    critical_chance, critical_damage,
    hp_regen, hp_on_hit, damage_reduction_pct,
    attack_speed_pct, attack_speed_more_pct,
    chill_chance, chill_effect_pct, freeze_chance,
    heavy_strike, def_hp_to_atk, uber_critical_follow_up,
    poison_multi_stack, ignite_intensify, chill_freeze_damage_mult,
  };
}
