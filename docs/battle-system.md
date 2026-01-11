# 戦闘システム

## 概要

完全自動戦闘RPG。プレイヤー操作は「一時停止」「撤退」「自動周回」のみで、ゲージ制で自動的に戦闘が進行します。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | 戦闘関連の型定義 |
| `hooks/useBattle.ts` | 戦闘ロジック（メイン） |
| `core/battle.ts` | ダメージ計算などのコア関数 |
| `core/player.ts` | プレイヤーステータス計算 |
| `app/battle/[dungeonId].tsx` | 戦闘画面UI |
| `app/result.tsx` | 結果画面 |
| `stores/usePlayerStore.ts` | プレイヤー状態管理 |
| `components/battle/` | 戦闘UIコンポーネント |
| `data/passiveTree.ts` | パッシブ効果計算 |

---

## 1. 型定義

### BattlePhase

```typescript
type BattlePhase = 'fighting' | 'victory' | 'defeat' | 'cleared';
```

| フェーズ | 説明 |
|---------|------|
| fighting | 戦闘中 |
| victory | 敵撃破（次階層へ） |
| defeat | プレイヤー敗北 |
| cleared | ダンジョンクリア |

### BattleState

```typescript
interface BattleState {
  dungeonId: string;
  currentFloor: number;        // 現在階層
  maxFloor: number;            // 最大階層
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;   // 現在の敵
  enemyPoison: PoisonState[];  // 敵の毒状態（複数スタック対応）
  phase: BattlePhase;
  battleLog: BattleLogEntry[]; // 戦闘ログ
  droppedItems: Item[];        // 獲得アイテム
  totalExpGained: number;      // 累計経験値
  playerGauge: number;         // プレイヤーの行動ゲージ (0-100)
  enemyGauge: number;          // 敵の行動ゲージ (0-100)
}
```

### ExtendedBattleState（周回機能用）

```typescript
interface ExtendedBattleState extends BattleState {
  runCount: number;          // 周回回数
  grandTotalExp: number;     // 全周回の累計経験値
  grandTotalItems: Item[];   // 全周回の累計アイテム
}
```

### BattleEnemy

```typescript
interface BattleEnemy {
  id: string;
  name: string;
  image: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  attackSpeed: number;       // 攻撃速度（デフォルト1.0）
  uniqueDrop: UniqueDrop | null;
}
```

### BattleLogEntry

```typescript
interface BattleLogEntry {
  id: number;
  message: string;
  type: 'player_attack' | 'enemy_attack' | 'victory' | 'defeat'
      | 'floor_clear' | 'info' | 'poison' | 'critical' | 'heal';
}
```

### PoisonState

```typescript
interface PoisonState {
  damagePerTurn: number;   // 毎ターンダメージ
  remainingTurns: number;  // 残りターン数
}
```

---

## 2. ゲージ制戦闘システム（ATB風）

### 概要

従来のターン制から、アクションゲージ制（ATB風）に変更されました。プレイヤーと敵が独立してゲージを溜め、100%になると攻撃を実行します。

### ゲームループ

```typescript
// 33msごとに更新（約30fps）
const TICK_INTERVAL = 33;

// ゲージ増加量 = AS × 200 / ticks/sec
// AS 1.0 の場合、約0.5秒で1回攻撃
const playerGaugeIncrease = (playerAS * 200) / ticksPerSecond;
const enemyGaugeIncrease = (enemyAS * 200) / ticksPerSecond;
```

### 攻撃速度（Attack Speed）

```typescript
// PoE式: base × (1 + increased%) × (1 + more1%) × (1 + more2%) × ...
// ※more%は加算して合計
let finalAS = baseAS * (1 + attackSpeedPct / 100);
const totalMore = attackSpeedMorePct.reduce((sum, more) => sum + more, 0);
finalAS *= (1 + totalMore / 100);
```

| 攻撃速度 | 攻撃間隔 |
|---------|---------|
| AS 1.0 | 約0.5秒 |
| AS 2.0 | 約0.25秒 |
| AS 0.5 | 約1.0秒 |

### ゲージUI

```
プレイヤー: ████████████░░░░░░░░ 60%
敵:         ██████░░░░░░░░░░░░░░ 30%
```

ActionGaugeコンポーネントで表示。

---

## 3. 戦闘の開始・初期化

### 初期状態の作成（createExtendedInitialState）

```typescript
const createExtendedInitialState = (
  dungeonId: string,
  playerMaxHp: number,
  runCount: number = 1,
  grandTotalExp: number = 0,
  grandTotalItems: Item[] = []
): ExtendedBattleState => {
  const dungeon = getDungeon(dungeonId);
  return {
    dungeonId,
    currentFloor: 1,
    maxFloor: dungeon?.maxFloor || 5,
    playerCurrentHp: playerMaxHp,
    playerMaxHp: playerMaxHp,
    enemy: null,
    enemyPoison: [],  // 配列で複数スタック対応
    phase: 'fighting',
    battleLog: runCount > 1 ? [{ message: `=== ${runCount}周目開始 ===`, type: 'info' }] : [],
    droppedItems: [],
    totalExpGained: 0,
    playerGauge: 0,
    enemyGauge: 0,
    runCount,
    grandTotalExp,
    grandTotalItems,
  };
};
```

### 敵の取得（ボス対応）

```typescript
const getEnemyForFloor = useCallback((floor: number): Enemy | undefined => {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return undefined;

  // ボスフロアかチェック
  if (dungeon.boss && dungeon.boss.floor === floor) {
    return getEnemy(dungeon.boss.monsterId);
  }

  // 通常の敵をランダム選択
  return getRandomEnemy(dungeon.monsters);
}, [dungeonId]);
```

---

## 4. 1ターンの処理フロー

```
┌─────────────────────────────────────────────────────────┐
│ プレイヤーゲージが100%に達した時                        │
├─────────────────────────────────────────────────────────┤
│ 1. 毒ダメージ処理（全スタック合計）                     │
│    ├ 全スタックのダメージを合計                        │
│    ├ enemyHp -= totalPoisonDamage                      │
│    ├ 各スタックのremainingTurns--                      │
│    └ 0以下になったスタックを除去                       │
├─────────────────────────────────────────────────────────┤
│ 2. クリティカル判定                                     │
│    └ random < criticalChance                           │
│       → ダメージ倍率 = 1.5 + criticalDamage/100        │
├─────────────────────────────────────────────────────────┤
│ 3. プレイヤー攻撃                                       │
│    ├ damage = DEF減衰式で計算                          │
│    ├ noDirectDamage時: damage = 0                      │
│    ├ クリティカル時: damage *= 倍率                    │
│    └ enemyHp -= damage                                 │
├─────────────────────────────────────────────────────────┤
│ 4. ライフスティール処理                                 │
│    ├ totalLifesteal = lifesteal + (クリティカル時のみ) │
│    └ playerHp += damage * totalLifesteal / 100         │
├─────────────────────────────────────────────────────────┤
│ 5. 毒付与判定（スタック上限未満の場合のみ）             │
│    ├ maxStacks = 1 + poison_max_stacks                 │
│    └ random < poisonChance                             │
│       → 毒付与（PoE式でダメージ計算）                  │
├─────────────────────────────────────────────────────────┤
│ 6. 敵撃破判定                                           │
│    ├ enemyHp <= 0 → ドロップ処理                       │
│    ├ 最終階層 → DUNGEON_CLEARED                        │
│    └ それ以外 → 500ms後にNEXT_FLOOR                    │
├─────────────────────────────────────────────────────────┤
│ 7. プレイヤーゲージリセット                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 敵ゲージが100%に達した時                                │
├─────────────────────────────────────────────────────────┤
│ 1. ダメージ軽減計算                                     │
│    ├ totalReduction = damageReductionPct               │
│    └ 敵が毒状態 → + poisonDamageReduction              │
├─────────────────────────────────────────────────────────┤
│ 2. 敵の攻撃                                             │
│    ├ damage = DEF減衰式で計算（追加軽減込み）          │
│    └ playerHp -= damage                                │
├─────────────────────────────────────────────────────────┤
│ 3. プレイヤー敗北判定                                   │
│    └ playerHp <= 0 → PLAYER_DEFEATED                   │
├─────────────────────────────────────────────────────────┤
│ 4. 敵ゲージリセット                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ HP回復タイマー（1秒ごと、独立）                         │
├─────────────────────────────────────────────────────────┤
│ ├ flatRegen = hpRegen                                  │
│ ├ pctRegen = maxHp × hpRegenPct / 100                  │
│ └ playerHp += flatRegen + pctRegen                     │
└─────────────────────────────────────────────────────────┘
```

---

## 5. ダメージ計算

### DEF減衰式（core/battle.ts）

```typescript
export function calculateDamage(atk: number, def: number, additionalReduction: number = 0): number {
  // DEF減衰: def / (def + 100)
  // DEFが高いほど1ポイントあたりの軽減効果が減少
  const defReduction = def / (def + 100);
  // DEF軽減 + 追加軽減（合計は99%まで）
  const totalReduction = Math.min(0.99, defReduction + additionalReduction / 100);
  return Math.max(1, Math.floor(atk * (1 - totalReduction)));
}
```

### DEF減衰の効果

| DEF | 軽減率 |
|-----|--------|
| 50 | 33% |
| 100 | 50% |
| 200 | 67% |
| 300 | 75% |
| 500 | 83% |

### クリティカルダメージ

```typescript
// 基礎倍率150% + ボーナス%
const criticalMultiplier = isCritical ? (1.5 + criticalDamage / 100) : 1;
const finalDamage = Math.floor(baseDamage * criticalMultiplier);
```

### 通常ダメージ無効化（キーストーン）

```typescript
// noDirectDamage = true の場合、通常攻撃ダメージは0
const playerDamage = modEffects.noDirectDamage ? 0 : Math.floor(baseDamage * criticalMultiplier);
```

---

## 6. MOD効果・パッシブ効果

### 効果の種類

| カテゴリ | 効果 | 説明 |
|---------|------|------|
| **ステータス** | atk_bonus | ATK+X (フラット) |
| | def_bonus | DEF+X (フラット) |
| | hp_bonus | HP+X (フラット) |
| | atk_increased_pct | ATK +X% (increased、加算) |
| | def_increased_pct | DEF +X% (increased、加算) |
| | hp_increased_pct | HP +X% (increased、加算) |
| | atk_more_pct | ATK X% more (乗算) |
| | def_more_pct | DEF X% more (乗算) |
| | hp_more_pct | HP X% more (乗算) |
| **攻撃速度** | attack_speed_pct | AS +X% (increased、加算) |
| | attack_speed_more_pct | AS X% more (乗算) |
| **回復** | hp_regen | 毎秒HP X回復 (フラット) |
| | hp_regen_pct | 毎秒HP X%回復 |
| | lifesteal | ダメージ吸収+X% |
| **防御** | damage_reduction_pct | ダメージ軽減+X% |
| **クリティカル** | critical_chance | クリティカル確率+X% |
| | critical_damage | クリティカルダメージ+X% |
| | critical_lifesteal | クリティカル時のみダメージ吸収+X% |
| **毒** | poison_chance | 毒付与確率+X% |
| | poison_damage_pct | 毒ダメージ倍率+X% (increased) |
| | poison_damage_more_pct | 毒ダメージ倍率X% more |
| | poison_max_stacks | 毒スタック上限+X |
| | poison_damage_reduction | 敵毒状態時ダメージ軽減+X% |
| **特殊** | no_direct_damage | 通常ダメージを与えられない（キーストーン） |

### PoE式ステータス計算

```typescript
// base × (1 + total_increased%) × (1 + total_more%)
// ※more%は加算して合計
export function applyPercentageScaling(
  base: number,
  increasedPct: number,
  moreMultipliers: number[]
): number {
  let result = base * (1 + increasedPct / 100);
  const totalMore = moreMultipliers.reduce((sum, more) => sum + more, 0);
  result = result * (1 + totalMore / 100);
  return Math.floor(result);
}
```

### 効果の取得元

1. **装備MOD** - 装備アイテムに付与されたランダムMOD
2. **パッシブツリー** - 解放したパッシブノードの効果

```typescript
const getCombinedModEffects = useCallback((): CombinedModEffects => {
  // 装備MODからの効果
  Object.values(equipment).forEach((item) => {
    if (item && item.mods) {
      for (const mod of item.mods) {
        // MODタイプに応じて加算
      }
    }
  });

  // パッシブツリーからの効果を加算
  const passiveEffects = calculatePassiveEffects(unlockedSkills);
  // 各効果を合算

  return combined;
}, [equipment, unlockedSkills]);
```

---

## 7. 毒システム

### 毒の特徴

| 項目 | 値 |
|------|-----|
| 基礎ダメージ | 攻撃ダメージの50% |
| 持続ターン | 5ターン |
| 基礎スタック上限 | 1 |
| 重ね掛け | 可能（スタック上限まで） |
| 階層移動時 | 敵の毒状態はリセット |

### 毒ダメージ計算（PoE式）

```typescript
// base × (1 + increased%) × (1 + more1%) × (1 + more2%) × ...
// ※more%は加算して合計
const calculatePoisonDamage = (baseDamage: number, modEffects: CombinedModEffects): number => {
  let damage = baseDamage * (1 + modEffects.poisonDamagePct / 100);
  const totalMore = modEffects.poisonDamageMorePct.reduce((sum, more) => sum + more, 0);
  damage *= (1 + totalMore / 100);
  return Math.floor(damage);
};
```

### 毒付与処理

```typescript
// スタック上限チェック
const maxPoisonStacks = BASE_POISON_MAX_STACKS + modEffects.poisonMaxStacks;
if (state.enemyPoison.length < maxPoisonStacks && modEffects.poisonChance > 0 && Math.random() * 100 < modEffects.poisonChance) {
  const rawPoisonDamage = Math.max(1, Math.floor(baseDamage * POISON_DAMAGE_RATIO));
  const poisonDamage = calculatePoisonDamage(rawPoisonDamage, modEffects);
  dispatch({ type: 'APPLY_POISON', damagePerTurn: poisonDamage, turns: POISON_DURATION });
}
```

### 毒ダメージ処理

```typescript
// 全スタックのダメージを合計
const totalPoisonDamage = state.enemyPoison.reduce((sum, p) => sum + p.damagePerTurn, 0);
dispatch({ type: 'POISON_DAMAGE', damage: totalPoisonDamage });

// 各スタックの残りターンを減らし、0以下になったものを除去
const updatedPoisonStacks = state.enemyPoison
  .map(p => ({ ...p, remainingTurns: p.remainingTurns - 1 }))
  .filter(p => p.remainingTurns > 0);
```

---

## 8. 敵撃破時の処理

### ドロップアイテム収集

```typescript
const droppedItems: Item[] = [];

// 1. ユニークドロップ判定
if (state.enemy.uniqueDrop) {
  const uniqueItem = tryUniqueDrop(
    state.enemy.uniqueDrop.itemId,
    state.enemy.uniqueDrop.dropRate
  );
  if (uniqueItem) {
    droppedItems.push(uniqueItem);
  }
}

// 2. 通常ドロップ判定
if (dungeon) {
  const dropCount = rollDropCount();  // 0-3個
  const normalDrops = rollDropItems(dungeon.dropTable, dropCount, dungeonId);
  droppedItems.push(...normalDrops);
}

// 3. フィルタリング適用
const filteredItems = filterDroppedItems(droppedItems, dropFilter);

dispatch({
  type: 'ENEMY_DEFEATED',
  exp: state.enemy.exp,
  droppedItems: filteredItems,
});
```

### ドロップフィルター

```typescript
interface DropFilterSettings {
  categories: {
    weapon: boolean;
    armor: boolean;
    gloves: boolean;
    boots: boolean;
    accessory: boolean;
  };
  minModCount: number;  // 最小MOD数
  maxTier: number;      // 最高Tier（1が最高品質）
}

const filterDroppedItems = (items: Item[], filter: DropFilterSettings): Item[] => {
  return items.filter((item) => {
    // カテゴリフィルター
    if (!filter.categories[item.slot]) return false;
    // MOD数フィルター
    if (filter.minModCount > 0 && item.mods.length < filter.minModCount) return false;
    // Tierフィルター
    if (filter.maxTier > 0) {
      const hasGoodTierMod = item.mods.some((mod) => mod.tier <= filter.maxTier);
      if (!hasGoodTierMod) return false;
    }
    return true;
  });
};
```

---

## 9. 階層進行・クリア判定

### 次階層への進行

```typescript
if (state.currentFloor < state.maxFloor) {
  const nextFloor = state.currentFloor + 1;
  const nextEnemy = getEnemyForFloor(nextFloor);
  setTimeout(() => {
    dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
  }, 500);
}
```

### NEXT_FLOORアクション

```typescript
case 'NEXT_FLOOR':
  return {
    ...state,
    currentFloor: state.currentFloor + 1,
    enemy: action.enemy,
    enemyPoison: [],  // 毒状態リセット
    playerGauge: 0,   // ゲージリセット
    enemyGauge: 0,    // ゲージリセット
    phase: 'fighting',
    battleLog: [
      ...state.battleLog,
      { message: `--- ${state.currentFloor + 1}階へ進む ---`, type: 'floor_clear' },
      { message: `${action.enemy.name}が現れた！`, type: 'info' },
    ],
  };
```

---

## 10. 自動周回機能

### 機能概要

- クリア時に自動で次の周回を開始
- 敗北時は自動周回を終了
- 累計経験値・アイテムを記録

### 使用方法

```typescript
const { isAutoRunning, startAutoRun, stopAutoRun } = useBattle(dungeonId);

// 自動周回開始
startAutoRun();

// 自動周回停止
stopAutoRun();
```

### RESET_DUNGEONアクション

```typescript
case 'RESET_DUNGEON':
  return createExtendedInitialState(
    state.dungeonId,
    action.playerMaxHp,
    state.runCount + 1,  // 周回数インクリメント
    state.grandTotalExp + state.totalExpGained,  // 累計経験値更新
    [...state.grandTotalItems, ...state.droppedItems]  // 累計アイテム更新
  );
```

---

## 11. プレイヤー敗北処理

### 敗北時も報酬獲得

```typescript
useEffect(() => {
  if (state.phase === 'cleared' || state.phase === 'defeat') {
    // 敗北時も経験値を付与
    if (state.totalExpGained > 0) {
      await gainExp(state.totalExpGained);
    }

    // ドロップアイテムをインベントリに追加
    const availableSpace = getInventorySpace();
    const itemsToAdd = state.droppedItems.slice(0, availableSpace);

    for (const item of itemsToAdd) {
      await addToInventory(item);
    }
  }
}, [state.phase]);
```

---

## 12. 戦闘ログシステム

### ログタイプと色分け

| タイプ | 色 | 用途 |
|-------|-----|------|
| player_attack | #4CAF50（緑） | プレイヤー攻撃 |
| enemy_attack | #F44336（赤） | 敵攻撃 |
| victory | #FFD700（金） | 勝利 |
| defeat | #FF6B6B（濃い赤） | 敗北 |
| floor_clear | #2196F3（青） | 階層クリア |
| poison | #9C27B0（紫） | 毒ダメージ |
| critical | #FF9800（オレンジ） | クリティカル |
| heal | #00BCD4（シアン） | HP回復 |
| info | #fff（白） | その他情報 |

### ログメッセージ例

```
=== 2周目開始 ===
スライムが現れた！
プレイヤーの攻撃！ スライムに8ダメージ！
クリティカルヒット！ スライムに24ダメージ！
スライムに毒を付与した！（4ダメージ x 5ターン）
スライムに毒を付与した！（4ダメージ x 5ターン） [2スタック]
毒ダメージ！ スライムに8ダメージ！（2スタック継続）
HP回復！ HPが5回復した！
スライムの攻撃！ 3ダメージを受けた！
スライムを倒した！ 経験値50を獲得！
朽ちた剣をドロップした！
--- 2階へ進む ---
ダンジョンを踏破した！
```

---

## 13. 戦闘UIレイアウト

```
┌─────────────────────────────────────────────────────────┐
│ ダンジョン名 - 3/5階 (2周目)                            │
│ 自動周回中                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   [プレイヤー画像]              [敵画像]                │
│   ████████████ 80/100          ██████░░░░ 30/50        │
│   Lv.5                                                  │
│   ████████░░░░ 80%             ██████░░░░ 60%          │  ← 行動ゲージ
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 戦闘ログ                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ スライムが現れた！                                  │ │
│ │ プレイヤーの攻撃！ スライムに8ダメージ！            │ │
│ │ スライムの攻撃！ 3ダメージを受けた！                │ │
│ │ クリティカルヒット！ スライムに24ダメージ！         │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ [武器] [防具] [手袋] [靴] [アクセ]                      │
├─────────────────────────────────────────────────────────┤
│      [一時停止/再開]    [自動周回/周回停止]             │
│                   [撤退する]（一時停止時のみ）          │
└─────────────────────────────────────────────────────────┘
```

---

## 14. Reducerアクション一覧

| アクション | 説明 |
|-----------|------|
| START_BATTLE | 戦闘開始、最初の敵を設定 |
| PLAYER_ATTACK | プレイヤー攻撃、敵HPを減少 |
| ENEMY_ATTACK | 敵攻撃、プレイヤーHPを減少 |
| ENEMY_DEFEATED | 敵撃破、経験値・アイテム追加 |
| PLAYER_DEFEATED | プレイヤー敗北、フェーズ変更 |
| NEXT_FLOOR | 次階層へ、新しい敵を設定 |
| DUNGEON_CLEARED | ダンジョンクリア |
| ADD_LOG | ログエントリ追加 |
| APPLY_POISON | 敵に毒を付与（スタック追加） |
| POISON_DAMAGE | 毒ダメージ処理 |
| HP_REGEN | HP回復処理 |
| UPDATE_GAUGES | ゲージ値の更新 |
| RESET_PLAYER_GAUGE | プレイヤーゲージリセット |
| RESET_ENEMY_GAUGE | 敵ゲージリセット |
| RESET_DUNGEON | 自動周回時のダンジョンリセット |

---

## 15. ゲームバランス設定

### プレイヤー初期ステータス

```typescript
export const INITIAL_STATS = {
  maxHp: 100,
  atk: 10,
  def: 5,
};

export const LEVEL_UP_BONUS = {
  maxHp: 10,   // +10 HP/level
  atk: 2,      // +2 ATK/level
  def: 1,      // +1 DEF/level
  skillPoints: 1,
};
```

### 戦闘定数

```typescript
const TICK_INTERVAL = 33;             // ゲームループ間隔（ms）
const POISON_DAMAGE_RATIO = 0.5;      // 攻撃ダメージの50%
const POISON_DURATION = 5;            // 5ターン持続
const BASE_POISON_MAX_STACKS = 1;     // 基礎毒スタック上限
const NEXT_FLOOR_DELAY = 500;         // 次階層への遅延（ms）
const RESULT_TRANSITION_DELAY = 2000; // 結果画面への遷移（ms）
const AUTO_RUN_DELAY = 1500;          // 自動周回時の次周回開始遅延（ms）
```

---

## 16. パフォーマンス最適化

### 二重実行防止

```typescript
const isProcessingRef = useRef(false);

const executeTurn = useCallback(() => {
  if (isProcessingRef.current) return;
  isProcessingRef.current = true;

  // ... 処理 ...

  isProcessingRef.current = false;
}, []);
```

### タイマー管理

```typescript
const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
const regenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
  return () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    if (regenTimerRef.current) {
      clearInterval(regenTimerRef.current);
    }
  };
}, []);
```

---

## 17. 戦闘システムの特徴

| 特徴 | 説明 |
|------|------|
| ゲージ制戦闘 | ATB風の独立したゲージシステム |
| 攻撃速度 | PoE式のincreased%/more%計算 |
| 完全自動戦闘 | プレイヤー操作不要（一時停止・撤退・自動周回のみ可能） |
| 自動周回 | クリア時に自動で次の周回を開始 |
| MOD効果 | 装備のランダムMODで戦闘に変化 |
| パッシブ効果 | スキルツリーで戦闘能力をカスタマイズ |
| 毒スタック | 複数の毒を同時に付与可能 |
| ドロップフィルター | 不要なアイテムを自動除外 |
| ボスシステム | 特定フロアでボス出現 |
| 詳細ログ | 毒、クリティカル、回復など色分け表示 |
| 敗北時も報酬 | 敗北階数までの経験値・アイテム獲得 |
| レベルアップ連鎖 | 多くの敵を倒すと複数レベルアップ可能 |

---

## 18. 関連ドキュメント

- [ダンジョンシステム](./dungeon-system.md) - ダンジョン・敵の詳細
- [ドロップ率システム](./drop-rate-system.md) - アイテムドロップの仕組み
- [MODシステム](./mod-system.md) - 戦闘中のMOD効果
- [インベントリ・倉庫システム](./inventory-storage-system.md) - 獲得アイテムの管理
- [パッシブツリー](./passive-tree.md) - パッシブスキルの詳細
