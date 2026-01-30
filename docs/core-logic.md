# core ディレクトリ概要

## 目的
`core/` は UI や DB に依存しない「純粋なゲームロジック」を提供します。戦闘、ダンジョン、シミュレーション、エンドコンテンツの挙動を TypeScript で完結させ、他層から呼び出せる形で集約しています。

## 公開API（入口）
`core/index.ts` がエクスポート窓口です。以下のカテゴリを再公開しています。

- 型定義（`types.ts`）
- プレイヤー/パッシブ関連（`player.ts`）
- ターン制戦闘（`battle.ts`）
- MOD効果統合（`modEffects.ts`）
- 戦闘効果（`combatEffects.ts`）
- ゲージ制戦闘（`gaugeBattle.ts`）
- 共通バトルエンジン（`battleEngine.ts`）
- ボス行動ID（`bossBehaviors.ts`）
- エンドコンテンツ（`endContent.ts`）
- シミュレーション（`simulation.ts`）
- 装備セット（`equipmentSets.ts`）

## 主要な型（抜粋）
`core/types.ts` でゲームロジックの基礎型を定義しています。

- `Stats` / `PassiveStats` / `CombatStats`
- `PlayerConfig` / `EquipmentConfig` / `ItemConfig`
- `EnemyConfig`, `DungeonConfig`, `BossConfig`
- 戦闘: `BattleState`, `TurnResult`, `BattleResult`
- ダンジョン: `FloorResult`, `DungeonResult`
- シミュレーション: `SimulationConfig`, `SimulationResult` ほか
- ゲージ制: `GaugeBattleState`, `GaugeBattleResult`, `BattleEvent` ほか
- 戦闘設定: `BattleConfig`, `DEFAULT_BATTLE_CONFIG`

## モジュール別の実装概要

### 1) プレイヤー関連（`core/player.ts`）
- 初期ステータス `INITIAL_STATS`、レベル上限 `MAX_LEVEL`、インベントリ上限 `INVENTORY_MAX_SIZE` を定数で管理。
- 経験値カーブ: `getExpToNextLevel` は `100 * level^1.8`。
- `calculateLevelUp` は複数回レベルアップに対応し、上限到達時は EXP を 0 にリセット。
- `calculateTotalStats` は装備の atk/def を合算し、maxHp は base のみ。
- パッシブプリセット
  - `PASSIVE_ROUTES` と `PASSIVE_PRESETS` で固定パスの組み合わせを定義。
  - `LEVEL_BASED_PRESETS` はレベル帯（5刻み）に応じたプリセットを提供。
  - `getLevelBasedPreset` で特定レベルのプリセットを取得。

### 2) ターン制戦闘（`core/battle.ts`）
- ステータススケーリング
  - `applyPercentageScaling` は PoE 風: `base * (1 + increased%) * (1 + sum(more%))`（整数切り捨て）。
- ダメージ計算
  - `calculateDamage`: `reduction = def / (def + 500)` + 追加軽減、最大 99% まで。最低 1 ダメージ保証。
- `executeTurn` は「プレイヤー先攻→敵後攻」。敵が倒れたら敵ターンなし。
- `runBattle` はターン制の 1vs1 を完走。
  - エンドコンテンツ補正や毒ダメージなどのオプションに対応。
  - `MAX_TURNS = 1000` で無限ループ防止。
- `runDungeon` はフロア連戦。
  - ボス階層、敵選択、ドロップ処理。
  - エンドコンテンツ時は `endContent.ts` の補正を適用。
- `estimateWinChance` は簡易 DPS による勝率推定。

### 3) MOD効果統合（`core/modEffects.ts`）
- `CombinedModEffects` を生成するための統合ロジック。
- `combineMods`
  - 装備 MOD とパッシブ効果を合算。
  - `more%` 系は配列として蓄積。
- 攻撃速度/毒ダメージの PoE 風計算を提供。

### 4) 戦闘効果（`core/combatEffects.ts`）
- プレイヤー攻撃
  - クリティカル倍率: `baseCriticalMultiplier + criticalDamage/100`。
  - 追撃: `critical_follow_up_attack` で ATK×0.5 の追加攻撃。
  - `noDirectDamage` で通常ダメージ無効化。
- 毒
  - 付与はスタック上限あり。
  - 毒ダメージは `poisonDamageRatio` を基礎に `MOD` で増幅。
  - 毒吸収 (`poisonLifesteal`) による回復。
- 回復
  - `calculateHpRegen` はフラット + % 回復。
  - HIT 時回復 (`hpOnHit`, `hpOnCrit`) を `calculateLifesteal` で計算。
- 敵攻撃
  - `calculateEnemyDamage` は毒中の追加軽減などを加味。

### 5) ゲージ制戦闘（`core/gaugeBattle.ts`）
- ATB 風のゲージ制バトル。
- `createGaugeBattleState` / `createGaugeBattleStateWithHp` で初期化。
- `runGaugeBattle` は `battleEngine` を利用して完走。
- `runGaugeDungeon` はフロア連戦 + 階層移動時に HP 回復（500ms 相当の ticks）。
- `ticksToSeconds` と `formatBattleTime` で時間表示を整形。

### 6) 共通バトルエンジン（`core/battleEngine.ts`）
- ゲージ制戦闘の中核。
- 主要特徴
  - 1tick ごとにゲージ進行、HP 回復、毒処理、行動発火を行う。
  - 1tick 内の多重行動は最大 5 回。
  - エンドコンテンツ補正（攻撃速度/軽減/回復倍率など）を統合。
  - ボス行動 (`bossBehaviors.ts`) をフック。
- `BattleEvent` を時系列で蓄積し、ログ用途に提供。
- `runBattleEngineToEnd` が `maxTicks` まで実行して勝敗を返す。

### 7) ボス行動（`core/bossBehaviors.ts`）
- `BossSkillId` でスキルIDを定義。
- `BossEffectState` がボス固有の一時効果を管理。
- 主要フック
  - `applyEnemyAttackPreEffects`: 敵攻撃直前に発動（例: デバフ、毒付与）。
  - `applyEnemyAttackPostEffects`: 攻撃後の一時効果の解除。
  - `applyEnemyHpThresholdEffects`: HP50% 以下で段階発動。
  - `applyPlayerAttackPostEffects`: プレイヤー攻撃後の残存時間減衰。
- エンドコンテンツ/UBER 用の特殊挙動が集中。

### 8) エンドコンテンツ補正（`core/endContent.ts`）
- 異次元ラッシュ (`DIMENSIONAL_RUSH_ID`) と UBER ボス判定。
- ボスIDの正規化 (`getBaseBossId`) と補正値の提供。
- 主な補正
  - プレイヤー/敵の ATK/DEF/AS 倍率
  - 敵のダメージ軽減、HP吸収、再生
  - ボス毒の付与
- `getBossSkillName` は i18n を遅延読み込み（React Native 依存を回避）。

### 9) シミュレーション（`core/simulation.ts`）
- `createRng` は xorshift のシード付き RNG。
- `runSimulation` / `runGaugeSimulation` でバッチ実行。
- `runBalanceTest` / `runGaugeBalanceTest` でレベル別の難易度評価。
- `generateSimulationReport` 系でテキストレポートを生成。

### 10) 装備セット（`core/equipmentSets.ts`）
- ダンジョンごとのシミュレーション用装備セットを定義。
- `DUNGEON_EQUIPMENT_SETS` から装備セットを取得。
- `getEquipmentSetForLevel` は推奨レベルに基づいて最適装備を選定。
- `generateSimulationMods` / `generateRandomEquipmentSet` でランダム MOD 装備を生成。
  - `data/json/mods.json` と `data/json/dungeons.json` に依存。

## データフロー（簡易）

1. プレイヤー設定 (`PlayerConfig`) を生成
2. 装備/パッシブから `CombinedModEffects` を作成
3. ターン制 or ゲージ制の戦闘を実行
4. ダンジョン/シミュレーションで複数回評価
5. 結果は `BattleEvent` や `SimulationResult` として集計

## 注意点・拡張ポイント
- 乱数: `Math.random` と `createRng` が混在（シミュレーションはシード対応）。
- エンドコンテンツ: `endContent.ts` と `bossBehaviors.ts` の連携が強い。
- ゲージ制戦闘は `battleEngine.ts` が唯一の実行基盤。
- i18n は遅延読み込みで React Native 依存を回避。

