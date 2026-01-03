# シミュレーションシステム

## 概要

ゲームバランス調整用の高速計算エンジン。UI/DB/Reactに依存しない純粋なゲームロジックで、複数ダンジョンを数秒で検証できます。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `core/simulation.ts` | シミュレーションロジック |
| `core/battle.ts` | 戦闘計算 |
| `core/player.ts` | プレイヤー計算 |
| `core/types.ts` | 型定義 |
| `scripts/runSimulation.ts` | 実行スクリプト |

---

## 1. 実行方法

### NPMスクリプト

```bash
npm run simulation
```

### 直接実行

```bash
npx tsx scripts/runSimulation.ts
```

---

## 2. 型定義

### SimulationConfig

```typescript
interface SimulationConfig {
  playerConfig: PlayerConfig;  // プレイヤー構成
  dungeonId: string;           // ダンジョンID
  runs: number;                // 試行回数
  seed?: number;               // 乱数シード（再現性）
}
```

### SimulationStats

```typescript
interface SimulationStats {
  winRate: number;              // 勝率（0.0〜1.0）
  avgTurns: number;             // 平均ターン数
  avgExpGained: number;         // 平均獲得EXP
  avgFloorsCleared: number;     // 平均クリア階層数
  avgPlayerHpRemaining: number; // 平均残りHP
  minTurns: number;             // 最小ターン数
  maxTurns: number;             // 最大ターン数
  totalRuns: number;            // 実行回数
  wins: number;                 // 勝利数
  losses: number;               // 敗北数
}
```

### SimulationResult

```typescript
interface SimulationResult {
  config: SimulationConfig;
  stats: SimulationStats;
  results: DungeonResult[];  // 全試行の詳細結果
}
```

---

## 3. 乱数生成（xorshift）

```typescript
export function createRng(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}
```

- **xorshiftアルゴリズム**で決定論的な乱数生成
- 同じシードから始めると常に同じ値列が生成される
- 再現性を確保

---

## 4. 戦闘シミュレーション

### ダメージ計算

```typescript
export function calculateDamage(atk: number, def: number): number {
  return Math.max(1, atk - def);  // 最低1ダメージ保証
}
```

### 1ターン実行

```typescript
export function executeTurn(
  playerStats: Stats,
  enemyStats: EnemyConfig,
  state: BattleState
): TurnResult {
  // ① プレイヤー先攻
  const playerDamage = calculateDamage(playerStats.atk, enemyStats.def);
  const enemyHpAfter = Math.max(0, state.enemyHp - playerDamage);

  if (enemyHpAfter <= 0) {
    return { enemyDefeated: true, ... };
  }

  // ② 敵反撃
  const enemyDamage = calculateDamage(enemyStats.atk, playerStats.def);
  const playerHpAfter = Math.max(0, state.playerHp - enemyDamage);

  return { playerDefeated: playerHpAfter <= 0, ... };
}
```

### ターン順序

```
1. プレイヤー攻撃
2. 敵HP ≤ 0？ → 敵撃破、終了
3. 敵反撃
4. プレイヤーHP ≤ 0？ → プレイヤー敗北、終了
5. 次のターンへ
```

### 1体の敵との戦闘

```typescript
export function runBattle(
  playerStats: Stats,
  playerCurrentHp: number,
  enemy: EnemyConfig
): BattleResult {
  const MAX_TURNS = 1000;  // 無限ループ防止

  while (state.turn < MAX_TURNS) {
    state.turn++;
    const result = executeTurn(playerStats, enemy, state);

    if (result.enemyDefeated) {
      return { victory: true, expGained: enemy.exp, ... };
    }
    if (result.playerDefeated) {
      return { victory: false, expGained: 0, ... };
    }
  }
}
```

### ダンジョン全体

```typescript
export function runDungeon(
  playerStats: Stats,
  dungeon: DungeonConfig,
  getEnemy: (id: string) => EnemyConfig | undefined,
  getRandomEnemyId: (enemyIds: string[]) => string
): DungeonResult {
  for (let floor = 1; floor <= dungeon.maxFloor; floor++) {
    const enemyId = getRandomEnemyId(dungeon.enemies);
    const enemy = getEnemy(enemyId);

    const battleResult = runBattle(playerStats, currentHp, enemy);

    if (!battleResult.victory) {
      return { cleared: false, floorsCleared: floor - 1, ... };
    }

    totalExp += battleResult.expGained;
    currentHp = battleResult.playerHpRemaining;
  }

  return { cleared: true, floorsCleared: dungeon.maxFloor, ... };
}
```

---

## 5. メインシミュレーション

```typescript
export function runSimulation(
  config: SimulationConfig,
  dungeonData: DungeonConfig,
  enemyData: Map<string, EnemyConfig>,
  initialSeed?: number
): SimulationResult {
  const seed = initialSeed ?? config.seed ?? Date.now();
  const rng = createRng(seed);
  const playerStats = getPlayerCombatStats(config.playerConfig);
  const results: DungeonResult[] = [];

  // 指定回数だけダンジョンをシミュレート
  for (let i = 0; i < config.runs; i++) {
    const result = runDungeon(playerStats, dungeonData, ...);
    results.push(result);
  }

  // 統計計算
  const stats = calculateSimulationStats(results);

  return { config, stats, results };
}
```

---

## 6. バランステスト

### 設定

```typescript
interface BalanceTestConfig {
  playerLevels: number[];   // 検証対象レベル [1, 2, 3, 5, 7]
  dungeonId: string;        // ダンジョンID
  runsPerLevel: number;     // 各レベルの試行回数（500回）
  seed?: number;
}
```

### 実行

```typescript
export function runBalanceTest(
  config: BalanceTestConfig,
  dungeonData: DungeonConfig,
  enemyData: Map<string, EnemyConfig>,
  createPlayerConfig: (level: number) => PlayerConfig
): BalanceTestResult {
  const levelResults = config.playerLevels.map((level) => {
    const playerConfig = createPlayerConfig(level);
    const result = runSimulation({ playerConfig, ... });
    return { level, stats: result.stats };
  });

  return { dungeonId: config.dungeonId, levelResults };
}
```

---

## 7. 統計計算

```typescript
export function calculateSimulationStats(results: DungeonResult[]): SimulationStats {
  const wins = results.filter((r) => r.cleared).length;
  const losses = results.length - wins;

  return {
    winRate: wins / results.length,
    avgTurns: totalTurns / results.length,
    avgExpGained: totalExp / results.length,
    avgFloorsCleared: totalFloorsCleared / results.length,
    avgPlayerHpRemaining: totalHpRemaining / results.length,
    minTurns: Math.min(...turns),
    maxTurns: Math.max(...turns),
    totalRuns: results.length,
    wins,
    losses,
  };
}
```

---

## 8. レポート生成

### シミュレーション結果

```typescript
export function generateSimulationReport(result: SimulationResult): string {
  return `
=== シミュレーション結果 ===
ダンジョンID: ${config.dungeonId}
プレイヤーレベル: ${config.playerConfig.level}
実行回数: ${stats.totalRuns}

--- 統計 ---
勝率: ${(stats.winRate * 100).toFixed(1)}%
勝利: ${stats.wins} / 敗北: ${stats.losses}
平均ターン数: ${stats.avgTurns.toFixed(1)}
平均獲得EXP: ${stats.avgExpGained.toFixed(1)}
`;
}
```

### バランステスト結果

```typescript
export function generateBalanceReport(result: BalanceTestResult): string {
  // テーブル形式で出力
  return `
レベル | 勝率 | 平均ターン | 平均EXP | 平均残HP
-------|------|------------|---------|--------
Lv  1 |  92% |       18.3 |      73 |     24
Lv  2 |  98% |       15.2 |      73 |     45
...
`;
}
```

---

## 9. 出力例

```
============================================================
ハクスラダンジョン シミュレーション
============================================================

【バランステスト: 始まりの草原】
レベル | 勝率 | 平均ターン | 平均EXP | 平均残HP
-------|------|------------|---------|--------
Lv  1 | 92% |       18.3 |      73 |     24
Lv  2 | 98% |       15.2 |      73 |     45
Lv  3 | 99% |       13.8 |      73 |     58
Lv  5 | 100% |       10.5 |      73 |     82
Lv  7 | 100% |        8.2 |      73 |     93

【バランステスト: 地底洞窟】
レベル | 勝率 | 平均ターン | 平均EXP | 平均残HP
-------|------|------------|---------|--------
Lv  3 | 45% |       35.2 |     115 |      8
Lv  5 | 75% |       28.5 |     115 |     32
...

============================================================
シミュレーション完了
============================================================
```

---

## 10. 敵の選択メカニズム

```typescript
// spawnRateを利用した重み付きランダム選択
enemies: dungeon.monsters.flatMap(m =>
  Array(m.spawnRate).fill(m.monsterId)
)

// 例：spawnRate が [30, 25, 20] の場合
enemies: [
  "slime", "slime", ..., "slime",      // 30個
  "wild_rabbit", ..., "wild_rabbit",   // 25個
  "goblin", ..., "goblin"              // 20個
]
// 計75個の配列から均等にランダム選択
```

---

## 11. シミュレーションとUI戦闘の違い

| 項目 | シミュレーション (core) | UI (useBattle) |
|------|----------------------|----------------|
| 実行速度 | 即座（数秒で500回） | リアルタイム（1秒/ターン） |
| UI表示 | なし | あり |
| MODエフェクト | 未対応 | 対応（毒、クリ、回復） |
| ログ | なし | 詳細ログ |
| 依存性 | なし | React, Zustand, DB |
| 用途 | バランス調整 | ゲーム画面表示 |

---

## 12. 再現性の確保

```typescript
// 同じシード値で同じ結果
const result1 = runSimulation(config, dungeonData, enemyData, 12345);
const result2 = runSimulation(config, dungeonData, enemyData, 12345);
// result1 === result2

// バランステストでは各レベルごとにシードをずらす
currentSeed += 1000;  // Lv1: 12345, Lv2: 13345, ...
```

---

## 13. 実行スクリプトの処理フロー

```
1. JSONデータ読み込み
   - monsters.json
   - dungeons.json

2. データ変換
   - UI用JSON → Core用TypeScript型

3. バランステスト実行
   - 各ダンジョン × 各レベル × 500回

4. レポート生成・表示
```

---

## 14. 仕様サマリー

| 項目 | 内容 |
|------|------|
| 目的 | ゲームバランス検証・難易度調整 |
| 実行方法 | `npm run simulation` |
| メイン処理 | `runSimulation()` |
| 戦闘ロジック | `runBattle()` → `executeTurn()` |
| 統計分析 | `calculateSimulationStats()` |
| 再現性 | xorshift RNG + シード値 |
| 出力 | テキストレポート |
| 処理速度 | 数秒で数千回のシミュレーション |

---

## 15. 関連ドキュメント

- [戦闘システム](./battle-system.md) - UI戦闘の詳細
- [ダンジョンシステム](./dungeon-system.md) - ダンジョン・敵データ
- [レベルシステム](./level-system.md) - プレイヤーステータス
