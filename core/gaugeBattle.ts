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
  DEFAULT_BATTLE_CONFIG,
} from './types';
import { getAttackSpeedFromMods } from './modEffects';
import {
  executePlayerAttack,
  tryApplyPoison,
  processPoisonDamage,
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
  createHpRegenEvent,
  createLifestealEvent,
  createEnemyAttackEvent,
} from './combatEffects';
import { calculateDamage } from './battle';

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
 * 1体の敵との戦闘を完了まで実行
 * @param playerStats プレイヤーの基本ステータス
 * @param playerCurrentHp プレイヤーの現在HP
 * @param playerMods プレイヤーのMOD効果
 * @param enemy 敵の設定
 * @param config 戦闘設定
 * @param rng 乱数生成関数
 * @returns 戦闘結果
 */
export function runGaugeBattle(
  playerStats: Stats,
  playerCurrentHp: number,
  playerMods: CombinedModEffects,
  enemy: EnemyConfig,
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): GaugeBattleResult {
  let state = createGaugeBattleStateWithHp(
    playerStats,
    playerCurrentHp,
    playerMods,
    enemy,
    config
  );

  const events: BattleEvent[] = [];
  const MAX_TICKS = 30000; // タイムアウト（約1000秒）

  // HP回復用カウンター（ticksPerSecondティック = 1秒ごと）
  let regenCounter = 0;

  while (!state.isFinished && state.elapsedTicks < MAX_TICKS) {
    // 次のアクションまでのティック数を計算
    const playerTicksToAction = getTicksToAction(
      state.player.gauge,
      state.player.attackSpeed,
      config
    );
    const enemyTicksToAction = getTicksToAction(
      state.enemy.gauge,
      state.enemy.attackSpeed,
      config
    );

    // 先に行動する方のティック数（最低1ティック進める）
    const ticksElapsed = Math.max(1, Math.floor(Math.min(playerTicksToAction, enemyTicksToAction)));

    // ゲージ更新
    const playerGaugeIncrease = getGaugeIncreasePerTick(state.player.attackSpeed, config) * ticksElapsed;
    const enemyGaugeIncrease = getGaugeIncreasePerTick(state.enemy.attackSpeed, config) * ticksElapsed;

    state = {
      ...state,
      player: {
        ...state.player,
        gauge: Math.min(100, state.player.gauge + playerGaugeIncrease),
      },
      enemy: {
        ...state.enemy,
        gauge: Math.min(100, state.enemy.gauge + enemyGaugeIncrease),
      },
      elapsedTicks: state.elapsedTicks + ticksElapsed,
    };

    // HP回復処理（1秒ごと）
    regenCounter += ticksElapsed;
    while (regenCounter >= config.ticksPerSecond) {
      regenCounter -= config.ticksPerSecond;
      const regenAmount = calculateHpRegen(
        state.player.currentHp,
        state.player.maxHp,
        playerMods
      );
      if (regenAmount > 0) {
        state = {
          ...state,
          player: {
            ...state.player,
            currentHp: Math.min(state.player.maxHp, state.player.currentHp + regenAmount),
          },
        };
        const regenEvent = createHpRegenEvent(state.elapsedTicks, regenAmount);
        if (regenEvent) events.push(regenEvent);
      }
    }

    // プレイヤー行動
    if (state.player.gauge >= 100) {
      // 毒ダメージ処理（プレイヤー行動時）
      if (state.enemyPoisonStacks.length > 0) {
        const poisonResult = processPoisonDamage(state, state.elapsedTicks);
        state = {
          ...state,
          enemy: {
            ...state.enemy,
            currentHp: Math.max(0, state.enemy.currentHp - poisonResult.totalDamage),
          },
          enemyPoisonStacks: poisonResult.updatedStacks,
        };
        events.push(...poisonResult.events);

        // 毒で敵撃破チェック
        if (state.enemy.currentHp <= 0) {
          state = { ...state, isFinished: true, winner: 'player' };
          events.push({
            type: 'enemy_defeated',
            tick: state.elapsedTicks,
            data: { byPoison: true },
          });
          break;
        }
      }

      // プレイヤー攻撃
      const attackResult = executePlayerAttack(
        state,
        state.player.atk,
        playerMods,
        config,
        rng
      );
      events.push(...attackResult.events);

      // ダメージ適用
      state = {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: Math.max(0, state.enemy.currentHp - attackResult.damage),
        },
        player: {
          ...state.player,
          gauge: 0, // ゲージリセット
        },
      };

      // ライフスティール処理
      if (attackResult.damage > 0 && state.player.currentHp < state.player.maxHp) {
        const lifestealAmount = calculateLifesteal(
          attackResult.damage,
          attackResult.isCritical,
          playerMods
        );
        if (lifestealAmount > 0) {
          state = {
            ...state,
            player: {
              ...state.player,
              currentHp: Math.min(
                state.player.maxHp,
                state.player.currentHp + lifestealAmount
              ),
            },
          };
          const lifestealEvent = createLifestealEvent(state.elapsedTicks, lifestealAmount);
          if (lifestealEvent) events.push(lifestealEvent);
        }
      }

      // 毒付与試行
      const baseDamage = calculateDamage(state.player.atk, state.enemy.def);
      const poisonResult = tryApplyPoison(state, baseDamage, playerMods, config, rng);
      if (poisonResult.poisonStack) {
        state = {
          ...state,
          enemyPoisonStacks: [...state.enemyPoisonStacks, poisonResult.poisonStack],
        };
        if (poisonResult.event) events.push(poisonResult.event);
      }

      // 敵撃破チェック
      if (state.enemy.currentHp <= 0) {
        state = { ...state, isFinished: true, winner: 'player' };
        events.push({
          type: 'enemy_defeated',
          tick: state.elapsedTicks,
          data: { byPoison: false },
        });
        break;
      }
    }

    // 敵行動
    if (state.enemy.gauge >= 100) {
      const damage = calculateEnemyDamage(
        state.enemy.atk,
        state.player.def,
        playerMods,
        state.enemyPoisonStacks.length > 0
      );

      state = {
        ...state,
        player: {
          ...state.player,
          currentHp: Math.max(0, state.player.currentHp - damage),
        },
        enemy: {
          ...state.enemy,
          gauge: 0, // ゲージリセット
        },
      };

      events.push(createEnemyAttackEvent(state.elapsedTicks, damage));

      // プレイヤー撃破チェック
      if (state.player.currentHp <= 0) {
        state = { ...state, isFinished: true, winner: 'enemy' };
        events.push({
          type: 'player_defeated',
          tick: state.elapsedTicks,
          data: {},
        });
        break;
      }
    }
  }

  return {
    victory: state.winner === 'player',
    totalTicks: state.elapsedTicks,
    playerHpRemaining: state.player.currentHp,
    expGained: state.winner === 'player' ? enemy.exp : 0,
    events,
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
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
  rng: () => number = Math.random
): GaugeDungeonResult {
  let currentHp = playerStats.maxHp;
  let totalExp = 0;
  let totalTicks = 0;
  const floorResults: GaugeFloorResult[] = [];
  const allEvents: BattleEvent[] = [];

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
    const battleResult = runGaugeBattle(
      playerStats,
      currentHp,
      playerMods,
      enemy,
      config,
      rng
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

    // 勝利
    totalExp += battleResult.expGained;
    currentHp = battleResult.playerHpRemaining;
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
