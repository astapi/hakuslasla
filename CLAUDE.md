# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

自動戦闘ハクスラRPG。React Native + Expo製。プレイヤー操作は「準備と判断」のみで、戦闘は完全自動。

## Commands

```bash
npm start          # Expo開発サーバー起動
npm run ios        # iOSシミュレータで起動
npm run android    # Androidエミュレータで起動
npm run lint       # ESLint実行
npx tsc --noEmit   # TypeScript型チェック

# シミュレーションスクリプト（戦闘バランス検証用）
npm run simulation       # 通常ダンジョンシミュレーション
npm run simulation:uber  # Uberボスシミュレーション
# 個別スクリプトは scripts/*.ts で実行（tsx + TSX_TSCONFIG_PATH指定）
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/[スクリプト名].ts
```

**注意**:
- Web (`npm run web`) は expo-sqlite の WASM 問題により動作しません。iOS/Android でのみ確認してください。
- シミュレーションスクリプトは `tsconfig.scripts.json` を使用し、Node.js環境でバトルロジックを検証します。

## Architecture

### State Management
- **Zustand (usePlayerStore)**: キャラクターデータ（レベル、経験値、スキル、装備、インベントリ）- DB連携
- **useReducer (useBattle)**: 戦闘中の一時状態（階層、HP、敵情報、戦闘ログ）

### Database (expo-sqlite)
```
db/
├── schema.ts           # テーブル定義
├── database.ts         # DB初期化
└── repositories/       # データアクセス層
    ├── characterRepository.ts   # キャラクターCRUD
    ├── inventoryRepository.ts   # インベントリ（スタック対応）
    ├── equipmentRepository.ts   # 装備管理
    ├── skillRepository.ts       # スキル解放
    ├── storageRepository.ts     # 倉庫（全キャラ共有）
    └── settingsRepository.ts    # 設定
```

### Routing (Expo Router)
```
app/
├── index.tsx              # キャラクター選択（エントリーポイント）
├── character-create.tsx   # キャラクター作成
├── home.tsx               # ホーム画面
├── dungeon-select.tsx     # ダンジョン選択
├── battle/
│   ├── _layout.tsx        # 戦闘レイアウト
│   └── [dungeonId].tsx    # 戦闘画面（動的ルート）
├── result.tsx             # 結果画面
├── inventory.tsx          # インベントリ
├── storage.tsx            # 倉庫
└── skills.tsx             # スキルツリー
```

### Key Directories
- `components/`: UIコンポーネント（battle/, player/, dungeon/, common/）
- `hooks/`: カスタムフック（useBattle.ts が戦闘ロジック統合）
- `stores/`: Zustand store（usePlayerStore.ts）
- `types/`: TypeScript型定義
- `data/`: マスターデータ（dungeons, enemies, items, skills, passiveTree）とドロップロジック
- `core/`: 戦闘エンジンの純粋ロジック（React非依存、シミュレーション可能）
  - `battleEngine.ts`: ゲージ制バトルのコアエンジン
  - `bossBehaviors.ts`: ボススキルと特殊効果
  - `combatEffects.ts`: ダメージ計算、毒、回復などの効果処理
  - `modEffects.ts`: 装備MOD効果の計算
  - `endContent.ts`: エンドコンテンツ（Uber、Dimensional Rush）のバランス調整値
- `scripts/`: バトルシミュレーションとバランス検証スクリプト（Node.js実行）

### Path Alias
`@/*` = `./`（例: `@/components`, `@/stores`）

## Game Flow

```
キャラ選択 → ホーム → ダンジョン選択 → 戦闘（自動） → 結果 → ホーム
```

- 画面遷移は `router.replace()` で履歴をリセット（戻るボタン対策）
- 戦闘は1秒ごとに自動ターン実行
- アイテムはスタック表示（同一アイテムは個数表示）
- 倉庫は全キャラクター共有

## Core Logic

### Battle System (ゲージ制)
- ATBゲージ風：攻撃速度でゲージ増加速度が変化
- ゲージ100で行動、プレイヤーと敵が独立に行動
- 実装: `core/battleEngine.ts` の `createBattleEngine()`
- 1秒 = 1000 ticks、攻撃速度でゲージ増加量が決定

### Damage Calculation
```typescript
// DEF減衰式（DEFが高いほど効果が減少）
reduction = def / (def + 500)  // DEF500で50%軽減、DEF1500で75%軽減
damage = Math.max(1, atk * (1 - reduction))
```

### Item System
- **アイテムベース（ItemBase）**: 基本ステータスとスロット
- **MOD（ItemMod）**: ランダム接尾辞効果（tier 1-5、ダンジョンで範囲指定）
- **ドロップ**: ダンジョン別のModTierRange/ModCountRangeで品質管理
- **ユニーク装備**: 固定効果、ボス撃破で一度だけドロップ
- 実装: `data/items.ts`, `data/json/items.json`, `data/json/mods.json`

### Level Up (per level)
- MaxHP +10, ATK +2, DEF +1, SkillPoints +1

### Total Stats
基本値 + 装備ボーナス（getTotalStats()で計算）

## Important Implementation Notes

### Battle Logic Separation
- **React層（hooks/useBattle.ts）**: UI連携、状態管理、DB操作
- **Pure Logic層（core/）**: 戦闘計算のみ、React非依存
  - メリット: Node.jsでシミュレーション可能、テスト容易
  - `createBattleEngine()` はステートフルオブジェクトを返し、`advanceTicks()`でゲージを進める

### MOD Effects Combination
- 装備スロットごとのMODを `combineMods()` で統合（`core/modEffects.ts`）
- パッシブツリー効果は `calculatePassiveEffects()` で計算（`data/passiveTree.ts`）
- ボス特殊効果・エンドコンテンツ補正は `core/endContent.ts` と `core/bossBehaviors.ts`

### Data Files Structure
- `data/json/*.json`: マスターデータ（items, dungeons, mods, skillsなど）
- TypeScriptから読み込み、型安全性を保つ
- MOD tierやドロップテーブルはJSONで管理

## UI Theme

ダークテーマ統一
- Background: `#1a1a2e`
- Text: `#fff`
- Success: `#4CAF50`
- Danger: `#F44336`
- Clear: `#FFD700`
