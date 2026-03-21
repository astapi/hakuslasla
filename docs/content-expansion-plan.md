# コンテンツ拡充 実装計画

## 概要

5つの大型機能を段階的に実装する。依存関係を考慮し、Phase 1から順に進める。

---

## 依存関係マップ

```
Phase 1: チル & フリーズ（状態異常追加）
  ↓
Phase 2: 氷系術師（新キャラクター）← Phase 1が前提
  ↓
Phase 3: UberUberボス ← 既存Uberシステム拡張
  ↓
Phase 4: バッジシステム ← Phase 3のUberUberボスがバッジ条件に含まれる
  ↓
Phase 5: Uberツリー ← 既存パッシブツリーの横展開
```

---

## Phase 1: チル & フリーズ（状態異常追加）

### 概要
既存の毒・発火に続く3番目の状態異常系統。攻撃速度低下（チル）と行動不能（フリーズ）。

### 設計

#### チル（Chill）
- **効果**: 対象の攻撃速度を0.8倍にする
- **実装方式**: 発火と同様の上書き式（スタックなし）
- **持続時間**: 3秒（デフォルト）
- **チルエフェクトMOD**: 倍率を強化（0.8 → 0.7など、最低0.5まで）

#### フリーズ（Freeze）
- **効果**: 対象の攻撃速度を0にする（行動不能）。HP regenはそのまま維持
- **発動条件**: 独立判定（チル状態でなくても発動する）
- **最大発生率**: 10%（MOD・パッシブ込みの上限キャップ）
- **持続時間**: 1.5秒（デフォルト）
- **フリーズ解除後**: 自動的にチル状態に移行（チルの持続時間分）
- **バランス**: 非常に強力なため、持続時間は短く、発生率にハードキャップ

### 変更ファイル

#### 1. 型定義
- **`core/types.ts`**
  - `ChillState` インターフェース追加: `{ speedMultiplier: number, remainingMs: number }`
  - `FreezeState` インターフェース追加: `{ remainingMs: number }`
  - `BattleState` に `enemyChill`, `enemyFreeze`, `playerChill`, `playerFreeze` 追加
  - `CombinedModEffects` にチル・フリーズ関連フィールド追加

#### 2. MOD定義
- **`types/index.ts`**
  - `ModType` に追加: `chill_chance`, `chill_effect_pct`, `chill_duration_pct`, `freeze_chance`, `freeze_duration_pct`
- **`data/json/mods.json`**
  - 各MODのTier 1-10を定義（武器・手袋スロット中心）

#### 3. 戦闘ロジック
- **`core/combatEffects.ts`**
  - `tryApplyChill()`: チル付与処理
  - `tryApplyFreeze()`: フリーズ付与処理（チル状態の敵のみ、上限10%）
  - `processChillEffect()`: チル持続管理
  - `processFreezeEffect()`: フリーズ持続管理
- **`core/battleEngine.ts`**
  - ゲージ計算時にチル/フリーズの攻撃速度補正を適用
  - フリーズ中はゲージ増加0（HP regenは継続）
- **`core/modEffects.ts`**
  - `combineMods()` にチル・フリーズMODの統合処理追加
  - `calculateAttackSpeed()` にチル倍率の適用

#### 4. i18n
- **`i18n/locales/*.json`**
  - チル・フリーズ関連のテキスト追加（MOD名、戦闘ログ）

#### 5. 戦闘UI
- **`components/battle/`**
  - チル・フリーズの状態表示アイコン/エフェクト追加

#### 6. ドロップ対応
- **`data/json/mods.json`**
  - チル・フリーズMODに `weaponTypes: ["staff"]` を追加（杖専用）
  - 手袋スロットのチル・フリーズMODはweaponTypes制限なし（全クラス使用可能）

#### 7. パッシブツリー
- **`data/json/passiveTree.json`**
  - 氷系パッシブノード群を追加（チル付与率UP、チルエフェクト強化、フリーズ確率UP等）
  - Phase 2の氷系術師と共用だが、他クラスでも装備MODと合わせて活用可能

### 作業項目（見積り）
1. 型定義追加（ChillState, FreezeState, MODタイプ） ✅
2. mods.json にチル・フリーズMOD追加 ✅
3. combatEffects.ts にチル・フリーズ処理実装 ✅
4. battleEngine.ts のゲージ計算にチル/フリーズ反映 ✅
5. modEffects.ts のcombineMods拡張 ✅
6. 戦闘ログメッセージ追加 ✅
7. i18n対応 ✅
8. 戦闘UIにステータス表示追加 ✅
9. チル・フリーズMODを杖専用に設定（weaponTypes制限） ✅
10. パッシブツリーに氷系ノード追加 ✅

---

## Phase 2: 氷系術師（新キャラクター）

### 概要
4番目のプレイアブルキャラクター。チル・フリーズを軸とした氷属性の術師。

### 設計

#### 基本ステータス
```typescript
// core/player.ts の BASE_STATS に追加
ice_mage: { maxHp: 80, atk: 10, def: 3 }
```
- 低HP・低DEFの代わりに強力なデバフで敵を無力化するスタイル

#### クラス固有能力
```typescript
// core/player.ts の CLASS_ABILITIES に追加
ice_mage: { chillChance: 25 }  // チル付与率+25%
```

#### パッシブツリー拡張
- **`data/json/passiveTree.json`** に氷系ノード追加
  - チル系: チル付与率UP、チルエフェクト強化、チル持続延長
  - フリーズ系: フリーズ確率UP（上限10%は超えない）、フリーズ持続延長
  - キーストーン案:
    - **氷結の支配者**: チルエフェクト倍率が2倍に適用される代わりに、毒・発火が無効
    - **絶対零度**: フリーズ中の敵へのダメージ+30% more

### 変更ファイル

#### 1. キャラクター定義
- **`types/index.ts`**
  - `CharacterType` に `'ice_mage'` 追加
- **`core/player.ts`**
  - `BASE_STATS`, `CLASS_ABILITIES` に ice_mage 追加

#### 2. キャラクター作成UI
- **`app/character-create.tsx`**
  - 氷系術師の選択肢追加
  - アイコン・説明テキスト

#### 3. パッシブツリー
- **`data/json/passiveTree.json`**
  - 氷系ノード群追加（8-12ノード程度）

#### 4. 初期装備・アイテム
- **`data/json/items.json`**
  - 氷系術師向け初期武器（氷杖など）

#### 5. i18n
- 氷系術師関連のテキスト全ロケール追加

### 作業項目
1. CharacterType拡張・基本ステータス定義 ✅
2. CLASS_ABILITIES追加 ✅
3. キャラクター作成UI更新 ✅
4. パッシブツリーに氷系ノード追加 ✅（Phase 1で実施済み）
5. 初期装備追加（※画像・サウンドはプレースホルダー）
6. i18n対応 ✅
7. 既存UIの4クラス対応確認（レイアウト調整等） ✅
8. DB characterRepository対応 ✅
9. 戦闘MOD計算にchillChance反映 ✅
10. ステータスパネルにチル・フリーズ表示追加 ✅

---

## Phase 3: UberUberボス

### 概要
各Uberボスのさらに強力なバージョン。全バッジ取得キャラのみ挑戦可能。

### 設計

#### UberUberボス定義
```typescript
// core/endContent.ts に追加
const UBER_UBER_BOSS_BY_BASE: Record<string, string> = {
  uber_goblin_king: 'uber_uber_goblin_king',
  uber_bandit_leader: 'uber_uber_bandit_leader',
  uber_vampire: 'uber_uber_vampire',
  uber_kraken: 'uber_uber_kraken',
  uber_demon_lord: 'uber_uber_demon_lord',
  uber_true_final_boss: 'uber_uber_true_final_boss',
};
```

#### 入場条件
- 全バッジ取得済みキャラクターのみ挑戦可能
- 入場券はUberボスと共通（uber_ticketを使用）
- UberUberバッジ以外の全バッジを所持していることが条件

#### スケーリング
- Uberボスのさらに1.5-2倍程度の強化
- 新規特殊スキル追加（各ボス1-2個）
- HP閾値スキルの強化版

### 変更ファイル

#### 1. ボスデータ
- **`data/json/monsters.json`**
  - UberUberボス6体のステータス定義
- **`data/json/dungeons.json`**
  - UberUberダンジョン6個追加

#### 2. ボス行動
- **`core/bossBehaviors.ts`**
  - UberUberボス用スキルID追加
  - 強化版特殊効果の実装
- **`core/endContent.ts`**
  - UberUberボスのスケーリング定数
  - 入場条件チェック関数（UberUberバッジ以外の全バッジ必要）

#### 3. ダンジョン選択
- **`app/dungeon-select.tsx`**
  - UberUberダンジョンの表示・選択UI
  - バッジ条件による解放表示
- **`data/endContents.ts`**
  - UberUber解放条件のロジック

#### 4. DB
- **`db/repositories/settingsRepository.ts`**
  - UberUberボスの解放状態管理

#### 5. i18n
- UberUberボス名・ダンジョン名の全ロケール追加

### 作業項目
1. モンスターデータ（6体）定義
2. ダンジョンデータ（6個）定義
3. ボススキル・特殊効果実装
4. スケーリング定数設定
5. 入場条件チェック（全バッジ）
6. ダンジョン選択UI更新
7. 解放状態DB管理
8. i18n対応

---

## Phase 4: バッジシステム

### 概要
キャラクターごとに条件達成でバッジを付与。Phase 3のUberUberボスクリアも条件に含む。

### 設計

#### バッジ一覧
| バッジID | 条件 | 表示名（案） |
|---------|------|------------|
| `badge_uber_goblin_king` | Uberゴブリンキング撃破 | 王殺し |
| `badge_uber_bandit_leader` | Uber盗賊の頭撃破 | 影の制覇者 |
| `badge_uber_vampire` | Uberヴァンパイア撃破 | 真昼の狩人 |
| `badge_uber_kraken` | Uberクラーケン撃破 | 深淵の征服者 |
| `badge_uber_demon_lord` | Uber魔王撃破 | 魔王討伐者 |
| `badge_uber_true_final_boss` | Uber最終ボス撃破 | 終焉を超えし者 |
| `badge_dimensional_4000` | 次元回廊4000階到達 | 次元の覇者 |
| `badge_uber_uber_boss` | UberUberボス全撃破 | 究極の挑戦者 |

#### データ構造
```typescript
interface Badge {
  id: string;
  nameKey: string;       // i18nキー
  descriptionKey: string;
  condition: BadgeCondition;
  icon: string;          // アイコン識別子
}

type BadgeCondition =
  | { type: 'uber_boss_clear'; bossId: string }
  | { type: 'dimensional_floor'; floor: number }
  | { type: 'uber_uber_all_clear' };
```

### 変更ファイル

#### 1. バッジ定義
- **`data/json/badges.json`** (新規)
  - バッジマスターデータ
- **`data/badges.ts`** (新規)
  - バッジ判定ロジック・ヘルパー関数

#### 2. DB
- **`db/schema.ts`**
  - `character_badges` テーブル追加（character_id, badge_id, earned_at）
- **`db/repositories/badgeRepository.ts`** (新規)
  - バッジCRUD操作
- **`db/database.ts`**
  - マイグレーションにバッジテーブル追加

#### 3. バッジ判定・付与
- **`hooks/useBadge.ts`** (新規)
  - バッジ条件チェック・付与ロジック
- **`app/result.tsx`**
  - 戦闘結果時にバッジ条件チェック・付与
  - バッジ獲得演出

#### 4. バッジ表示UI
- **`components/player/BadgeList.tsx`** (新規)
  - バッジ一覧コンポーネント
- **`app/home.tsx`**
  - キャラクター情報にバッジ表示

#### 5. ストア
- **`stores/usePlayerStore.ts`**
  - バッジ関連のstate/action追加

#### 6. i18n
- バッジ名・説明の全ロケール追加

### 作業項目
1. DBスキーマ・マイグレーション ✅（V5: character_badgesテーブル）
2. badgeRepository実装 ✅
3. バッジマスターデータ定義（badges.json） ✅
4. バッジ判定ロジック実装 ✅（data/badges.ts）
5. 戦闘結果でのバッジ付与処理 ✅（useBattle.ts）
6. バッジ表示UI（ホーム画面・キャラ情報） ✅（BadgeList.tsx）
7. UberUber入場条件にバッジチェック統合（Phase 3実装時に対応）
8. i18n対応

---

## Phase 5: Uberツリー

### 概要
Uberボス撃破で獲得するポイントで解放する、パッシブツリーとは別のツリー。

### 設計

#### ポイント獲得
- 各Uberボス初回撃破時に1ポイント（計6ポイント最大）
- キャラクターごとに独立

#### ツリー構成（案）
- 6ポイントで全ノード解放は不可能な設計（選択の余地を残す）
- ノード数: 10-15個程度
- 強力だがビルドの方向性を決定づける効果

```
例:
[超越の力] ← ATK 10% more
  ├── [不滅の意志] ← HP regen 2% more
  │     └── [時の支配] ← 攻撃速度 5% more
  └── [破壊の化身] ← 全ダメージ 8% more
        └── [終焉の使者] ← ボス戦ダメージ 15% more
```

#### データ構造
```typescript
interface UberTreeNode {
  id: string;
  nameKey: string;
  descriptionKey: string;
  effect: PassiveEffect;  // 既存のPassiveEffect型を再利用
  requiredNodes: string[];
  position: { x: number; y: number };
  cost: number;  // 通常1ポイント
}
```

### 変更ファイル

#### 1. ツリー定義
- **`data/json/uberTree.json`** (新規)
  - Uberツリーノード定義
- **`data/uberTree.ts`** (新規)
  - Uberツリーロジック（パッシブツリーのロジックを参考に）

#### 2. DB
- **`db/schema.ts`**
  - `character_uber_tree` テーブル追加（character_id, node_id）
  - `character_uber_points` テーブル追加（character_id, boss_id, earned）
- **`db/repositories/uberTreeRepository.ts`** (新規)
  - Uberツリーノード解放・ポイント管理

#### 3. ポイント付与
- **`app/result.tsx`**
  - Uberボス初回撃破時にポイント付与

#### 4. ステータス計算
- **`core/modEffects.ts`**
  - `calculateUberTreeEffects()` 追加
  - 最終ステータス計算にUberツリー効果を統合

#### 5. UI
- **`app/uber-tree.tsx`** (新規)
  - Uberツリー画面（パッシブツリーUIを参考に）
- **`components/uber-tree/`** (新規)
  - Uberツリー用コンポーネント群
- **`app/home.tsx`**
  - Uberツリーへの導線追加

#### 6. ストア
- **`stores/usePlayerStore.ts`**
  - Uberツリー関連のstate/action追加

#### 7. i18n
- Uberツリーノード名・説明の全ロケール追加

### 作業項目
1. DBスキーマ・マイグレーション ✅（V6: character_uber_skillsテーブル）
2. uberTreeRepository実装 ✅
3. Uberツリーマスターデータ設計・定義 ✅（16ノード、4ルート×4ノード）
4. ポイント付与ロジック ✅（Uberボスバッジ数から自動計算）
5. ステータス計算への統合 ✅（getTotalStats + 戦闘MOD）
6. Uberツリー画面UI実装 ✅（app/uber-tree.tsx）
7. ホーム画面に導線追加 ✅
8. i18n対応 ✅

---

## 実装順序まとめ

| Phase | 機能 | 前提 | 主な変更範囲 |
|-------|------|------|------------|
| 1 | チル & フリーズ | なし | core/, types/, data/json/mods.json, i18n |
| 2 | 氷系術師 | Phase 1 | core/player.ts, types/, app/character-create, passiveTree |
| 3 | UberUberボス | なし（Phase 4と並行可） | core/endContent, bossBehaviors, data/json/monsters,dungeons |
| 4 | バッジシステム | Phase 3 | db/schema, 新規repository, app/result, home |
| 5 | Uberツリー | なし（Phase 4と並行可） | db/schema, 新規repository, 新規画面, core/modEffects |

### 注意事項
- 各Phaseの完了後にシミュレーションスクリプトでバランス検証を行う
- Phase 1のチル/フリーズは既存ボスのスキルとしても使える（ボスが氷攻撃でプレイヤーをチルにする等）
- DBマイグレーションはPhase 4, 5で発生するため、既存データとの互換性に注意
- UberUberボスの入場券はUberと共通のため、チケットシステムの変更は不要

---

## 必要な画像・音声アセット一覧

### 氷系術師（Phase 2）— プレースホルダー差し替え必要

現在elementalistのコピーを仮で使用中。専用画像が必要。

| ファイルパス | 用途 | 現状 | 参考サイズ |
|------------|------|------|-----------|
| `assets/images/characters/ice_mage.png` | 立ち絵（ホーム画面・キャラ選択） | elementalist.pngのコピー | warrior.png参照 |
| `assets/images/characters/ice_mage_battle.png` | 戦闘画面 | elementalist_battle.pngのコピー | warrior_battle.png参照 |

**デザイン方針:**
- 氷・冷気をモチーフとした術師キャラクター
- 他3クラス（戦士=赤系、術師=紫系、弓手=緑系）と差別化する青・水色系の配色
- 立ち絵と戦闘ポーズの2種（既存キャラと同様）

### 氷系術師 攻撃SE（Phase 2）— プレースホルダー差し替え推奨

| ファイルパス | 用途 | 現状 |
|------------|------|------|
| `assets/sounds/attack_ice_mage.mp3` | 氷系術師の攻撃SE | attack_elementalist.mp3を共用中（`lib/sound.ts`で直接参照） |

**注意:** 現在は専用ファイルなしでelementalistのSEを直接参照しています。専用SE追加時は `lib/sound.ts` の `SOUND_FILES.player_attack.ice_mage` を変更。

### バッジアイコン（Phase 4）— 現在は絵文字、画像化は任意

バッジは現在Unicode絵文字で表示（`components/player/BadgeList.tsx`の`BADGE_ICONS`）。
画像に差し替える場合は以下のファイルを作成し、BadgeList.tsxを`Image`コンポーネントに変更。

| バッジID | 現在のアイコン | 画像化する場合のパス |
|---------|--------------|-------------------|
| badge_uber_goblin_king | 👑 crown | `assets/images/badges/uber_goblin_king.png` |
| badge_uber_bandit_leader | 🗡️ knife | `assets/images/badges/uber_bandit_leader.png` |
| badge_uber_vampire | ☀️ sun | `assets/images/badges/uber_vampire.png` |
| badge_uber_kraken | ⚓ anchor | `assets/images/badges/uber_kraken.png` |
| badge_uber_demon_lord | 🔥 fire | `assets/images/badges/uber_demon_lord.png` |
| badge_uber_true_final_boss | ⭐ star | `assets/images/badges/uber_true_final_boss.png` |
| badge_dimensional_4000 | ♾️ infinity | `assets/images/badges/dimensional_4000.png` |
| badge_uber_uber_all | 🏆 trophy | `assets/images/badges/uber_uber_all.png` |

**絵文字のままでもOK。** 画像化する場合は48×48px程度のPNGを推奨。

### UberUberボス（Phase 3）— 未実装、ボス設計時に追加

Phase 3実装時に必要になる画像。既存Uberボスの強化版なので、既存画像の色違い/エフェクト追加が考えられる。

| ファイルパス | 用途 |
|------------|------|
| `assets/images/monsters/uber_uber_goblin_king.png` | UberUberゴブリンキング |
| `assets/images/monsters/uber_uber_bandit_leader.png` | UberUber盗賊の頭 |
| `assets/images/monsters/uber_uber_vampire.png` | UberUberヴァンパイア |
| `assets/images/monsters/uber_uber_kraken.png` | UberUberクラーケン |
| `assets/images/monsters/uber_uber_demon_lord.png` | UberUber魔王 |
| `assets/images/monsters/uber_uber_true_final_boss.png` | UberUber最終ボス |

**注意:** 既存Uberボスの画像（`goblin_king.png`等）が通常・Uber共用されているかを確認し、UberUber用に別画像が必要か判断する。

### 優先度まとめ

| 優先度 | アセット | 理由 |
|--------|---------|------|
| **高** | 氷系術師 立ち絵・戦闘画像（2枚） | プレースホルダーのまま出荷不可 |
| **中** | 氷系術師 攻撃SE（1ファイル） | elementalist共用でも違和感は少ない |
| **低** | バッジアイコン画像（8枚） | 絵文字で十分機能する |
| **Phase 3時** | UberUberボス画像（6枚） | ボス設計と同時に対応 |
