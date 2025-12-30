# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

自動戦闘ハクスラRPG。React Native + Expo製。プレイヤー操作は「準備と判断」のみで、戦闘は完全自動。

## Commands

```bash
npm start          # Expo開発サーバー起動
npm run ios        # iOSシミュレータで起動
npm run android    # Androidエミュレータで起動
npm run web        # Webブラウザで起動
npm run lint       # ESLint実行
```

## Architecture

### State Management
- **Zustand (usePlayerStore)**: 永続的な状態（レベル、経験値、スキル、装備、インベントリ）
- **useReducer (useBattle)**: 戦闘中の一時状態（階層、HP、敵情報、戦闘ログ）

### Routing (Expo Router)
```
app/
├── index.tsx              # ホーム画面
├── dungeon-select.tsx     # ダンジョン選択
├── battle/
│   ├── _layout.tsx        # 戦闘レイアウト
│   └── [dungeonId].tsx    # 戦闘画面（動的ルート）
├── result.tsx             # 結果画面
├── inventory.tsx          # インベントリ
├── storage.tsx            # 倉庫
└── skills.tsx             # スキルツリー（モーダル）
```

### Key Directories
- `components/`: UIコンポーネント（battle/, player/, dungeon/, common/）
- `hooks/`: カスタムフック（useBattle.ts が戦闘ロジック）
- `stores/`: Zustand store
- `types/`: TypeScript型定義
- `data/`: マスターデータ（dungeons, enemies, items, skills）

### Path Alias
`@/*` = `./`（例: `@/components`, `@/stores`）

## Game Flow

```
ホーム → ダンジョン選択 → 戦闘（自動） → 結果 → ホーム
```

- ダンジョン選択→戦闘、戦闘→結果、結果→ホームは `router.replace()` で履歴をリセット
- 戦闘は1秒ごとに自動ターン実行

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
