/**
 * 戦闘関連の純粋計算ロジック
 * React/DB依存なし、タイマーなし
 */

import {
  Stats,
  PassiveStats,
  EnemyConfig,
  BattleState,
  TurnResult,
  BattleResult,
  DungeonConfig,
  DungeonResult,
  FloorResult,
} from './types';

// ========================================
// PoE式ステータス計算
// ========================================

/**
 * ステータス計算: base × (1 + total_increased%) × (1 + total_more%)
 * @param base 基礎値（フラット）
 * @param increasedPct increased%の合計（加算）
 * @param moreMultipliers more%の配列（加算して合計）
 * @returns 最終値（小数点以下切り捨て）
 */
export function applyPercentageScaling(
  base: number,
  increasedPct: number,
  moreMultipliers: number[]
): number {
  // Step 1: base × (1 + total_increased%)
  let result = base * (1 + increasedPct / 100);

  // Step 2: × (1 + total_more%)  ※more%も加算
  const totalMore = moreMultipliers.reduce((sum, more) => sum + more, 0);
  result = result * (1 + totalMore / 100);

  return Math.floor(result);
}

/**
 * パッシブ効果を適用した最終ステータスを計算
 * @param baseStats 基礎ステータス（レベル+装備+フラットパッシブ）
 * @param passiveStats パッシブ効果（inc%、more%含む）
 * @returns 最終戦闘ステータス
 */
export function calculateFinalStats(
  baseStats: Stats,
  passiveStats: Pick<PassiveStats, 'hp_increased_pct' | 'atk_increased_pct' | 'def_increased_pct' | 'hp_more_pct' | 'atk_more_pct' | 'def_more_pct'>
): Stats {
  return {
    maxHp: applyPercentageScaling(
      baseStats.maxHp,
      passiveStats.hp_increased_pct,
      passiveStats.hp_more_pct
    ),
    atk: applyPercentageScaling(
      baseStats.atk,
      passiveStats.atk_increased_pct,
      passiveStats.atk_more_pct
    ),
    def: applyPercentageScaling(
      baseStats.def,
      passiveStats.def_increased_pct,
      passiveStats.def_more_pct
    ),
  };
}

// ========================================
// ダメージ計算
// ========================================

/**
 * ダメージ計算（DEF減衰式、最低1ダメージ保証）
 * DEFが高いほど1ポイントあたりの軽減効果が減少する
 * reduction = def / (def + 100)
 * - DEF 100 → 50%軽減
 * - DEF 200 → 67%軽減
 * - DEF 300 → 75%軽減
 * @param atk 攻撃力
 * @param def 防御力
 * @param additionalReduction 追加軽減率（%、MODなど）
 */
export function calculateDamage(atk: number, def: number, additionalReduction: number = 0): number {
  const defReduction = def / (def + 100);
  // DEF軽減 + 追加軽減（合計は99%まで）
  const totalReduction = Math.min(0.99, defReduction + additionalReduction / 100);
  return Math.max(1, Math.floor(atk * (1 - totalReduction)));
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
