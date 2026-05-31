# パッシブツリーDSL仕様（S3）

S3のパッシブツリーは **コードDSL（TypeScriptビルダー）でレイアウトを記述 → JSONを生成** する。
ノード座標・接続(`requiredNodes`)は一切手書きせず、幾何プリミティブの呼び出しから自動算出する。

> S2以前（legacy）は従来どおり `data/json/passiveTree.json` を手書き。本書はS3専用。
> ランタイムの仕組み・効果計算は [`passive-tree-system.md`](./passive-tree-system.md) を参照。

## 全体像

```
data/passiveTree_s3.dsl.ts        ← レイアウト記述（セクター/リング/枝のデータ＋組み立て）
        │ buildS3DslNodes()
        ▼
data/passiveTreeBuilder.ts        ← 幾何プリミティブ（座標と辺を計算）
        │ build() → { nodes, edges, startNodeId, startNodeIds }
        ▼
scripts/buildPassiveTreeS3.ts     ← 検証＋1ノード1行で整形して書き出し
        ▼
data/json/passiveTree_s3.json     ← 生成物（手で編集しない）
        ▼
data/passiveTree.ts → PassiveTree.tsx（ランタイム・UI）
```

### ファイル責務

| ファイル | 役割 |
|---|---|
| `data/passiveTreeBuilder.ts` | DSL本体。`RadialTreeBuilder` クラスと幾何プリミティブ。React非依存 |
| `data/passiveTree_s3.dsl.ts` | S3ツリーの**内容**（セクター定義＋組み立てロジック）。`buildS3DslNodes()` を export |
| `scripts/buildPassiveTreeS3.ts` | base無しでDSL出力をそのまま検証→`passiveTree_s3.json` 生成 |
| `data/json/passiveTree_s3.json` | **生成物**。`_generated` マーカー付き。直接編集禁止 |
| `data/json/passiveTree_s3.base.json` | 旧S2コピーのアーカイブ（現在は未使用） |

### ビルド

```bash
npm run build:s3tree
# = TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/buildPassiveTreeS3.ts
```
冪等（同じ入力なら同じ出力）。生成後に `npx vitest run` でテストが緑であることを確認する。

## 座標系

- 原点 `(0,0)` = ツリー中心。`position` は論理座標（小数可、`round2`で2桁）。
- **+x = 右 / +y = 下**（画面座標系）。角度 `deg` は `deg=0°→右`、時計回りに増加（`-90°=上`, `+90°=下`, `±180°=左`）。
- 極座標変換: `x = ring·cos(deg)`, `y = ring·sin(deg)`。
- UI(`PassiveTree.tsx`)で `px = (position − min) × GRID_SIZE(56) + padding + GRID_SIZE/2`。

## 接続モデル（重要）

S3は **無向グラフ**。検証済みの性質：

> 全ての非スタートノードの `requiredNodes` は「そのノードの隣接リスト」そのもの（単一前提 or 1つのORグループ。AND複数グループは0件）。
> ⇒ 解放ルール＝PoE同様「隣接ノードがどれか1つ解放済みなら取れる」。

このため DSLは **`link(a, b)` で無向辺を1回宣言するだけ**でよく、`build()` が各ノードの隣接を集めて `requiredNodes` を自動生成する（A↔Bの対称性も自動保証）。スタートノード（`nodeType:'start'`）は `requiredNodes: []`。

## プリミティブ API（`RadialTreeBuilder`）

`radialTree()` でインスタンス生成。全メソッドは座標を自動計算し、ノードIDを返す。

### ノード配置

| メソッド | 説明 |
|---|---|
| `node(spec, {ring,deg}, nodeType='minor')` | 極座標に1ノード配置。`spec = {id,name,effect,description?,iconType?,class?}` |
| `start(cls, spec, {ring,deg})` | クラススタート（`nodeType:'start'`, `requiredNodes:[]`, `class=cls`）。`startNodeIds` に登録される |
| `keystone(spec, {ring,deg})` | `node(spec, polar, 'keystone')` のショートカット |
| `setStartNodeId(id)` | 共通フォールバックのスタートID（中央ハブ）を指定 |
| `link(a, b)` | 無向辺を追加（重複は自動排除、自己ループは例外） |

`description` 省略時は `effect` から日本語要約を自動生成（`describeEffect`）。

### 線・鎖・弧

| メソッド | 配置 | 用途 |
|---|---|---|
| `chain({from, dirDeg, step, nodes})` | `from`座標から `dirDeg`方向へ `step`間隔で直線配置、順に接続 | 主線(spine)・直線の枝 |
| `path({from, to, nodes})` | 既存2ノード間を**線形補間**で配置し `from→…→to` を接続 | クラスター間の橋・短い小道（弦） |
| `arc({from, to, radius, nodes})` | 原点中心・半径 `radius` の**円弧上**に角度補間で配置 | 同心リング（弦だと内側へ凹むので弧で一定半径を保つ） |

`nodes` は `ChainNodeSpec[]`（`NodeSpec` ＋ `nodeType?`）。`posOf(id)` で既存ノードの座標を取得できる。

### クラスター・ループ

**`cluster(spec)`** — ホイール型（notable中心＋周囲minorのリム）。
```ts
cluster({ ring, deg, notable, minors, orbit?, orbitStartDeg?, rim?, linkTo?, class? })
//  notable=中心 / minors=周囲の小円(orbit) / rim=true(既定)でminor同士を環状接続
//  → スポーク(notable↔minor) ＋ リム(minor環) の「本物のホイール」
```

**`branchLoop(opts)`** — 派生ループ（強ノードを「円の反対側」に置いて門番化）。
```ts
branchLoop({ from, outDeg, gap?, radius?, entry, ring, strong })
//  from(notable) ──(派生)── entry小ノード ─┐
//                                         ├ 円(リング)を左右どちらでも回れる
//                            strong(反対側)┘ ← 中央スポーク無し＝半周ぶんの小ノードが必須
//  center = posOf(from) + outDeg方向×gap、円周に entry+ring+strong を等間隔配置、strongは入口の真反対
//  ⚠ entry↔notable距離 = gap − radius。gap≈radius にすると重なるので gap>radius にする
```
`strong.nodeType` 未指定なら `keystone`。`ring` の本数で前提コスト（円の大きさ）を調整。

**`keystoneCluster(opts)`**（旧式・現在S3未使用） — 中央キーストーン＋周囲gateリングのホイール門番版。`branchLoop` に置き換え済み。

### コンパイル

`build()` → `{ nodes: PassiveNodeData[], edges, startNodeId, startNodeIds }`。
- 各ノードの `requiredNodes` を隣接から生成（start=空、隣接1=単一、隣接2+=ORグループ）。
- 孤立ノード（辺なし非start）は例外を投げる。

## S3ツリーの構造（`passiveTree_s3.dsl.ts`）

PoE型「全体が円・全部つながる網目・強ノードは門番付き」を満たす planar 同心セル構造。
**現状251ノード**（minor209 / notable31 / keystone6 / start5）。Lv80=最大79SPで全ノードは取り切れない。

### レイアウト

```
        外周リング(半径20) ─────────────────
       /   中2リング(14.5)              \
      /   中1リング(9.5)                 \
     |   内リング(4.5)                    |
     |        ◎ ◎ ◎  H  ◎ ◎              |  ← 中心ハブ＋5クラススタート
      \      6本の放射スポーク           /
       \    各セルに枝ノータブル＋ループ /
        ──────────────────────────────
```

- **6セクター**（60°ずつ）: 上=DEF / 左上=クリ / 右上=毒 / 右下=ペット / 下=チル / 左下=発火。
  `SECTORS[]` に角度・テーマ・3つの枝（notable/strong/strongKind）を定義。
- **4本の同心リング** `RINGS4 = [4.5, 9.5, 14.5, 20]`。各リング半径で隣セクターのジャンクションを `arc()` 接続。
- **放射スポーク**: クラススタート → 各リング半径のジャンクション小ノード（`{key}_j0..j3`）を `path()` で接続。**主線は小ノードのみ**（一直線で取れるのは小ノードだけ）。
- **枝＋派生ループ**: リング間の各「セル」に、主線から横へ退避した **notable** ＋ `branchLoop`。
  - 横ずれは**距離一定**（`SIDE_OFFSET=2.6`）になるよう角度を半径から算出（外側セルほど小角度＝connectorが長くなりすぎない）。
  - notableは内側ジャンクション寄り（`RINGS4[bi]+1.6`）で派生線を短く、ループは外側へ。
  - **強ノード（中段=強notable / 外周=keystone）は円の反対側**。取得に半周ぶん（12〜15ノード）必要。

### 連結・スタート位置

- 中央 `start` ハブはクラススタートのみ束ねる（**横断ショートカットは作らない**＝行き止まり）。
- 他セクターへは同心リングを遠回りするしかない ⇒ **クラスの開始位置が意味を持つ**。
- DEF（クラス無し）は内リング経由で到達。

### 交差ゼロの保証

枝/ループを各**セル（リング間の環状帯）に収める**ことで、同心リング（弧）が枝を横切らない planar 配置になる。検証スクリプトで交差数・重なりを計測しながら調整する。

## 主な調整つまみ（データ側）

| 変えたいもの | パラメータ |
|---|---|
| リングの数・半径 | `RINGS4` |
| クラススタート半径 | `START_RING` |
| セクターの角度・テーマ・効果 | `SECTORS[].deg / .ic / .branches[].notable/strong` |
| 枝の横ずれ距離（主線からの離れ具合） | `SIDE_OFFSET` |
| ノータブルの内寄せ（派生線の長さ） | `notableR` の `+1.6` |
| ループの大きさ・前提コスト | `branchLoop` の `gap`/`radius`、`branches[].ring` |
| キーストーンの前提リング本数 | `branches[].ring`（強い物は6） |

## 拡張ガイド

1. **新ノード効果フィールド**: `PassiveEffect`(`types/index.ts`) に追加 → `calculatePassiveEffects`(`data/passiveTree.ts`) の宣言/加算/return → 戦闘で使うなら `core/`・`getTotalStats()`。`describeEffect`(builder) にも表示文を足すと自動説明が出る。optionalのままならS2は0扱いで後方互換。
2. **新プリミティブ**: `RadialTreeBuilder` にメソッド追加。座標は `round2` で丸め、辺は `link()` 経由で張る。
3. **検証**: 生成後に「交差数・ノード重なり・全クラス到達」を計測（`scripts/buildPassiveTreeS3.ts` の `validate` が連結性/ID重複/参照解決をチェック）。`npx vitest run` でテスト緑を確認。
4. **生成物は直接編集しない**: 必ず `*.dsl.ts` を直して `npm run build:s3tree`。

## 関連ドキュメント

- [`passive-tree-system.md`](./passive-tree-system.md) — ランタイム/UI/効果計算/シーズン切替
- [`season3-skilltree-design.md`](./season3-skilltree-design.md) — S3再設計の方針
