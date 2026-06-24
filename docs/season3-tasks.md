# シーズン3 タスク管理

## 概要

シーズン3（アプリ v2.0.0 以降）のコンテンツ拡充タスクをまとめたドキュメント。

シーズン3では**スキルツリーの構成を変更**する。シーズン2以前に作られたキャラはシーズン2のスキルツリー・ランキングのまま継続プレイでき、新規作成キャラはシーズン3用のツリー・ランキングを使う。この「2パターン保持の仕組み（インフラ）」は実装済みで、本ドキュメントはその上に乗せる**コンテンツ調整・追加・考案**のタスクを管理する。

- 🟢 実装済み … 現時点で完成している内容・仕様
- 🟡 タスク … シーズン3で着手する作業
- 💡 考案 … 設計アイデア（未確定）

---

## 1. 🟢 実装済み：シーズン管理 / シーズン別スキルツリー基盤

### 1.1 シーズン判定

| 項目 | 内容 | ファイル |
|------|------|---------|
| シーズン定義 | `RANKING_RESET_VERSIONS = ['1.3.0', '2.0.0']`（v2.0.0以降=シーズン3） | `lib/rankingSeason.ts` |
| 現在シーズン | `getCurrentSeason()`（アプリバージョン基準） | `lib/rankingSeason.ts` |
| 最新ツリーシーズン | `LATEST_PASSIVE_SEASON = 3`（expo-constants非依存のハードコード） | `data/passiveTree.ts` |

### 1.2 キャラクターへのシーズン固定

- `characters` テーブルに `season` 列を追加（`SCHEMA_VERSION = 14`）。
- **マイグレーションV14**：既存キャラは全員 `season=2`（旧ツリー・S2ランキング継続）。
- **新規インストールのCREATE TABLE**：`DEFAULT 3`。新規作成キャラは `characterRepository.create()` で `getCurrentSeason()` を記録。
- 設計の肝：migration の DEFAULT=2 と CREATE TABLE の DEFAULT=3 を意図的に分け、既存ユーザーはS2、まっさらインストール後の作成キャラはS3になる。

### 1.3 スキルツリーの2パターン保持

| 項目 | 内容 |
|------|------|
| ツリーデータ | `data/json/passiveTree.json`（S2以前=legacy）/ `data/json/passiveTree_s3.json`（S3用、PoE型ツリーとして構築済み） |
| 切替ロジック | `data/passiveTree.ts` の `treeForSeason(season)`：`season >= 3 → s3Tree` / `season <= 2 → legacyTree` |
| アクティブ切替 | `setActivePassiveSeason(season)` を `usePlayerStore.loadCharacter()` で呼出。`getPassiveNode` / `canUnlockNode` / `calculatePassiveEffects` 等は全てアクティブツリーを参照 |
| ランキング連動 | キャラの `season` を `getRankingCollectionName(season)` / `getSeasonKeySuffix(season)` に渡す（`lib/firestore.ts` / `lib/ranking.ts` / `lib/rankingCache.ts`：シーズン別キャッシュ無効化 / `settingsRepository.ts` / `app/ranking.tsx` / `app/dungeon-select.tsx`） |
| テスト | `tests/data/passiveTreeSeason.test.ts`（シーズン切替の回帰防止） |

> **重要**：以降、`passiveTree_s3.json` を編集すればS3キャラのみに反映され、S2キャラには影響しない。**S2ツリー（`passiveTree.json`）は原則メンテのみ**で構成変更しない。

---

## 2. 🟢 実装済み：ペットシステム & テイマークラス

### 2.1 ペット仕様

- ペットは21体（通常20 + ボス1）。`data/json/pets.json` で定義、型は `types/index.ts` の `PetDefinition` / `PetBuff`。
- **強化レベル**：Lv1〜6。倍率 `getPetLevelFactor(lv) = 1 + (lv-1)×0.2`（Lv1=1.0倍 … Lv6=2.0倍）。
- **強化コスト**：`getPetUpgradeCost(lv) = lv`（重複消費。Lv1→6で合計15体）。
- **ドロップ率**：通常 0.5% / ボス 3%（`data/pets.ts`、`tryPetDrop`）。
- **DB**：`character_pets` / `character_active_pet` / `character_pet_levels`（`db/repositories/petRepository.ts`）。
- **UI**：`app/pets.tsx`（一覧・詳細・アクティブ設定・強化・破棄）。

### 2.2 PetBuff 全11種（うち4種が新バフ種）

| バフ種 | 内容 | 適用先 |
|--------|------|--------|
| `hpRegen` | 毎秒HP回復（フラット） | combatMods |
| `attackSpeedPct` | AS +X% increased | combatMods |
| `poisonChance` / `igniteChance` / `freezeChance` | 状態異常付与率% | combatMods |
| `atkIncreasedPct` / `defIncreasedPct` | ATK/DEF increased% | 基礎ステ（increased%レイヤー） |
| `maxHp` | 最大HP +X（フラット） 🆕 | 基礎ステ（increased%を通さない純加算） |
| `critChancePct` | クリティカル率 +X% 🆕 | combatMods |
| `lifestealPct` | 与ダメージ吸収% 🆕 | combatMods |
| `freezeChanceCapPct` | フリーズ上限引き上げ（既定10%超） 🆕 | combatMods |

- 🆕 = commit `707be2c` で実装。バフ適用は `core/petEffects.ts` の `applyPetBuff()`、戦闘反映は `hooks/useBattle.ts`、基礎ステ反映は `usePlayerStore.getTotalStats()`。

### 2.3 テイマークラス（`core/player.ts`）

- 基本ステ：`tamer: { maxHp: 100, atk: 10, def: 4 }`
- 固有能力：`{ petDropRatePct: 0.5, petEffectMultiplier: 2 }`（ペットバフ2倍・ドロップ率+0.5%）
- 総合倍率（テイマー × Lv6）：`2 × 2.0 = 4.0倍`

---

## 3. 🟢 実装済み：エンドコンテンツ & UberUberボス

### 3.1 ダンジョン体系（`core/endContent.ts`）

- 異次元ラッシュ：`dimensional_rush_1`〜`6`（ボスHP×2.5、ステ×1.5）
- 次元回廊：`dimensional_corridor`（無制限階層、HP/ATK倍率 `1 + (floor/30)×0.1` で最大1.3倍、200階周期でボスループ）
- Uber：6体（チケット制）
- **UberUber：現状3体のみ実装** … `uber_uber_goblin_king` / `uber_uber_bandit_leader` / `uber_uber_kraken`（`UBER_UBER_DUNGEON_IDS`）。全バッジ所持 + チケットが入場条件。

### 3.2 UberUberクラーケン仕様

| 補正項目 | 通常 | Uber | UberUber |
|---------|------|------|----------|
| 敵ATK倍率 | 1.15 | 1.3 | **1.5** |
| 敵攻撃速度倍率 | 1.2 | 1.35 | **1.5** |
| プレイヤーDEF倍率 | 0.85 | 0.75 | **0.65** |
| HP再生（/秒） | 100 | 150 | **2500** |

戦闘開始時付与（`core/bossBehaviors.ts`）：フリーズ耐性70%、敵攻撃時にプレイヤーへチル20%/フリーズ10%付与、被発火ダメージ2/3軽減。

特殊ギミック「触手乱打（Tentacle Flurry）」：10回攻撃ごとに **10連撃**（追加攻撃 `extraEnemyAttacks=9`、各1/3倍）。

> UberUberクラーケンは発火耐性があるため発火ビルドが不利。**毒の継続ダメージ + ダメージ遅延/反撃による生存**が攻略の軸。

### 3.3 既存ボスギミック一覧（`core/bossBehaviors.ts`）

ゴブリンキング（Shield / Warlord / Kings Slam / Roar）、盗賊の頭（Bear Trap / Night Ambush / Shadow Bind / Garrote / Twin Strike）、クラーケン（Tsunami / Deep Embrace / Abyssal Ebb / Tentacle Flurry）、ヴァンパイア（Blood Feast / Night Feast / Crimson Pact）、デーモンロード（Death Hand / Black Flame / Crown）、真の最終ボス（Final End / Time Sever）。

トリガー類型：**毎3回攻撃**・**10回に1回**・**HP50%閾値**・**戦闘開始時付与**。

### 3.4 プレイヤー側の既存防御機構

- ダメージ軽減：DEF減衰式 `ATK × 100/(100+DEF)`、`damageReductionPct`、`damageDeferPct`（最大50%・4秒遅延）、`poisonDamageReduction`、`retaliateDefPct`（反撃）、`igniteResistPct`
- HP回復：`hpRegen` / `hpRegenPct` / `hpOnHit` / `hpOnCrit` / `lifestealPct` / `poisonLifesteal` / `igniteLifesteal` / `critLifestealPct`
- 浄化/緊急：`royalRoar`（3回攻撃ごと毒・チル解除）、`warlordEnrage`（HP30%↓で攻撃速度+20%/HP on Hit+300）、重撃・重傷スタック
- 状態異常：チル（AS低下）・フリーズ（行動不能、時間経過でチルへ移行）。プレイヤー側のチル/フリーズ耐性ステもS3防御機構として実装済み。

---

## 4. 🟢 実装済み：シーズン3用スキルツリーの調整

**目的**：`passiveTree_s3.json` をS2複製から脱却し、シーズン3独自の構成にする。S2キャラには影響させない。

現在は新防御機構を含めたS3用パッシブツリーを構築済み。ツリー検証・型チェック対象外の既知エラーを除く確認・バランス検証・i18n/表示確認も完了済み。

### 4.1 作業項目

- [x] `data/json/passiveTree_s3.json` の構成を確定（PoE型ツリー・クラス別スタート・S3独自構成）
- [x] リバランス方針の決定（新防御機構を含めたS3向け調整）
- [x] 新キーストーン / 新ノードの追加（新防御機構と連動）
- [x] 新規 `PassiveEffect` フィールドの集計処理追加（`types/index.ts` / `data/passiveTree.ts`）
- [x] i18n（ノード名・説明）の全ロケール追加
- [x] 装備MOD欄・図鑑MOD欄を含むMOD表示の翻訳確認
- [x] `tests/data/passiveTreeSeason.test.ts` を拡張（S3固有ノードの存在確認、ノード数差分の検証）
- [x] シミュレーションスクリプトでバランス検証

### 4.2 注意点

- `calculatePassiveEffects()` / `combineMods()` は**シーズン非依存の共通ロジック**。新効果フィールドを足すとS2ツリーのノードがそれを持たないだけで、コードは両対応になる。
- ノードID命名はS2の規約を踏襲（系統プレフィックス + `_n` / `_key` / `_final` / `_a/_b` 分岐）。S3独自ノードは衝突しないID（例：`s3_*` プレフィックス）も検討。
- リスペック：過去にguardツリー再構成でマイグレーションV7（削除ノードのSP返還+トークン付与）を実施。S3ツリー変更は**S3キャラのみ**が対象なので、リリース直後はS3キャラがほぼ存在しない＝マイグレーション不要の可能性が高いが、リリース後の再調整時はV7同様の救済を検討。

---

## 5. 🟡 タスク：シーズン3用 追加ユニークアイテムの実装

**目的**：シーズン3の新ビルド・新防御機構を支える固定効果ユニークを追加する。

### 5.1 追加手順（既存パターン踏襲）

1. `data/json/items.json` にアイテム定義（`slot` / `weaponType` / `atk` / `def` / `fixedMods`）。`fixedMods` の合計は最大4個。
2. `data/json/monsters.json` のボスに `uniqueDrop`（または複数の `uniqueDrops[]`）を設定。
3. ドロップは `data/items.ts` の `tryUniqueDrop()` が自動処理（ランダムMODなし・tier0固定）。
4. i18n（アイテム名・説明）追加。

### 5.2 作業項目

- [ ] **UberUber未実装ボス（vampire / demon_lord / true_final_boss）の実装**と、それに対応するUberUberユニークの追加（現状UberUberは goblin_king / bandit_leader / kraken の3体のみ）
- [ ] シーズン3新ビルド向けユニークの効果設計（下記の新防御機構フィールドを fixedMods に持たせる）
- [ ] ドロップ率・入手難度のバランス調整
- [ ] 既存MOD type で表現できない効果は `ModType`（`types/index.ts`）と `combineMods()`（`core/modEffects.ts`）に追加

### 5.3 ユニーク効果アイデア（💡）

- 「吸収シールド付与」アクセサリ（後述のバリア機構）
- 「被ダメージ上限（ダメージキャップ）」防具（即死系ギミック対策）
- 「チル/フリーズ耐性」手袋（プレイヤー側状態異常耐性。UberUberクラーケン対策）
- 「DPSバースト」武器（一定間隔で大ダメージ。後述のシールド/エンレイジ・DPSチェック対策）

---

## 6. 💡 考案：シーズン3用 新しい戦闘ギミック

既存ギミックは「次撃倍率・追加攻撃・状態異常付与・回復/軽減・ゲージリセット」が中心。シーズン3では**プレイヤーの引き出しを増やす方向**の新ギミックを考案する。

### 6.1 ボス側 新ギミック案

| 名称 | 効果 | 狙い / 対策手段 | 実装の足がかり |
|------|------|----------------|---------------|
| **吸収シールド（バリア）** | ボスが一定時間/一定量のダメージを吸収するシールドを展開。剥がすまでHPが減らない | DPSチェック。瞬間火力 or 持続火力を要求 | `BossEffectState` にシールドHP保持、ダメージ適用前にシールドへ吸収 |
| **エンレイジ（時間切れ強化）** | 戦闘開始から一定時間でATK/AS大幅上昇。長期戦を許さない | 制限時間内撃破。既存の時間スタックは**プレイヤー側**なので逆方向の新規 | `advanceTicks` の経過tickで `enemyAttackMult` を段階上昇 |
| **被ダメージ反射** | プレイヤーの与ダメージの一定%を反射 | 過剰DPSへのペナルティ。回復との両立を要求 | プレイヤー攻撃適用後に反射ダメージをプレイヤーへ |
| **処刑（HP閾値即死級攻撃）** | プレイヤーHPが一定%以下のとき特大ダメージ | 事前回復・シールドで耐える設計を要求 | `applyEnemyAttackPreEffects` でHP比率判定→`enemyNextAttackMult`増 |
| **累積デバフ（重ねがけ）** | 攻撃ごとにプレイヤーへ解除困難なスタックデバフ（回復低下/被ダメ増） | 浄化（royalRoar）や時間管理を要求 | プレイヤー側スタック状態を新規追加、攻撃時に加算 |
| **ヒール完全封印** | 一定時間プレイヤーの全回復を0に | 回復依存ビルドへのカウンター。シールド/軽減で凌ぐ | 既存 Shadow Bind（回復-50%）の上位。回復係数を一時0 |

### 6.2 実装ガイド（`core/bossBehaviors.ts` 拡張ポイント）

1. `BossSkillId` 型に新スキルIDを追加
2. 必要なら `BossEffectState` に状態フィールド（カウンタ/フラグ/シールドHP）を追加
3. `createBossIntroEvents()` で初期付与（戦闘開始時の常設効果）
4. `applyEnemyAttackPreEffects()` にトリガー判定（毎N回 / HP閾値 / 経過時間）
5. `core/battleEngine.ts` で効果適用（`extraEnemyAttacks`, `enemyNextAttackMult`, `applyPlayerFreeze/Poison`, `playerDamageTakenMult`, `resetPlayerGauge` などの既存フックを活用）

---

## 7. 🟢 実装済み：シーズン3用 プレイヤー側 防御機構

UberUberクラーケンの「チル/フリーズ連打・10連撃・高HP再生」に代表される高難度ギミックに対し、**回復一辺倒ではない防御の選択肢**を増やす。S3ツリーには、シールド・ブロック・ダメージ遅延・チル/フリーズ耐性・自動浄化・連続被弾軽減などを反映済み。

### 7.1 新防御機構案

| 名称 | 効果 | 既存との差別化 | 状態 |
|------|------|---------------|---------------|
| **吸収シールド** | 一定量のダメージを肩代わりする一時シールド（HP回復とは別レイヤー）。被弾で消費、一定間隔で再付与 | フリーズ中でも機能。即死/連撃の頭を抑える | 実装済み |
| **ブロック（確率カット）** | 一定確率で被ダメージを大幅カット | DEF減衰とは独立した確率防御層 | 実装済み |
| **被ダメージ上限（キャップ）** | 1撃のダメージにHP%上限を設定 | 処刑/10連撃の各撃を緩和 | 未採用（必要なら将来実装） |
| **チル/フリーズ耐性** | プレイヤー側のチル/フリーズ付与確率を軽減/無効化 | ボス側耐性とは別にプレイヤー側へ新設 | 実装済み |
| **連続被弾軽減 / 低HP時被ダメ軽減** | 短時間の連続被弾や低HP時の被ダメージを軽減 | 連撃や崩れ始めた局面への防御層 | 実装済み |
| **自動浄化** | 一定間隔で自身のデバフ（チル/累積デバフ）を解除 | royalRoarは攻撃回数依存。時間依存版 | 実装済み |
| **不屈（即死耐性）** | HPが0になる致命ダメージをHP1で耐える（クールダウンあり） | エンレイジ/処刑への保険 | 未採用（必要なら将来実装） |

### 7.2 実装ガイド

- 新フィールドは `core/modEffects.ts` の `CombinedModEffects` と `combineMods()`、および `data/passiveTree.ts` の `calculatePassiveEffects()` の両方に集計を追加。
- 装備MODで表現する場合は `ModType`（`types/index.ts`）と `data/json/mods.json` に tier 定義を追加。
- パッシブで表現する場合は `PassiveEffect`（`types/index.ts`）に追加し、S3ツリー（`passiveTree_s3.json`）のノード effect に設定。
- ユニーク固定効果で表現する場合は §5 の手順。
- 追加後は必ず `npx tsc --noEmit` / `npx vitest run` とシミュレーションでバランス検証。

---

## 8. 実装状況

| 状態 | タスク | 主な変更範囲 |
|------|--------|------------|
| ✅ 完了 | 新防御機構の実装（§7） | `core/modEffects.ts`, `core/battleEngine.ts`, `types/index.ts` |
| ✅ 完了 | S3スキルツリー調整（§4） | `data/json/passiveTree_s3.json`, `data/passiveTree.ts` |
| ✅ 完了 | i18n / MOD表示確認 / バランス検証 / テスト | `locales/`, `data/items.ts`, `scripts/`, `tests/` |
| ⏳ 未完 | UberUber残り3体 + シーズン3ユニーク（§5） | `data/json/items.json`, `monsters.json`, `dungeons.json` |
| ⏳ 未完 | S3リリース準備（§9） | 告知、更新内容、スクリーンショット、App Store Connect |

### 注意事項

- **S2ツリー（`passiveTree.json`）は構成変更しない。** すべての新規ノード・調整は `passiveTree_s3.json` 側に行う。
- `calculatePassiveEffects()` / `combineMods()` はシーズン共通ロジック。新フィールド追加はS2/S3双方に影響するが、S2ノードが新フィールドを持たなければ実効果はゼロ。
- 各機能完了後にシミュレーションでバランス検証（特にUberUber・次元回廊）。
- 画像/SEアセットが必要な新ボス・新ペットはプレースホルダー運用の可否を確認（参考：`docs/content-expansion-plan.md` のアセット一覧）。

---

## 9. 🟡 タスク：S3リリース準備

S3コンテンツ実装後、ストア公開前に必要な告知・メタデータ・提出準備を整理する。

- [ ] S3リリースの事前お知らせ作成
- [ ] S3でのupdate内容の整理
- [ ] S3用にApp Store用のスクリーンショットを見直し
- [ ] App Store Connectでリリースバージョンを作成
