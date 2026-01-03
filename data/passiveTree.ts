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
 */
export function calculatePassiveEffects(unlockedNodeIds: string[]): {
  hp: number;
  atk: number;
  def: number;
  poison_chance: number;
  critical_chance: number;
  hp_regen: number;
} {
  let hp = 0;
  let atk = 0;
  let def = 0;
  let poison_chance = 0;
  let critical_chance = 0;
  let hp_regen = 0;

  for (const nodeId of unlockedNodeIds) {
    const node = getPassiveNode(nodeId);
    if (node) {
      hp += node.effect.hp || 0;
      atk += node.effect.atk || 0;
      def += node.effect.def || 0;
      poison_chance += node.effect.poison_chance || 0;
      critical_chance += node.effect.critical_chance || 0;
      hp_regen += node.effect.hp_regen || 0;
    }
  }

  return { hp, atk, def, poison_chance, critical_chance, hp_regen };
}

// 後方互換性のため、旧APIも維持
export { passiveTreeData as passiveTreeRawData };
