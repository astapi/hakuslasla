/**
 * パッシブツリー放射状DSL（S3用ビルダー）
 *
 * S3ツリーは「中心ハブから円形にノードが広がり、すべてが連結した無向グラフ」。
 * 検証済みの事実: S3の全ノードの requiredNodes は AND複数グループが0件で、
 * 「そのノードの隣接リスト（単一前提 or 1つのORグループ）」そのもの。
 *   → 解放ルール = PoE本家と同じ「隣接ノードがどれか1つ解放済みなら取れる」
 *
 * この性質を使い、作者は以下だけを宣言する:
 *   1. ノード（効果・種別）
 *   2. 無向辺（系統内／系統またぎ問わず1回だけ）
 *   3. 配置（極座標: リング×角度）
 *
 * ビルダーが自動でやること:
 *   - requiredNodes 生成: 全辺から各ノードの隣接リストを集約（A↔B対称性を構造的に保証）
 *   - position 生成: 極座標(ring, deg) → 直交座標(x, y)。クラスターのminorは小オービットに自動展開
 *   - description 生成: effect から日本語要約（明示指定で上書き可）
 *
 * Reactには非依存。scripts/buildPassiveTreeS3.ts から実行してJSONを生成する。
 */
import type {
  CharacterType,
  PassiveEffect,
  PassiveIconType,
  PassiveNodeData,
  PassiveNodeType,
} from '../types';

/** 極座標（論理座標）。ring=中心からの距離、deg=角度(度・0°が+X方向、時計回りに増加) */
export interface PolarPos {
  ring: number;
  deg: number;
}

/** 1ノードの宣言（IDは明示・座標と配線は自動） */
export interface NodeSpec {
  id: string;
  name: string;
  effect: PassiveEffect;
  /** 未指定なら effect から自動生成 */
  description?: string;
  iconType?: PassiveIconType;
  class?: CharacterType;
}

/** chain() の各ノード（nodeTypeを明示できる） */
export interface ChainNodeSpec extends NodeSpec {
  nodeType?: PassiveNodeType;
}

/** クラスター宣言（notable中心 ＋ 周囲minorのホイール） */
export interface ClusterSpec {
  /** クラスター中心(notable)の配置 */
  ring: number;
  deg: number;
  notable: NodeSpec;
  minors: NodeSpec[];
  /** minorを並べる小オービット半径（論理単位・デフォルト0.9） */
  orbit?: number;
  /** minorリングの開始角度（度・デフォルト-90 = 上から時計回り） */
  orbitStartDeg?: number;
  /** notableを既存/他ノードへ接続（無向辺）。文字列 or 配列 */
  linkTo?: string | string[];
  /** リム（minor同士の環状接続）。既定true */
  rim?: boolean;
  /** クラスター全体のクラス帰属（各NodeSpecで個別上書き可） */
  class?: CharacterType;
}

interface InternalNode {
  id: string;
  name: string;
  description?: string;
  effect: PassiveEffect;
  nodeType: PassiveNodeType;
  iconType?: PassiveIconType;
  class?: CharacterType;
  pos: { x: number; y: number };
}

const DEG2RAD = Math.PI / 180;

function polarToXY(ring: number, deg: number): { x: number; y: number } {
  return {
    x: round2(ring * Math.cos(deg * DEG2RAD)),
    y: round2(ring * Math.sin(deg * DEG2RAD)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** effect → 日本語要約（description未指定時のフォールバック） */
export function describeEffect(effect: PassiveEffect): string {
  const parts: string[] = [];
  const flat = (v: number | undefined, label: string) => {
    if (v !== undefined && v !== 0) parts.push(`${label} +${v}`);
  };
  const inc = (v: number | undefined, label: string) => {
    if (v !== undefined && v !== 0) parts.push(`${label} +${v}% increased`);
  };
  const more = (v: number | undefined, label: string) => {
    if (v !== undefined && v !== 0) parts.push(`${label} ${v}% more`);
  };
  const pct = (v: number | undefined, label: string, suffix = '%') => {
    if (v !== undefined && v !== 0) parts.push(`${label} +${v}${suffix}`);
  };

  flat(effect.hp, 'HP');
  flat(effect.atk, 'ATK');
  flat(effect.def, 'DEF');
  inc(effect.hp_increased_pct, 'HP');
  inc(effect.atk_increased_pct, 'ATK');
  inc(effect.def_increased_pct, 'DEF');
  more(effect.hp_more_pct, 'HP');
  more(effect.atk_more_pct, 'ATK');
  more(effect.def_more_pct, 'DEF');

  pct(effect.poison_chance, '毒付与率');
  pct(effect.poison_damage_pct, '毒ダメージ');
  more(effect.poison_damage_more_pct, '毒ダメージ');
  if (effect.poison_max_stacks) parts.push(`毒スタック +${effect.poison_max_stacks}`);
  pct(effect.poison_lifesteal, '毒ダメージ吸収');
  if (effect.no_direct_damage) parts.push('通常ダメージ無効');

  pct(effect.ignite_chance, '発火付与率');
  pct(effect.ignite_damage_pct, '発火ダメージ');
  more(effect.ignite_damage_more_pct, '発火ダメージ');
  pct(effect.ignite_duration_pct, '発火時間');
  pct(effect.ignite_lifesteal, '発火ダメージ吸収');

  pct(effect.critical_chance, 'クリティカル率');
  pct(effect.critical_damage, 'クリティカルダメージ');
  if (effect.hp_on_crit) parts.push(`クリティカル時HP +${effect.hp_on_crit}回復`);
  pct(effect.critical_lifesteal_pct, 'クリティカル時ダメージ吸収');

  if (effect.hp_regen) parts.push(`毎秒HP +${effect.hp_regen}回復`);
  pct(effect.hp_regen_pct, '毎秒HP回復', '%');
  pct(effect.damage_defer_pct, 'ダメージ遅延');
  if (effect.hp_on_hit) parts.push(`HIT時HP +${effect.hp_on_hit}回復`);
  pct(effect.retaliate_def_pct, '被ダメ時DEF反撃');

  pct(effect.attack_speed_pct, '攻撃速度');
  more(effect.attack_speed_more_pct, '攻撃速度');

  pct(effect.chill_chance, 'チル付与率');
  pct(effect.chill_effect_pct, 'チル効果');
  pct(effect.chill_duration_pct, 'チル持続');
  pct(effect.freeze_chance, 'フリーズ付与率');
  pct(effect.freeze_duration_pct, 'フリーズ持続');

  return parts.join(', ') || '（効果なし）';
}

export interface BuildResult {
  nodes: PassiveNodeData[];
  /** DSL側で宣言した無向辺（デバッグ・可視化用） */
  edges: [string, string][];
  /** 共通フォールバックのスタートID（中央ハブ） */
  startNodeId: string;
  /** クラス別スタートID */
  startNodeIds: Partial<Record<CharacterType, string>>;
}

/** 放射状ツリービルダー */
export class RadialTreeBuilder {
  private nodes = new Map<string, InternalNode>();
  // 無向辺は "a|b"(a<b) で正規化して重複排除
  private edgeSet = new Set<string>();

  private addNode(n: InternalNode): string {
    if (this.nodes.has(n.id)) {
      throw new Error(`[DSL] ノードID重複: "${n.id}"`);
    }
    this.nodes.set(n.id, n);
    return n.id;
  }

  /** クラス別スタートノード（requiredNodesは空＝起点） */
  start(
    cls: CharacterType,
    spec: Omit<NodeSpec, 'class'>,
    polar: PolarPos
  ): string {
    return this.addNode({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      effect: spec.effect,
      nodeType: 'start',
      iconType: spec.iconType,
      class: cls,
      pos: polarToXY(polar.ring, polar.deg),
    });
  }

  /** 任意ノードを極座標で配置 */
  node(spec: NodeSpec, polar: PolarPos, nodeType: PassiveNodeType = 'minor'): string {
    return this.addNode({
      id: spec.id,
      name: spec.name,
      description: spec.description,
      effect: spec.effect,
      nodeType,
      iconType: spec.iconType,
      class: spec.class,
      pos: polarToXY(polar.ring, polar.deg),
    });
  }

  /** キーストーン（大ノード） */
  keystone(spec: NodeSpec, polar: PolarPos): string {
    return this.node(spec, polar, 'keystone');
  }

  /**
   * 2つの既存ノード間を小ノードの小道で繋ぐ（メッシュのループ/橋を作る要）。
   * from → n0 → n1 → … → to を順に接続し、中間ノードは線分上に等間隔配置。
   * nodes が空なら from↔to を直接結ぶ。
   */
  path(opts: { from: string; to: string; nodes: ChainNodeSpec[] }): string[] {
    const a = this.posOf(opts.from);
    const b = this.posOf(opts.to);
    const count = opts.nodes.length;
    let prev = opts.from;
    const ids: string[] = [];
    opts.nodes.forEach((n, i) => {
      const tt = (i + 1) / (count + 1);
      this.addNode({
        id: n.id,
        name: n.name,
        description: n.description,
        effect: n.effect,
        nodeType: n.nodeType ?? 'minor',
        iconType: n.iconType,
        class: n.class,
        pos: { x: round2(a.x + (b.x - a.x) * tt), y: round2(a.y + (b.y - a.y) * tt) },
      });
      this.link(prev, n.id);
      prev = n.id;
      ids.push(n.id);
    });
    this.link(prev, opts.to); // 終端を目的ノードへ接続（ループ閉じ）
    return ids;
  }

  /**
   * 円弧の小道。from→to を「原点中心・半径 radius の円弧」上に中間ノードを並べて接続。
   * 直線(path)だと弦になって内側へ凹み枝/ループと交差するため、外周リングはこれで一定半径に保つ。
   */
  arc(opts: { from: string; to: string; radius: number; nodes: ChainNodeSpec[] }): string[] {
    const a = this.posOf(opts.from);
    const b = this.posOf(opts.to);
    const angA = Math.atan2(a.y, a.x);
    let diff = Math.atan2(b.y, b.x) - angA;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI; // 短い向きの弧
    const n = opts.nodes.length;
    let prev = opts.from;
    const ids: string[] = [];
    opts.nodes.forEach((nd, i) => {
      const ang = angA + diff * ((i + 1) / (n + 1));
      this.addNode({
        id: nd.id,
        name: nd.name,
        description: nd.description,
        effect: nd.effect,
        nodeType: nd.nodeType ?? 'minor',
        iconType: nd.iconType,
        class: nd.class,
        pos: { x: round2(opts.radius * Math.cos(ang)), y: round2(opts.radius * Math.sin(ang)) },
      });
      this.link(prev, nd.id);
      prev = nd.id;
      ids.push(nd.id);
    });
    this.link(prev, opts.to);
    return ids;
  }

  /** 既存ノードの直交座標を返す（chain/offshootの起点取得用） */
  posOf(id: string): { x: number; y: number } {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`[DSL] 未定義ノードの座標参照: "${id}"`);
    return { ...n.pos };
  }

  /**
   * 鎖状ノード列。`from` ノードの座標から `dirDeg` 方向へ `step` 間隔で並べ、
   * 隣接ノードを順に接続（先頭は from に接続）。
   * 幹（spine: クラススタートから外向き）にも派生枝（offshoot: 幹ノードから側方）にも使う。
   * 各ノードの nodeType を 'keystone' にすればその先端をキーストーンにできる。
   */
  chain(opts: {
    from: string;
    dirDeg: number;
    step: number;
    nodes: ChainNodeSpec[];
  }): string[] {
    const base = this.posOf(opts.from);
    const rad = opts.dirDeg * DEG2RAD;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    let prev = opts.from;
    const ids: string[] = [];
    opts.nodes.forEach((n, i) => {
      const dist = opts.step * (i + 1);
      this.addNode({
        id: n.id,
        name: n.name,
        description: n.description,
        effect: n.effect,
        nodeType: n.nodeType ?? 'minor',
        iconType: n.iconType,
        class: n.class,
        pos: { x: round2(base.x + dx * dist), y: round2(base.y + dy * dist) },
      });
      this.link(prev, n.id);
      prev = n.id;
      ids.push(n.id);
    });
    return ids;
  }

  /**
   * クラスター = notable中心 ＋ 周囲minorのホイール。
   * notable↔各minor を自動接続し、minorは小オービットに円形配置。
   * linkToでnotableを外部ノード（既存ツリー含む）へ無向接続。
   */
  cluster(spec: ClusterSpec): { notableId: string; minorIds: string[] } {
    const center = polarToXY(spec.ring, spec.deg);
    const notableId = this.addNode({
      id: spec.notable.id,
      name: spec.notable.name,
      description: spec.notable.description,
      effect: spec.notable.effect,
      nodeType: 'notable',
      iconType: spec.notable.iconType,
      class: spec.notable.class ?? spec.class,
      pos: center,
    });

    const orbit = spec.orbit ?? 0.9;
    const startDeg = spec.orbitStartDeg ?? -90;
    const step = spec.minors.length > 0 ? 360 / spec.minors.length : 0;
    const minorIds: string[] = [];

    spec.minors.forEach((m, i) => {
      const deg = startDeg + step * i;
      const id = this.addNode({
        id: m.id,
        name: m.name,
        description: m.description,
        effect: m.effect,
        nodeType: 'minor',
        iconType: m.iconType,
        class: m.class ?? spec.class,
        pos: {
          x: round2(center.x + orbit * Math.cos(deg * DEG2RAD)),
          y: round2(center.y + orbit * Math.sin(deg * DEG2RAD)),
        },
      });
      minorIds.push(id);
      this.link(notableId, id); // スポーク：ハブ＝notable と各minorを接続
    });

    // リム：minor同士を環状に接続して「本物のホイール」にする（既定ON・minorが3つ以上）
    if (spec.rim !== false && minorIds.length >= 3) {
      for (let i = 0; i < minorIds.length; i++) {
        this.link(minorIds[i], minorIds[(i + 1) % minorIds.length]);
      }
    }

    // notableを外部へ接続（無向辺）
    const linkTargets = spec.linkTo
      ? Array.isArray(spec.linkTo)
        ? spec.linkTo
        : [spec.linkTo]
      : [];
    for (const t of linkTargets) {
      this.link(notableId, t);
    }

    return { notableId, minorIds };
  }

  /**
   * キーストーンクラスター（PoEのクラスタージュエル風・本物のホイール）。
   *   - gate（門番minor）を中央の周囲に円状配置し、隣同士を環状接続＝リム（外周の輪）。
   *   - 中央キーストーンは、入口の反対側（外周側）の gate にのみスポーク接続＝ハブ。
   *   - メッシュへは入口 gate[0] の1点でのみ接続（行き止まりの輪）。
   * よって中央キーストーンへ届くには、入口からリムを半周ぶん辿って外周側gateを解放する
   * 必要があり、安易には取れない（強キーストーンほど gate を増やせば前提が増える）。
   * gate[0] が原点側（入口）、gate[floor(n/2)]付近が外周側（ハブのスポーク先）。
   */
  keystoneCluster(opts: {
    from: string; // メッシュ側の接続元（例: 外周ホイールのnotable）
    centerRing: number; // キーストーン中央の極座標
    centerDeg: number;
    ringRadius?: number; // リム半径（既定1.2）
    gate: ChainNodeSpec[]; // リムの門番minor（円状）。多いほど高コスト
    keystone: NodeSpec;
  }): { gateIds: string[]; keystoneId: string } {
    const center = polarToXY(opts.centerRing, opts.centerDeg);
    const rad = opts.ringRadius ?? 1.2;
    const n = opts.gate.length;
    const entryDeg = opts.centerDeg + 180; // gate[0]を原点(メッシュ)側へ
    const stepDeg = 360 / n;

    const gateIds: string[] = [];
    opts.gate.forEach((g, i) => {
      const a = (entryDeg + stepDeg * i) * DEG2RAD;
      this.addNode({
        id: g.id,
        name: g.name,
        description: g.description,
        effect: g.effect,
        nodeType: g.nodeType ?? 'minor',
        iconType: g.iconType,
        class: g.class,
        pos: { x: round2(center.x + rad * Math.cos(a)), y: round2(center.y + rad * Math.sin(a)) },
      });
      gateIds.push(g.id);
    });

    // リム：gate同士を環状接続
    for (let i = 0; i < n; i++) this.link(gateIds[i], gateIds[(i + 1) % n]);
    // 入口：メッシュ → gate[0]（円の隙間ではなく1点接続）
    this.link(opts.from, gateIds[0]);

    // 中央キーストーン（ハブ）
    this.addNode({
      id: opts.keystone.id,
      name: opts.keystone.name,
      description: opts.keystone.description,
      effect: opts.keystone.effect,
      nodeType: 'keystone',
      iconType: opts.keystone.iconType,
      class: opts.keystone.class,
      pos: center,
    });
    // スポーク：入口の反対側（外周側）の gate にのみ接続＝入口から半周しないと届かない
    const mid = Math.floor(n / 2);
    const spokes = n >= 6 ? [mid - 1, mid, mid + 1] : [mid];
    for (const s of spokes) this.link(opts.keystone.id, gateIds[((s % n) + n) % n]);

    return { gateIds, keystoneId: opts.keystone.id };
  }

  /**
   * 派生ループ（強ノードを「円の反対側」に置いて門番化する）。
   *   notable(from) ──(派生)── entry小ノード ─┐
   *                                          ├ 円(リング)を左右どちらでも回れる
   *                              strong(反対側)┘  ← どちらの弧でも半周ぶんの小ノードが必須
   * 中央スポークを作らないので strong はループの真反対からしか取れず、
   * 必ず arc 片側ぶん（小ノード数の約半分）のptを消費する。ノータブル単体取りを防ぐ。
   * ループはメッシュへ from(notable) の1点でのみ接続＝行き止まり。
   */
  branchLoop(opts: {
    from: string; // 派生元のノータブル
    outDeg: number; // from から見たループ中心の方向（度）
    gap?: number; // from からループ中心までの距離（既定2.0）
    radius?: number; // ループ半径（既定1.25）
    entry: ChainNodeSpec; // 派生する入口の小ノード（円の手前側=from側）
    ring: ChainNodeSpec[]; // 円を構成する小ノード（左右の弧へ二分）
    strong: ChainNodeSpec; // 円の反対側に置く強ノード（nodeType未指定なら keystone）
  }): { entryId: string; ringIds: string[]; strongId: string } {
    const f = this.posOf(opts.from);
    const gap = opts.gap ?? 2.0;
    const center = {
      x: round2(f.x + Math.cos(opts.outDeg * DEG2RAD) * gap),
      y: round2(f.y + Math.sin(opts.outDeg * DEG2RAD) * gap),
    };
    const rad = opts.radius ?? 1.25;
    const m = opts.ring.length;
    const entryDeg = opts.outDeg + 180; // entryはfrom側、strongはその反対(外側)
    const total = m + 2; // entry + ring + strong
    const stepDeg = 360 / total;
    const half = Math.ceil(m / 2);

    // 円周の並び: entry → 弧A(ring前半) → strong(反対側) → 弧B(ring後半) → entry
    const seq: { spec: ChainNodeSpec | NodeSpec; kind: 'entry' | 'ring' | 'strong' }[] = [];
    seq.push({ spec: opts.entry, kind: 'entry' });
    for (let i = 0; i < half; i++) seq.push({ spec: opts.ring[i], kind: 'ring' });
    seq.push({ spec: opts.strong, kind: 'strong' });
    for (let i = half; i < m; i++) seq.push({ spec: opts.ring[i], kind: 'ring' });

    seq.forEach((s, idx) => {
      const a = (entryDeg + stepDeg * idx) * DEG2RAD;
      this.addNode({
        id: s.spec.id,
        name: s.spec.name,
        description: s.spec.description,
        effect: s.spec.effect,
        nodeType: s.kind === 'strong' ? ((s.spec as ChainNodeSpec).nodeType ?? 'keystone') : 'minor',
        iconType: s.spec.iconType,
        class: s.spec.class,
        pos: { x: round2(center.x + rad * Math.cos(a)), y: round2(center.y + rad * Math.sin(a)) },
      });
    });

    // 円周を環状接続（弦・中央スポークは作らない）
    for (let i = 0; i < seq.length; i++) {
      this.link(seq[i].spec.id, seq[(i + 1) % seq.length].spec.id);
    }
    // 派生：ノータブル → entry
    this.link(opts.from, opts.entry.id);

    return { entryId: opts.entry.id, ringIds: opts.ring.map((r) => r.id), strongId: opts.strong.id };
  }

  /** 無向辺を追加（系統またぎ・既存ノードへの橋も可） */
  link(a: string, b: string): void {
    if (a === b) {
      throw new Error(`[DSL] 自己ループ禁止: "${a}"`);
    }
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    this.edgeSet.add(key);
  }

  private startNodeIdValue?: string;

  /** 共通フォールバックのスタートID（中央ハブ）を指定 */
  setStartNodeId(id: string): void {
    this.startNodeIdValue = id;
  }

  /** 宣言済みの無向辺一覧 */
  edges(): [string, string][] {
    return [...this.edgeSet].map((k) => {
      const [a, b] = k.split('|');
      return [a, b] as [string, string];
    });
  }

  /**
   * PassiveNodeData[] へコンパイル。
   * requiredNodes = 各ノードの隣接リスト（DSL内で宣言したノードのみ・start除く）。
   * 外部（既存base）ノードへ伸ばした辺は、DSL側ノードの隣接にのみ反映する
   *   （baseは読み取り専用のまま＝到達も接続線描画も片方向で成立）。
   */
  build(): BuildResult {
    // 隣接リスト構築
    const adjacency = new Map<string, string[]>();
    for (const id of this.nodes.keys()) adjacency.set(id, []);
    for (const [a, b] of this.edges()) {
      // DSL内ノードにのみ隣接を積む（外部ノードはこのビルド対象に存在しない）
      if (this.nodes.has(a)) adjacency.get(a)!.push(b);
      if (this.nodes.has(b)) adjacency.get(b)!.push(a);
    }

    const out: PassiveNodeData[] = [];
    for (const node of this.nodes.values()) {
      const neighbors = adjacency.get(node.id) ?? [];
      let requiredNodes: PassiveNodeData['requiredNodes'];
      if (node.nodeType === 'start') {
        requiredNodes = []; // 起点
      } else if (neighbors.length === 0) {
        throw new Error(`[DSL] 孤立ノード（辺なし）: "${node.id}"`);
      } else if (neighbors.length === 1) {
        requiredNodes = [neighbors[0]]; // 単一前提
      } else {
        requiredNodes = [neighbors]; // 1つのORグループ＝隣接リスト
      }

      const data: PassiveNodeData = {
        id: node.id,
        name: node.name,
        description: node.description ?? describeEffect(node.effect),
        effect: node.effect,
        requiredNodes,
        position: { x: node.pos.x, y: node.pos.y },
      };
      if (node.nodeType) data.nodeType = node.nodeType;
      if (node.iconType) data.iconType = node.iconType;
      if (node.class) data.class = node.class;
      out.push(data);
    }

    // スタート構成を集計（nodeType==='start' かつ class 指定があるもの）
    const startNodeIds: Partial<Record<CharacterType, string>> = {};
    let firstStart: string | undefined;
    for (const node of this.nodes.values()) {
      if (node.nodeType === 'start') {
        firstStart ??= node.id;
        if (node.class) startNodeIds[node.class] = node.id;
      }
    }
    const startNodeId = this.startNodeIdValue ?? firstStart ?? '';
    if (!startNodeId) throw new Error('[DSL] スタートノードが1つもありません');

    return { nodes: out, edges: this.edges(), startNodeId, startNodeIds };
  }
}

export function radialTree(): RadialTreeBuilder {
  return new RadialTreeBuilder();
}
