/**
 * パッシブツリーのデータローダー
 * JSONからパッシブツリーデータを読み込み、ランタイム用に変換
 */

import {
  PassiveTreeData,
  PassiveNode,
  PassiveTree,
  NodeRequirement,
  CharacterType,
} from '@/types';

import passiveTreeJsonLegacy from './json/passiveTree.json';
import passiveTreeJsonS3 from './json/passiveTree_s3.json';

/**
 * シーズン別パッシブツリーの最新シーズン番号
 * 注意: expo-constants 非依存にするためハードコード（scripts(Node実行)でも読めるように）
 * 将来シーズンを増やす場合はこの定数・treeForSeason の分岐・新JSON・lib/rankingSeason を更新する
 */
export const LATEST_PASSIVE_SEASON = 3;

// JSONデータの型アサーション
// legacy: シーズン2以前用 / s3: シーズン3用
const passiveTreeDataLegacy: PassiveTreeData = passiveTreeJsonLegacy as PassiveTreeData;
const passiveTreeDataS3: PassiveTreeData = passiveTreeJsonS3 as PassiveTreeData;

// 後方互換APIの参照先（旧 passiveTreeData 相当 = legacy）
const passiveTreeData = passiveTreeDataLegacy;

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
    startNodeIds: data.startNodeIds,
    nodes: nodesMap,
  };
}

// シーズン別パッシブツリーのインスタンス（モジュールロード時に両方構築）
const legacyTree: PassiveTree = buildPassiveTree(passiveTreeDataLegacy);
const s3Tree: PassiveTree = buildPassiveTree(passiveTreeDataS3);

/**
 * シーズン番号に対応するパッシブツリーを返す
 * season >= 3 → S3ツリー / season <= 2 → 旧（legacy）ツリー
 */
function treeForSeason(season: number): PassiveTree {
  return season >= 3 ? s3Tree : legacyTree;
}

/**
 * 現在アクティブなパッシブツリー
 * ロード中キャラのシーズンに応じて setActivePassiveSeason で切り替える。
 * デフォルトは最新シーズン（scripts/初期表示用）。
 */
let activeTree: PassiveTree = treeForSeason(LATEST_PASSIVE_SEASON);

/**
 * ロード中キャラのクラス（クラス別スタート解決用）
 * 未設定 or ツリーに startNodeIds が無ければ共通 startNodeId を使う。
 */
let activeClass: CharacterType | undefined = undefined;

/**
 * アクティブなパッシブツリーをシーズンで切り替える
 * usePlayerStore.loadCharacter から呼び出す。
 */
export function setActivePassiveSeason(season: number): void {
  activeTree = treeForSeason(season);
}

/**
 * ロード中キャラのクラスを設定する（クラス別スタートの解決に使用）
 * usePlayerStore.loadCharacter から setActivePassiveSeason と並べて呼び出す。
 */
export function setActivePassiveClass(type: CharacterType | undefined): void {
  activeClass = type;
}

/**
 * 現在アクティブなクラスのスタートノードIDを取得する。
 * - ツリーに startNodeIds があり、activeClass の対応があればそれを返す
 * - なければ共通 startNodeId（S2互換）
 */
export function getStartNodeId(): string {
  if (activeTree.startNodeIds) {
    if (activeClass) {
      const id = activeTree.startNodeIds[activeClass];
      if (id) return id;
    }
    // activeClass 未設定（scripts/テスト/キャラ未ロード）でもクラス別スタートを持つツリーでは、
    // 最初のクラススタートを既定起点にする（取得不能化を防ぐ）。
    const first = Object.values(activeTree.startNodeIds).find((id) => !!id);
    if (first) return first;
  }
  return activeTree.startNodeId;
}

/**
 * 全クラスのスタートノードIDの集合を返す（リスペック保護・初期解放判定用）。
 * startNodeIds が無ければ共通 startNodeId のみ。
 */
export function getAllStartNodeIds(): string[] {
  const ids = new Set<string>([activeTree.startNodeId]);
  if (activeTree.startNodeIds) {
    for (const id of Object.values(activeTree.startNodeIds)) {
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

/**
 * パッシブツリーを取得
 */
export function getPassiveTree(): PassiveTree {
  return activeTree;
}

/**
 * ノードをIDで取得
 */
export function getPassiveNode(id: string): PassiveNode | undefined {
  return activeTree.nodes.get(id);
}

/**
 * スタートノードを取得
 */
export function getStartNode(): PassiveNode | undefined {
  return activeTree.nodes.get(getStartNodeId());
}

/**
 * 全ノードを配列で取得
 */
export function getAllPassiveNodes(): PassiveNode[] {
  return Array.from(activeTree.nodes.values());
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

  // 前提ノードがない（=スタート候補）の場合
  // クラス別スタートでは複数のスタートノードが requiredNodes 空で存在しうるため、
  // 「現在のクラスのスタートノード」だけを無条件取得可能にする。
  // 他クラスのスタートノードは起点専用（通過点にしない）= 取得不可。
  // startNodeIds が無いツリー（S2）では getStartNodeId() が共通 startNodeId を返すため従来挙動。
  if (node.requiredNodes.length === 0) {
    return nodeId === getStartNodeId();
  }

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
  // 全クラスのスタートノードは返却不可（他クラスのスタートも幹の通過点になりうる）
  if (getAllStartNodeIds().includes(nodeId)) return false;
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

  for (const node of activeTree.nodes.values()) {
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
  poison_lifesteal: number;
  no_direct_damage: boolean;
  // 発火系
  ignite_chance: number;
  ignite_damage_pct: number;
  ignite_damage_more_pct: number[];
  ignite_duration_pct: number;
  ignite_lifesteal: number;
  ignite_spread: boolean;
  ignite_stacking_damage: boolean; // 緩慢なる炎キーストーン
  // クリティカル系
  critical_chance: number;
  critical_damage: number;
  hp_on_crit: number;
  critical_lifesteal_pct: number;
  hp_regen: number;
  hp_regen_pct: number;
  damage_defer_pct: number;
  hp_on_hit: number;
  retaliate_def_pct: number;
  attack_speed_pct: number;
  attack_speed_more_pct: number[];
  // チル系
  chill_chance: number;
  chill_effect_pct: number;
  chill_duration_pct: number;
  // フリーズ系
  freeze_chance: number;
  freeze_duration_pct: number;
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
  let poison_lifesteal = 0;
  let no_direct_damage = false;
  // 発火系
  let ignite_chance = 0;
  let ignite_damage_pct = 0;
  const ignite_damage_more_pct: number[] = [];
  let ignite_duration_pct = 0;
  let ignite_lifesteal = 0;
  let ignite_spread = false;
  let ignite_stacking_damage = false;
  // クリティカル系
  let critical_chance = 0;
  let critical_damage = 0;
  let hp_on_crit = 0;
  let critical_lifesteal_pct = 0;
  // 回復・防御系
  let hp_regen = 0;
  let hp_regen_pct = 0;
  let damage_defer_pct = 0;
  let hp_on_hit = 0;
  let retaliate_def_pct = 0;
  // 攻撃速度系
  let attack_speed_pct = 0;
  const attack_speed_more_pct: number[] = [];
  // チル系
  let chill_chance = 0;
  let chill_effect_pct = 0;
  let chill_duration_pct = 0;
  // フリーズ系
  let freeze_chance = 0;
  let freeze_duration_pct = 0;

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
      poison_lifesteal += node.effect.poison_lifesteal || 0;
      if (node.effect.no_direct_damage) no_direct_damage = true;
      // 発火系
      ignite_chance += node.effect.ignite_chance || 0;
      ignite_damage_pct += node.effect.ignite_damage_pct || 0;
      if (node.effect.ignite_damage_more_pct) ignite_damage_more_pct.push(node.effect.ignite_damage_more_pct);
      ignite_duration_pct += node.effect.ignite_duration_pct || 0;
      ignite_lifesteal += node.effect.ignite_lifesteal || 0;
      if (node.effect.ignite_spread) ignite_spread = true;
      if (node.effect.ignite_stacking_damage) ignite_stacking_damage = true;
      // クリティカル系
      critical_chance += node.effect.critical_chance || 0;
      critical_damage += node.effect.critical_damage || 0;
      hp_on_crit += node.effect.hp_on_crit || 0;
      critical_lifesteal_pct += node.effect.critical_lifesteal_pct || 0;
      // 回復・防御系
      hp_regen += node.effect.hp_regen || 0;
      hp_regen_pct += node.effect.hp_regen_pct || 0;
      damage_defer_pct += node.effect.damage_defer_pct || 0;
      hp_on_hit += node.effect.hp_on_hit || 0;
      retaliate_def_pct += node.effect.retaliate_def_pct || 0;
      // 攻撃速度系
      attack_speed_pct += node.effect.attack_speed_pct || 0;
      if (node.effect.attack_speed_more_pct) attack_speed_more_pct.push(node.effect.attack_speed_more_pct);
      // チル系
      chill_chance += node.effect.chill_chance || 0;
      chill_effect_pct += node.effect.chill_effect_pct || 0;
      chill_duration_pct += node.effect.chill_duration_pct || 0;
      // フリーズ系
      freeze_chance += node.effect.freeze_chance || 0;
      freeze_duration_pct += node.effect.freeze_duration_pct || 0;
    }
  }

  return {
    hp, atk, def,
    hp_increased_pct, atk_increased_pct, def_increased_pct,
    hp_more_pct, atk_more_pct, def_more_pct,
    poison_chance, poison_damage_pct, poison_damage_more_pct,
    poison_max_stacks, poison_lifesteal, no_direct_damage,
    ignite_chance, ignite_damage_pct, ignite_damage_more_pct, ignite_duration_pct, ignite_lifesteal, ignite_spread,
    ignite_stacking_damage,
    critical_chance, critical_damage, hp_on_crit, critical_lifesteal_pct,
    hp_regen, hp_regen_pct,
    damage_defer_pct, hp_on_hit, retaliate_def_pct,
    attack_speed_pct, attack_speed_more_pct,
    chill_chance, chill_effect_pct, chill_duration_pct,
    freeze_chance, freeze_duration_pct,
  };
}

// 後方互換性のため、旧APIも維持
export { passiveTreeData as passiveTreeRawData };
