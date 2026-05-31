/**
 * S3パッシブツリー ビルドスクリプト
 *
 *   base(手書き) + DSL(新系統) → 検証 → data/json/passiveTree_s3.json を生成
 *
 * 実行: TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/buildPassiveTreeS3.ts
 *   または npm run build:s3tree
 *
 * 生成物 passiveTree_s3.json は直接手で編集しないこと（次回ビルドで上書きされる）。
 * 既存ノードを直すなら passiveTree_s3.base.json、新系統はDSL(data/passiveTree_s3.dsl.ts)を編集。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { NodeRequirement, PassiveNodeData, PassiveTreeData } from '../types';
import { buildS3DslNodes } from '../data/passiveTree_s3.dsl';

const OUT_PATH = path.resolve(__dirname, '../data/json/passiveTree_s3.json');

function refIds(req: NodeRequirement): string[] {
  return typeof req === 'string' ? [req] : req;
}

/** マージ後グラフの検証。問題があれば throw */
function validate(data: PassiveTreeData): void {
  const errors: string[] = [];
  const nodes = data.nodes;
  const ids = new Set<string>();

  // 1. ID重複
  for (const n of nodes) {
    if (ids.has(n.id)) errors.push(`ID重複: "${n.id}"`);
    ids.add(n.id);
  }

  // 2. requiredNodes の参照先が存在するか / 自己参照がないか
  for (const n of nodes) {
    for (const req of n.requiredNodes) {
      for (const ref of refIds(req)) {
        if (ref === n.id) errors.push(`自己参照: "${n.id}"`);
        if (!ids.has(ref)) {
          errors.push(`未解決の前提参照: "${n.id}" → "${ref}"`);
        }
      }
    }
  }

  // 3. スタート整合
  const startIds = new Set<string>([
    data.startNodeId,
    ...Object.values(data.startNodeIds ?? {}),
  ]);
  for (const s of startIds) {
    if (!ids.has(s)) errors.push(`スタートノード不在: "${s}"`);
  }

  // 4. 連結性: 全スタートからBFSして全ノード到達可能か
  //    （親 → その親をrequiredNodesに持つ子、の向きで到達 = ランタイムの解放可能性と一致）
  const childrenOf = new Map<string, string[]>();
  for (const id of ids) childrenOf.set(id, []);
  for (const n of nodes) {
    for (const req of n.requiredNodes) {
      for (const ref of refIds(req)) {
        if (childrenOf.has(ref)) childrenOf.get(ref)!.push(n.id);
      }
    }
  }
  const visited = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }
  const unreachable = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
  if (unreachable.length) {
    errors.push(
      `スタートから到達不能なノード(${unreachable.length}件): ${unreachable.slice(0, 20).join(', ')}` +
        (unreachable.length > 20 ? ' …' : '')
    );
  }

  if (errors.length) {
    throw new Error('検証エラー:\n  - ' + errors.join('\n  - '));
  }
}

/** 1ノード=1行のdiffしやすい整形（既存ファイルのスタイルに合わせる） */
function serialize(data: PassiveTreeData & { _generated?: string }): string {
  const keyOrder: (keyof PassiveNodeData)[] = [
    'id',
    'name',
    'description',
    'effect',
    'nodeType',
    'iconType',
    'class',
    'requiredNodes',
    'position',
  ];
  const nodeLine = (n: PassiveNodeData): string => {
    const pairs: string[] = [];
    for (const k of keyOrder) {
      const v = (n as unknown as Record<string, unknown>)[k];
      if (v === undefined) continue;
      pairs.push(`${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    }
    return `    {${pairs.join(', ')}}`;
  };

  const header: string[] = [];
  header.push('{');
  header.push(`  "_generated": ${JSON.stringify(
    'このファイルは scripts/buildPassiveTreeS3.ts が自動生成します。手で編集しないでください（base.json または DSL を編集）。'
  )},`);
  header.push(`  "startNodeId": ${JSON.stringify(data.startNodeId)},`);
  if (data.startNodeIds) {
    header.push(`  "startNodeIds": ${JSON.stringify(data.startNodeIds, null, 2).replace(/\n/g, '\n  ')},`);
  }
  const body = data.nodes.map(nodeLine).join(',\n');
  return `${header.join('\n')}\n  "nodes": [\n${body}\n  ]\n}\n`;
}

/** ノード種別ごとの内訳 */
function summary(nodes: PassiveNodeData[]): string {
  const c: Record<string, number> = {};
  for (const n of nodes) c[n.nodeType ?? 'minor'] = (c[n.nodeType ?? 'minor'] ?? 0) + 1;
  return Object.entries(c).map(([k, v]) => `${k}:${v}`).join(' / ');
}

function main(): void {
  const dsl = buildS3DslNodes();

  const tree: PassiveTreeData = {
    startNodeId: dsl.startNodeId,
    startNodeIds: dsl.startNodeIds,
    nodes: dsl.nodes,
  };

  validate(tree);

  fs.writeFileSync(OUT_PATH, serialize(tree), 'utf8');

  console.log('✅ passiveTree_s3.json 生成完了（DSL全面生成）');
  console.log(`   総ノード: ${tree.nodes.length}（${summary(tree.nodes)}）`);
  console.log(`   無向辺: ${dsl.edges.length}本`);
  console.log(`   startNodeId: ${tree.startNodeId} / クラス別: ${JSON.stringify(tree.startNodeIds)}`);
  console.log(`   出力: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();
