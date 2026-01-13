# パッシブツリーシステム

## 概要

Path of Exile（PoE）にインスパイアされたパッシブスキルツリーシステム。プレイヤーはレベルアップで獲得したスキルポイント（SP）を使用して、様々なパッシブノードを解放し、キャラクターをカスタマイズできる。

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
│   └── passiveTree.json    # パッシブツリーのマスターデータ
└── passiveTree.ts          # データローダー・ヘルパー関数

components/player/
└── PassiveTree.tsx         # UI コンポーネント

types/index.ts              # 型定義
stores/usePlayerStore.ts    # スキルポイント・解放済みスキル管理
```

## データ構造

### PassiveNodeData（JSON定義）

```typescript
interface PassiveNodeData {
  id: string;                      // ユニークID
  name: string;                    // 表示名
  description: string;             // 効果説明
  effect: PassiveEffect;           // 効果値
  requiredNodes: NodeRequirement[]; // 前提ノード条件
  position: { x: number; y: number }; // UI座標
}
```

### NodeRequirement（前提条件）

前提ノードは柔軟な条件設定が可能：

```typescript
type NodeRequirement = string | string[];

// 例1: 単一前提
requiredNodes: ["poison_1"]  // poison_1が必要

// 例2: 複数前提（AND）
requiredNodes: ["poison_3", "poison_4"]  // 両方必要

// 例3: OR条件
requiredNodes: [["poison_a2", "poison_b2"]]  // どちらか1つでOK

// 例4: 組み合わせ
requiredNodes: ["nodeA", ["nodeB", "nodeC"]]  // A AND (B OR C)
```

### PassiveEffect（効果）

```typescript
interface PassiveEffect {
  // 基本ステータス（フラット加算）
  hp?: number;
  atk?: number;
  def?: number;

  // Increased%（加算で合計）
  hp_increased_pct?: number;
  atk_increased_pct?: number;
  def_increased_pct?: number;

  // More%（乗算、非常に強力）
  hp_more_pct?: number;
  atk_more_pct?: number;
  def_more_pct?: number;

  // 毒系
  poison_chance?: number;           // 毒付与率（%）
  poison_damage_pct?: number;       // 毒ダメージ倍率 +X%
  poison_damage_more_pct?: number;  // 毒ダメージ X% more
  poison_max_stacks?: number;       // 毒スタック上限増加
  poison_damage_reduction?: number; // 毒状態時ダメージ軽減
  poison_lifesteal?: number;        // 毒ダメージ吸収
  no_direct_damage?: boolean;       // 通常ダメージ無効化（キーストーン）

  // クリティカル系
  critical_chance?: number;         // クリティカル率（%）
  critical_damage?: number;         // クリティカルダメージ+X%
  hp_on_crit?: number;              // クリティカル時HP回復

  // 回復・防御系
  hp_regen?: number;                // 毎ターンHP回復
  hp_regen_pct?: number;            // 毎ターンHP X%回復
  damage_reduction_pct?: number;    // ダメージ軽減+X%
  hp_on_hit?: number;               // HIT時HP回復

  // 攻撃速度系
  attack_speed_pct?: number;        // AS +X% increased
  attack_speed_more_pct?: number;   // AS X% more
}
```

## ビルドパス

### 1. 毒ビルド（上方向）

中央のスタートノードから上へ伸びるパス。毒を積み重ねてダメージを与える。

**主な効果:**
- 毒付与率 UP
- 毒ダメージ倍率 UP
- 毒スタック上限増加（最大5スタック）
- 毒状態時のダメージ軽減
- 毒ダメージ吸収（回復）

**キーストーン:**
- `猛毒使い`: 毒付与率 +10%, 毒ダメージ +20%, 毒ダメージ吸収 +30%
- `純粋毒`: 通常ダメージを与えられなくなる。毒ダメージ 50% more

### 2. クリティカルビルド（右上方向）

高いクリティカル率とクリティカルダメージで大ダメージを狙う。

**主な効果:**
- クリティカル率 UP
- クリティカルダメージ UP
- ATK増加
- クリティカル時HP回復

**キーストーン:**
- `必殺の一撃`: クリティカルダメージ +30%
- `処刑人`: クリティカル時HP +150回復, ATK 15% more

### 3. ガード/タンクビルド（右下方向）

高いDEFとダメージ軽減で耐久力を高める。

**主な効果:**
- ダメージ軽減 UP
- DEF増加（フラット・Increased）
- HP増加（フラット・Increased）

**キーストーン:**
- `鉄壁の盾`: ダメージ軽減 +8%
- `鉄壁の守護者`: ダメージ軽減 +10%, DEF 20% more
- `不滅の城壁`: HP 20% more

### 4. 吸血/ライフスティールビルド（左下方向）

攻撃時にHPを回復して持続戦闘能力を高める。

**主な効果:**
- HIT時HP回復
- ATK増加
- 毎ターンHP回復

**キーストーン:**
- `血の渇望`: HIT時HP +30回復
- `血の支配者`: HIT時HP +40回復, ATK 15% more
- `永遠の吸血鬼`: 毎ターンHP 3%回復

### 5. 回復/リジェネビルド（左上方向）

高いHP再生力で長期戦に強い。

**主な効果:**
- 毎ターンHP回復（フラット）
- 毎ターンHP%回復
- HP増加（フラット・Increased・More）

**キーストーン:**
- `生命の泉`: 毎ターンHP 2%回復
- `不死鳥の祝福`: HP 25% more, 毎ターンHP +25回復
- `永遠の生命`: 毎ターンHP 4%回復

### 6. 攻撃速度ビルド（下方向）

高い攻撃速度で手数を増やす。

**主な効果:**
- 攻撃速度 Increased% UP
- 攻撃速度 More% UP
- ATK増加

**キーストーン:**
- `疾風`: 攻撃速度 +15%
- `電光石火`: 攻撃速度 15% more
- `神速`: 攻撃速度 20% more, ATK 10% more

## ステータス計算式

PoE式の計算システム：

```
最終値 = (基本値 + フラット加算) × (1 + 合計increased%) × more1 × more2 × ...
```

### 例：ATK計算

```
基本ATK: 50
パッシブでATK +20
装備でATK +30
パッシブで +30% increased
装備で +20% increased
パッシブで 15% more

最終ATK = (50 + 20 + 30) × (1 + 0.30 + 0.20) × 1.15
        = 100 × 1.50 × 1.15
        = 172.5 → 172
```

## UI実装

### ノードサイズ

ノードの重要度に応じて4段階のサイズを設定：

| サイズ | ピクセル | 条件 |
|--------|----------|------|
| Small | 28px | 単一効果のフラットボーナス |
| Medium | 36px | Increased%効果、または2つの効果 |
| Large | 46px | More%効果、または3つ以上の効果 |
| Keystone | 56px | final/keyノード、またはno_direct_damage |

### ノード状態

| 状態 | ボーダー色 | 背景色 | 説明 |
|------|------------|--------|------|
| 未解放 | グレー (#4a4a5a) | 暗いグレー | 解放不可 |
| 解放可能 | 金 (#c9a227) | 暗い金色 + グロー | SP消費で解放可 |
| 解放済み | 緑 (#7cb342) | 暗い緑色 | 既に取得済み |
| 選択中 | 白 (#ffffff) | 状態に依存 | タップ中 |

### 接続線

SVGのCubic Bezier曲線でノード間を接続：

```typescript
// S字カーブの生成
const generateSmoothPath = (startX, startY, endX, endY) => {
  const dx = endX - startX;
  const dy = endY - startY;
  const ctrl1X = startX + dx * 0.3;
  const ctrl1Y = startY + dy * 0.1;
  const ctrl2X = startX + dx * 0.7;
  const ctrl2Y = startY + dy * 0.9;
  return `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y} ${ctrl2X} ${ctrl2Y} ${endX} ${endY}`;
};
```

### ジェスチャー操作

| 操作 | 機能 |
|------|------|
| ドラッグ | パン（移動） |
| ピンチ | ズーム（0.3x〜2.5x） |
| ダブルタップ | 初期位置・スケールにリセット |
| シングルタップ | ノード選択 |

### アイコン

効果タイプに応じたアイコンを表示：

| タイプ | アイコン | 条件 |
|--------|----------|------|
| legendary | 👑 | 全ステータスmore%を持つ |
| speed | ⚡ | 攻撃速度効果を持つ |
| guard | 🔰 | ダメージ軽減を持つ |
| vamp | 🩸 | HIT時HP回復を持つ |
| atk | ⚔ | ATK関連効果のみ |
| hp | ♥ | HP関連効果のみ |
| def | 🛡 | DEF関連効果のみ |
| poison | ☠ | 毒効果を持つ |
| crit | ★ | クリティカル効果を持つ |
| regen | ✚ | HP回復効果を持つ |
| special | ◆ | 複合効果 |

## 主要関数

### passiveTree.ts

```typescript
// 全ノード取得
getAllPassiveNodes(): PassiveNode[]

// ノード取得
getPassiveNode(id: string): PassiveNode | undefined

// 解放可能判定
canUnlockNode(nodeId: string, unlockedNodes: string[]): boolean

// 効果計算
calculatePassiveEffects(unlockedNodeIds: string[]): {
  hp, atk, def,
  hp_increased_pct, atk_increased_pct, def_increased_pct,
  hp_more_pct[], atk_more_pct[], def_more_pct[],
  poison_chance, poison_damage_pct, ...
}
```

### usePlayerStore.ts

```typescript
interface PlayerStore {
  skillPoints: number;
  unlockedSkills: string[];

  unlockSkill(skillId: string): Promise<void>;
  // SPを1消費してスキルを解放
}
```

## 技術詳細

### 使用ライブラリ

- `react-native-svg` - SVG描画（接続線、ノード）
- `react-native-gesture-handler` - ジェスチャー操作
- `react-native-reanimated` - アニメーション

### パフォーマンス最適化

1. **useMemo使用**: 座標計算、接続線生成をメモ化
2. **SVG一括描画**: 全接続線を1つのSVGコンポーネントで描画
3. **条件付きレンダリング**: グロー効果は解放可能ノードのみ

### 座標システム

```
グリッドサイズ: 56px
パディング: 56px（上下左右）

ノード座標 = position × GRID_SIZE + padding + GRID_SIZE/2
```

JSON座標（position.x, position.y）は論理座標で、実際のピクセル座標に変換される。

## 拡張ガイド

### 新しいビルドパスを追加

1. `data/json/passiveTree.json` にノードを追加
2. 適切な position.x, position.y を設定
3. requiredNodes で前提関係を定義

### 新しい効果タイプを追加

1. `types/index.ts` の `PassiveEffect` に新プロパティを追加
2. `data/passiveTree.ts` の `calculatePassiveEffects` に計算ロジックを追加
3. 戦闘システムで効果を適用

### カスタムアイコンを追加

1. `components/player/PassiveTree.tsx` の `IconType` に新タイプを追加
2. `ICON_FALLBACK` に対応するアイコンを追加
3. `getIconType` に判定条件を追加
