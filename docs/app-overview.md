# アプリ概要（画面構成・仕様・アーキテクチャ）

## 目的 / 範囲
- 本ドキュメントは、現在の実装から把握できる「画面構成」「画面仕様の要点」「アーキテクチャ」を簡潔にまとめる。
- 詳細な仕様は既存ドキュメント（`docs/`配下）を参照し、本書は全体像と導線の把握を目的とする。

---

## 画面構成（ルーティング）
Expo Router 構成。`app/_layout.tsx` で Stack を定義。

- `/` : キャラクター選択
- `/character-create` : キャラクター作成（モーダル）
- `/home` : ホーム（キャラ・装備・各機能入口）
- `/dungeon-select` : ダンジョン選択
- `/battle/[dungeonId]` : バトル進行
- `/result` : バトル結果
- `/skills` : パッシブツリー（モーダル）
- `/inventory` : インベントリ
- `/storage` : 倉庫
- `/settings` : 設定（言語・ドロップフィルタ）
- `/debug` : デバッグメニュー（開発用）

---

## 画面仕様（要点）
### キャラクター選択 `/`
- キャラクター一覧表示。選択でロードし `/home` へ。
- 新規作成導線は `/character-create`。
- 削除ボタンあり。
- 直近選択キャラ ID を設定に保存。

### キャラクター作成 `/character-create`
- 名前入力 → 作成 → 戻る。
- 初期ステータス（Lv1 / HP100 / ATK10 / DEF5）をプレビュー表示。

### ホーム `/home`
- キャラ情報（名前・ステータス・画像）と装備一覧を表示。
- 主要導線: スキル、インベントリ、倉庫、設定、ダンジョン選択。
- デバッグ画面導線あり。
- 画面フォーカス時に内部再描画（装備/ステータス更新反映）。

### ダンジョン選択 `/dungeon-select`
- 解放順序・クリア状況・エンドコンテンツ解放・チケット所持で表示可否を判定。
- 選択で `/battle/[dungeonId]` に `replace` 遷移。
- Uber 系はチケット消費が必要。

### バトル `/battle/[dungeonId]`
- `useBattle` によるバトル進行。
- 状態: フロア進行、敵HP/プレイヤーHP、行動ゲージ、毒、戦闘ログ、ドロップ。
- 自動周回（オート）と一時停止が可能。
- 撤退確認モーダルあり。
- ドロップ演出（宝箱落下・レアリティ演出）。

### バトル結果 `/result`
- クリア/敗北/撤退の結果表示。
- クリアフロア数、獲得経験値、獲得アイテムを表示。
- オート周回時は累計結果を表示。
- ホームへ戻る。

### スキル `/skills`
- パッシブツリー画面。
- 閉じるボタンで戻る。

### インベントリ `/inventory`
- タブ: 装備 / その他（チケット・リスペックトークン等）。
- スロット別一覧、詳細表示。
- 装備・売却・倉庫移動を提供。
- ドロップフィルタ設定（戦闘中の拾得判定に影響）。

### 倉庫 `/storage`
- スロット別に保存アイテム一覧。
- 引き出し（インベントリ容量チェック）・売却。

### 設定 `/settings`
- 言語設定（system/ja/en）。
- ドロップフィルタ（カテゴリ、MOD数、Tier制限）。

### デバッグ `/debug`（開発用）
- パッシブ/装備/ビルドのプリセット適用。
- 戦闘速度設定。
- 現在状態の共有（JSON）。

---

## 画面遷移（主要フロー）
1. 起動 → `/`（キャラクター選択）
2. キャラ選択 → `/home`
3. ホーム → `/dungeon-select` → `/battle/[dungeonId]`
4. バトル終了 → `/result` → `/home`
5. ホームから `/skills`・`/inventory`・`/storage`・`/settings`

---

## アーキテクチャ
### 技術スタック
- UI: React Native + Expo
- ルーティング: Expo Router（`app/` ベース）
- 状態管理: Zustand（`stores/usePlayerStore.ts`）
- 永続化: SQLite（`expo-sqlite`）
- 多言語: i18n (`lib/i18n.ts`, `locales/`)

### モジュール構成（概略）
```
app/            画面コンポーネント（ルーティング）
components/     UIパーツ（共通/バトル/プレイヤー）
hooks/          画面ロジック（例: useBattle）
stores/         グローバル状態（Zustand）
core/           ゲームロジック（UI非依存）
data/           マスターデータ + JSON
 db/             SQLite初期化・リポジトリ
lib/            i18n など基盤
```

### データフロー
1) **画面** → **hooks / store** → **core**（純粋計算）
2) **store / repositories** → **SQLite**（永続化）
3) **data/**（マスターデータ）を参照

```
UI(app/) -> hooks/useBattle -> core/* (戦闘計算)
          -> stores/usePlayerStore (プレイヤー状態)
          -> db/repositories/* (SQLite)
```

### ストレージ設計（SQLite）
- `characters` : キャラ基本情報
- `character_equipment` : 装備（JSON保存）
- `character_inventory` : インベントリ（MOD付きアイテムをJSON保存）
- `character_skills` : 解放済みスキル
- `storage` : 倉庫（キャラ共有）
- `game_settings` : 言語/ドロップフィルタ/チケット/クリア記録等

### ゲームロジック（core/）
- `battleEngine`, `battle`, `gaugeBattle` : バトル/ゲージ制ロジック
- `combatEffects` : 攻撃/毒/回復処理
- `modEffects` : MOD集計と効果計算
- `player` : レベル/EXP/ステータス計算
- `endContent` : エンドコンテンツ/ボス解放
- `simulation` : バランス検証用シミュレーション

### ドメインデータ（data/）
- `data/json/*.json` : ダンジョン・敵・装備・パッシブなどの定義
- `data/*.ts` : JSON読み込み・ユーティリティ

---

## 関連ドキュメント
- `docs/home-screen.md`
- `docs/dungeon-system.md`
- `docs/battle-system.md`
- `docs/battle-screen-specification.md`
- `docs/inventory-storage-system.md`
- `docs/passive-tree-system.md`
- `docs/mod-system.md`
- `docs/level-system.md`
- `docs/drop-rate-system.md`
- `docs/endcontents.md`

