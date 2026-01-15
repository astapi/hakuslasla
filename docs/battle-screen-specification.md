# 戦闘画面の仕様と実装

## 概要

戦闘画面は完全自動化されたハクスラRPGの中核機能。プレイヤーは準備（装備・スキル）のみで、戦闘は自動実行される。

---

## 1. 戦闘画面のメインコンポーネント

### ファイル: `app/battle/[dungeonId].tsx`

Expo Routerの動的ルートで、選択されたダンジョンIDをパラメータとして受け取り、戦闘画面をレンダリング。

### 主な構成要素

#### 背景画像マッピング (13-28行)
- 14個のダンジョンに対応した背景画像を定義
- 各ダンジョンには専用の背景画像が割り当て
- `ImageBackground`コンポーネントで背景を表示、半透明オーバーレイで暗くしている

#### アニメーション管理 (37-62行)
- `useRef`で前フレームのログ長を記録
- ログに新しいエントリが追加された時に攻撃アニメーションをトリガー
- `player_attack`/`critical`時は`playerAttacking`状態を200ms設定
- `enemy_attack`時は`enemyAttacking`状態を200ms設定

#### 戦闘フェーズ管理 (64-96行)
- `phase`が`cleared`または`defeat`になると自動的に結果画面へ遷移
- 自動周回中（`isAutoRunning`）でクリアした場合は結果画面に遷移しない
- 2000msのタイマーで遷移を遅延させ、UI表示を見せる

### UI レイアウト

```
┌─────────────────────────────────┐
│  バトルエリア（背景画像）          │
│  ┌─────────┐    ┌─────────┐    │
│  │ プレイヤー│    │   敵    │    │
│  │  HP/ゲージ│    │ HP/ゲージ │   │
│  └─────────┘    └─────────┘    │
├─────────────────────────────────┤
│  戦闘ログ（高さ200px以下）        │
├─────────────────────────────────┤
│  装備スロット表示                 │
├─────────────────────────────────┤
│  アクションボタン                 │
└─────────────────────────────────┘
```

### ボタン機能

| ボタン | 状態 | 機能 |
|--------|------|------|
| 一時停止/再開 | 戦闘中 | 戦闘を一時停止/再開 |
| 自動周回 | 戦闘中（非一時停止） | ダンジョンを自動で周回開始 |
| 周回停止 | 自動周回中 | 周回を停止 |
| 撤退 | 一時停止中 | 戦闘を放棄してホーム画面へ戻る |

### 撤退確認モーダル
- 撤退時に確認ダイアログを表示
- 「獲得した経験値とアイテムは失われる」と警告
- キャンセル/撤退の選択肢を提供

---

## 2. 戦闘ロジック (hooks/useBattle.ts)

`useBattle`はカスタムフックで、戦闘の中核ロジックを統括。`useReducer`で状態管理、33msごとのゲージ制ゲームループで行動タイミングを制御。

### 2.1 State Management

#### 拡張BattleState (103-107行)

```typescript
interface ExtendedBattleState extends BattleState {
  runCount: number;           // 周回数（自動周回用）
  grandTotalExp: number;      // 全周回の累計EXP
  grandTotalItems: Item[];    // 全周回の累計アイテム
}
```

#### 初期化
- `createExtendedInitialState()`: 新規ダンジョン開始時の初期状態を生成
- 周回1回目のみログを初期化、2周目以降は「=== N周目開始 ===」ログを追加

### 2.2 Reducer アクション一覧

| アクション | 説明 |
|------------|------|
| `START_BATTLE` | 敵の出現、戦闘開始 |
| `PLAYER_ATTACK` | プレイヤー攻撃、ダメージ適用 |
| `ENEMY_ATTACK` | 敵の攻撃、プレイヤーダメージ |
| `ENEMY_DEFEATED` | 敵撃破、EXP獲得、ドロップ処理 |
| `PLAYER_DEFEATED` | プレイヤー敗北 |
| `NEXT_FLOOR` | 次の階層へ進む |
| `DUNGEON_CLEARED` | ダンジョン踏破 |
| `APPLY_POISON` | 毒を付与（スタック対応） |
| `POISON_DAMAGE` | 毒ダメージ処理、スタック減少 |
| `HP_REGEN` | HP回復（回復MODなど） |
| `UPDATE_GAUGES` | ゲージ値を更新 |
| `RESET_DUNGEON` | 周回リセット（自動周回用） |

### 2.3 戦闘フロー - ゲージ制システム

#### ゲージ増加ロジック (724-752行)

```typescript
const TICK_INTERVAL = 33;  // 33ms = 約30fps

// ゲージ増加式
const playerGaugeIncrease = (playerAS * 200) / ticksPerSecond;
const enemyGaugeIncrease = (enemyAS * 200) / ticksPerSecond;

// ゲージが100に達したら攻撃（リセット）
if (playerGaugeRef.current >= 100) {
  playerGaugeRef.current = 0;
  executeTurn();
}
```

**ゲージシステムの特性**:
- AS(AttackSpeed) 1.0 = 0.5秒で1回攻撃
- AS 1.5 = 約0.33秒で1回攻撃（高速）
- AS 0.7 = 約0.71秒で1回攻撃（低速）

### 2.4 プレイヤー攻撃処理 (executeTurn)

**処理順序**:

1. **毒ダメージ処理**（敵が毒状態の場合）
   - Core関数`processPoisonDamage()`を使用
   - 毒ダメージを敵HPから減算
   - `poisonLifesteal` MOD効果で毒ダメージ吸収

2. **通常ダメージ計算**
   - `calculateDamage(stats.atk, state.enemy.def)` で基礎ダメージを計算
   - DEF減衰式: `reduction = def / (def + 100)`, `damage = atk * (1 - reduction)`
   - クリティカル判定: `criticalChance%`の確率で発生
   - クリティカルダメージ: `1.5 + criticalDamage%`の倍率

3. **ライフスティール** (587-593行)
   - Core関数`calculateLifesteal()` で吸収量を計算
   - HIT時にHP回復を適用

4. **毒付与判定** (597-603行)
   - 敵が毒状態でない、またはスタック数が上限未満なら判定
   - `poisonChance%`の確率で付与
   - 毒ダメージ = `baseDamage * 1.2 * poisonDamageBonus`

5. **敵撃破判定**
   - 敵HPが0以下になった場合、ドロップ処理を実行

#### ドロップ処理 (525-552行)

```typescript
// 1. ユニークドロップ（モンスター固有）
if (state.enemy.uniqueDrop) {
  const uniqueItem = tryUniqueDrop(...);
  if (uniqueItem) droppedItems.push(uniqueItem);
}

// 2. 通常ドロップ（ダンジョンドロップテーブル）
const dropCount = rollDropCount();
const normalDrops = rollDropItems(dungeon.dropTable, dropCount);
droppedItems.push(...normalDrops);

// 3. フィルタリング適用
const filteredItems = filterDroppedItems(droppedItems, dropFilter);
```

### 2.5 敵攻撃処理 (executeEnemyAttack)

```typescript
const enemyDamage = calculateEnemyDamage(
  state.enemy.atk,
  stats.def,
  modEffects,
  isEnemyPoisoned  // 敵が毒状態なら被ダメージ軽減
);

dispatch({ type: 'ENEMY_ATTACK', damage: enemyDamage });
```

- Core関数`calculateEnemyDamage()`で敵ダメージを計算
- 毒状態時は被ダメージが`poisonDamageReduction%`軽減される

### 2.6 HP回復タイマー (762-790行)

```typescript
// 1秒ごとにHP回復をチェック
regenTimerRef.current = setInterval(() => {
  const regenAmount = calculateHpRegen(currentHp, maxHp, modEffects);
  if (regenAmount > 0) {
    dispatch({ type: 'HP_REGEN', amount: regenAmount });
  }
}, 1000);
```

- 戦闘中は常に1秒ごとに回復量を計算
- 敗北時・一時停止時は回復停止
- `playerHpRef`を使用して`state`の更新でタイマーをリセットしないようにしている

### 2.7 自動周回処理 (818-836行)

```typescript
if (state.phase === 'cleared') {
  // クリア時に次の周回を開始（1.5秒後）
  setTimeout(() => {
    dispatch({ type: 'RESET_DUNGEON', playerMaxHp: ... });
  }, 1500);
} else if (state.phase === 'defeat') {
  // 敗北時は自動周回を終了
  setIsAutoRunning(false);
}
```

---

## 3. 戦闘関連の UIコンポーネント

### 3.1 CharacterDisplay.tsx

**目的**: プレイヤーと敵のステータス表示

#### プロパティ:
- `name`: キャラクター/敵の名前
- `currentHp` / `maxHp`: HP
- `level`: プレイヤーレベル（敵には不表示）
- `isPlayer`: プレイヤーか敵かの判定
- `imageId`: 敵の画像ID
- `isAttacking`: 攻撃中フラグ（アニメーション用）
- `actionGauge`: 行動ゲージ (0-100)

#### アニメーション (39-58行)
- `react-native-reanimated`を使用した攻撃時のキャラクター移動アニメーション
- プレイヤーは右へ25px移動（100ms）→ 元位置に戻る（100ms）
- 敵は左へ-25px移動（同様）
- `Easing.out()` / `Easing.in()` で滑らかな動きを実現

### 3.2 HPBar.tsx

**目的**: HP表示バー（色変化機能付き）

#### 特性:
- HP比率に応じて色を変更
  - 50% 以上: 指定色（プレイヤー緑/敵赤）
  - 25-50%: 黄色
  - 25% 以下: 赤色
- テキスト表示: `現在HP/最大HP`

### 3.3 ActionGauge.tsx

**目的**: 行動ゲージ表示（0-100%）

#### 特性:
- プレイヤー: 金色（`#FFD700`）
- 敵: 赤色（`#FF6B6B`）
- 高さ6pxの細いバー

### 3.4 BattleLog.tsx

**目的**: 戦闘ログの表示・スクロール

#### ログタイプ別の色分け:

| ログタイプ | 色 | 用途 |
|----------|---|----|
| `player_attack` | 緑 | プレイヤー通常攻撃 |
| `critical` | オレンジ | クリティカルヒット |
| `enemy_attack` | 赤 | 敵の攻撃 |
| `victory` | 金色 | 敵撃破 |
| `defeat` | 赤 | 敗北 |
| `floor_clear` | 青 | 階層クリア |
| `poison` | 紫 | 毒関連 |
| `heal` | シアン | 回復 |
| その他 | 白 | 情報ログ |

#### 自動スクロール:
- ログが追加されるたびに最下部へ自動スクロール
- `useRef`で`ScrollView`を参照、`scrollToEnd()`を呼び出し

---

## 4. 関連する型定義 (types/index.ts)

### BattleState (373-387行)

```typescript
interface BattleState {
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;
  enemyPoison: PoisonState[];  // 毒スタック（複数対応）
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;
  playerGauge: number;  // 0-100
  enemyGauge: number;   // 0-100
}
```

### BattleEnemy (351-362行)

```typescript
interface BattleEnemy {
  id: string;
  name: string;
  image: string;
  currentHp: number;
  maxHp: number;
  uniqueDrop: UniqueDrop | null;
  atk: number;
  def: number;
  exp: number;
  attackSpeed: number;  // 攻撃速度
}
```

### PoisonState (142-145行)

```typescript
interface PoisonState {
  damagePerTurn: number;
  remainingTurns: number;
}
```

### BattleLogEntry (365-369行)

```typescript
interface BattleLogEntry {
  id: number;
  message: string;
  type: 'player_attack' | 'enemy_attack' | 'victory' | 'defeat'
       | 'floor_clear' | 'info' | 'poison' | 'critical' | 'heal';
}
```

### DropFilterSettings (5-19行)

```typescript
interface DropFilterSettings {
  categories: {
    weapon: boolean;
    armor: boolean;
    gloves: boolean;
    boots: boolean;
    accessory: boolean;
  };
  minModCount: number;     // 最小MOD数フィルター
  maxTier: number;         // 最高Tierフィルター
}
```

---

## 5. 敵データの構造

### 敵定義 (Enemy型)

```typescript
interface Enemy {
  id: string;               // 一意なID
  name: string;             // 表示名
  image: string;            // 画像ID
  maxHp: number;            // 最大HP
  atk: number;              // 攻撃力
  def: number;              // 防御力
  exp: number;              // ドロップEXP
  attackSpeed?: number;     // 攻撃速度（デフォルト1.0）
  uniqueDrop: UniqueDrop | null;  // モンスター固有ドロップ
}
```

### monsters.json の例

| ID | 名前 | HP | ATK | DEF | EXP | AS | ユニークドロップ |
|----|------|----|----|-----|-----|-----|-----------------|
| slime | スライム | 20 | 5 | 2 | 10 | 0.7 | division_core (5%) |
| wild_rabbit | キラーラビット | 15 | 6 | 1 | 8 | 1.4 | なし |
| goblin | ゴブリン | 30 | 8 | 3 | 15 | 1.0 | なし |
| bee | キラービー | 12 | 10 | 1 | 12 | 1.5 | poison_needle_ring (5%) |
| wolf | オオカミ | 25 | 10 | 2 | 14 | 1.3 | wolf_fang (5%) |

### 敵選択ロジック (data/enemies.ts)

```typescript
// 出現確率に基づいてランダムに敵を選択
const totalRate = monsterSpawns.reduce((sum, spawn) => sum + spawn.spawnRate, 0);
const random = Math.random() * totalRate;

let cumulative = 0;
for (const spawn of monsterSpawns) {
  cumulative += spawn.spawnRate;
  if (random < cumulative) {
    return getEnemy(spawn.monsterId);
  }
}
```

**方式**: 累積確率法（ルーレット方式）

---

## 6. ダンジョンデータの構造

### ダンジョン定義 (Dungeon型)

```typescript
interface Dungeon {
  id: string;
  name: string;
  description: string;
  maxFloor: number;                    // 最大階層数
  recommendedLevel: number;            // 推奨レベル
  monsters: MonsterSpawn[];            // 出現敵の配列
  dropTable: DungeonDropTable;         // ドロップテーブル
  boss?: DungeonBoss;                  // ボス敵（最終階層）
  modTierRange?: ModTierRange;         // MOD生成のtier範囲
  modCountRange?: ModCountRange;       // MOD生成の個数範囲
}
```

### dungeons.json の例

#### 始まりの草原 (grassland)

```json
{
  "id": "grassland",
  "name": "始まりの草原",
  "maxFloor": 5,
  "recommendedLevel": 1,
  "monsters": [
    { "monsterId": "slime", "spawnRate": 30 },
    { "monsterId": "wild_rabbit", "spawnRate": 25 },
    { "monsterId": "goblin", "spawnRate": 20 },
    { "monsterId": "bee", "spawnRate": 15 },
    { "monsterId": "wolf", "spawnRate": 10 }
  ],
  "dropTable": {
    "common": [...],
    "dungeon": [
      { "itemId": "grassland_sword", "dropRate": 15 },
      { "itemId": "light_leather", "dropRate": 15 },
      { "itemId": "rabbit_boots", "dropRate": 15 }
    ]
  },
  "modTierRange": { "minTier": 10, "maxTier": 10 },
  "modCountRange": { "min": 0, "max": 1 }
}
```

### ドロップテーブル

```typescript
interface DungeonDropTable {
  common: ItemDrop[];   // 全ダンジョンで出現
  dungeon: ItemDrop[];  // ダンジョン固有ドロップ
}
```

**処理フロー**:
1. `rollDropCount()`で1回の敵撃破時のドロップ数を決定（通常1〜2個）
2. 各ドロップ対象について出現確率をロール
3. マッチしたアイテムをランダム生成（MOD付き）
4. フィルター設定に応じてフィルタリング

---

## 7. ダンジョンの流れ

### ダンジョン開始時

```
ユーザーがダンジョン選択
↓
/battle/[dungeonId]へ遷移
↓
useBattle初期化
  - currentFloor = 1
  - playerCurrentHp = playerMaxHp
  - enemy = null
  - phase = 'fighting'
↓
useEffect で startBattle() を実行
  - getEnemyForFloor(1) で1階の敵を取得
  - START_BATTLE アクション発行
↓
ゲームループ開始（33ms間隔）
```

### ゲームループ中の敵撃破

```
敵との戦闘（ゲージ制）
↓
プレイヤーゲージ 100% → executeTurn()
  - 毒ダメージ処理
  - 通常ダメージ + クリティカル判定
  - ライフスティール
  - 毒付与判定
↓
敵が撃破（HP ≤ 0）
  - ENEMY_DEFEATED アクション
  - ドロップ処理
  - currentFloor >= maxFloor ? → DUNGEON_CLEARED : NEXT_FLOOR
↓
NEXT_FLOOR の場合：
  - currentFloor を +1
  - 新敵を取得・配置
  - playerGauge/enemyGauge をリセット（0）
  - 毒スタックをリセット
```

### ダンジョン踏破 / 敗北

#### ダンジョンクリア

```
最終階層の敵を撃破
↓
currentFloor >= maxFloor && phase !== 'cleared'
↓
DUNGEON_CLEARED アクション発行
↓
2秒後に /result へ遷移
  - 累計EXP・アイテムを計算
  - パラメータを渡す
```

#### プレイヤー敗北

```
プレイヤーHP ≤ 0
↓
PLAYER_DEFEATED アクション発行
↓
phase = 'defeat'
↓
2秒後に /result へ遷移
```

---

## 8. Core 戦闘関数の連携

### 主要なCore関数 (core/combatEffects.ts)

| 関数 | 用途 | 使用場所 |
|------|------|---------|
| `calculateDamage(atk, def)` | ダメージ計算 | executeTurn |
| `calculateLifesteal(damage, isCritical, modEffects)` | ライフスティール計算 | executeTurn |
| `tryApplyPoison(...)` | 毒付与判定 | executeTurn |
| `processPoisonDamage(state, elapsedTicks, modEffects)` | 毒ダメージ処理 | executeTurn |
| `calculateHpRegen(currentHp, maxHp, modEffects)` | HP回復計算 | HP回復タイマー |
| `calculateEnemyDamage(atk, def, modEffects, isPoisoned)` | 敵ダメージ計算 | executeEnemyAttack |

### MOD効果の統合

```typescript
// useBattle内で毎フレーム計算
const modEffects = useMemo((): CombinedModEffects => {
  const passiveEffects = calculatePassiveEffects(unlockedSkills);
  return combineMods(Object.values(equipment), passiveEffects);
}, [equipment, unlockedSkills]);
```

**CombinedModEffects に含まれる項目**:
- HP回復: `hpRegen`, `hpRegenPct`
- 毒: `poisonChance`, `poisonDamagePct`, `poisonDamageMorePct[]`, `poisonMaxStacks`, `poisonLifesteal`, `poisonDamageReduction`
- クリティカル: `criticalChance`, `criticalDamage`, `hpOnCrit`
- その他: `damageReductionPct`, `hpOnHit`, `attackSpeedPct`, `attackSpeedMorePct[]`

---

## 9. 毒システムの詳細

### 毒スタック機制

```typescript
// 毒付与時
const maxPoisonStacks = BASE_POISON_MAX_STACKS + modEffects.poisonMaxStacks;
if (state.enemyPoison.length < maxPoisonStacks &&
    modEffects.poisonChance > 0 &&
    Math.random() * 100 < modEffects.poisonChance) {
  // 付与
}

// 毒ダメージ時に スタック1つあたりのダメージを計算・適用
// 各スタックの remainingTurns を -1 し、0以下は削除
```

### 毒ダメージ計算

```typescript
// Core関数で計算
const poisonResult = processPoisonDamage(coreState, elapsedTicks, modEffects);
// 戻り値: { totalDamage, healAmount, ... }

// ダメージ構成:
// 1. 各スタックの damagePerTick を合算
// 2. poisonDamagePct (increased%) を乗算
// 3. poisonDamageMorePct[] を乗算（複数あれば積）
// 4. poisonLifesteal で一定割合を回復（HP上限内）
```

---

## 10. アーキテクチャまとめ

### 階層構造

```
BattleScreen (画面コンポーネント)
  ↓ useBattle hook
    - useReducer (state管理)
    - ゲームループ (33ms interval)
    - 自動周回処理
  ↓
  - CharacterDisplay (キャラ表示)
  - HPBar / ActionGauge (ステータス表示)
  - BattleLog (ログ表示)
  - EquipmentSlots (装備表示)
  ↓ Core関数
    - calculateDamage
    - processPoisonDamage
    - calculateEnemyDamage
    - calculateHpRegen
    - calculateLifesteal
```

### 戦闘画面の特徴

1. **完全自動化**: プレイヤーは準備（装備・スキル）のみで、戦闘は完全自動実行
2. **ゲージ制システム**: 攻撃速度MODで行動速度をコントロール
3. **毒スタック対応**: 複数の毒を同時管理、スタック上限MODで拡張可能
4. **自動周回機能**: クリア時に自動で次の周回を開始（敗北で終了）
5. **ドロップフィルター**: アイテムをカテゴリ・MOD数・Tierで自動選別
6. **モジュール設計**: Core関数で計算ロジックを分離し、UI/ロジック層を独立
