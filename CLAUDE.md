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
```

**注意**: Web (`npm run web`) は expo-sqlite の WASM 問題により動作しません。iOS/Android でのみ確認してください。

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
- `hooks/`: カスタムフック（useBattle.ts が戦闘ロジック）
- `stores/`: Zustand store（usePlayerStore.ts）
- `types/`: TypeScript型定義
- `data/`: マスターデータ（dungeons, enemies, items, skills）

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

### Damage Calculation
```typescript
damage = Math.max(1, atk - def)
```

### Level Up (per level)
- MaxHP +10, ATK +2, DEF +1, SkillPoints +1

### Total Stats
基本値 + 装備ボーナス（getTotalStats()で計算）

## UI Theme

ダークテーマ統一
- Background: `#1a1a2e`
- Text: `#fff`
- Success: `#4CAF50`
- Danger: `#F44336`
- Clear: `#FFD700`
