# core ロジックのテスト方針（案）

## 目的
`core/` の純粋ロジック（戦闘/シミュレーション/エンドコンテンツ）の挙動をユニットテストで保証するための指針です。UI/DB 依存を排除したため、関数単位のテストが基本になります。

## テスト対象の優先度
1. 計算式・境界条件が明確な純関数（最優先）
2. 状態遷移があるが外部依存のない処理（次点）
3. 乱数を含む処理（シード固定で再現）

## テストの基本指針
- 期待値を数値で固定できるケースを中心にする。
- 境界値（0/1/最大/上限到達）を必ず含める。
- 乱数は `createRng(seed)` を使い、再現性を担保する。
- 戦闘は「最短終了」「長期戦」「無限ループ防止」を別ケースで確認。

---

## モジュール別のテスト観点

### `core/types.ts`
- 仕様上は型のみ。実テスト不要。

### `core/player.ts`
- `getExpToNextLevel`
  - Lv1/25/49 などの固定値（四捨五入ではなく `Math.floor` を確認）。
- `calculateLevelUp`
  - 単発レベルアップ / 複数回レベルアップ / 上限到達（EXP リセット）
  - `maxLevel` 引数の上書き動作
- `calculateTotalStats`
  - 装備の atk/def 加算のみ（HP は base のみ）
- `calculateBaseStatsForLevel`
  - Lv1 と Lv2 の差分確認
- `getPlayerCombatStats`
  - `calculateTotalStats` の薄いラッパー確認
- `getLevelBasedPreset`
  - 指定レベル（5/10/…）の正しいプリセット返却

### `core/battle.ts`
- `applyPercentageScaling`
  - increased / more の加算・乗算順序、切り捨て
- `calculateDamage`
  - 防御 0 / 高防御 / 追加軽減 99% 上限 / 最低 1 ダメージ
- `executeTurn`
  - 敵が先に倒れると敵攻撃なし
  - プレイヤーが倒れると `playerDefeated: true`
- `runBattle`
  - `MAX_TURNS` ガードの確認
  - エンドコンテンツ補正の適用有無
  - `enemyHpOnHit` / `enemyRegenPerTurn` / `playerPoison` の効果
- `runDungeon`
  - ボス階層選択
  - 敗北時の `floorsCleared` と `playerHpRemaining` が 0
  - ドロップの有無（dropTable 空/非空）
- `estimateWinChance`
  - 自明に有利/不利なケースの範囲チェック（0〜1）

### `core/modEffects.ts`
- `combineMods`
  - 装備 MOD とパッシブの合算
  - `more%` が配列に積まれること
- `calculateAttackSpeed` / `calculatePoisonDamage`
  - increased + more の加算ロジック
  - 切り捨て

### `core/combatEffects.ts`
- `executePlayerAttack`
  - クリティカル時ダメージ倍率
  - `critical_follow_up_attack` 追撃発動
  - `noDirectDamage` の無効化
- `tryApplyPoison`
  - スタック上限 / 付与率 / ダメージ計算
- `processPoisonDamage`
  - スタック減衰 / 毒吸収回復
- `calculateHpRegen`
  - %回復 + フラット、上限超え防止
- `calculateLifesteal`
  - クリティカル時の追加回復
- `calculateEnemyDamage`
  - 毒状態の軽減追加

### `core/gaugeBattle.ts`
- `runGaugeBattle`
  - `battleEngine` への委譲確認
- `runGaugeDungeon`
  - 階層移動時の回復（500ms 相当の ticks）
- `formatBattleTime`
  - 秒/分のフォーマット

### `core/battleEngine.ts`
- 重点テスト
  - `advanceTicks` の状態遷移
  - 多重行動（最大 5 回）制限
  - クリティカル・毒・回復の同時発生
  - ボス効果（`bossBehaviors`）の発火
- 終了条件
  - プレイヤー勝利 / 敵勝利 / `maxTicks` 到達

### `core/bossBehaviors.ts`
- `applyEnemyAttackPreEffects`
  - 3回ごとの発火
  - UBER 判定による分岐
- `applyEnemyHpThresholdEffects`
  - HP50% 以下のみで発火
- `applyPlayerAttackPostEffects`
  - 残存ターンの減衰

### `core/endContent.ts`
- `isEndContentDungeon` 判定
- 各補正関数（ATK/DEF/AS/軽減/毒など）
- `getBossSkillName` が i18n 未ロード時に `null` を返す

### `core/simulation.ts`
- `createRng` の再現性（同 seed で同じ結果）
- `runSimulation` / `runGaugeSimulation`
  - runs 回数分結果が返る
  - `seed` / `initialSeed` の優先順位
- `calculateSimulationStats` / `calculateGaugeSimulationStats`
  - 0件時のデフォルト
  - 集計値の整合性

### `core/equipmentSets.ts`
- `getDungeonEquipmentSet`
  - 未定義 dungeonId で `undefined`
- `getEquipmentSetForLevel`
  - 推奨レベルの最適選択
- `extractModsFromEquipmentSet`
  - null 装備が混ざっても安全
- `generateSimulationMods`
  - スロット制限 / tier 範囲 / 重み付き選択
- `generateRandomEquipmentSet`
  - 生成される装備の slot が正しい

---

## 推奨テストケース例

- **境界ケース**
  - HP/ATK/DEF が 0 または極端に高い場合
  - 追加軽減が 99% を超える場合
  - 毒スタックが上限に達した場合

- **リグレッション検出向け**
  - ボスの特定効果（例: `demon_lord` の反射ダメージ）
  - UBER フラグの有無で挙動が変わるケース

- **シード固定**
  - `seed=123` 固定で結果が変わらないこと

---

## 実装メモ（参考）
- 乱数を使う関数は `rng` を引数に渡す形式に統一するとテストが容易。
- `battleEngine` はログ (`BattleEvent`) を検証すると副作用の確認がしやすい。

