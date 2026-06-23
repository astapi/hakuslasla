/**
 * S3パッシブツリー — DSLによる全面再設計（PoE型メッシュ・主線/枝/派生ループ）
 *
 * レイアウトの「形状ロジック」はこのファイル、「中身データ（効果値/ノード名/テーマ/調整つまみ）」は
 * data/passiveTree_s3.config.json に分離している。configを編集して npm run build:s3tree で再生成する。
 * tools/tree-editor のWebエディタは buildS3DslNodes(config) を直接呼び、編集中のconfigでライブ描画する。
 *
 * ■ 設計方針
 *   - 6テーマを60°ずつのセクターに割り当て（上=DEF/左上=クリ/右上=毒/右下=ペット/下=チル/左下=発火）。
 *   - 各セクターの「主線(spine)」は中心→外周へ伸びる“小ノードの通り道”。一直線で得られるのは
 *     小ノード(ATK/DEF/HP/テーマ)だけ＝主線だけ伸ばしても弱い。
 *   - ノータブルは主線から“枝分かれ(detour)”して配置。取るには寄り道ptが必要＝一直線で全部は取れない。
 *   - 各ノータブルが「派生ループ」の入口。円の反対側に強ノード（中段=強ノータブル/外周=キーストーン）を
 *     置き、左右どちらの弧でも半周ぶんの小ノードを消費しないと取れない。
 *   - セクターの主線同士を横方向で接続＝同心ループのメッシュ。5クラスのスタートは別々の位置から自セクター主線へ。
 *
 *   Lv80（最大79SP）想定。全ノードは取り切れない＝取捨選択が生まれる規模。
 */
import { radialTree, type BuildResult, type ChainNodeSpec } from './passiveTreeBuilder';
import type { CharacterType, PassiveEffect, PassiveIconType } from '../types';
import rawConfig from './passiveTree_s3.config.json';

/** 効果値＋表示名（＋任意アイコン）の最小単位 */
export type Lite = { n: string; e: PassiveEffect; ic?: PassiveIconType };

/** 1本の枝（ノータブル＋派生ループの強ノード） */
export interface BranchCfg {
  notable: Lite; // 枝先のノータブル
  strong: Lite; // 派生ループの反対側に置く強ノード
  strongKind: 'notable' | 'keystone';
  ring?: number; // 旧ループ用の互換フィールド。現行レイアウトでは使用しない。
}

/** 1セクター（60°分のテーマ帯） */
export interface SectorCfg {
  key: string;
  cls?: CharacterType; // DEFはクラス無し（メッシュ経由で到達）
  deg: number; // セクター中心角
  ic: PassiveIconType;
  spineFlavor: Lite; // 主線に散らすテーマ小ノード
  branches: BranchCfg[]; // 内・中・外（通常3本）
}

/** クラススタートノード定義 */
export interface ClassStartCfg {
  id: string;
  name: string;
  e: PassiveEffect;
  ic: PassiveIconType;
}

/** 形状の調整つまみ */
export interface TreeConstants {
  startRing: number; // クラススタート半径
  rings4: number[]; // 同心リングの半径（内→外）
  ringArcNodeCounts?: number[]; // 各リングのセクター間に置く小ノード数（内→外）
  sideOffset: number; // 枝の横ずれ距離（主線からの離れ具合）
  notableROffset: number; // ノータブルの内寄せ（内側ジャンクション半径＋この値）
  loopGap: number; // キーストーン別枝のノード間隔
  loopRadius: number; // 派生ループ半径
}

/** Webエディタ／ビルドが読む調整データ全体 */
export interface TreeConfig {
  constants: TreeConstants;
  scatter: Lite[]; // 主線/リム/弧に散らす汎用小ノード（ATK/HP/DEF巡回）
  classStarts: Record<string, ClassStartCfg>;
  sectors: SectorCfg[];
  linkOverrides: { add: [string, string][]; remove: [string, string][] };
}

/** 既定config（data/passiveTree_s3.config.json）。Webエディタは編集済みconfigを渡して上書きする。 */
export const defaultConfig = rawConfig as unknown as TreeConfig;

function statWheel(prefix: string, stat: 'hp' | 'atk' | 'def', flat: number, inc: number): ChainNodeSpec[] {
  const flatKey = stat;
  const incKey = `${stat}_increased_pct` as keyof PassiveEffect;
  return [
    { id: `${prefix}_flat1`, name: stat === 'hp' ? '巨体' : stat === 'atk' ? '剛腕' : '重装', effect: { [flatKey]: flat } },
    { id: `${prefix}_inc1`, name: stat === 'hp' ? '生命熟達' : stat === 'atk' ? '攻撃熟達' : '防御熟達', effect: { [incKey]: inc } },
    { id: `${prefix}_flat2`, name: stat === 'hp' ? '巨体' : stat === 'atk' ? '剛腕' : '重装', effect: { [flatKey]: flat } },
    { id: `${prefix}_inc2`, name: stat === 'hp' ? '生命熟達' : stat === 'atk' ? '攻撃熟達' : '防御熟達', effect: { [incKey]: inc } },
  ] as ChainNodeSpec[];
}

function sustainWheel(prefix: string, flavor: 'blood' | 'venom' | 'ember' | 'focus' | 'frost' | 'guard'): ChainNodeSpec[] {
  const variants: Record<typeof flavor, ChainNodeSpec[]> = {
    blood: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_leech1`, name: '吸血', effect: { lifestealPct: 2 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 45 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
    venom: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 30 } },
      { id: `${prefix}_leech1`, name: '毒血吸収', effect: { poison_lifesteal: 8 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
    ember: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 30 } },
      { id: `${prefix}_leech1`, name: '火勢吸収', effect: { ignite_lifesteal: 8 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
    focus: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 30 } },
      { id: `${prefix}_leech1`, name: '会心吸収', effect: { critical_lifesteal_pct: 10 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
    frost: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 30 } },
      { id: `${prefix}_leech1`, name: '凍傷吸収', effect: { lifestealPct: 2, freeze_resist_pct: 5 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
    guard: [
      { id: `${prefix}_hit1`, name: '吸命', effect: { hp_on_hit: 35 } },
      { id: `${prefix}_leech1`, name: '堅守吸収', effect: { lifestealPct: 2, block_chance: 2 } },
      { id: `${prefix}_hit2`, name: '吸命', effect: { hp_on_hit: 40 } },
      { id: `${prefix}_defer1`, name: '受け流し', effect: { damage_defer_pct: 3 } },
    ],
  };
  return variants[flavor];
}

/**
 * S3ツリー全体をDSLからコンパイル（planar同心セル構造）。
 * config未指定なら data/passiveTree_s3.config.json を使う。
 */
export function buildS3DslNodes(config: TreeConfig = defaultConfig): BuildResult {
  const t = radialTree();
  const { constants: C, scatter: SCATTER, classStarts: CLASS_STARTS, sectors: SECTORS } = config;
  const RINGS4 = C.rings4;
  const ringArcNodeCounts = C.ringArcNodeCounts ?? RINGS4.map(() => 2);
  const ringNode = (ring: number, sectorIndex: number, side: 1 | 2) => {
    const count = Math.max(1, Math.floor(ringArcNodeCounts[ring] ?? 2));
    return `ring${ring}_${sectorIndex}_${Math.min(side, count)}`;
  };
  const outwardDeg = (id: string, offset = 0) => {
    const p = t.posOf(id);
    return (Math.atan2(p.y, p.x) * 180) / Math.PI + offset;
  };

  // 中央ノードは廃止（各クラスは自分のクラススタートから開始する）。
  // 共通フォールバック startNodeId は build() が最初のクラススタートを自動採用する。

  // クラススタート
  for (const [sectorIndex, sec] of SECTORS.entries()) {
    if (!sec.cls) continue;
    const cs = CLASS_STARTS[sec.cls];
    t.start(sec.cls, { id: cs.id, name: cs.name, effect: cs.e, iconType: cs.ic }, { ring: C.startRing, deg: sec.deg });
  }

  // 各セクター: 放射の主線（リング半径ごとのジャンクション）＋セル内の枝/派生ループ
  const junc: Record<string, string[]> = {};
  for (const sec of SECTORS) {
    // 主線ジャンクション（各リング半径に小ノード）
    const js: string[] = [];
    RINGS4.forEach((r, k) => {
      js.push(t.node({ id: `${sec.key}_j${k}`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls }, { ring: r, deg: sec.deg }, 'minor'));
    });
    junc[sec.key] = js;
    // 主線の通り道（クラススタート→j0→j1→j2→j3 を小ノードで繋ぐ）
    if (sec.cls) t.path({ from: CLASS_STARTS[sec.cls].id, to: js[0], nodes: [{ id: `${sec.key}_si`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls }] });
    for (let k = 0; k < js.length - 1; k++) {
      t.path({ from: js[k], to: js[k + 1], nodes: [{ id: `${sec.key}_s${k}`, name: SCATTER[k % SCATTER.length].n, effect: SCATTER[k % SCATTER.length].e, class: sec.cls }] });
    }
  }

  // 同心リング4本：各リング半径で隣セクターのジャンクションを円弧接続（枝はセル内なので交差しない）
  const order = SECTORS.map((s) => s.key);
  for (let k = 0; k < RINGS4.length; k++) {
    for (let i = 0; i < order.length; i++) {
      const count = Math.max(1, Math.floor(ringArcNodeCounts[k] ?? 2));
      t.arc({
        from: junc[order[i]][k],
        to: junc[order[(i + 1) % order.length]][k],
        radius: RINGS4[k],
        nodes: Array.from({ length: count }, (_, idx) => {
          const scatter = SCATTER[(i + idx) % SCATTER.length];
          return { id: `ring${k}_${i}_${idx + 1}`, name: scatter.n, effect: scatter.e };
        }),
      });
    }
  }

  // セル(リング間)ごとにノータブル/キーストーン枝を配置。主線だけでなく円周ノードからも生やす。
  for (const [sectorIndex, sec] of SECTORS.entries()) {
    sec.branches.forEach((br, bi) => {
      const keystoneBranch = br.strongKind === 'keystone';
      const keyMainIndex = bi;
      const notableMainIndex = bi;
      const notableSource = ringNode(notableMainIndex, sectorIndex, 1);
      const strongSource = ringNode(Math.min(bi + 1, RINGS4.length - 1), sectorIndex, 2);
      const keystoneSource = ringNode(Math.min(keyMainIndex + 1, RINGS4.length - 1), sectorIndex, 2);
      const notableR = RINGS4[notableMainIndex] + C.notableROffset;
      const side = (bi % 2 === 0 ? 1 : -1) * (Math.asin(Math.min(0.6, C.sideOffset / notableR)) * 180) / Math.PI;
      const notableDir = outwardDeg(notableSource, bi === 1 ? -24 : 24);
      t.chain({
        from: notableSource,
        dirDeg: notableDir,
        step: C.loopGap,
        nodes: [
          { id: `${sec.key}_b${bi + 1}_c`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls },
          { id: `${sec.key}_b${bi + 1}_n`, name: br.notable.n, effect: br.notable.e, nodeType: 'notable', iconType: br.notable.ic ?? sec.ic, class: sec.cls },
        ],
      });

      if (br.strongKind === 'keystone') {
        t.keystoneDiamond({
          from: keystoneSource,
          dirDeg: outwardDeg(keystoneSource, -18),
          step: C.loopGap,
          branch: { id: `${sec.key}_b${bi + 1}_e`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls },
          left: { id: `${sec.key}_b${bi + 1}_g1`, name: SCATTER[bi % SCATTER.length].n, effect: SCATTER[bi % SCATTER.length].e, class: sec.cls },
          right: { id: `${sec.key}_b${bi + 1}_g2`, name: SCATTER[(bi + 1) % SCATTER.length].n, effect: SCATTER[(bi + 1) % SCATTER.length].e, class: sec.cls },
          keystone: { id: `${sec.key}_b${bi + 1}_k`, name: br.strong.n, effect: br.strong.e, nodeType: 'keystone', iconType: br.strong.ic ?? sec.ic, class: sec.cls },
        });
      } else {
        t.chain({
          from: strongSource,
          dirDeg: outwardDeg(strongSource, bi === 0 ? 70 : 30),
          step: C.loopGap,
          nodes: [
            { id: `${sec.key}_b${bi + 1}_e`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls },
            { id: `${sec.key}_b${bi + 1}_k`, name: br.strong.n, effect: br.strong.e, nodeType: 'notable', iconType: br.strong.ic ?? sec.ic, class: sec.cls },
          ],
        });
      }
    });
  }

  // 汎用ステータスの4pt円クラスタ。メインノードを囲まず、外側へ枝として出す。
  t.minorRingOffshoot({ from: junc.def[3], dirDeg: -90, gap: 4.6, radius: 1.25, minors: statWheel('stat_def_inc', 'def', 25, 12) });
  t.minorRingOffshoot({ from: junc.pet[3], dirDeg: 30, gap: 4.8, radius: 1.25, minors: statWheel('stat_hp_inc', 'hp', 100, 12) });
  t.minorRingOffshoot({ from: junc.cri[3], dirDeg: -150, gap: 4.6, radius: 1.25, minors: statWheel('stat_atk_inc', 'atk', 18, 10) });

  // クラス間の円周ノードから伸びる汎用吸収クラスタ。
  // 円周で派生がない ring1_*_3 を使い、隣系統へ移動しながらHP on hit/吸収を拾えるようにする。
  const sustainFlavors: Array<'focus' | 'guard' | 'venom' | 'blood' | 'frost' | 'ember'> = ['focus', 'guard', 'venom', 'blood', 'frost', 'ember'];
  for (let i = 0; i < order.length; i++) {
    const from = `ring1_${i}_3`;
    t.minorRingOffshoot({
      from,
      dirDeg: outwardDeg(from),
      gap: 3.8,
      radius: 1.05,
      minors: sustainWheel(`sustain_${i}`, sustainFlavors[i]),
    });
  }

  // 手動の接続編集（Webエディタの linkOverrides）。追加→削除の順で適用。
  for (const [a, b] of config.linkOverrides?.add ?? []) t.link(a, b);
  for (const [a, b] of config.linkOverrides?.remove ?? []) t.unlink(a, b);

  return t.build();
}
