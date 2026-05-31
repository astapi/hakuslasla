# パッシブツリーシステム

## 概要

Path of Exile（PoE）にインスパイアされたパッシブスキルツリーシステム。プレイヤーはレベルアップで獲得したスキルポイント（SP）を使用してパッシブノードを解放し、キャラクターをカスタマイズできる。

- **SP = レベル − 1**（Lv1=0SP）。レベルキャップは現状クリア前50 / クリア後60。
- ツリーは **シーズンごとに別データ**を持ち（S2以前 = legacy / S3）、キャラの `season` 列で切り替わる。
- **シーズン3（S3）はクラス別スタート地点**を持つ（PoE同様、自分のクラスからのみ開始）。
- **効果計算は全シーズン共通**。新フィールドを追加しても旧ツリーは0扱いで後方互換が保たれる。

> S3のPoE型再設計（主線+円形クラスター、Lv80対応、ペット強化）の**計画**は [`season3-skilltree-design.md`](./season3-skilltree-design.md)。本書は**現状実装された仕組み**を説明する。

## 画面構成

```
┌─────────────────────────────────────┐
│ パッシブツリー            SP: 10    │  ← ヘッダー
├─────────────────────────────────────┤
│ ピンチで拡大縮小 / ダブルタップでリセット │  ← 操作ヒント
├─────────────────────────────────────┤
│                                     │
│       ○───○                         │
│      /     \                        │
│     ○       ○                       │  ← ツリー表示エリア
│      \     /                        │   （ズーム・パン可能）
│       ◉───◉                         │
│         │                           │
│         ●                           │
│                                     │
├─────────────────────────────────────┤
│ 毒の心得                   習得済   │
│ HP +20, 毒付与率 +3%               │  ← 情報パネル
│ [習得 (SP: 1)]                     │
└─────────────────────────────────────┘
```

## ファイル構成

```
data/
├── json/
│   ├── passiveTree.json     # S2以前（legacy）のマスターデータ
│   └── passiveTree_s3.json  # S3のマスターデータ（クラス別スタート対応）
└── passiveTree.ts           # データローダー・ヘルパー関数・シーズン/クラス切替API

components/player/
└── PassiveTree.tsx          # UIコンポーネント（SVG + ズーム/パン）

types/index.ts               # 型定義
stores/usePlayerStore.ts     # SP・解放済みスキル管理・合計ステータス算出
db/repositories/skillRepository.ts  # 解放ノードの永続化
tests/data/passiveTreeSeason.test.ts # シーズン/クラス切替テスト
```

## データ構造

### PassiveNodeData（JSON定義）

```typescript
interface PassiveNodeData {
  id: string;                      // ユニークID
  name: string;                    // 表示名
  description: string;             // 効果説明
  effect: PassiveEffect;           // 効果値
  requiredNodes: NodeRequirement[]; // 前提ノード条件（接続）
  position: { x: number; y: number }; // UI座標（小数可）
  // --- S3型ツリー用の明示メタ（optional・未設定なら従来推定にフォールバック） ---
  nodeType?: PassiveNodeType;      // 'start' | 'minor' | 'notable' | 'keystone' | 'mastery'
  iconType?: PassiveIconType;      // アイコンを明示（id/effectからの推定をやめる）
  class?: CharacterType;           // クラススタート / クラスター帰属（将来のフィルタ用）
}
```

ランタイムでは `childNodes`（このノードを前提とする子ノードID配列）を付与した `PassiveNode` に変換される。

### NodeRequirement（前提条件）

```typescript
type NodeRequirement = string | string[];

// 例1: 単一前提
requiredNodes: ["poison_1"]              // poison_1が必要
// 例2: 複数前提（AND）
requiredNodes: ["poison_3", "poison_4"]  // 両方必要
// 例3: OR条件
requiredNodes: [["poison_a2", "poison_b2"]]  // どちらか1つでOK
// 例4: 組み合わせ
requiredNodes: ["nodeA", ["nodeB", "nodeC"]] // A AND (B OR C)
// 例5: 空 = 前提なし（スタート候補）
requiredNodes: []
```

- 配列の**各要素はAND**で結合、要素が `string[]` の場合は**内部がOR**。
- OR条件により系統間を環状接続でき、ツリー全体が1つの連結グラフになる。

### PassiveEffect（効果）

PoE式の3層（フラット / increased% / more%）＋戦闘特性で構成。全量は `types/index.ts` 参照。

```typescript
interface PassiveEffect {
  // 基本ステータス（フラット加算）
  hp?: number; atk?: number; def?: number;
  // Increased%（加算で合計）
  hp_increased_pct?: number; atk_increased_pct?: number; def_increased_pct?: number;
  // More%（乗算、非常に強力）
  hp_more_pct?: number; atk_more_pct?: number; def_more_pct?: number;

  // 毒系
  poison_chance?: number;           // 毒付与率（%）
  poison_damage_pct?: number;       // 毒ダメージ +X%（increased）
  poison_damage_more_pct?: number;  // 毒ダメージ X% more
  poison_max_stacks?: number;       // 毒スタック上限増加
  poison_lifesteal?: number;        // 毒ダメージ吸収
  no_direct_damage?: boolean;       // 通常ダメージ無効化（キーストーン）

  // 発火系
  ignite_chance?: number;           // 発火付与率（%）
  ignite_damage_pct?: number;       // 発火ダメージ +X%
  ignite_damage_more_pct?: number;  // 発火ダメージ X% more
  ignite_duration_pct?: number;     // 発火時間 +X%
  ignite_lifesteal?: number;        // 発火ダメージ吸収
  ignite_spread?: boolean;          // イグナイト伝染（キーストーン）
  ignite_stacking_damage?: boolean; // 緩慢なる炎（キーストーン）

  // クリティカル系
  critical_chance?: number;         // クリティカル率（%）
  critical_damage?: number;         // クリティカルダメージ +X%
  hp_on_crit?: number;              // クリティカル時HP回復
  critical_lifesteal_pct?: number;  // クリティカル時ダメージ吸収%

  // 回復・防御系
  hp_regen?: number;                // 毎秒HP回復
  hp_regen_pct?: number;            // 毎秒HP X%回復
  damage_defer_pct?: number;        // ダメージ遅延（X%を4秒かけて受ける）
  hp_on_hit?: number;               // HIT時HP回復
  retaliate_def_pct?: number;       // 被ダメ時DEFのX%を反撃

  // 攻撃速度系
  attack_speed_pct?: number;        // AS +X% increased
  attack_speed_more_pct?: number;   // AS X% more

  // チル系 / フリーズ系
  chill_chance?: number; chill_effect_pct?: number; chill_duration_pct?: number;
  freeze_chance?: number; freeze_duration_pct?: number;
}
```

## シーズン別ツリー

```typescript
export const LATEST_PASSIVE_SEASON = 3;
```

- モジュールロード時に legacy / S3 両ツリーを構築。
- `treeForSeason(season)`：`season >= 3` → S3、`season <= 2` → legacy。
- `setActivePassiveSeason(season)`：アクティブツリーを切替（`loadCharacter` がキャラの `season` を渡す）。
- S3ツリーを編集してもS2キャラには影響しない（別JSON）。将来シーズンを増やす場合は本定数・`treeForSeason` 分岐・新JSONを更新する。

## クラス別スタートとハブ構造（S3）

S3ツリーは **クラスごとに別のスタートノード**を持つ。

```jsonc
// passiveTree_s3.json
{
  "startNodeId": "start",   // 共通フォールバック（S2互換）
  "startNodeIds": {          // クラス別スタート
    "warrior": "warrior_start",
    "elementalist": "elementalist_start",
    "ranger": "ranger_start",
    "frostmage": "frostmage_start",
    "tamer": "tamer_start"
  },
  "nodes": [ /* ... */ ]
}
```

- 各クラススタートは `requiredNodes: []`（起点）＋ `nodeType: "start"`、`class` でクラスを明示。
- 中央 `start` は**通過ハブ**で、`requiredNodes` が5クラスのOR条件。各クラススタートを取ると `start` ハブ経由で全系統に到達できる（**全連結を維持**＝エレメンタリストが毒を取りに行く等も可能、遠回りになるだけ）。
- 各クラススタートは自クラスの得意系統入口にも直結（warrior→crit/speed、ranger→poison、frostmage→ice、elementalist→ignite、tamer→ハブ経由）。

### 関連API（`data/passiveTree.ts`）

| 関数 | 役割 |
|------|------|
| `setActivePassiveClass(type?)` | ロード中キャラのクラスを設定。`loadCharacter` で `setActivePassiveSeason` と並べて呼ぶ。`clear()` で `undefined` リセット。 |
| `getStartNodeId()` | 現在クラスのスタートID。`startNodeIds` に対応があればそれ、なければ最初のクラススタートにフォールバック（クラス未設定のscripts/テストでも取得不能化しない）、それも無ければ共通 `startNodeId`。 |
| `getAllStartNodeIds()` | 全スタートID集合（共通 + 全クラス）。リスペック保護に使用。 |
| `getStartNode()` | `getStartNodeId()` のノード実体。 |

### スタートノードの解放仕様

PoEと同じく **スタートも1SP消費して手動取得**する。複数のスタートが `requiredNodes` 空で並ぶため、`canUnlockNode` は次のように振る舞う：

```typescript
if (node.requiredNodes.length === 0) {
  return nodeId === getStartNodeId();  // 現在クラスのスタートのみ取得可能
}
```

- 自クラスのスタート → 取得可能。
- 他クラスのスタート → 起点専用（通過点にしない）= 取得不可。
- `startNodeIds` を持たないS2ツリーでは共通 `start` が返るため従来挙動。

## 取得・返却ルール

### 取得（`canUnlockNode(nodeId, unlockedNodes)`）

1. 存在しない / 既に取得済み → 不可。
2. `requiredNodes` 空 → 現在クラスのスタートのみ可（上記）。
3. それ以外 → 全 `requiredNodes` 要素を満たす（各要素AND、配列内OR）。

### 返却（`canRefundNode(nodeId, unlockedNodes)`）

1. **全スタートノードは返却不可**（`getAllStartNodeIds()` に含まれるID。ハブ `start` も含む）。
2. 取得済みであること。
3. 返却しても取得済みの子ノードが前提を失わない（孤立する下流があれば不可）。

### SP連携（`usePlayerStore`）

- `unlockSkill(nodeId)`：SP≥1かつ `canUnlockNode` を満たせば `skillRepository.unlock` で永続化、SP −1、`calculatePassiveEffects` で再計算。
- 返却：`canRefundNode` を満たせば `skillRepository.remove`、SP +1、再計算。
- レベルアップ時 SP +1。

## ビルドパス（S2 legacy ツリーの系統）

> 以下はS2 legacyツリーの系統構成。S3ではクラス別スタートから同種の系統（毒・発火・チル/フリーズ・クリ等）へアクセスする。

### 1. 毒ビルド
毒付与率/ダメージ/スタック上限/吸収を積む。キーストーン：`猛毒使い`、`純粋毒`（通常ダメージ無効・毒50% more）。

### 2. クリティカルビルド
クリ率・クリダメ・ATK。キーストーン：`必殺の一撃`、`処刑人`（クリ時HP回復・ATK15% more）。

### 3. ガード/タンクビルド
ダメージ遅延・DEF・HP。キーストーン：`鉄壁の盾`、`鉄壁の守護者`（DEF20% more）、`不滅の城壁`（HP20% more）。

### 4. 吸血ビルド
HIT時HP回復・ATK・毎秒HP回復。キーストーン：`血の渇望`、`血の支配者`、`永遠の吸血鬼`。

### 5. 回復ビルド
毎秒HP回復（フラット/％）・HP増加。キーストーン：`生命の泉`、`不死鳥の祝福`、`永遠の生命`。

### 6. 攻撃速度ビルド
AS increased/more・ATK。キーストーン：`疾風`、`電光石火`、`神速`。

### 発火 / チル / フリーズ
S3でエレメンタリスト（発火）・フロストメイジ（チル/フリーズ）の得意系統として強化される。

## ステータス計算式

PoE式：

```
最終値 = (基本値 + フラット加算) × (1 + 合計increased%) × more1 × more2 × ...
```

### 例：ATK計算

```
基本ATK: 50, パッシブ+20, 装備+30
パッシブ +30% increased, 装備 +20% increased
パッシブ 15% more

最終ATK = (50 + 20 + 30) × (1 + 0.30 + 0.20) × 1.15
        = 100 × 1.50 × 1.15 = 172.5 → 172
```

- フラット・increased% は加算集計、more% は配列保持で順に乗算。
- 合算は `calculatePassiveEffects`（シーズン共通）、合計ステータス反映は `usePlayerStore.getTotalStats()`。

## UI実装

### ノードサイズ（`getNodeSize`）

`nodeType` があればそれを優先：

| nodeType | サイズ |
|----------|--------|
| keystone | 56px |
| start / notable | 46px |
| mastery | 36px |
| minor | 28px |

`nodeType` 未設定（S2）は **id（`key`/`final` を含むか）と effect の内容から推定**するフォールバックを使う。

| サイズ | px | 推定条件 |
|--------|----|---------|
| Small | 28 | 単一効果のフラットボーナス |
| Medium | 36 | increased%効果、または2効果 |
| Large | 46 | more%効果、または3効果以上 |
| Keystone | 56 | id に final/key、または no_direct_damage |

### ノード状態

| 状態 | ボーダー色 | 背景色 |
|------|------------|--------|
| 未解放 | グレー (#4a4a5a) | 暗いグレー |
| 解放可能 | 金 (#c9a227) | 暗い金 + グロー |
| 解放済み | 緑 (#7cb342) | 暗い緑 |
| 選択中 | 白 (#ffffff) | 状態依存 |

### 接続線（SVG Cubic Bezier）

```typescript
const generateSmoothPath = (startX, startY, endX, endY) => {
  const dx = endX - startX, dy = endY - startY;
  const ctrl1X = startX + dx * 0.3, ctrl1Y = startY + dy * 0.1;
  const ctrl2X = startX + dx * 0.7, ctrl2Y = startY + dy * 0.9;
  return `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y} ${ctrl2X} ${ctrl2Y} ${endX} ${endY}`;
};
```

### ジェスチャー操作

| 操作 | 機能 |
|------|------|
| ドラッグ | パン |
| ピンチ | ズーム（MIN 0.3x 〜 MAX 2.5x、初期 0.55x） |
| ダブルタップ | 初期位置・スケールにリセット |
| シングルタップ | ノード選択 |

### アイコン（`iconType`）

`node.iconType ?? getIconType(node.effect)` で解決。`PassiveIconType`：

| タイプ | 条件（推定時） |
|--------|---------------|
| legendary | 全ステータス more% を持つ |
| speed | 攻撃速度効果 |
| guard | ダメージ遅延 |
| vamp | HIT時HP回復 |
| atk / hp / def | 各ステータス単独 |
| poison | 毒効果 |
| crit | クリティカル効果 |
| regen | HP回復効果 |
| special | 複合効果 |

> ⚠ `PassiveIconType` に値を追加したら `PassiveTree.tsx` の `ICON_IMAGES` / `ICON_BG_COLORS` も必ず対応させること。

## 主要関数（`data/passiveTree.ts`）

```typescript
getAllPassiveNodes(): PassiveNode[]
getPassiveNode(id: string): PassiveNode | undefined
canUnlockNode(nodeId, unlockedNodes): boolean
canRefundNode(nodeId, unlockedNodes): boolean
getNodeConnections(): [string, string][]
calculatePassiveEffects(unlockedNodeIds): { hp, atk, def, ...各種効果 }

// シーズン / クラス切替
setActivePassiveSeason(season): void
setActivePassiveClass(type?): void
getStartNodeId(): string
getAllStartNodeIds(): string[]
getStartNode(): PassiveNode | undefined
```

## 永続化

- 解放ノードは `skillRepository`（`db/repositories/skillRepository.ts`）に characterId 単位で保存：`unlock` / `remove` / `getAll` / `clear` / `applyPreset`。
- キャラ作成・ロード時に `unlockedSkills` を復元、SP は `level − 1` から再計算。
- スタートノードは初期未取得。新規キャラはまず自クラスのスタートを取得して開始。

## 技術詳細

- **ライブラリ**：`react-native-svg`（描画）/ `react-native-gesture-handler`（操作）/ `react-native-reanimated`（アニメーション）。
- **最適化**：座標・接続線を `useMemo` でメモ化、全接続線を1つのSVGで描画、グローは解放可能ノードのみ。
- **座標系**：`ノードpx = position × GRID_SIZE(56) + padding + GRID_SIZE/2`。`position` は論理座標（小数可）。

## 拡張ガイド

1. **新ノード追加**：該当シーズンのJSON（S3は `passiveTree_s3.json`）に追加。`position` と `requiredNodes` を設定。スタート増減時は `startNodeIds`・ハブ `start` のOR条件・系統入口のOR条件を整合させ、全クラスから全系統に到達できるか（連結性）を検証。
2. **新効果フィールド追加**：`PassiveEffect`（`types/index.ts`）→ `calculatePassiveEffects` の宣言/加算/return → 戦闘で使うなら `core/`・`getTotalStats()` に反映。optional のままにすればS2は0扱いで後方互換。
3. **新アイコン/ノード種別**：`types/index.ts` の union に追加し、`PassiveTree.tsx` の `ICON_IMAGES` / `ICON_BG_COLORS` / `getNodeSize` を対応。
4. **テスト**：`tests/data/passiveTreeSeason.test.ts` がシーズン切替・クラス別スタート解決・フォールバックを検証。`npx vitest run` で実行（jestではなくvitest）。

## 関連ドキュメント

- [`season3-skilltree-design.md`](./season3-skilltree-design.md) — PoE型への再設計方針（主線+円形クラスター、Lv80対応、ペット強化フィールド計画）
- [`season3-tasks.md`](./season3-tasks.md) — シーズン3全体のタスク（§4=S3ツリー調整）
