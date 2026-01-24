/**
 * パッシブツリーのデータローダー
 * JSONからパッシブツリーデータを読み込み、ランタイム用に変換
 */

import {
  PassiveTreeData,
  PassiveNode,
  PassiveTree,
  NodeRequirement,
} from '@/types';

import passiveTreeJson from './json/passiveTree.json';

// JSONデータの型アサーション
const passiveTreeData: PassiveTreeData = passiveTreeJson as PassiveTreeData;

/**
 * NodeRequirementから全ての参照ノードIDを抽出
 */
function extractNodeIds(requirement: NodeRequirement): string[] {
  if (typeof requirement === 'string') {
    return [requirement];
  }
  return requirement;
}

/**
 * JSONデータからランタイム用のパッシブツリーを構築
 */
function buildPassiveTree(data: PassiveTreeData): PassiveTree {
  const nodesMap = new Map<string, PassiveNode>();

  // 1. 全ノードをMapに登録（childNodesは空配列で初期化）
  for (const nodeData of data.nodes) {
    nodesMap.set(nodeData.id, {
      ...nodeData,
      childNodes: [],
    });
  }

  // 2. 親子関係を構築（requiredNodesからchildNodesを逆算）
  for (const nodeData of data.nodes) {
    for (const requirement of nodeData.requiredNodes) {
      const parentIds = extractNodeIds(requirement);
      for (const parentId of parentIds) {
        const parentNode = nodesMap.get(parentId);
        if (parentNode && !parentNode.childNodes.includes(nodeData.id)) {
          parentNode.childNodes.push(nodeData.id);
        }
      }
    }
  }

  return {
    startNodeId: data.startNodeId,
    nodes: nodesMap,
  };
}

// パッシブツリーのシングルトンインスタンス
const passiveTree: PassiveTree = buildPassiveTree(passiveTreeData);

/**
 * パッシブツリーを取得
 */
export function getPassiveTree(): PassiveTree {
  return passiveTree;
}

/**
 * ノードをIDで取得
 */
export function getPassiveNode(id: string): PassiveNode | undefined {
  return passiveTree.nodes.get(id);
}

/**
 * スタートノードを取得
 */
export function getStartNode(): PassiveNode | undefined {
  return passiveTree.nodes.get(passiveTree.startNodeId);
}

/**
 * 全ノードを配列で取得
 */
export function getAllPassiveNodes(): PassiveNode[] {
  return Array.from(passiveTree.nodes.values());
}

/**
 * 単一の条件を評価
 * - string: そのノードが取得済みか
 * - string[]: いずれか1つが取得済みか（OR条件）
 */
function evaluateRequirement(requirement: NodeRequirement, unlockedNodes: string[]): boolean {
  if (typeof requirement === 'string') {
    // 単一ノード: そのノードが取得済みか
    return unlockedNodes.includes(requirement);
  }
  // OR条件: いずれか1つが取得済みか
  return requirement.some((nodeId) => unlockedNodes.includes(nodeId));
}

/**
 * ノードの前提条件が満たされているか判定
 */
function areRequirementsMet(node: PassiveNode, unlockedNodes: string[]): boolean {
  if (node.requiredNodes.length === 0) return true;
  return node.requiredNodes.every((requirement) =>
    evaluateRequirement(requirement, unlockedNodes)
  );
}

/**
 * ノードが取得可能かどうかを判定
 * @param nodeId 判定対象のノードID
 * @param unlockedNodes 既に取得済みのノードID配列
 */
export function canUnlockNode(nodeId: string, unlockedNodes: string[]): boolean {
  const node = getPassiveNode(nodeId);
  if (!node) return false;

  // 既に取得済み
  if (unlockedNodes.includes(nodeId)) return false;

  // 前提ノードがない場合は取得可能
  if (node.requiredNodes.length === 0) return true;

  // 全ての条件がtrueである必要がある（AND条件）
  // 各条件内でOR条件が使える
  return node.requiredNodes.every((requirement) =>
    evaluateRequirement(requirement, unlockedNodes)
  );
}

/**
 * ノードがリスペック（返却）可能か判定
 * - スタートノードは返却不可
 * - 依存している取得済みノードがある場合は返却不可
 */
export function canRefundNode(nodeId: string, unlockedNodes: string[]): boolean {
  const node = getPassiveNode(nodeId);
  if (!node) return false;
  if (nodeId === passiveTree.startNodeId) return false;
  if (!unlockedNodes.includes(nodeId)) return false;

  const remaining = unlockedNodes.filter((id) => id !== nodeId);
  for (const childId of node.childNodes) {
    if (!remaining.includes(childId)) continue;
    const childNode = getPassiveNode(childId);
    if (!childNode) continue;
    if (!areRequirementsMet(childNode, remaining)) {
      return false;
    }
  }

  return true;
}

/**
 * 取得可能なノードの一覧を取得
 */
export function getUnlockableNodes(unlockedNodes: string[]): PassiveNode[] {
  return getAllPassiveNodes().filter(
    (node) => canUnlockNode(node.id, unlockedNodes)
  );
}

/**
 * ノード間の接続関係を取得（UI描画用）
 * @returns [親ノードID, 子ノードID]のペア配列
 */
export function getNodeConnections(): [string, string][] {
  const connections: [string, string][] = [];

  for (const node of passiveTree.nodes.values()) {
    for (const childId of node.childNodes) {
      connections.push([node.id, childId]);
    }
  }

  return connections;
}

/**
 * 取得済みパッシブノードの合計効果を計算
 * PoE式: base × (1 + total_increased%) × more1 × more2 × ...
 */
export function calculatePassiveEffects(unlockedNodeIds: string[]): {
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
  poison_max_stacks: number;
  poison_damage_reduction: number;
  poison_lifesteal: number;
  no_direct_damage: boolean;
  critical_chance: number;
  critical_damage: number;
  hp_on_crit: number;
  hp_regen: number;
  hp_regen_pct: number;
  damage_reduction_pct: number;
  hp_on_hit: number;
  attack_speed_pct: number;
  attack_speed_more_pct: number[];
} {
  // フラット加算
  let hp = 0;
  let atk = 0;
  let def = 0;
  // increased% (加算で合計)
  let hp_increased_pct = 0;
  let atk_increased_pct = 0;
  let def_increased_pct = 0;
  // more% (配列で保持、後で乗算)
  const hp_more_pct: number[] = [];
  const atk_more_pct: number[] = [];
  const def_more_pct: number[] = [];
  // 毒系
  let poison_chance = 0;
  let poison_damage_pct = 0;
  const poison_damage_more_pct: number[] = [];
  let poison_max_stacks = 0;
  let poison_damage_reduction = 0;
  let poison_lifesteal = 0;
  let no_direct_damage = false;
  // クリティカル系
  let critical_chance = 0;
  let critical_damage = 0;
  let hp_on_crit = 0;
  // 回復・防御系
  let hp_regen = 0;
  let hp_regen_pct = 0;
  let damage_reduction_pct = 0;
  let hp_on_hit = 0;
  // 攻撃速度系
  let attack_speed_pct = 0;
  const attack_speed_more_pct: number[] = [];

  for (const nodeId of unlockedNodeIds) {
    const node = getPassiveNode(nodeId);
    if (node) {
      // フラット
      hp += node.effect.hp || 0;
      atk += node.effect.atk || 0;
      def += node.effect.def || 0;
      // increased%
      hp_increased_pct += node.effect.hp_increased_pct || 0;
      atk_increased_pct += node.effect.atk_increased_pct || 0;
      def_increased_pct += node.effect.def_increased_pct || 0;
      // more% (配列に追加)
      if (node.effect.hp_more_pct) hp_more_pct.push(node.effect.hp_more_pct);
      if (node.effect.atk_more_pct) atk_more_pct.push(node.effect.atk_more_pct);
      if (node.effect.def_more_pct) def_more_pct.push(node.effect.def_more_pct);
      // 毒系
      poison_chance += node.effect.poison_chance || 0;
      poison_damage_pct += node.effect.poison_damage_pct || 0;
      if (node.effect.poison_damage_more_pct) poison_damage_more_pct.push(node.effect.poison_damage_more_pct);
      poison_max_stacks += node.effect.poison_max_stacks || 0;
      poison_damage_reduction += node.effect.poison_damage_reduction || 0;
      poison_lifesteal += node.effect.poison_lifesteal || 0;
      if (node.effect.no_direct_damage) no_direct_damage = true;
      // クリティカル系
      critical_chance += node.effect.critical_chance || 0;
      critical_damage += node.effect.critical_damage || 0;
      hp_on_crit += node.effect.hp_on_crit || 0;
      // 回復・防御系
      hp_regen += node.effect.hp_regen || 0;
      hp_regen_pct += node.effect.hp_regen_pct || 0;
      damage_reduction_pct += node.effect.damage_reduction_pct || 0;
      hp_on_hit += node.effect.hp_on_hit || 0;
      // 攻撃速度系
      attack_speed_pct += node.effect.attack_speed_pct || 0;
      if (node.effect.attack_speed_more_pct) attack_speed_more_pct.push(node.effect.attack_speed_more_pct);
    }
  }

  return {
    hp, atk, def,
    hp_increased_pct, atk_increased_pct, def_increased_pct,
    hp_more_pct, atk_more_pct, def_more_pct,
    poison_chance, poison_damage_pct, poison_damage_more_pct,
    poison_max_stacks, poison_damage_reduction, poison_lifesteal, no_direct_damage,
    critical_chance, critical_damage, hp_on_crit,
    hp_regen, hp_regen_pct,
    damage_reduction_pct, hp_on_hit,
    attack_speed_pct, attack_speed_more_pct,
  };
}

// 後方互換性のため、旧APIも維持
export { passiveTreeData as passiveTreeRawData };
