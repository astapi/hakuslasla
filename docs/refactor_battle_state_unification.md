# 戦闘状態型統一リファクタリング設計書

## 概要

シミュレーション（core）とUI（hooks/useBattle）で戦闘ロジックが二重実装されている問題を解決するため、状態型を統一し、UIがcoreの戦闘関数を直接使用できるようにする。

## 現状の問題

### 1. ロジックの二重実装

| 処理 | Core実装 | UI実装 |
|-----|---------|--------|
| 毒ダメージ処理 | `processPoisonDamage()` | reducer内で独自実装 |
| 毒ダメージ吸収 | `poisonResult.healAmount` | **未実装だった** |
| HP回復計算 | `calculateHpRegen()` | reducer内で独自実装 |
| ライフスティール | `calculateLifesteal()` | reducer内で独自実装 |
| プレイヤー攻撃 | `executePlayerAttack()` | reducer内で独自実装 |

### 2. 状態型の不一致

**Core (`core/types.ts`)**
```typescript
interface GaugeCombatant {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  attackSpeed: number;
  gauge: number;
}

interface PoisonStack {
  damagePerTick: number;
  remainingTicks: number;
}

interface GaugeBattleState {
  player: GaugeCombatant;
  enemy: GaugeCombatant;
  enemyPoisonStacks: PoisonStack[];
  elapsedTicks: number;
  isFinished: boolean;
  winner: 'player' | 'enemy' | null;
}
```

**UI (`types/index.ts`)**
```typescript
interface PoisonState {
  damagePerTurn: number;    // ≒ damagePerTick
  remainingTurns: number;   // ≒ remainingTicks
}

interface BattleEnemy {
  id: string;
  name: string;
  image: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  attackSpeed: number;
  uniqueDrop: UniqueDrop | null;
}

interface BattleState {
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;
  enemyPoison: PoisonState[];
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;
  playerGauge: number;
  enemyGauge: number;
}
```

---

## 設計方針

### 原則

1. **Coreの型を正とする** - 戦闘ロジックに関わる型はcoreで定義
2. **UIは拡張のみ** - UI固有の情報（表示用、ダンジョン進行用）はUIで拡張
3. **Core関数を直接使用** - UIはcoreの戦闘効果関数を直接呼び出す

### 型の統一設計

```
┌─────────────────────────────────────────────────────────┐
│  core/types.ts (戦闘ロジック型)                          │
├─────────────────────────────────────────────────────────┤
│  GaugeCombatant     - 戦闘者の基本情報                   │
│  PoisonStack        - 毒スタック                         │
│  GaugeBattleState   - 1体との戦闘状態                    │
│  BattleEvent        - 戦闘イベント                       │
└─────────────────────────────────────────────────────────┘
                          ↓ 使用
┌─────────────────────────────────────────────────────────┐
│  types/index.ts (UI拡張型)                               │
├─────────────────────────────────────────────────────────┤
│  EnemyDisplayInfo   - 敵の表示情報 (name, image, etc)    │
│  DungeonBattleState - ダンジョン攻略状態                  │
│    ├─ battle: GaugeBattleState  ← Core型を内包          │
│    ├─ enemyInfo: EnemyDisplayInfo                       │
│    ├─ dungeonId, currentFloor, maxFloor                 │
│    ├─ phase, battleLog, droppedItems                    │
│    └─ totalExpGained                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 詳細設計

### 1. Core型の調整 (`core/types.ts`)

変更なし。現状のまま使用。

```typescript
// 既存のまま
export interface GaugeCombatant { ... }
export interface PoisonStack { ... }
export interface GaugeBattleState { ... }
export interface BattleEvent { ... }
```

### 2. UI型の変更 (`types/index.ts`)

#### 削除する型
```typescript
// 削除: Core型に統一
interface PoisonState { ... }  // → core/PoisonStack を使用
```

#### 変更する型
```typescript
// 変更前
interface BattleEnemy {
  id: string;
  name: string;
  image: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  attackSpeed: number;
  uniqueDrop: UniqueDrop | null;
}

// 変更後: 表示情報のみに限定
interface EnemyDisplayInfo {
  id: string;
  name: string;
  image: string;
  exp: number;
  uniqueDrop: UniqueDrop | null;
}
```

#### 新規追加
```typescript
import { GaugeBattleState, PoisonStack } from '@/core';

// ダンジョン戦闘状態（UIで使用）
interface DungeonBattleState {
  // Core戦闘状態（1体との戦闘）
  battle: GaugeBattleState;

  // 敵の表示情報
  enemyInfo: EnemyDisplayInfo | null;

  // ダンジョン進行
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;

  // UI状態
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;
}
```

#### BattleAction型の調整
```typescript
// 変更前: UIが直接HPやダメージを管理
type BattleAction =
  | { type: 'PLAYER_ATTACK'; damage: number; isCritical?: boolean }
  | { type: 'ENEMY_ATTACK'; damage: number }
  | { type: 'POISON_DAMAGE'; damage: number }
  | { type: 'HP_REGEN'; amount: number }
  | ...

// 変更後: Core関数の結果を適用
type BattleAction =
  | { type: 'START_BATTLE'; enemy: Enemy }
  | { type: 'APPLY_BATTLE_STATE'; battle: GaugeBattleState; events: BattleEvent[] }
  | { type: 'ENEMY_DEFEATED'; exp: number; droppedItems: Item[] }
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'NEXT_FLOOR'; enemy: Enemy }
  | { type: 'DUNGEON_CLEARED' }
  | { type: 'RESET_DUNGEON'; playerMaxHp: number }
```

### 3. useBattle.ts の変更

#### インポート追加
```typescript
import {
  GaugeBattleState,
  PoisonStack,
  BattleEvent,
  createGaugeBattleState,
  createGaugeBattleStateWithHp,
} from '@/core';
import {
  executePlayerAttack,
  tryApplyPoison,
  processPoisonDamage,
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
} from '@/core/combatEffects';
```

#### ゲームループの変更

```typescript
// 変更前: 独自実装
const executeTurn = useCallback(() => {
  // ... 長い独自実装 ...
  if (state.enemyPoison.length > 0) {
    const totalPoisonDamage = state.enemyPoison.reduce(...);
    dispatch({ type: 'POISON_DAMAGE', damage: totalPoisonDamage });
    // 毒ダメージ吸収が欠落していた
  }
  // ...
}, [...]);

// 変更後: Core関数を使用
const executeTurn = useCallback(() => {
  // GaugeBattleStateを取得
  const battleState = state.battle;

  // Core関数で毒ダメージ処理
  if (battleState.enemyPoisonStacks.length > 0) {
    const poisonResult = processPoisonDamage(battleState, battleState.elapsedTicks, modEffects);
    // poisonResult.healAmount も自動的に含まれる
  }

  // Core関数でプレイヤー攻撃
  const attackResult = executePlayerAttack(battleState, playerAtk, modEffects, config, Math.random);

  // Core関数でライフスティール
  const lifestealAmount = calculateLifesteal(attackResult.damage, attackResult.isCritical, modEffects);

  // 結果を適用
  dispatch({ type: 'APPLY_BATTLE_STATE', battle: newBattleState, events: allEvents });
}, [...]);
```

#### Reducerの簡素化

```typescript
// 変更前: 細かいアクションごとに状態更新
case 'PLAYER_ATTACK':
  return { ...state, enemy: { ...state.enemy, currentHp: ... } };
case 'POISON_DAMAGE':
  return { ...state, enemy: { ...state.enemy, currentHp: ... }, enemyPoison: ... };
case 'HP_REGEN':
  return { ...state, playerCurrentHp: ... };

// 変更後: Core状態をそのまま適用
case 'APPLY_BATTLE_STATE':
  return {
    ...state,
    battle: action.battle,
    battleLog: [...state.battleLog, ...convertEventsToLogs(action.events)],
  };
```

### 4. 戦闘UIコンポーネントの調整

参照パスの変更のみ：

```typescript
// 変更前
const playerHp = state.playerCurrentHp;
const playerMaxHp = state.playerMaxHp;
const playerGauge = state.playerGauge;
const enemyHp = state.enemy?.currentHp;

// 変更後
const playerHp = state.battle.player.currentHp;
const playerMaxHp = state.battle.player.maxHp;
const playerGauge = state.battle.player.gauge;
const enemyHp = state.battle.enemy.currentHp;
```

---

## 実装計画

### Phase 1: 型定義の統一

| ファイル | 変更内容 |
|---------|---------|
| `types/index.ts` | PoisonState削除、BattleState→DungeonBattleState変更、BattleAction簡素化 |
| `core/types.ts` | 変更なし（exportの確認のみ） |
| `core/index.ts` | combatEffects関数のexport追加 |

### Phase 2: useBattle.tsリファクタリング

| 変更箇所 | 内容 |
|---------|------|
| インポート | Core関数のインポート追加 |
| 初期状態 | `createGaugeBattleState()`使用 |
| executeTurn | Core関数（processPoisonDamage, executePlayerAttack等）使用 |
| executeEnemyAttack | Core関数（calculateEnemyDamage）使用 |
| HP回復タイマー | Core関数（calculateHpRegen）使用 |
| Reducer | APPLY_BATTLE_STATE中心に簡素化 |

### Phase 3: UIコンポーネント調整

| ファイル | 変更内容 |
|---------|---------|
| `components/battle/BattleScreen.tsx` | state参照パス変更 |
| `components/battle/PlayerStatus.tsx` | state参照パス変更 |
| `components/battle/EnemyStatus.tsx` | state参照パス変更 |
| `components/battle/BattleLog.tsx` | BattleEvent→BattleLogEntry変換対応 |

### Phase 4: テスト・検証

1. 各ダンジョンでの戦闘動作確認
2. 毒ビルドでのpoison_lifesteal動作確認
3. シミュレーションとUIの結果比較

---

## 影響範囲

### 変更ファイル一覧

```
types/index.ts              - 型定義変更
core/index.ts               - export追加
hooks/useBattle.ts          - 主要リファクタ
components/battle/*.tsx     - 参照パス変更（軽微）
app/battle/[dungeonId].tsx  - 必要に応じて調整
```

### 後方互換性

- 戦闘ロジックの動作は変わらない（Coreと同一になる）
- UI表示は変わらない
- セーブデータへの影響なし

---

## 期待される効果

1. **バグ防止**: ロジック二重実装による不整合がなくなる
2. **保守性向上**: 戦闘ロジックの変更がCore一箇所で完結
3. **テスト容易性**: シミュレーションとUIが同一ロジックなので、シミュレーション結果がそのままUI動作を保証

---

## 備考

- このリファクタは戦闘システムの根幹に関わるため、段階的に実施
- Phase 1完了後に型エラーを解消してからPhase 2に進む
- 各Phase完了後に動作確認を行う
