/**
 * ゲージ制戦闘エンジン
 * ATB風のゲージ制戦闘をシミュレート
 */

import {
  Stats,
  CombinedModEffects,
  GaugeCombatant,
  GaugeBattleState,
  GaugeBattleResult,
  GaugeDungeonResult,
  GaugeFloorResult,
  BattleEvent,
  BattleConfig,
  DungeonConfig,
  EnemyConfig,
  IgniteState,
  DEFAULT_BATTLE_CONFIG,
} from './types';
import { getAttackSpeedFromMods } from './modEffects';
import { createBattleEngine, runBattleEngineToEnd } from './battleEngine';

// ========================================
// 初期化
// ========================================

/**
 * ゲージ制戦闘の初期状態を作成
 * @param playerStats プレイヤーの基本ステータス
 * @param playerMods プレイヤーのMOD効果
 * @param enemy 敵の設定
 * @param config 戦闘設定
 * @returns 初期戦闘状態
 */
export function createGaugeBattleState(
  playerStats: Stats,
  playerMods: CombinedModEffects,
  enemy: EnemyConfig,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): GaugeBattleState {
  const playerAS = getAttackSpeedFromMods(playerMods);
  const enemyAS = 1.0; // 敵の攻撃速度はEnemyConfigから取得する場合は拡張

  const player: GaugeCombatant = {
    currentHp: playerStats.maxHp,
    maxHp: playerStats.maxHp,
    atk: playerStats.atk,
    def: playerStats.def,
    attackSpeed: playerAS,
    gauge: 0,
  };

  const enemyCombatant: GaugeCombatant = {
    currentHp: enemy.maxHp,
    maxHp: enemy.maxHp,
    atk: enemy.atk,
    def: enemy.def,
    attackSpeed: enemyAS,
    gauge: 0,
  };

  return {
    player,
    enemy: enemyCombatant,
    enemyPoisonStacks: [],
    playerPoisonStacks: [],
    enemyIgniteState: null,
    igniteApplyCount: 0,
    elapsedTicks: 0,
    isFinished: false,
    winner: null,
  };
}

/**
 * 現在HPを指定して戦闘状態を作成（ダンジョン継続用）
 */
export function createGaugeBattleStateWithHp(
  playerStats: Stats,
  playerCurrentHp: number,
  playerMods: CombinedModEffects,
  enemy: EnemyConfig,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): GaugeBattleState {
  const state = createGaugeBattleState(playerStats, playerMods, enemy, config);
  return {
    ...state,
    player: {
      ...state.player,
      currentHp: playerCurrentHp,
    },
  };
}

// ========================================
// ゲージ計算
// ========================================

/**
 * 1ティックあたりのゲージ増加量を計算
 */
function getGaugeIncreasePerTick(
  attackSpeed: number,
  config: BattleConfig
): number {
  return (attackSpeed * config.baseGaugePerSecond) / config.ticksPerSecond;
}

/**
 * ゲージが100に達するまでのティック数を計算
 */
function getTicksToAction(
  currentGauge: number,
  attackSpeed: number,
  config: BattleConfig
): number {
  const gaugeNeeded = 100 - currentGauge;
  const gaugePerTick = getGaugeIncreasePerTick(attackSpeed, config);
  return gaugeNeeded / gaugePerTick;
}

// ========================================
// 1体の敵との戦闘
// ========================================

/**
 * 1体の敵との戦闘結果（発火状態を含む）
 */
export interface GaugeBattleResultWithIgnite extends GaugeBattleResult {
  finalIgniteState: IgniteState | null;  // 戦闘終了時の敵の発火状態（伝染用）
}

/**
 * 1体の敵との戦闘を完了まで実行
 * @param playerStats プレイヤーの基本ステータス
 * @param playerCurrentHp プレイヤーの現在HP
 * @param playerMods プレイヤーのMOD効果
 * @param enemy 敵の設定
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @param dungeonId ダンジョンID
 * @param initialIgniteState 初期発火状態（イグナイト伝染用）
 * @returns 戦闘結果
 */
export function runGaugeBattle(
  playerStats: Stats,
  playerCurrentHp: number,
  playerMods: CombinedModEffects,
  enemy: EnemyConfig,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random,
  dungeonId?: string,
  initialIgniteState?: IgniteState | null
): GaugeBattleResultWithIgnite {
  const MAX_TICKS = 30000;
  const { engine, events: introEvents } = createBattleEngine({
    playerStats,
    playerCurrentHp,
    playerMods,
    enemy,
    config,
    rng,
    dungeonId,
    initialIgniteState,
  });
  const result = runBattleEngineToEnd(engine, enemy.exp, MAX_TICKS);
  const finalState = engine.getState();
  return {
    ...result,
    events: [...introEvents, ...result.events],
    finalIgniteState: finalState.enemyIgniteState,
  };
}

// ========================================
// ダンジョン全体のシミュレーション
// ========================================

/**
 * ダンジョン全体をゲージ制でシミュレート
 * @param playerStats プレイヤーの基本ステータス
 * @param playerMods プレイヤーのMOD効果
 * @param dungeon ダンジョン設定
 * @param getEnemy 敵IDから敵設定を取得する関数
 * @param getRandomEnemyId ランダムな敵IDを取得する関数
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @returns ダンジョン結果
 */
export function runGaugeDungeon(
  playerStats: Stats,
  playerMods: CombinedModEffects,
  dungeon: DungeonConfig,
  getEnemy: (id: string) => EnemyConfig | undefined,
  getRandomEnemyId: (enemyIds: string[]) => string,
  resolveEnemyForFloor?: (floor: number, rng: () => number) => EnemyConfig | undefined,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): GaugeDungeonResult {
  let currentHp = playerStats.maxHp;
  let totalExp = 0;
  let totalTicks = 0;
  const floorResults: GaugeFloorResult[] = [];
  const allEvents: BattleEvent[] = [];

  // イグナイト伝染用: 前の敵から引き継ぐ発火状態
  let spreadIgniteState: IgniteState | null = null;

  for (let floor = 1; floor <= dungeon.maxFloor; floor++) {
    // ボス階層かどうかチェック
    const enemyFromResolver = resolveEnemyForFloor
      ? resolveEnemyForFloor(floor, rng)
      : undefined;
    const isBossFloor = dungeon.boss && dungeon.boss.floor === floor;
    const enemyId = isBossFloor
      ? dungeon.boss!.monsterId
      : getRandomEnemyId(dungeon.enemies);
    const enemy = enemyFromResolver ?? getEnemy(enemyId);

    if (!enemy) {
      // 敵が見つからない場合はスキップ（エラー状態）
      continue;
    }

    // イグナイト伝染: igniteSpread が有効で、前の敵から発火状態を引き継ぐ場合
    const initialIgniteForThisBattle = playerMods.igniteSpread ? spreadIgniteState : null;

    // 戦闘実行
    const battleResult = runGaugeBattle(
      playerStats,
      currentHp,
      playerMods,
      enemy,
      config,
      rng,
      dungeon.id,
      initialIgniteForThisBattle
    );

    floorResults.push({
      floor,
      enemyId,
      battle: battleResult,
    });

    totalTicks += battleResult.totalTicks;
    allEvents.push(...battleResult.events);

    if (!battleResult.victory) {
      // 敗北
      return {
        dungeonId: dungeon.id,
        cleared: false,
        floorsCleared: floor - 1,
        maxFloor: dungeon.maxFloor,
        totalExp,
        totalTicks,
        playerHpRemaining: 0,
        floorResults,
        events: allEvents,
      };
    }

    // 勝利: イグナイト伝染のために発火状態を保持
    // 敵が発火状態で死んだ場合、次の敵に伝染する
    if (playerMods.igniteSpread && battleResult.finalIgniteState) {
      // 発火状態をリセット（新しい敵に対して初期化）
      spreadIgniteState = {
        damage: battleResult.finalIgniteState.damage,
        remainingMs: battleResult.finalIgniteState.remainingMs,
        tickIntervalMs: battleResult.finalIgniteState.tickIntervalMs,
        lastTickMs: 0,  // 新しい敵に対してはリセット
      };
    } else {
      spreadIgniteState = null;
    }

    // 勝利
    totalExp += battleResult.expGained;
    currentHp = battleResult.playerHpRemaining;

    // 次の階層がある場合、遷移時間（500ms = 5 ticks）分のHP回復を反映
    if (floor < dungeon.maxFloor) {
      const transitionTicks = Math.floor((config.ticksPerSecond * 500) / 1000);
      const { engine } = createBattleEngine({
        playerStats,
        playerCurrentHp: currentHp,
        playerMods,
        enemy: { ...enemy, maxHp: 1, atk: 0, def: 0, exp: 0 }, // ダミー敵
        config,
        rng,
        dungeonId: dungeon.id,
      });
      engine.setTransitioning(true);
      const transitionEvents = engine.advanceTicks(transitionTicks);
      currentHp = engine.getState().player.currentHp;
      totalTicks += transitionTicks;
      allEvents.push(...transitionEvents);
    }
  }

  // ダンジョンクリア
  return {
    dungeonId: dungeon.id,
    cleared: true,
    floorsCleared: dungeon.maxFloor,
    maxFloor: dungeon.maxFloor,
    totalExp,
    totalTicks,
    playerHpRemaining: currentHp,
    floorResults,
    events: allEvents,
  };
}

// ========================================
// ユーティリティ
// ========================================

/**
 * ティック数を秒に変換
 */
export function ticksToSeconds(
  ticks: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): number {
  return ticks / config.ticksPerSecond;
}

/**
 * 戦闘時間を人間が読みやすい形式に変換
 */
export function formatBattleTime(
  ticks: number,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG
): string {
  const seconds = ticksToSeconds(ticks, config);
  if (seconds < 60) {
    return `${seconds.toFixed(1)}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds.toFixed(0)}秒`;
}
