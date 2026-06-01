/**
 * S3パッシブツリー — DSLによる全面再設計（PoE型メッシュ・主線/枝/派生ループ）
 *
 * S2のコピー（base.json）は廃し、このDSLがS3ツリー全体を生成する。
 * scripts/buildPassiveTreeS3.ts が build() の結果をそのまま passiveTree_s3.json に書き出す。
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

type Lite = { n: string; e: PassiveEffect; ic?: PassiveIconType };

interface Branch {
  at: number; // 分岐する主線インデックス
  side: number; // 主線方向からの相対角（度・±で左右）
  notable: Lite; // 枝先のノータブル
  strong: Lite; // 派生ループの反対側に置く強ノード
  strongKind: 'notable' | 'keystone';
  ring?: number; // ループの小ノード数（既定4。多いほど高コスト）
}

interface SectorDef {
  key: string;
  cls?: CharacterType; // DEFはクラス無し（メッシュ経由で到達）
  deg: number; // セクター中心角
  ic: PassiveIconType;
  spineFlavor: Lite; // 主線に散らすテーマ小ノード
  branches: [Branch, Branch, Branch]; // 内・中・外
}

const START_RING = 2.4; // クラススタート半径
const SPINE_STEP = 1.7; // 主線ノード間隔
const SPINE_LEN = 6; // 主線の小ノード数
const BR_STEP = 1.4; // 枝（connector→notable）の間隔
const LOOP_GAP = 2.0; // ノータブルから派生ループ中心までの距離
const LOOP_RADIUS = 1.3;

// 主線に散らす汎用小ノード（ATK/HP/DEF巡回）
const SCATTER: Lite[] = [
  { n: '筋力', e: { atk: 6 } },
  { n: '活力', e: { hp: 20 } },
  { n: '頑強', e: { def: 5 } },
];

const SECTORS: SectorDef[] = [
  // 左上: クリティカル（warrior）
  {
    key: 'cri', cls: 'warrior', deg: -150, ic: 'crit', spineFlavor: { n: '鍛錬', e: { atk: 5 } },
    branches: [
      { at: 1, side: 42, notable: { n: '戦士の技', e: { atk: 8, critical_chance: 3 } }, strong: { n: '会心の極み', e: { critical_chance: 8, critical_damage: 30 }, ic: 'crit' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '必中', e: { critical_chance: 5, critical_damage: 25 } }, strong: { n: '修羅', e: { atk: 15, critical_damage: 60 }, ic: 'crit' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '一閃', e: { atk: 12, critical_chance: 5, critical_damage: 30 } }, strong: { n: '処刑人', e: { hp_on_crit: 120, atk_more_pct: 12, critical_lifesteal_pct: 25 }, ic: 'crit' }, strongKind: 'keystone', ring: 6 },
    ],
  },
  // 上: DEF（クラス無し）
  {
    key: 'def', deg: -90, ic: 'guard', spineFlavor: { n: '錬磨', e: { def: 4 } },
    branches: [
      { at: 1, side: 42, notable: { n: '鉄の意志', e: { def: 8, def_increased_pct: 8 } }, strong: { n: '鉄壁', e: { def: 12, def_increased_pct: 15 }, ic: 'guard' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '不動', e: { hp: 40, def: 10 } }, strong: { n: '巨壁', e: { hp: 50, def: 15 }, ic: 'def' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '城塞', e: { def: 12, hp: 40, damage_defer_pct: 5 }, ic: 'guard' }, strong: { n: '鉄壁の守護者', e: { damage_defer_pct: 8, def_more_pct: 8 }, ic: 'guard' }, strongKind: 'keystone' },
    ],
  },
  // 右上: 毒（ranger）
  {
    key: 'poi', cls: 'ranger', deg: -30, ic: 'poison', spineFlavor: { n: '毒の研鑽', e: { poison_chance: 4 } },
    branches: [
      { at: 1, side: 42, notable: { n: '狩人の毒', e: { poison_chance: 8, poison_damage_pct: 10 } }, strong: { n: '猛毒の心得', e: { poison_chance: 10, poison_damage_pct: 20 }, ic: 'poison' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '蔓延', e: { poison_chance: 10, poison_max_stacks: 1 } }, strong: { n: '毒蛇', e: { poison_damage_pct: 30, poison_max_stacks: 1 }, ic: 'poison' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '疫病の達人', e: { poison_chance: 12, poison_damage_pct: 20 } }, strong: { n: '純粋毒', e: { no_direct_damage: true, poison_damage_more_pct: 50 }, ic: 'poison' }, strongKind: 'keystone', ring: 6 },
    ],
  },
  // 右下: ペット/絆（tamer）
  {
    key: 'pet', cls: 'tamer', deg: 30, ic: 'regen', spineFlavor: { n: '絆', e: { hp: 18 } },
    branches: [
      { at: 1, side: 42, notable: { n: '調教の心得', e: { hp: 30, hp_regen: 50 } }, strong: { n: '生命の絆', e: { hp: 50, hp_regen: 80 }, ic: 'regen' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '癒やしの絆', e: { hp_regen: 80, hp_on_hit: 15 } }, strong: { n: '不屈の絆', e: { hp_on_hit: 30, hp_regen: 100 }, ic: 'regen' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '獣王の加護', e: { hp: 40, hp_regen: 80, def: 8 } }, strong: { n: '共生', e: { hp_regen: 200, hp_on_hit: 50 }, ic: 'vamp' }, strongKind: 'keystone' },
    ],
  },
  // 下: チル/フリーズ（frostmage）
  {
    key: 'frz', cls: 'frostmage', deg: 90, ic: 'special', spineFlavor: { n: '氷の研鑽', e: { chill_effect_pct: 6 } },
    branches: [
      { at: 1, side: 42, notable: { n: '氷術の心得', e: { chill_chance: 8, chill_effect_pct: 12 } }, strong: { n: '氷嵐', e: { chill_chance: 10, chill_effect_pct: 25 }, ic: 'special' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '氷結', e: { freeze_chance: 3, chill_effect_pct: 18 } }, strong: { n: '凍結の極み', e: { freeze_chance: 4, freeze_duration_pct: 30 }, ic: 'special' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '永久凍土', e: { freeze_chance: 4, chill_effect_pct: 20 } }, strong: { n: '絶対零度', e: { freeze_chance: 5, freeze_duration_pct: 40 }, ic: 'special' }, strongKind: 'keystone' },
    ],
  },
  // 左下: 発火（elementalist）
  {
    key: 'ign', cls: 'elementalist', deg: 150, ic: 'special', spineFlavor: { n: '火の研鑽', e: { ignite_damage_pct: 8 } },
    branches: [
      { at: 1, side: 42, notable: { n: '火術の心得', e: { ignite_chance: 8, ignite_damage_pct: 12 } }, strong: { n: '業火の心得', e: { ignite_chance: 10, ignite_damage_pct: 25 }, ic: 'special' }, strongKind: 'notable' },
      { at: 3, side: -42, notable: { n: '業火', e: { ignite_chance: 10, ignite_damage_pct: 18 } }, strong: { n: '劫火', e: { ignite_damage_pct: 35, ignite_duration_pct: 20 }, ic: 'special' }, strongKind: 'notable' },
      { at: 5, side: 42, notable: { n: '業火の支配', e: { ignite_chance: 12, ignite_damage_pct: 22 } }, strong: { n: '業炎天', e: { ignite_damage_more_pct: 30, ignite_spread: true }, ic: 'special' }, strongKind: 'keystone', ring: 6 },
    ],
  },
];

// クラススタート
const CLASS_STARTS: Record<string, { id: string; name: string; e: PassiveEffect; ic: PassiveIconType }> = {
  warrior: { id: 'warrior_start', name: '戦士の構え', e: { atk: 5, hp: 20 }, ic: 'atk' },
  ranger: { id: 'ranger_start', name: '狩人の心得', e: { atk: 4, hp: 20 }, ic: 'poison' },
  tamer: { id: 'tamer_start', name: '調教師の絆', e: { hp: 25, def: 2 }, ic: 'regen' },
  frostmage: { id: 'frostmage_start', name: '氷術の素養', e: { atk: 4, hp: 20, def: 2 }, ic: 'special' },
  elementalist: { id: 'elementalist_start', name: '魔導の素養', e: { atk: 5, hp: 15 }, ic: 'special' },
};

// 主線の小ノードを生成（テーマ小ノードとステ散りを交互に）
function spineNodes(sec: SectorDef): ChainNodeSpec[] {
  const out: ChainNodeSpec[] = [];
  for (let i = 0; i < SPINE_LEN; i++) {
    const s = i % 2 === 0 ? sec.spineFlavor : SCATTER[((i - 1) / 2) % SCATTER.length];
    out.push({ id: `${sec.key}_s${i + 1}`, name: s.n, effect: s.e, class: sec.cls });
  }
  return out;
}

// 派生ループの円ノード（テーマ小ノードとステ散りを交互に）
function loopRing(key: string, bi: number, flavor: Lite, n: number): ChainNodeSpec[] {
  const out: ChainNodeSpec[] = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 === 0 ? flavor : SCATTER[((i - 1) / 2) % SCATTER.length];
    out.push({ id: `${key}_b${bi}_g${i + 1}`, name: s.n, effect: s.e });
  }
  return out;
}

// 同心リングの半径（内・中1・中2・外の4本）。枝/ループは隣り合うリング間の「セル」に収める。
const RINGS4 = [4.5, 9.5, 14.5, 20];

/** S3ツリー全体をDSLからコンパイル（planar同心セル構造） */
export function buildS3DslNodes(): BuildResult {
  const t = radialTree();

  // 中央ノードは廃止（各クラスは自分のクラススタートから開始する）。
  // 共通フォールバック startNodeId は build() が最初のクラススタートを自動採用する。

  // クラススタート
  for (const sec of SECTORS) {
    if (!sec.cls) continue;
    const cs = CLASS_STARTS[sec.cls];
    t.start(sec.cls, { id: cs.id, name: cs.name, effect: cs.e, iconType: cs.ic }, { ring: START_RING, deg: sec.deg });
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
      t.path({ from: js[k], to: js[k + 1], nodes: [{ id: `${sec.key}_s${k}`, name: SCATTER[k % 3].n, effect: SCATTER[k % 3].e, class: sec.cls }] });
    }

    // セル(リング間)ごとに枝ノータブル＋派生ループ。主線から横(±)へ退避し、セル内に収める。
    sec.branches.forEach((br, bi) => {
      // ノータブルは内側ジャンクション寄りに置く（派生始めの線を短く＆ループを外側へ伸ばす余地確保）
      const notableR = RINGS4[bi] + 1.6;
      // 横ずれの「距離」を一定(=SIDE_OFFSET)にする。半径が大きい外側セルほど角度は小さくなり、
      // connectorが長くなりすぎない（弧長 ≒ 半径×角度 を一定化）。符号は交互。
      const SIDE_OFFSET = 2.6;
      const side = (bi % 2 === 0 ? 1 : -1) * (Math.asin(Math.min(0.6, SIDE_OFFSET / notableR)) * 180) / Math.PI;
      const notableId = t.node(
        { id: `${sec.key}_b${bi + 1}_n`, name: br.notable.n, effect: br.notable.e, iconType: br.notable.ic ?? sec.ic, class: sec.cls },
        { ring: notableR, deg: sec.deg + side },
        'notable'
      );
      // 内側ジャンクションから枝分かれ（connector経由）
      t.path({ from: junc[sec.key][bi], to: notableId, nodes: [{ id: `${sec.key}_b${bi + 1}_c`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls }] });
      // 派生ループ（強ノードは円の反対側）。gap>radius にして entry がノータブルと重ならないように。
      t.branchLoop({
        from: notableId,
        outDeg: sec.deg + side, // ノータブルの放射方向＝セル内で外側へ
        gap: 1.9,
        radius: 0.85,
        entry: { id: `${sec.key}_b${bi + 1}_e`, name: sec.spineFlavor.n, effect: sec.spineFlavor.e, class: sec.cls },
        ring: loopRing(sec.key, bi + 1, sec.spineFlavor, br.ring ?? 4),
        strong: { id: `${sec.key}_b${bi + 1}_k`, name: br.strong.n, effect: br.strong.e, nodeType: br.strongKind, iconType: br.strong.ic ?? sec.ic, class: sec.cls },
      });
    });
  }

  // 同心リング4本：各リング半径で隣セクターのジャンクションを円弧接続（枝はセル内なので交差しない）
  const order = SECTORS.map((s) => s.key);
  for (let k = 0; k < RINGS4.length; k++) {
    for (let i = 0; i < order.length; i++) {
      t.arc({
        from: junc[order[i]][k],
        to: junc[order[(i + 1) % order.length]][k],
        radius: RINGS4[k],
        nodes: [
          { id: `ring${k}_${i}_1`, name: SCATTER[i % 3].n, effect: SCATTER[i % 3].e },
          { id: `ring${k}_${i}_2`, name: SCATTER[(i + 1) % 3].n, effect: SCATTER[(i + 1) % 3].e },
        ],
      });
    }
  }

  return t.build();
}
