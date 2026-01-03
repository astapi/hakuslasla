# 戦闘システム

## 概要

完全自動戦闘RPG。プレイヤー操作は「一時停止」と「撤退」のみで、1秒ごとに自動でターンが進行します。

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
  enemyPoison: PoisonState | null;  // 敵の毒状態
  phase: BattlePhase;
  battleLog: BattleLogEntry[]; // 戦闘ログ
  droppedItems: Item[];        // 獲得アイテム
  totalExpGained: number;      // 累計経験値
}
```

### BattleEnemy

```typescript
interface BattleEnemy {
  id: string;
  name: string;
  image: any;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  uniqueDrop?: UniqueDrop;
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

## 2. 戦闘の開始・初期化

### 初期状態の作成（createInitialState）

```typescript
const createInitialState = (dungeonId: string, playerMaxHp: number): BattleState => {
  const dungeon = getDungeon(dungeonId);
  return {
    dungeonId,
    currentFloor: 1,
    maxFloor: dungeon?.maxFloor || 5,
    playerCurrentHp: playerMaxHp,
    playerMaxHp: playerMaxHp,
    enemy: null,
    enemyPoison: null,
    phase: 'fighting',
    battleLog: [],
    droppedItems: [],
    totalExpGained: 0,
  };
};
```

### 戦闘開始（startBattle）

```typescript
const startBattle = useCallback(() => {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return;

  // ランダムに敵を選択
  const enemy = getRandomEnemy(dungeon.monsters);
  if (!enemy) return;

  // 戦闘開始
  dispatch({
    type: 'START_BATTLE',
    enemy: createBattleEnemy(enemy),
  });
}, [dungeonId]);
```

### 自動開始（マウント時）

```typescript
useEffect(() => {
  if (!state.enemy && state.phase === 'fighting') {
    startBattle();
  }
}, []);
```

---

## 3. ターン実行ロジック

### 自動戦闘タイマー

```typescript
useEffect(() => {
  if (state.phase !== 'fighting' || !state.enemy || isPaused) return;

  timerRef.current = setTimeout(() => {
    executeTurn();
  }, 1000);  // 1秒ごとにターン実行

  return () => clearTimeout(timerRef.current);
}, [state.phase, state.enemy, state.playerCurrentHp, state.battleLog.length, isPaused]);
```

### 一時停止機能

```typescript
const [isPaused, setIsPaused] = useState(false);

const togglePause = useCallback(() => {
  setIsPaused((prev) => !prev);
}, []);
```

- 一時停止中は自動戦闘タイマーが停止
- 「再開」ボタンで戦闘を再開

### 1ターンの処理フロー

```
┌─────────────────────────────────────────────────────────┐
│ 1. ターン開始時のHP回復（hp_regen MOD）                  │
│    └ playerCurrentHp += modEffects.hpRegen              │
├─────────────────────────────────────────────────────────┤
│ 2. 敵の毒ダメージ処理                                    │
│    ├ enemyHp -= poisonDamage                            │
│    ├ remainingTurns--                                   │
│    └ 毒で敵が倒れた場合 → ドロップ処理 → 次階層          │
├─────────────────────────────────────────────────────────┤
│ 3. クリティカル判定                                      │
│    └ random < criticalChance → ダメージ2倍             │
├─────────────────────────────────────────────────────────┤
│ 4. プレイヤー攻撃                                        │
│    ├ damage = max(1, ATK - DEF)                         │
│    ├ クリティカル時: damage *= 2                        │
│    └ enemyHp -= damage                                  │
├─────────────────────────────────────────────────────────┤
│ 5. 毒付与判定（敵が毒でない場合のみ）                    │
│    └ random < poisonChance → 毒付与（5ターン）          │
├─────────────────────────────────────────────────────────┤
│ 6. 敵撃破判定                                            │
│    ├ enemyHp <= 0 → ドロップ処理                        │
│    ├ 最終階層 → DUNGEON_CLEARED                         │
│    └ それ以外 → 500ms後にNEXT_FLOOR                     │
├─────────────────────────────────────────────────────────┤
│ 7. 敵の反撃（敵が生存している場合）                      │
│    ├ 500ms後に実行                                      │
│    ├ damage = max(1, enemy.ATK - player.DEF)            │
│    └ playerHp -= damage                                 │
├─────────────────────────────────────────────────────────┤
│ 8. プレイヤー敗北判定                                    │
│    └ playerHp <= 0 → PLAYER_DEFEATED                    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. ダメージ計算

### 基本ダメージ（core/battle.ts）

```typescript
export function calculateDamage(atk: number, def: number): number {
  return Math.max(1, atk - def);  // 最低1ダメージ保証
}
```

### プレイヤー攻撃ダメージ

```typescript
// 装備込みステータスを取得
const stats = getTotalStats();

// 基本ダメージ
const baseDamage = calculateDamage(stats.atk, enemy.def);

// クリティカル判定
const isCritical = modEffects.criticalChance > 0
  && Math.random() * 100 < modEffects.criticalChance;
const criticalMultiplier = isCritical ? 2 : 1;

// 最終ダメージ
const playerDamage = Math.floor(baseDamage * criticalMultiplier);
```

### 敵攻撃ダメージ

```typescript
const enemyDamage = calculateDamage(enemy.atk, stats.def);
```

---

## 5. MOD効果の適用

### 戦闘時MOD効果の取得

```typescript
const getModEffectsFromEquipment = useCallback(() => {
  const combined = {
    hpRegen: 0,
    poisonChance: 0,
    criticalChance: 0,
  };

  Object.values(equipment).forEach((item) => {
    if (item && item.mods) {
      for (const mod of item.mods) {
        switch (mod.type) {
          case 'hp_regen':
            combined.hpRegen += mod.value;
            break;
          case 'poison_chance':
            combined.poisonChance += mod.value;
            break;
          case 'critical_chance':
            combined.criticalChance += mod.value;
            break;
        }
      }
    }
  });

  return combined;
}, [equipment]);
```

### 各MODの適用タイミング

| MODタイプ | 適用タイミング | 効果 |
|----------|---------------|------|
| atk_bonus | ステータス計算時 | ATKに加算 |
| def_bonus | ステータス計算時 | DEFに加算 |
| hp_regen | ターン開始時 | HPを回復 |
| poison_chance | 攻撃後 | 敵に毒を付与 |
| critical_chance | 攻撃時 | ダメージ2倍 |

---

## 6. 毒システム

### 毒付与条件

```typescript
if (!state.enemyPoison                           // 敵が毒でない
    && modEffects.poisonChance > 0               // poison_chance MODあり
    && Math.random() * 100 < poisonChance) {     // 確率判定成功

  const poisonDamage = Math.max(1, Math.floor(playerDamage * 0.5));
  dispatch({
    type: 'APPLY_POISON',
    damagePerTurn: poisonDamage,
    turns: 5,  // 5ターン持続
  });
}
```

### 毒ダメージ処理

```typescript
// ターン開始時に処理
if (state.enemyPoison && state.enemyPoison.remainingTurns > 0) {
  dispatch({
    type: 'POISON_DAMAGE',
    damage: state.enemyPoison.damagePerTurn,
  });
  // 残りターン減少はreducerで処理
}
```

### 毒の特徴

- ダメージ量: 攻撃ダメージの50%
- 持続ターン: 5ターン
- 重ね掛け: 不可（既に毒状態なら付与されない）
- 階層移動時: 敵の毒状態はリセット

---

## 7. 敵撃破時の処理

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
  const normalDrops = rollDropItems(dungeon.dropTable, dropCount);
  droppedItems.push(...normalDrops);
}

// 3. 敵撃破アクション
dispatch({
  type: 'ENEMY_DEFEATED',
  exp: state.enemy.exp,
  droppedItems,
});
```

### 経験値の蓄積

```typescript
// reducerで処理
case 'ENEMY_DEFEATED':
  return {
    ...state,
    totalExpGained: state.totalExpGained + action.exp,
    droppedItems: [...state.droppedItems, ...action.droppedItems],
  };
```

---

## 8. 階層進行・クリア判定

### 次階層への進行

```typescript
if (state.currentFloor < state.maxFloor) {
  const nextEnemy = getRandomEnemy(dungeon.monsters);
  setTimeout(() => {
    dispatch({
      type: 'NEXT_FLOOR',
      enemy: createBattleEnemy(nextEnemy),
    });
  }, 500);  // 500ms後に次の敵
}
```

### NEXT_FLOORアクション

```typescript
case 'NEXT_FLOOR':
  return {
    ...state,
    currentFloor: state.currentFloor + 1,
    enemy: action.enemy,
    enemyPoison: null,  // 毒状態リセット
    phase: 'fighting',
    battleLog: [
      ...state.battleLog,
      { message: `--- ${state.currentFloor + 1}階へ進む ---`, type: 'floor_clear' },
      { message: `${action.enemy.name}が現れた！`, type: 'info' },
    ],
  };
```

### ダンジョンクリア

```typescript
if (state.currentFloor >= state.maxFloor) {
  dispatch({ type: 'DUNGEON_CLEARED' });
}

// reducerで処理
case 'DUNGEON_CLEARED':
  return {
    ...state,
    phase: 'cleared',
    battleLog: [
      ...state.battleLog,
      { message: 'ダンジョンを踏破した！', type: 'victory' },
    ],
  };
```

---

## 9. プレイヤー敗北処理

### 敗北判定

```typescript
const playerHpAfterEnemyAttack = state.playerCurrentHp - enemyDamage;

if (playerHpAfterEnemyAttack <= 0) {
  dispatch({ type: 'PLAYER_DEFEATED' });
}
```

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

## 10. 戦闘ログシステム

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
スライムが現れた！
プレイヤーの攻撃！スライムに8ダメージ！
クリティカルヒット！16ダメージ！
毒を付与した！（4ダメージ/ターン、5ターン）
毒ダメージ！スライムに4ダメージ！（残り4ターン）
HP回復！5回復した！
スライムの攻撃！プレイヤーに3ダメージ！
スライムを倒した！
--- 2階へ進む ---
ダンジョンを踏破した！
```

### 自動スクロール

```typescript
const scrollViewRef = useRef<ScrollView>(null);

useEffect(() => {
  scrollViewRef.current?.scrollToEnd({ animated: true });
}, [logs.length]);
```

---

## 11. 戦闘UIレイアウト

```
┌─────────────────────────────────────────────────────────┐
│ ダンジョン名                              3/5階        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   [プレイヤー画像]              [敵画像]               │
│   ████████████ 80/100         ██████░░░░ 30/50        │
│   Lv.5                                                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 戦闘ログ                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ スライムが現れた！                                  │ │
│ │ プレイヤーの攻撃！スライムに8ダメージ！            │ │
│ │ スライムの攻撃！プレイヤーに3ダメージ！            │ │
│ │ クリティカルヒット！16ダメージ！                   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ HP 80  │  ATK 25  │  DEF 10  │  SP 2                   │
│ EXP ████████░░░░░░░░░░░░░░░░ 45%                       │
├─────────────────────────────────────────────────────────┤
│ [武器] [防具] [手袋] [靴] [アクセ]                     │
├─────────────────────────────────────────────────────────┤
│              [撤退する]                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 12. 結果画面への遷移

### 自動遷移（2秒後）

```typescript
useEffect(() => {
  if (state.phase === 'cleared' || state.phase === 'defeat') {
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/result',
        params: {
          dungeonId: dungeonId,
          dungeonName: dungeon?.name || '',
          result: state.phase === 'cleared' ? 'cleared' : 'defeat',
          floorsCleared: state.currentFloor.toString(),
          maxFloor: state.maxFloor.toString(),
          expGained: state.totalExpGained.toString(),
          itemsGained: JSON.stringify(state.droppedItems),
        },
      });
    }, 2000);

    return () => clearTimeout(timer);
  }
}, [state.phase]);
```

### 結果画面の表示内容

```
┌─────────────────────────────────────────────────────────┐
│            ダンジョン踏破！ / 敗北...                   │
│                                                         │
│            始まりの草原                                 │
│            5/5 階クリア                                 │
│                                                         │
│            ─── 獲得報酬 ───                             │
│            経験値  +500 EXP                             │
│                                                         │
│            獲得アイテム                                 │
│            ・朽ちた剣  ATK+2                           │
│            ・布の服    DEF+2                           │
│            ・革の手袋  DEF+1 MOD x1                    │
│                                                         │
│            [ダンジョン選択に戻る]                       │
└─────────────────────────────────────────────────────────┘
```

---

## 13. Reducerアクション一覧

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
| APPLY_POISON | 敵に毒を付与 |
| POISON_DAMAGE | 毒ダメージ処理 |
| HP_REGEN | HP回復処理 |

---

## 14. ゲームバランス設定

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
const POISON_DAMAGE_RATIO = 0.5;  // 攻撃ダメージの50%
const POISON_DURATION = 5;        // 5ターン持続
const TURN_INTERVAL = 1000;       // 1秒ごと
const ENEMY_ATTACK_DELAY = 500;   // 敵攻撃の遅延
const NEXT_FLOOR_DELAY = 500;     // 次階層への遅延
const RESULT_TRANSITION_DELAY = 2000;  // 結果画面への遷移
```

---

## 15. パフォーマンス最適化

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
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };
}, []);
```

---

## 16. 戦闘システムの特徴

| 特徴 | 説明 |
|------|------|
| 完全自動戦闘 | プレイヤー操作不要（一時停止・撤退のみ可能） |
| MOD効果 | 装備のランダムMODで戦闘に変化 |
| 複数階層 | 同一ダンジョン内で連続戦闘 |
| 詳細ログ | 毒、クリティカル、回復など色分け表示 |
| 敗北時も報酬 | 敗北階数までの経験値・アイテム獲得 |
| レベルアップ連鎖 | 多くの敵を倒すと複数レベルアップ可能 |

---

## 17. 関連ドキュメント

- [ダンジョンシステム](./dungeon-system.md) - ダンジョン・敵の詳細
- [ドロップ率システム](./drop-rate-system.md) - アイテムドロップの仕組み
- [MODシステム](./mod-system.md) - 戦闘中のMOD効果
- [インベントリ・倉庫システム](./inventory-storage-system.md) - 獲得アイテムの管理
