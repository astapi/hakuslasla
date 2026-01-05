/**
 * 戦闘関連の純粋計算ロジック
 * React/DB依存なし、タイマーなし
 */

import {
  Stats,
  EnemyConfig,
  BattleState,
  TurnResult,
  BattleResult,
  DungeonConfig,
  DungeonResult,
  FloorResult,
} from './types';

// ========================================
// ダメージ計算
// ========================================

/**
 * ダメージ計算（最低1ダメージ保証）
 */
export function calculateDamage(atk: number, def: number): number {
  return Math.max(1, atk - def);
}

// ========================================
// 1ターン実行
// ========================================

/**
 * 1ターンを実行し結果を返す
 * プレイヤー先攻、敵後攻
 */
export function executeTurn(
  playerStats: Stats,
  enemyStats: EnemyConfig,
  state: BattleState
): TurnResult {
  // プレイヤーの攻撃
  const playerDamage = calculateDamage(playerStats.atk, enemyStats.def);
  const enemyHpAfter = Math.max(0, state.enemyHp - playerDamage);
  const enemyDefeated = enemyHpAfter <= 0;

  // 敵が倒れた場合、敵の攻撃はない
  if (enemyDefeated) {
    return {
      playerDamageDealt: playerDamage,
      enemyDamageDealt: 0,
      playerHpAfter: state.playerHp,
      enemyHpAfter: 0,
      enemyDefeated: true,
      playerDefeated: false,
    };
  }

  // 敵の攻撃
  const enemyDamage = calculateDamage(enemyStats.atk, playerStats.def);
  const playerHpAfter = Math.max(0, state.playerHp - enemyDamage);
  const playerDefeated = playerHpAfter <= 0;

  return {
    playerDamageDealt: playerDamage,
    enemyDamageDealt: enemyDamage,
    playerHpAfter,
    enemyHpAfter,
    enemyDefeated: false,
    playerDefeated,
  };
}

// ========================================
// 戦闘シミュレーション
// ========================================

/**
 * 1体の敵との戦闘を最後まで実行
 */
export function runBattle(
  playerStats: Stats,
  playerCurrentHp: number,
  enemy: EnemyConfig
): BattleResult {
  let state: BattleState = {
    playerHp: playerCurrentHp,
    playerMaxHp: playerStats.maxHp,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    turn: 0,
  };

  const MAX_TURNS = 1000; // 無限ループ防止

  while (state.turn < MAX_TURNS) {
    state.turn++;

    const result = executeTurn(playerStats, enemy, state);

    state = {
      ...state,
      playerHp: result.playerHpAfter,
      enemyHp: result.enemyHpAfter,
    };

    if (result.enemyDefeated) {
      return {
        victory: true,
        turns: state.turn,
        expGained: enemy.exp,
        playerHpRemaining: state.playerHp,
      };
    }

    if (result.playerDefeated) {
      return {
        victory: false,
        turns: state.turn,
        expGained: 0,
        playerHpRemaining: 0,
      };
    }
  }

  // タイムアウト（通常到達しない）
  return {
    victory: false,
    turns: MAX_TURNS,
    expGained: 0,
    playerHpRemaining: state.playerHp,
  };
}

// ========================================
// ダンジョンシミュレーション
// ========================================

/**
 * ダンジョン全体をシミュレート
 * @param playerStats プレイヤーの戦闘ステータス
 * @param dungeon ダンジョン設定
 * @param getEnemy 敵IDから敵設定を取得する関数
 * @param getRandomEnemyId ランダムな敵IDを取得する関数
 * @param getDropItem ドロップアイテムを決定する関数（undefined = ドロップなし）
 */
export function runDungeon(
  playerStats: Stats,
  dungeon: DungeonConfig,
  getEnemy: (id: string) => EnemyConfig | undefined,
  getRandomEnemyId: (enemyIds: string[]) => string,
  getDropItem?: (dropTable: string[]) => string | undefined
): DungeonResult {
  let currentHp = playerStats.maxHp;
  let totalExp = 0;
  let totalTurns = 0;
  const floorResults: FloorResult[] = [];
  const droppedItems: string[] = [];

  for (let floor = 1; floor <= dungeon.maxFloor; floor++) {
    // ボス階層かどうかチェック
    const isBossFloor = dungeon.boss && dungeon.boss.floor === floor;
    const enemyId = isBossFloor
      ? dungeon.boss!.monsterId
      : getRandomEnemyId(dungeon.enemies);
    const enemy = getEnemy(enemyId);

    if (!enemy) {
      // 敵が見つからない場合はスキップ（エラー状態）
      continue;
    }

    // 戦闘実行
    const battleResult = runBattle(playerStats, currentHp, enemy);

    floorResults.push({
      floor,
      enemyId,
      battle: battleResult,
    });

    totalTurns += battleResult.turns;

    if (!battleResult.victory) {
      // 敗北
      return {
        dungeonId: dungeon.id,
        cleared: false,
        floorsCleared: floor - 1,
        maxFloor: dungeon.maxFloor,
        totalExp,
        totalTurns,
        playerHpRemaining: 0,
        floorResults,
        droppedItems,
      };
    }

    // 勝利
    totalExp += battleResult.expGained;
    currentHp = battleResult.playerHpRemaining;
  }

  // ダンジョンクリア時のドロップ
  if (getDropItem) {
    const item = getDropItem(dungeon.dropTable);
    if (item) {
      droppedItems.push(item);
    }
  }

  return {
    dungeonId: dungeon.id,
    cleared: true,
    floorsCleared: dungeon.maxFloor,
    maxFloor: dungeon.maxFloor,
    totalExp,
    totalTurns,
    playerHpRemaining: currentHp,
    floorResults,
    droppedItems,
  };
}

// ========================================
// ユーティリティ
// ========================================

/**
 * 戦闘前の勝率を概算（簡易計算）
 */
export function estimateWinChance(
  playerStats: Stats,
  enemy: EnemyConfig
): number {
  const playerDps = calculateDamage(playerStats.atk, enemy.def);
  const enemyDps = calculateDamage(enemy.atk, playerStats.def);

  const turnsToKillEnemy = Math.ceil(enemy.maxHp / playerDps);
  const turnsToKillPlayer = Math.ceil(playerStats.maxHp / enemyDps);

  if (turnsToKillEnemy <= turnsToKillPlayer) {
    // プレイヤー有利
    const margin = turnsToKillPlayer - turnsToKillEnemy;
    return Math.min(1, 0.5 + margin * 0.1);
  } else {
    // 敵有利
    const margin = turnsToKillEnemy - turnsToKillPlayer;
    return Math.max(0, 0.5 - margin * 0.1);
  }
}
