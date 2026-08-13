import { useReducer, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { BattleState, BattleAction, BattleEnemy, Item, Enemy, PoisonState, DropFilterSettings, DEFAULT_DROP_FILTER, Dungeon } from '@/types';
import { getDungeon } from '@/data/dungeons';
import {
  isDimensionalRushDungeon,
  isDimensionalCorridorDungeon,
  toOriginalDimensionalRushFloor,
  getDimensionalRushEnemy,
  getDimensionalCorridorEnemy,
  DIMENSIONAL_CORRIDOR_ID,
  UBER_UBER_DUNGEON_IDS,
} from '@/data/endContents';
import { getRandomEnemy, getEnemy } from '@/data/enemies';
import { tryUniqueDrop, rollDropCount, rollDropItems } from '@/data/items';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAdBoostStore } from '@/stores/useAdBoostStore';
import {
  CombinedModEffects,
  calculateBattleHpAndShield,
  combineMods,
  createBattleEngine,
  BattleEvent,
  BossSkillId,
  IgniteState,
  applyPetBuff,
} from '@/core';
import { scaleEnemyHpForDungeon } from '@/core/enemyScaling';
import { getPet, getPetLevelFactor, tryPetDrop } from '@/data/pets';
import { CLASS_ABILITIES } from '@/core/player';
import { settingsRepository, BattleSpeedMultiplier, DEFAULT_BATTLE_SPEED } from '@/db/repositories/settingsRepository';
import { badgeRepository } from '@/db/repositories/badgeRepository';
import { getUberBossClearBadgeId, DIMENSIONAL_BADGE_ID, DIMENSIONAL_BADGE_FLOOR } from '@/data/badges';
import { calculateUberTreeEffects } from '@/data/uberTree';
import { Analytics } from '@/lib/analytics';
import { submitDimensionalCorridorScore, submitUberUberClearRecord } from '@/lib/ranking';
import { preloadBattleSounds, unloadBattleSounds, playBattleSound, playBattleBgm, stopBattleBgm, pauseBattleBgm, resumeBattleBgm } from '@/lib/sound';
import {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOOR_BY_ID,
  getBaseBossId,
  DIMENSIONAL_RUSH_BOSS_IDS,
  DEBUG_DIMENSIONAL_DUNGEON_IDS,
  isEndContentDungeon,
} from '@/core/endContent';
import { ENGRAVE_DEFS, ENGRAVE_DROP_CHANCE_BOSS, ENGRAVE_DROP_CHANCE_NORMAL } from '@/data/engraveMods';
import i18n from '@/lib/i18n';
import { isUniqueItem } from '@/utils/item';

const BOSS_SKILL_KEY = {
  goblin: {
    shield: 'bossSkills.goblin_king.shield',
    warlord: 'bossSkills.goblin_king.warlord',
  },
  bandit: {
    bearTrap: 'bossSkills.bandit_leader.bearTrap',
    nightAmbush: 'bossSkills.bandit_leader.nightAmbush',
    shadowBind: 'bossSkills.bandit_leader.shadowBind',
    twinStrike: 'bossSkills.bandit_leader.twinStrike',
    shadowGarrote: 'bossSkills.bandit_leader.shadowGarrote',
  },
  vampire: {
    bloodFeast: 'bossSkills.vampire.bloodFeast',
    nightFeast: 'bossSkills.vampire.nightFeast',
    crimsonPact: 'bossSkills.vampire.crimsonPact',
  },
  kraken: {
    tsunami: 'bossSkills.kraken.tsunami',
    deepEmbrace: 'bossSkills.kraken.deepEmbrace',
    abyssalEbb: 'bossSkills.kraken.abyssalEbb',
    tentacleFlurry: 'bossSkills.kraken.tentacleFlurry',
  },
  demon: {
    deathHand: 'bossSkills.demon_lord.deathHand',
    blackFlame: 'bossSkills.demon_lord.blackFlame',
    crown: 'bossSkills.demon_lord.crown',
  },
  final: {
    end: 'bossSkills.true_final_boss.end',
    convergence: 'bossSkills.true_final_boss.convergence',
    timeSever: 'bossSkills.true_final_boss.timeSever',
  },
};

const BOSS_SKILL_LABEL_BY_ID: Record<BossSkillId, string | null> = {
  goblin_shield: BOSS_SKILL_KEY.goblin.shield,
  goblin_warlord: BOSS_SKILL_KEY.goblin.warlord,
  bandit_bear_trap: BOSS_SKILL_KEY.bandit.bearTrap,
  bandit_night_ambush: BOSS_SKILL_KEY.bandit.nightAmbush,
  bandit_shadow_bind: BOSS_SKILL_KEY.bandit.shadowBind,
  bandit_twin_strike: BOSS_SKILL_KEY.bandit.twinStrike,
  bandit_shadow_garrote: BOSS_SKILL_KEY.bandit.shadowGarrote,
  vampire_blood_feast: BOSS_SKILL_KEY.vampire.bloodFeast,
  vampire_night_feast: BOSS_SKILL_KEY.vampire.nightFeast,
  vampire_crimson_pact: BOSS_SKILL_KEY.vampire.crimsonPact,
  kraken_tsunami: BOSS_SKILL_KEY.kraken.tsunami,
  kraken_deep_embrace: BOSS_SKILL_KEY.kraken.deepEmbrace,
  kraken_abyssal_ebb: BOSS_SKILL_KEY.kraken.abyssalEbb,
  kraken_tentacle_flurry: BOSS_SKILL_KEY.kraken.tentacleFlurry,
  demon_death_hand: BOSS_SKILL_KEY.demon.deathHand,
  demon_black_flame: BOSS_SKILL_KEY.demon.blackFlame,
  demon_crown: BOSS_SKILL_KEY.demon.crown,
  final_end: BOSS_SKILL_KEY.final.end,
  final_convergence: BOSS_SKILL_KEY.final.convergence,
  final_time_sever: BOSS_SKILL_KEY.final.timeSever,
  goblin_kings_slam: 'bossSkills.goblin_king.kingsSlam',
  goblin_kings_roar: 'bossSkills.goblin_king.kingsRoar',
  boss_intro: null,
};

const DEBUG_DIMENSIONAL_RUSH_FLOORS: Record<string, number> = {
  debug_dimensional_goblin_king: 50,
  debug_dimensional_bandit_leader: 70,
  debug_dimensional_vampire: 90,
  debug_dimensional_kraken: 110,
  debug_dimensional_demon_lord: 120,
  debug_dimensional_true_final_boss: 200,
};


// 敵をBattleEnemy形式に変換
const createBattleEnemy = (enemy: Enemy, dungeonId: string): BattleEnemy => ({
  id: enemy.id,
  name: i18n.t(`monsters.${enemy.id}.name`, { defaultValue: enemy.name }),
  image: enemy.image,
  currentHp: enemy.maxHp,
  maxHp: enemy.maxHp,
  atk: enemy.atk,
  def: enemy.def,
  accuracy: enemy.accuracy,
  exp: enemy.exp,
  attackSpeed: enemy.attackSpeed ?? 1.0,
  uniqueDrop: enemy.uniqueDrop,
  uniqueDrops: enemy.uniqueDrops,
  isBoss: enemy.isBoss,
});

const buildMimicForDungeon = (dungeon: Dungeon): Enemy | undefined => {
  const baseMimic = getEnemy('mimic');
  if (!baseMimic) return undefined;

  const spawns = dungeon.monsters.filter((spawn) => spawn.monsterId !== 'mimic');
  if (spawns.length === 0) return baseMimic;

  const totals = spawns.reduce(
    (acc, spawn) => {
      const enemy = getEnemy(spawn.monsterId);
      if (!enemy) return acc;
      acc.totalWeight += spawn.spawnRate;
      acc.hp += enemy.maxHp * spawn.spawnRate;
      acc.atk += enemy.atk * spawn.spawnRate;
      acc.def += enemy.def * spawn.spawnRate;
      acc.exp += enemy.exp * spawn.spawnRate;
      acc.attackSpeed += (enemy.attackSpeed ?? 1) * spawn.spawnRate;
      acc.accuracy += (enemy.accuracy ?? 100) * spawn.spawnRate;
      return acc;
    },
    { totalWeight: 0, hp: 0, atk: 0, def: 0, exp: 0, attackSpeed: 0, accuracy: 0 }
  );

  const weight = totals.totalWeight || 1;
  return {
    ...baseMimic,
    maxHp: Math.max(1, Math.round(totals.hp / weight)),
    atk: Math.max(1, Math.round(totals.atk / weight)),
    def: Math.max(0, Math.round(totals.def / weight)),
    exp: Math.max(1, Math.round(totals.exp / weight)),
    attackSpeed: Math.max(0.1, totals.attackSpeed / weight),
    accuracy: Math.max(5, Math.round(totals.accuracy / weight)),
  };
};

// 初期状態を作成
const createInitialState = (dungeonId: string, playerMaxHp: number, startFloor: number = 1, playerMaxShield: number = 0): BattleState => {
  const dungeon = getDungeon(dungeonId);
  return {
    dungeonId,
    currentFloor: startFloor,
    maxFloor: dungeon?.maxFloor || 5,
    playerCurrentHp: playerMaxHp,
    playerMaxHp: playerMaxHp,
    playerShield: playerMaxShield,
    playerMaxShield,
    enemy: null,
    enemyPoison: [],
    playerPoison: [],
    enemyIgnite: null,
    enemyChill: null,
    enemyFreeze: null,
    playerChill: null,
    playerFreeze: null,
    phase: 'fighting',
    battleLog: [],
    droppedItems: [],
    lastDroppedItems: [],
    totalExpGained: 0,
    playerGauge: 0,
    enemyGauge: 0,
  };
};

// ログIDカウンター
let logIdCounter = 0;

// battleLogの最大件数（パフォーマンス対策）
const MAX_BATTLE_LOG_SIZE = 50;

// ログ追加時に上限を超えたら古いログを削除するヘルパー
const addToLog = (currentLog: BattleState['battleLog'], newEntries: BattleState['battleLog'][number] | BattleState['battleLog']): BattleState['battleLog'] => {
  const entries = Array.isArray(newEntries) ? newEntries : [newEntries];
  const combined = [...currentLog, ...entries];
  if (combined.length > MAX_BATTLE_LOG_SIZE) {
    return combined.slice(-MAX_BATTLE_LOG_SIZE);
  }
  return combined;
};

// 周回状態を含む拡張State
interface ExtendedBattleState extends BattleState {
  runCount: number; // 周回回数
  grandTotalExp: number; // 全周回の累計経験値
  grandTotalItems: Item[]; // 全周回の累計アイテム
}

// 拡張初期状態を作成
const createExtendedInitialState = (
  dungeonId: string,
  playerMaxHp: number,
  playerMaxShield: number = 0,
  runCount: number = 1,
  grandTotalExp: number = 0,
  grandTotalItems: Item[] = [],
  startFloor: number = 1
): ExtendedBattleState => {
  const dungeon = getDungeon(dungeonId);
  return {
    dungeonId,
    currentFloor: startFloor,
    maxFloor: dungeon?.maxFloor || 5,
    playerCurrentHp: playerMaxHp,
    playerMaxHp: playerMaxHp,
    playerShield: playerMaxShield,
    playerMaxShield,
    enemy: null,
    enemyPoison: [],
    playerPoison: [],
    enemyIgnite: null,
    enemyChill: null,
    enemyFreeze: null,
    playerChill: null,
    playerFreeze: null,
    phase: 'fighting',
    battleLog: runCount > 1 ? [{
      id: logIdCounter++,
      message: i18n.t('battleLog.runStart', { count: runCount }),
      type: 'info',
    }] : [],
    droppedItems: [],
    lastDroppedItems: [],
    totalExpGained: 0,
    playerGauge: 0,
    enemyGauge: 0,
    runCount,
    grandTotalExp,
    grandTotalItems,
  };
};

// 拡張アクション型
type ExtendedBattleAction =
  | BattleAction
  | { type: 'RESET_DUNGEON'; playerMaxHp: number; playerMaxShield: number }
  | { type: 'CLEANSE_ENEMY_POISON_IGNITE' }
  | {
      type: 'SET_SCREENSHOT_BATTLE_STATE';
      enemyName: string;
      playerMaxHp: number;
      playerCurrentHp: number;
      enemyCurrentHp: number;
      playerGauge: number;
      enemyGauge: number;
      entries: Omit<BattleState['battleLog'][number], 'id'>[];
    };

// リデューサー
const battleReducer = (state: ExtendedBattleState, action: ExtendedBattleAction): ExtendedBattleState => {
  switch (action.type) {
    case 'CLEANSE_ENEMY_POISON_IGNITE':
      return {
        ...state,
        enemyPoison: [],
        enemyIgnite: null,
      };

    case 'SET_SCREENSHOT_BATTLE_STATE':
      return {
        ...state,
        playerMaxHp: action.playerMaxHp,
        playerCurrentHp: Math.max(1, Math.min(action.playerMaxHp, action.playerCurrentHp)),
        enemy: state.enemy
          ? {
              ...state.enemy,
              name: action.enemyName,
              currentHp: Math.max(1, Math.min(state.enemy.maxHp, action.enemyCurrentHp)),
            }
          : state.enemy,
        playerGauge: action.playerGauge,
        enemyGauge: action.enemyGauge,
        battleLog: action.entries.map((entry) => ({
          id: logIdCounter++,
          ...entry,
        })),
      };

    case 'RESET_DUNGEON':
      // 周回完了時に累計を更新
      return createExtendedInitialState(
        state.dungeonId,
        action.playerMaxHp,
        action.playerMaxShield,
        state.runCount + 1,
        state.grandTotalExp + state.totalExpGained,
        [...state.grandTotalItems, ...state.droppedItems]
      );

    case 'START_BATTLE':
      return {
        ...state,
        enemy: action.enemy,
        phase: 'fighting',
        lastDroppedItems: [],
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.enemyAppeared', { enemy: action.enemy.name }),
          type: 'info',
        }),
      };

    case 'PLAYER_ATTACK':
      if (!state.enemy) return state;
      const newEnemyHp = state.enemy.currentHp - action.damage;
      // ダメージ0の場合（純粋毒キーストーン）は空メッセージでログ追加（モーション用）
      const attackMessage = action.damage === 0
        ? ''
        : action.source === 'king_slam'
          ? i18n.t('battleLog.kingSlamHit', { enemy: state.enemy.name, damage: action.damage })
          : action.source === 'twin_blade'
            ? i18n.t('battleLog.twinBladeHit', { enemy: state.enemy.name, damage: action.damage })
            : action.isCritical
              ? i18n.t('battleLog.criticalHit', { enemy: state.enemy.name, damage: action.damage })
              : i18n.t('battleLog.playerAttack', { enemy: state.enemy.name, damage: action.damage });
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: Math.max(0, newEnemyHp),
        },
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: attackMessage,
          type: action.isCritical ? 'critical' : 'player_attack',
        }),
      };

    case 'ENEMY_ATTACK':
      if (action.evaded) {
        return {
          ...state,
          battleLog: addToLog(state.battleLog, {
            id: logIdCounter++,
            message: i18n.t('battleLog.evaded', { enemy: state.enemy?.name ?? '', defaultValue: '回避！' }),
            type: 'evade',
          }),
        };
      }
      if (action.blocked) {
        return {
          ...state,
          battleLog: addToLog(state.battleLog, {
            id: logIdCounter++,
            message: i18n.t('battleLog.blocked', { enemy: state.enemy?.name ?? '', defaultValue: 'ブロック！' }),
            type: 'block',
          }),
        };
      }
      const newPlayerHp = state.playerCurrentHp - action.damage;
      const newPlayerShield = action.playerShield ?? Math.max(0, state.playerShield - (action.shieldDamage ?? 0));
      return {
        ...state,
        playerCurrentHp: Math.max(0, newPlayerHp),
        playerShield: newPlayerShield,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.enemyAttack', { enemy: state.enemy?.name ?? '', damage: action.damage }),
          type: 'enemy_attack',
        }),
      };

    case 'PLAYER_DAMAGE':
      if (action.damage <= 0) return state;
      return {
        ...state,
        playerCurrentHp: Math.max(0, state.playerCurrentHp - action.damage),
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: action.message,
          type: action.logType ?? 'enemy_attack',
        }),
      };

    case 'ENEMY_HEAL':
      if (!state.enemy || action.amount <= 0) return state;
      const healMessage = action.source === 'on_hit'
        ? i18n.t('battleLog.enemyHealOnHit', { enemy: state.enemy.name, amount: action.amount })
        : i18n.t('battleLog.enemyHealRegen', { enemy: state.enemy.name, amount: action.amount });
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: Math.min(state.enemy.maxHp, state.enemy.currentHp + action.amount),
        },
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: healMessage,
          type: 'heal',
        }),
      };

    case 'ENEMY_DEFEATED':
      const defeatLogs = [
        {
          id: logIdCounter++,
          message: i18n.t('battleLog.enemyDefeated', { enemy: state.enemy?.name ?? '', exp: action.exp }),
          type: 'victory' as const,
        },
      ];
      // ドロップアイテムがあればログに追加
      for (const item of action.droppedItems) {
        defeatLogs.push({
          id: logIdCounter++,
          message: i18n.t('battleLog.itemDropped', {
            item: i18n.t(`items.${item.id}.name`, { defaultValue: item.name }),
          }),
          type: 'victory' as const,
        });
      }
      return {
        ...state,
        totalExpGained: state.totalExpGained + action.exp,
        droppedItems: [...state.droppedItems, ...action.droppedItems],
        lastDroppedItems: action.droppedItems,
        battleLog: addToLog(state.battleLog, defeatLogs),
      };

    case 'PLAYER_DEFEATED':
      return {
        ...state,
        phase: 'defeat',
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.playerDefeated'),
          type: 'defeat',
        }),
      };

    case 'RETREAT':
      return {
        ...state,
        phase: 'retreat',
      };

    case 'NEXT_FLOOR':
      return {
        ...state,
        currentFloor: state.currentFloor + 1,
        enemy: action.enemy,
        enemyPoison: [], // 次の敵には毒状態をリセット
        playerPoison: [], // 次の敵にはプレイヤー毒もリセット
        enemyIgnite: null, // 次の敵には発火状態をリセット
        enemyChill: null,  // 次の敵にはチル状態をリセット
        enemyFreeze: null, // 次の敵にはフリーズ状態をリセット
        playerChill: null,  // 次の敵にはプレイヤーチルもリセット
        playerFreeze: null, // 次の敵にはプレイヤーフリーズもリセット
        playerGauge: 0,  // ゲージリセット
        enemyGauge: 0,   // ゲージリセット
        phase: 'fighting',
        lastDroppedItems: [],
        battleLog: addToLog(state.battleLog, [
          {
            id: logIdCounter++,
            message: i18n.t('battleLog.nextFloor', { floor: state.currentFloor + 1 }),
            type: 'floor_clear' as const,
          },
          {
            id: logIdCounter++,
            message: i18n.t('battleLog.enemyAppeared', { enemy: action.enemy.name }),
            type: 'info' as const,
          },
        ]),
      };

    case 'DUNGEON_CLEARED':
      return {
        ...state,
        phase: 'cleared',
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.dungeonCleared'),
          type: 'victory',
        }),
      };

    case 'ADD_LOG':
      return {
        ...state,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          ...action.entry,
        }),
      };

    case 'APPLY_POISON':
      // 新しい毒スタックを追加
      const newPoisonStack: PoisonState = {
        damagePerTurn: action.damagePerTurn,
        remainingTurns: action.turns,
      };
      const currentStacks = state.enemyPoison.length;
      const stackText = currentStacks > 0
        ? i18n.t('battleLog.poisonStacks', { count: currentStacks + 1 })
        : '';
      return {
        ...state,
        enemyPoison: [...state.enemyPoison, newPoisonStack],
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.poisonAppliedEnemy', {
            enemy: state.enemy?.name ?? '',
            damage: action.damagePerTurn,
            turns: action.turns,
            stacks: stackText,
          }),
          type: 'poison',
        }),
      };

    case 'POISON_DAMAGE':
      if (!state.enemy || state.enemyPoison.length === 0) return state;
      const poisonedEnemyHp = Math.max(0, state.enemy.currentHp - action.damage);
      // 各スタックの残りターンを減らし、0以下になったものを除去
      const updatedPoisonStacks = state.enemyPoison
        .map(p => ({ ...p, remainingTurns: p.remainingTurns - 1 }))
        .filter(p => p.remainingTurns > 0);
      const stacksRemoved = state.enemyPoison.length - updatedPoisonStacks.length;
      const remainingText = updatedPoisonStacks.length > 0
        ? i18n.t('battleLog.poisonRemaining', { count: updatedPoisonStacks.length })
        : '';
      const endedText = updatedPoisonStacks.length > 0
        ? ''
        : i18n.t('battleLog.poisonEnded');
      const lostText = stacksRemoved > 0
        ? i18n.t('battleLog.poisonStacksLost', { count: stacksRemoved })
        : '';
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: poisonedEnemyHp,
        },
        enemyPoison: updatedPoisonStacks,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.poisonDamageEnemy', {
            enemy: state.enemy.name,
            damage: action.damage,
            remaining: remainingText,
            ended: endedText,
            lost: lostText,
          }),
          type: 'poison',
        }),
      };

    case 'APPLY_PLAYER_POISON':
      if (!state.enemy) return state;
      const newPlayerPoison: PoisonState = {
        damagePerTurn: action.damagePerTurn,
        remainingTurns: action.turns,
      };
      const currentPlayerStacks = state.playerPoison.length;
      const playerStackText = currentPlayerStacks > 0
        ? i18n.t('battleLog.poisonStacks', { count: currentPlayerStacks + 1 })
        : '';
      return {
        ...state,
        playerPoison: [...state.playerPoison, newPlayerPoison],
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.poisonAppliedPlayer', {
            damage: action.damagePerTurn,
            turns: action.turns,
            stacks: playerStackText,
          }),
          type: 'poison',
        }),
      };

    case 'PLAYER_POISON_DAMAGE':
      if (state.playerPoison.length === 0) return state;
      const poisonedPlayerHp = Math.max(0, state.playerCurrentHp - action.damage);
      const updatedPlayerStacks = state.playerPoison
        .map(p => ({ ...p, remainingTurns: p.remainingTurns - 1 }))
        .filter(p => p.remainingTurns > 0);
      const playerStacksRemoved = state.playerPoison.length - updatedPlayerStacks.length;
      const playerRemainingText = updatedPlayerStacks.length > 0
        ? i18n.t('battleLog.poisonRemaining', { count: updatedPlayerStacks.length })
        : '';
      const playerEndedText = updatedPlayerStacks.length > 0
        ? ''
        : i18n.t('battleLog.poisonEnded');
      const playerLostText = playerStacksRemoved > 0
        ? i18n.t('battleLog.poisonStacksLost', { count: playerStacksRemoved })
        : '';
      return {
        ...state,
        playerCurrentHp: poisonedPlayerHp,
        playerPoison: updatedPlayerStacks,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.poisonDamagePlayer', {
            damage: action.damage,
            remaining: playerRemainingText,
            ended: playerEndedText,
            lost: playerLostText,
          }),
          type: 'poison',
        }),
      };

    case 'APPLY_IGNITE':
      // 発火は上書き（スタックしない）
      const igniteDurationSec = Math.round(action.durationMs / 1000);
      return {
        ...state,
        enemyIgnite: {
          damage: action.damage,
          remainingMs: action.durationMs,
          tickIntervalMs: action.tickIntervalMs,
        },
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.igniteApplied', {
            enemy: state.enemy?.name ?? '',
            damage: action.damage,
            duration: igniteDurationSec,
          }),
          type: 'ignite',
        }),
      };

    case 'APPLY_IGNITE_SPREAD':
      // イグナイト伝染（前の敵から引き継いだ発火）
      const spreadDurationSec = Math.round(action.durationMs / 1000);
      return {
        ...state,
        enemyIgnite: {
          damage: action.damage,
          remainingMs: action.durationMs,
          tickIntervalMs: action.tickIntervalMs,
        },
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.igniteSpread', {
            enemy: state.enemy?.name ?? '',
            damage: action.damage,
            duration: spreadDurationSec,
          }),
          type: 'ignite',
        }),
      };

    case 'IGNITE_DAMAGE':
      if (!state.enemy || !state.enemyIgnite) return state;
      const igniteEnemyHp = Math.max(0, state.enemy.currentHp - action.damage);
      const igniteEnded = action.remainingMs <= 0;
      const igniteRemainingText = !igniteEnded
        ? i18n.t('battleLog.igniteRemaining', { seconds: Math.ceil(action.remainingMs / 1000) })
        : '';
      const igniteEndedText = igniteEnded
        ? i18n.t('battleLog.igniteEnded')
        : '';
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: igniteEnemyHp,
        },
        enemyIgnite: igniteEnded ? null : {
          ...state.enemyIgnite,
          remainingMs: action.remainingMs,
        },
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.igniteDamage', {
            enemy: state.enemy.name,
            damage: action.damage,
            remaining: igniteRemainingText,
            ended: igniteEndedText,
          }),
          type: 'ignite',
        }),
      };

    case 'HP_REGEN':
      const healedHp = Math.min(state.playerMaxHp, state.playerCurrentHp + action.amount);
      const actualHeal = healedHp - state.playerCurrentHp;
      if (actualHeal <= 0) return state; // 既にMAXHPなら何もしない
      return {
        ...state,
        playerCurrentHp: healedHp,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: i18n.t('battleLog.hpRegen', { amount: actualHeal }),
          type: 'heal',
        }),
      };

    case 'UPDATE_GAUGES':
      return {
        ...state,
        playerGauge: action.playerGauge,
        enemyGauge: action.enemyGauge,
        playerShield: action.playerShield ?? state.playerShield,
        playerMaxShield: action.playerMaxShield ?? state.playerMaxShield,
        enemyChill: action.enemyChill ?? null,
        enemyFreeze: action.enemyFreeze ?? null,
        playerChill: action.playerChill ?? null,
        playerFreeze: action.playerFreeze ?? null,
      };

    case 'RESET_PLAYER_GAUGE':
      return {
        ...state,
        playerGauge: 0,
      };

    case 'RESET_ENEMY_GAUGE':
      return {
        ...state,
        enemyGauge: 0,
      };

    default:
      return state;
  }
};

// ドロップフィルタリング関数
const filterDroppedItems = (items: Item[], filter: DropFilterSettings): Item[] => {
  return items.filter((item) => {
    const uniqueItem = isUniqueItem(item);

    // カテゴリフィルター
    if (!filter.categories[item.slot]) {
      return false;
    }

    // ユニークアイテムは MOD 数フィルターの対象外
    if (!uniqueItem && filter.minModCount > 0 && item.mods.length < filter.minModCount) {
      return false;
    }

    // MOD Tierフィルター（0の場合は無効）
    // 指定したTier以下のMODを少なくとも1つ持つアイテムのみ取得
    if (filter.maxTier > 0) {
      const hasGoodTierMod = item.mods.some((mod) => mod.tier <= filter.maxTier);
      if (!hasGoodTierMod) {
        return false;
      }
    }

    return true;
  });
};

export const useBattle = (dungeonId: string, options?: { startFloor?: number; prewarmActions?: number; staticBattle?: boolean; screenshotBattle?: boolean; screenshotLanguage?: string }) => {
  const startFloor = options?.startFloor ?? 1;
  const prewarmActions = Math.max(0, options?.prewarmActions ?? 0);
  const staticBattle = options?.staticBattle === true;
  const screenshotBattle = options?.screenshotBattle === true;
  const screenshotLanguage = options?.screenshotLanguage;
  const { getTotalStats, gainExp, addToInventory, getInventorySpace, equipment, unlockedSkills, unlockedUberSkills, characterType, characterId, pets, activePetInstanceId, petLevels, addPet } = usePlayerStore();
  const stats = getTotalStats();
  const { getDropRateMultiplier, isTierBoosted, checkExpiredBoosts } = useAdBoostStore();

  // フィルター設定
  const [dropFilter, setDropFilter] = useState<DropFilterSettings>(DEFAULT_DROP_FILTER);

  // 戦闘速度設定
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);
  const battleSpeedRef = useRef<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);
  const handleBattleEventsRef = useRef<(events: BattleEvent[]) => void>(() => {});

  // 設定の読み込み
  useEffect(() => {
    const loadSettings = async () => {
      const filter = await settingsRepository.getDropFilter();
      const speed = await settingsRepository.getBattleSpeed();
      setBattleSpeed(speed);
      battleSpeedRef.current = speed;
      setDropFilter(filter);
    };
    loadSettings();
  }, []);

  // battleSpeedの変更をrefに反映
  useEffect(() => {
    battleSpeedRef.current = battleSpeed;
  }, [battleSpeed]);

  // 装備品+パッシブ+クラス能力+Uberツリー+ペットから戦闘時MOD効果を取得（coreロジック使用）
  const modEffects = useMemo((): CombinedModEffects => {
    const passiveEffects = calculatePassiveEffects(unlockedSkills);
    const baseMods = combineMods(Object.values(equipment), passiveEffects);

    // クラス固有能力を加算
    const classAbility = CLASS_ABILITIES[characterType];

    // Uberツリー効果を加算
    const uberEffects = calculateUberTreeEffects(unlockedUberSkills);

    // アクティブペットのバフ
    const activePet = activePetInstanceId
      ? pets.find((p) => p.instanceId === activePetInstanceId)
      : undefined;
    const petBuff = activePet ? getPet(activePet.petId)?.buff : undefined;
    // 強化レベルによるバフ倍率
    const petLevelFactor = activePet ? getPetLevelFactor(petLevels[activePet.petId] ?? 1) : 1;

    const withClassUber = {
      ...baseMods,
      igniteChance: baseMods.igniteChance + (classAbility.igniteChance ?? 0) + uberEffects.ignite_chance,
      criticalChance: baseMods.criticalChance + (classAbility.criticalChance ?? 0) + uberEffects.critical_chance,
      criticalDamage: baseMods.criticalDamage + uberEffects.critical_damage,
      attackSpeedPct: baseMods.attackSpeedPct + (classAbility.attackSpeedPct ?? 0) + uberEffects.attack_speed_pct,
      attackSpeedMorePct: [...baseMods.attackSpeedMorePct, ...uberEffects.attack_speed_more_pct],
      poisonChance: baseMods.poisonChance + (classAbility.poisonChance ?? 0) + uberEffects.poison_chance,
      poisonDamagePct: baseMods.poisonDamagePct + uberEffects.poison_damage_pct,
      poisonDamageMorePct: [...baseMods.poisonDamageMorePct, ...uberEffects.poison_damage_more_pct],
      igniteDamagePct: baseMods.igniteDamagePct + uberEffects.ignite_damage_pct,
      igniteDamageMorePct: [...baseMods.igniteDamageMorePct, ...uberEffects.ignite_damage_more_pct],
      chillChance: baseMods.chillChance + (classAbility.chillChance ?? 0) + uberEffects.chill_chance,
      chillEffectPct: baseMods.chillEffectPct + uberEffects.chill_effect_pct,
      freezeChance: baseMods.freezeChance + uberEffects.freeze_chance,
      hpRegen: baseMods.hpRegen + uberEffects.hp_regen,
      hpOnHit: baseMods.hpOnHit + uberEffects.hp_on_hit,
      damageDeferPct: baseMods.damageDeferPct + uberEffects.damage_defer_pct,
      // Uberツリー最終ノード固有能力
      heavyStrike: baseMods.heavyStrike || uberEffects.heavy_strike,
      defHpToAtk: baseMods.defHpToAtk || uberEffects.def_hp_to_atk,
      uberCriticalFollowUp: baseMods.uberCriticalFollowUp || uberEffects.uber_critical_follow_up,
      poisonMultiStack: uberEffects.poison_multi_stack,
      igniteIntensify: baseMods.igniteIntensify || uberEffects.ignite_intensify,
      chillFreezeDamageMult: uberEffects.chill_freeze_damage_mult,
    };

    // ペットバフを最後に重ねる（テイマーはクラス固有能力でペット効果が倍化する／強化レベルで倍化）
    return applyPetBuff(
      withClassUber,
      petBuff,
      (classAbility.petEffectMultiplier ?? 1) *
        petLevelFactor *
        (1 + withClassUber.petEffectPct / 100)
    );
  }, [equipment, unlockedSkills, unlockedUberSkills, characterType, pets, activePetInstanceId, petLevels]);

  // 後方互換性のためのラッパー（将来的に直接modEffectsを使用するよう移行）
  const getCombinedModEffects = useCallback((): CombinedModEffects => {
    return modEffects;
  }, [modEffects]);

  const battleVitals = useMemo(
    () => calculateBattleHpAndShield(stats.maxHp, modEffects),
    [stats.maxHp, modEffects]
  );

  const [state, dispatch] = useReducer(
    battleReducer,
    createExtendedInitialState(dungeonId, battleVitals.maxHp, battleVitals.maxShield, 1, 0, [], startFloor)
  );

  const [isPaused, setIsPaused] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false); // 自動周回モード
  // UberUberクラーケン: 触手乱打の残りターン数表示用
  const [krakenFlurryCountdown, setKrakenFlurryCountdown] = useState<number | null>(null);
  const isProcessingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const isAutoRunningRef = useRef(false);
  const lastGaugeUpdateAtRef = useRef(0);
  const battleEngineRef = useRef<ReturnType<typeof createBattleEngine>['engine'] | null>(null);
  const hasPrewarmedBattleRef = useRef(false);
  const screenshotStateKeyRef = useRef('');
  // 全周回累計のペットドロップ（petId配列）。リザルト画面表示用
  const petsGainedRef = useRef<string[]>([]);
  // イグナイト伝染用: 敵撃破時の発火状態を次敵へ引き継ぐ
  const spreadIgniteRef = useRef<IgniteState | null>(null);

  // 一時停止の切り替え
  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const newPaused = !prev;
      if (newPaused) {
        pauseBattleBgm();
      } else if (!isAutoRunningRef.current) {
        resumeBattleBgm();
      }
      return newPaused;
    });
  }, []);

  // 自動周回の開始
  const startAutoRun = useCallback(() => {
    isAutoRunningRef.current = true;
    setIsAutoRunning(true);
    setIsPaused(false);
    pauseBattleBgm();
  }, []);

  // 自動周回の停止
  const stopAutoRun = useCallback(() => {
    isAutoRunningRef.current = false;
    setIsAutoRunning(false);
    if (!isPaused && state.phase === 'fighting') {
      resumeBattleBgm();
    }
  }, [isPaused, state.phase]);

  const applyScreenshotBattleState = useCallback((enemy: BattleEnemy) => {
    const fixedLanguage = screenshotLanguage && screenshotLanguage !== 'system' ? screenshotLanguage : undefined;
    const fakeT = (key: string, options: Record<string, unknown> = {}): string =>
      String(i18n.t(key, fixedLanguage ? { ...options, lng: fixedLanguage } : options));
    const enemyName = fakeT(`monsters.${enemy.id}.name`, { defaultValue: enemy.name });

    dispatch({
      type: 'SET_SCREENSHOT_BATTLE_STATE',
      enemyName,
      playerMaxHp: 5279,
      playerCurrentHp: 5279,
      enemyCurrentHp: Math.floor(enemy.maxHp * 0.62),
      playerGauge: 64,
      enemyGauge: 38,
      entries: [
        { message: fakeT('battleLog.enemyAppeared', { enemy: enemyName }), type: 'info' },
        {
          message: fakeT('battleLog.bossSkillActivated', {
            enemy: enemyName,
            skill: fakeT('bossSkills.goblin_king.shield'),
          }),
          type: 'info',
        },
        {
          message: fakeT('battleLog.bossSkillActivated', {
            enemy: enemyName,
            skill: fakeT('bossSkills.goblin_king.warlord'),
          }),
          type: 'info',
        },
        { message: fakeT('battleLog.playerAttack', { enemy: enemyName, damage: 1184 }), type: 'player_attack' },
        { message: fakeT('battleLog.enemyAttack', { enemy: enemyName, damage: 312 }), type: 'enemy_attack' },
        { message: fakeT('battleLog.criticalHit', { enemy: enemyName, damage: 2210 }), type: 'critical' },
        { message: fakeT('battleLog.blocked', { enemy: enemyName, defaultValue: 'ブロック！' }), type: 'block' },
        { message: fakeT('battleLog.playerAttack', { enemy: enemyName, damage: 1268 }), type: 'player_attack' },
        { message: fakeT('battleLog.enemyAttack', { enemy: enemyName, damage: 287 }), type: 'enemy_attack' },
        { message: fakeT('battleLog.kingSlamHit', { enemy: enemyName, damage: 1836 }), type: 'player_attack' },
        { message: fakeT('battleLog.blocked', { enemy: enemyName, defaultValue: 'ブロック！' }), type: 'block' },
        { message: fakeT('battleLog.criticalHit', { enemy: enemyName, damage: 2384 }), type: 'critical' },
        { message: fakeT('battleLog.enemyAttack', { enemy: enemyName, damage: 329 }), type: 'enemy_attack' },
        { message: fakeT('battleLog.playerAttack', { enemy: enemyName, damage: 1312 }), type: 'player_attack' },
        { message: fakeT('battleLog.enemyAttack', { enemy: enemyName, damage: 301 }), type: 'enemy_attack' },
      ],
    });
  }, [screenshotLanguage]);

  const retreat = useCallback(async () => {
    isAutoRunningRef.current = false;
    setIsAutoRunning(false);
    dispatch({ type: 'RETREAT' });

    // BGMを停止
    stopBattleBgm();

    // 次元回廊の場合はランキングスコアを送信
    if (isDimensionalCorridorDungeon(dungeonId)) {
      await submitDimensionalCorridorScore(state.currentFloor);
    }

    // 撤退時は経験値を付与せず、取得済みアイテムのみ持ち帰る
    const availableSpace = getInventorySpace();
    const itemsToAdd = state.droppedItems.slice(0, availableSpace);
    for (const item of itemsToAdd) {
      await addToInventory(item);
    }
  }, [addToInventory, getInventorySpace, state.droppedItems, dungeonId, state.currentFloor]);

  // 指定フロアの敵を取得（ボスフロアならボスを返す）
  const getEnemyForFloor = useCallback((floor: number): Enemy | undefined => {
    const debugFloor = DEBUG_DIMENSIONAL_RUSH_FLOORS[dungeonId];
    if (debugFloor) {
      return getDimensionalRushEnemy(debugFloor);
    }
    if (Object.prototype.hasOwnProperty.call(BASE_BOSS_BY_UBER, dungeonId)) {
      const baseBossId = BASE_BOSS_BY_UBER[dungeonId];
      const bossFloor = DIMENSIONAL_RUSH_BOSS_FLOOR_BY_ID[baseBossId];
      const drBoss = bossFloor ? getDimensionalRushEnemy(bossFloor) : undefined;
      const uberBoss = getEnemy(dungeonId);
      if (drBoss && uberBoss) {
        return {
          ...uberBoss,
          maxHp: Math.max(1, Math.floor(drBoss.maxHp * 1.2)),
          atk: Math.max(1, Math.floor(drBoss.atk * 1.2)),
          def: Math.max(0, Math.floor(drBoss.def * 1.2)),
          exp: Math.max(1, Math.floor(drBoss.exp * 1.2)),
          attackSpeed: Math.max(0.1, Number(((drBoss.attackSpeed ?? 1) * 1.2).toFixed(2))),
          accuracy: Math.max(5, Math.round((drBoss.accuracy ?? uberBoss.accuracy ?? 100) * 1.02)),
        };
      }
      return uberBoss;
    }
    if (isDimensionalRushDungeon(dungeonId)) {
      const originalFloor = toOriginalDimensionalRushFloor(dungeonId, floor);
      return getDimensionalRushEnemy(originalFloor);
    }
    // 次元回廊
    if (isDimensionalCorridorDungeon(dungeonId)) {
      return getDimensionalCorridorEnemy(floor);
    }
    const dungeon = getDungeon(dungeonId);
    if (!dungeon) return undefined;

    // ボスフロアかチェック
    if (dungeon.boss && dungeon.boss.floor === floor) {
      const boss = getEnemy(dungeon.boss.monsterId);
      return boss ? scaleEnemyHpForDungeon(boss, dungeon) : undefined;
    }

    // 通常の敵をランダム選択
    const enemy = getRandomEnemy(dungeon.monsters);
    if (enemy?.id === 'mimic') {
      const mimic = buildMimicForDungeon(dungeon) ?? enemy;
      return scaleEnemyHpForDungeon(mimic, dungeon);
    }
    return enemy ? scaleEnemyHpForDungeon(enemy, dungeon) : undefined;
  }, [dungeonId]);

  // 戦闘開始
  const startBattle = useCallback(() => {
    const enemy = getEnemyForFloor(startFloor);
    if (!enemy) return;

    // イグナイト伝染状態をリセット（新しいダンジョン開始）
    spreadIgniteRef.current = null;
    dispatch({ type: 'START_BATTLE', enemy: createBattleEnemy(enemy, dungeonId) });

    // BGM再生開始
    if (!isAutoRunningRef.current && !staticBattle) {
      playBattleBgm();
    }
  }, [getEnemyForFloor, dungeonId, startFloor, staticBattle]);


  const handleDimensionalRushBossDefeat = useCallback((enemyId: string, enemyName: string) => {
    const baseBossId = getBaseBossId(enemyId);
    if (!DIMENSIONAL_RUSH_BOSS_IDS.includes(baseBossId)) return;

    void (async () => {
      const season = usePlayerStore.getState().season;
      await settingsRepository.unlockUberBoss(enemyId, season);
      dispatch({
        type: 'ADD_LOG',
        entry: {
          message: i18n.t('battleLog.uberUnlocked', { enemy: enemyName }),
          type: 'info',
        },
      });

      const ticketRoll = Math.random() * 100 < 95;
      if (ticketRoll) {
        const count = await settingsRepository.addUberTicket(enemyId, 1, season);
        dispatch({
          type: 'ADD_LOG',
          entry: {
            message: i18n.t('battleLog.uberTicket', { count }),
            type: 'victory',
          },
        });
      }
    })();
  }, []);

  const handleMimicDefeat = useCallback((enemyId: string) => {
    if (enemyId !== 'mimic') return;
    void (async () => {
      const count = await settingsRepository.addRespecTokens(1);
      dispatch({
        type: 'ADD_LOG',
        entry: {
          message: i18n.t('battleLog.respecToken', { count }),
          type: 'victory',
        },
      });
    })();
  }, []);

  const handleEnemyDefeated = useCallback(() => {
    if (!state.enemy) return;

    // 広告ブースト効果を取得
    checkExpiredBoosts(); // 期限切れチェック
    const { uniqueBonus, dropRateMultiplier } = getDropRateMultiplier();
    const tierBoosted = isTierBoosted();

    const dungeon = getDungeon(dungeonId);
    const droppedItems: Item[] = [];

    if (state.enemy.uniqueDrops && state.enemy.uniqueDrops.length > 0) {
      for (const drop of state.enemy.uniqueDrops) {
        const uniqueItem = tryUniqueDrop(drop.itemId, drop.dropRate, uniqueBonus);
        if (uniqueItem) {
          droppedItems.push(uniqueItem);
        }
      }
    } else if (state.enemy.uniqueDrop) {
      const uniqueItem = tryUniqueDrop(
        state.enemy.uniqueDrop.itemId,
        state.enemy.uniqueDrop.dropRate,
        uniqueBonus
      );
      if (uniqueItem) {
        droppedItems.push(uniqueItem);
      }
    }

    if (dungeon) {
      const dropCount = rollDropCount(dropRateMultiplier);
      const normalDrops = rollDropItems(dungeon.dropTable, dropCount, state.dungeonId, tierBoosted);
      droppedItems.push(...normalDrops);
    }

    const filteredItems = filterDroppedItems(droppedItems, dropFilter);

    // ペットドロップ判定（独自の枠で容量管理、装備インベントリには影響しない）
    // クラス固有能力（テイマーのペットドロップ率+%）をボーナスとして加算
    const petDropBonus = (CLASS_ABILITIES[characterType].petDropRatePct ?? 0) +
      getCombinedModEffects().petDropRatePct;
    const droppedPetId = tryPetDrop(state.enemy.id, petDropBonus);
    if (droppedPetId) {
      const droppedDef = getPet(droppedPetId);
      const petName = droppedDef
        ? i18n.t(`monsters.${droppedDef.sourceMonsterId}.name`, { defaultValue: droppedDef.sourceMonsterId })
        : droppedPetId;
      void (async () => {
        const added = await addPet(droppedPetId);
        if (added) {
          petsGainedRef.current = [...petsGainedRef.current, droppedPetId];
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: i18n.t('battleLog.petDrop', { name: petName }),
              type: 'victory',
            },
          });
        } else {
          // 枠満杯で取得できなかった
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: i18n.t('battleLog.petDropFull', { name: petName }),
              type: 'info',
            },
          });
        }
      })();
    }

    // 刻印ドロップ（終焉以降のエンドコンテンツのみ・ボスは確定、通常敵は低確率）
    const engraveChance = state.enemy.isBoss
      ? ENGRAVE_DROP_CHANCE_BOSS
      : ENGRAVE_DROP_CHANCE_NORMAL;
    if (isEndContentDungeon(state.dungeonId) && Math.random() < engraveChance) {
      const def = ENGRAVE_DEFS[Math.floor(Math.random() * ENGRAVE_DEFS.length)];
      const engraveName = i18n.t(`engrave.mods.${def.id}`, { defaultValue: def.id });
      void (async () => {
        await settingsRepository.addEngraveStone(def.id);
        dispatch({
          type: 'ADD_LOG',
          entry: {
            message: i18n.t('battleLog.engraveDrop', { name: engraveName }),
            type: 'victory',
          },
        });
      })();
    }

    handleMimicDefeat(state.enemy.id);

    // イグナイト伝染: 発火状態を次の敵に引き継ぐ
    const finalIgniteState = battleEngineRef.current?.getState().enemyIgniteState;
    const mods = getCombinedModEffects();
    if (mods.igniteSpread && finalIgniteState) {
      spreadIgniteRef.current = {
        damage: finalIgniteState.damage,
        remainingMs: finalIgniteState.remainingMs,
        tickIntervalMs: finalIgniteState.tickIntervalMs,
        lastTickMs: 0, // 新しい敵に対してはリセット
      };
    } else {
      spreadIgniteRef.current = null;
    }

    dispatch({
      type: 'ENEMY_DEFEATED',
      exp: state.enemy.exp,
      droppedItems: filteredItems,
    });

    // 異次元ラッシュ、次元回廊、またはデバッグダンジョンでボスを倒した場合 Uber 版解放と入場券ドロップ
    if (isDimensionalRushDungeon(dungeonId) || isDimensionalCorridorDungeon(dungeonId) || DEBUG_DIMENSIONAL_DUNGEON_IDS.includes(dungeonId)) {
      handleDimensionalRushBossDefeat(state.enemy.id, state.enemy.name);
    }

    // 無制限階層（maxFloor=-1）は永遠に続く
    if (state.maxFloor > 0 && state.currentFloor >= state.maxFloor) {
      dispatch({ type: 'DUNGEON_CLEARED' });
      return;
    }

    const nextFloor = state.currentFloor + 1;
    const nextEnemy = getEnemyForFloor(nextFloor);
    if (!nextEnemy) {
      return;
    }

    // 遷移モードを有効化（戦闘エンジンがHP回復のみ継続）
    battleEngineRef.current?.setTransitioning(true);
    const transitionDelay = 500 / battleSpeedRef.current;
    setTimeout(() => {
      dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy, dungeonId) });
      // 新しい敵が出現したら遷移モードを解除
      battleEngineRef.current?.setTransitioning(false);
    }, transitionDelay);
  }, [state, dungeonId, dropFilter, handleDimensionalRushBossDefeat, handleMimicDefeat, getEnemyForFloor, getCombinedModEffects, addPet, characterType]);

  const handleBattleEvents = useCallback((events: BattleEvent[]) => {
    if (!state.enemy) return;
    for (const event of events) {
      const data = event.data as Record<string, unknown>;
      switch (event.type) {
        case 'player_attack': {
          const damage = Number(data.damage ?? 0);
          const rawSource = typeof data.source === 'string' ? data.source : undefined;
          const source = rawSource === 'king_slam' || rawSource === 'twin_blade' ? rawSource : undefined;
          dispatch({ type: 'PLAYER_ATTACK', damage, isCritical: false, source });
          if (!isAutoRunningRef.current) {
            playBattleSound('player_attack', characterType);
          }
          break;
        }
        case 'critical_hit': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'PLAYER_ATTACK', damage, isCritical: true });
          if (!isAutoRunningRef.current) {
            playBattleSound('player_attack', characterType);
          }
          break;
        }
        case 'enemy_attack': {
          const damage = Number(data.damage ?? 0);
          const shieldDamage = Number(data.shieldDamage ?? 0);
          const blocked = data.blocked === true;
          const evaded = data.evaded === true;
          const playerShield = typeof data.playerShield === 'number' ? data.playerShield : undefined;
          dispatch({ type: 'ENEMY_ATTACK', damage, shieldDamage, blocked, evaded, playerShield });
          if (!isAutoRunningRef.current && !blocked && !evaded) {
            playBattleSound('enemy_attack');
          }
          break;
        }
        case 'poison_applied': {
          const damagePerTurn = Number(data.damage ?? 0);
          const turns = Number(data.duration ?? 0);
          dispatch({ type: 'APPLY_POISON', damagePerTurn, turns });
          break;
        }
        case 'poison_damage': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'POISON_DAMAGE', damage });
          break;
        }
        case 'player_poison_applied': {
          const damagePerTurn = Number(data.damagePerTurn ?? 0);
          const turns = Number(data.turns ?? 0);
          dispatch({ type: 'APPLY_PLAYER_POISON', damagePerTurn, turns });
          break;
        }
        case 'player_poison_damage': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'PLAYER_POISON_DAMAGE', damage });
          break;
        }
        case 'hp_regen':
        case 'lifesteal': {
          const amount = Number(data.amount ?? 0);
          dispatch({ type: 'HP_REGEN', amount });
          break;
        }
        case 'ignite_applied': {
          const damage = Number(data.damage ?? 0);
          const durationMs = Number(data.durationMs ?? 0);
          const tickIntervalMs = Number(data.tickIntervalMs ?? 1000);
          dispatch({ type: 'APPLY_IGNITE', damage, durationMs, tickIntervalMs });
          break;
        }
        case 'ignite_spread': {
          const damage = Number(data.damage ?? 0);
          const durationMs = Number(data.durationMs ?? 0);
          const tickIntervalMs = Number(data.tickIntervalMs ?? 1000);
          dispatch({ type: 'APPLY_IGNITE_SPREAD', damage, durationMs, tickIntervalMs });
          break;
        }
        case 'ignite_damage': {
          const damage = Number(data.damage ?? 0);
          const remainingMs = Number(data.remainingMs ?? 0);
          dispatch({ type: 'IGNITE_DAMAGE', damage, remainingMs });
          break;
        }
        case 'enemy_heal': {
          const amount = Number(data.amount ?? 0);
          const source = String(data.source ?? 'regen') as 'regen' | 'on_hit';
          dispatch({ type: 'ENEMY_HEAL', amount, source });
          break;
        }
        case 'player_heal': {
          const source = typeof data.source === 'string' ? data.source : '';
          if (source === 'royal_roar') {
            dispatch({
              type: 'ADD_LOG',
              entry: {
                message: i18n.t('battleLog.royalRoar'),
                type: 'info',
              },
            });
          }
          break;
        }
        case 'player_damage': {
          const damage = Number(data.damage ?? 0);
          if (damage > 0) {
            dispatch({
              type: 'PLAYER_DAMAGE',
              damage,
              message: i18n.t('battleLog.reflectedDamage', { enemy: state.enemy.name, damage }),
              logType: 'enemy_attack',
            });
          }
          break;
        }
        case 'deferred_damage': {
          const damage = Number(data.damage ?? 0);
          if (damage > 0) {
            dispatch({
              type: 'PLAYER_DAMAGE',
              damage,
              message: i18n.t('battleLog.deferredDamage', { damage }),
              logType: 'enemy_attack',
            });
          }
          break;
        }
        case 'boss_intro': {
          const skillName = typeof data.skillName === 'string' ? data.skillName : null;
          if (skillName) {
            dispatch({
              type: 'ADD_LOG',
              entry: {
                message: i18n.t('battleLog.bossSkillUsed', { enemy: state.enemy.name, skill: skillName }),
                type: 'info',
              },
            });
          }
          break;
        }
        case 'boss_skill': {
          const skillId = String(data.skillId ?? '') as BossSkillId;
          const skillKey = BOSS_SKILL_LABEL_BY_ID[skillId] ?? null;
          if (skillKey) {
            dispatch({
              type: 'ADD_LOG',
              entry: {
                message: i18n.t('battleLog.bossSkillActivated', { enemy: state.enemy.name, skill: i18n.t(skillKey) }),
                type: 'info',
              },
            });
          }
          // 王の咆哮: 毒・発火状態をUIにも反映
          if (skillId === 'goblin_kings_roar') {
            dispatch({ type: 'CLEANSE_ENEMY_POISON_IGNITE' });
          }
          break;
        }
        case 'chill_applied': {
          const targetIsPlayer = (event.data as { target?: string }).target === 'player';
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: targetIsPlayer
                ? i18n.t('battleLog.chillAppliedPlayer')
                : i18n.t('battleLog.chillApplied', { enemy: state.enemy.name }),
              type: 'chill',
            },
          });
          break;
        }
        case 'chill_expired': {
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: i18n.t('battleLog.chillExpired', { enemy: state.enemy.name }),
              type: 'chill',
            },
          });
          break;
        }
        case 'freeze_applied': {
          const targetIsPlayer = (event.data as { target?: string }).target === 'player';
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: targetIsPlayer
                ? i18n.t('battleLog.freezeAppliedPlayer')
                : i18n.t('battleLog.freezeApplied', { enemy: state.enemy.name }),
              type: 'freeze',
            },
          });
          break;
        }
        case 'freeze_expired': {
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: i18n.t('battleLog.freezeExpired', { enemy: state.enemy.name }),
              type: 'freeze',
            },
          });
          break;
        }
        case 'warlord_enrage': {
          dispatch({
            type: 'ADD_LOG',
            entry: {
              message: i18n.t('battleLog.warlordEnrage'),
              type: 'info',
            },
          });
          break;
        }
        case 'retaliate': {
          const damage = Number(data.damage ?? 0);
          if (damage > 0) {
            dispatch({ type: 'PLAYER_ATTACK', damage, isCritical: false });
            dispatch({
              type: 'ADD_LOG',
              entry: {
                message: i18n.t('battleLog.retaliateDamage', { enemy: state.enemy.name, damage }),
                type: 'player_attack',
              },
            });
          }
          break;
        }
        case 'reset_player_gauge': {
          dispatch({ type: 'RESET_PLAYER_GAUGE' });
          break;
        }
        case 'enemy_defeated': {
          handleEnemyDefeated();
          break;
        }
        case 'player_defeated': {
          dispatch({ type: 'PLAYER_DEFEATED' });
          break;
        }
        default:
          break;
      }
    }
  }, [state.enemy, handleEnemyDefeated, characterType]);

  useEffect(() => {
    handleBattleEventsRef.current = handleBattleEvents;
  }, [handleBattleEvents]);

  const activeEnemyId = state.enemy?.id ?? null;

  // ボス戦エンジン初期化（敵切り替え時のみ）
  useEffect(() => {
    if (!state.enemy || state.phase !== 'fighting') {
      battleEngineRef.current = null;
      return;
    }
    const key = `${state.enemy.id}:${state.currentFloor}`;
    if ((battleEngineRef.current as any)?.__key === key) {
      return;
    }
    const playerStats = getTotalStats();
    const mods = getCombinedModEffects();
    const { engine, events } = createBattleEngine({
      playerStats: {
        maxHp: playerStats.maxHp,
        atk: playerStats.atk,
        def: playerStats.def,
      },
      playerCurrentHp: state.playerCurrentHp,
      playerMods: mods,
      enemy: {
        id: state.enemy.id,
        name: state.enemy.name,
        maxHp: state.enemy.maxHp,
        atk: state.enemy.atk,
        def: state.enemy.def,
        exp: state.enemy.exp,
        attackSpeed: state.enemy.attackSpeed,
        accuracy: state.enemy.accuracy,
      },
      dungeonId,
      // イグナイト伝染: 前の敵から引き継いだ発火状態を適用
      initialIgniteState: mods.igniteSpread ? spreadIgniteRef.current : null,
    });
    (engine as any).__key = key;
    battleEngineRef.current = engine;
    isTransitioningRef.current = false;
    if (events.length > 0 && !screenshotBattle) {
      handleBattleEventsRef.current(events);
    }
    if (screenshotBattle && !hasPrewarmedBattleRef.current) {
      hasPrewarmedBattleRef.current = true;
      screenshotStateKeyRef.current = `${state.enemy.id}:${screenshotLanguage ?? ''}`;
      applyScreenshotBattleState(state.enemy);
    } else if (prewarmActions > 0 && !hasPrewarmedBattleRef.current) {
      hasPrewarmedBattleRef.current = true;
      let actionCount = 0;
      let iterations = 0;
      const maxIterations = 3000;
      while (actionCount < prewarmActions && iterations < maxIterations) {
        iterations++;
        const prewarmEvents = engine.advanceTicks(1);
        if (prewarmEvents.length === 0) continue;

        actionCount += prewarmEvents.filter((event) =>
          event.type === 'player_attack' ||
          event.type === 'critical_hit' ||
          event.type === 'enemy_attack'
        ).length;
        handleBattleEventsRef.current(prewarmEvents);

        if (prewarmEvents.some((event) => event.type === 'enemy_defeated' || event.type === 'player_defeated')) {
          break;
        }
      }

      const coreState = engine.getState();
      dispatch({
        type: 'UPDATE_GAUGES',
        playerGauge: Math.min(100, coreState.player.gauge),
        enemyGauge: Math.min(100, coreState.enemy.gauge),
        playerShield: coreState.playerShield,
        playerMaxShield: coreState.playerMaxShield,
        enemyChill: coreState.enemyChillState,
        enemyFreeze: coreState.enemyFreezeState,
        playerChill: coreState.playerChillState,
        playerFreeze: coreState.playerFreezeState,
      });
    }
  }, [state.enemy, state.currentFloor, state.phase, state.playerMaxHp, state.playerCurrentHp, dungeonId, prewarmActions, screenshotBattle, screenshotLanguage, applyScreenshotBattleState, getCombinedModEffects, getTotalStats]);

  useEffect(() => {
    if (!screenshotBattle || !state.enemy) {
      return;
    }

    const key = `${state.enemy.id}:${screenshotLanguage ?? ''}`;
    if (screenshotStateKeyRef.current === key) {
      return;
    }

    screenshotStateKeyRef.current = key;
    applyScreenshotBattleState(state.enemy);
  }, [screenshotBattle, screenshotLanguage, state.enemy, applyScreenshotBattleState]);

  // ゲージ制ゲームループ（戦闘計算は約30fps、UI反映は必要分だけ間引く）
  const TICK_INTERVAL = 33;
  const ACTIVE_GAUGE_UPDATE_INTERVAL = 66;
  const AUTO_RUN_GAUGE_UPDATE_INTERVAL = 500;
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.phase !== 'fighting' || !activeEnemyId || isPaused || staticBattle) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    const enemyId = activeEnemyId;
    gameLoopRef.current = setInterval(() => {
      if (isProcessingRef.current) return;
      const engine = battleEngineRef.current;
      if (!engine) return;

      isProcessingRef.current = true;
      try {
        const events = engine.advanceTicks(Math.max(1, Math.floor(battleSpeedRef.current)));
        if (events.length > 0) {
          handleBattleEventsRef.current(events);
        }
        const coreState = engine.getState();
        const now = Date.now();
        const gaugeUpdateInterval = isAutoRunning
          ? AUTO_RUN_GAUGE_UPDATE_INTERVAL
          : ACTIVE_GAUGE_UPDATE_INTERVAL;
        if (now - lastGaugeUpdateAtRef.current >= gaugeUpdateInterval) {
          lastGaugeUpdateAtRef.current = now;
          dispatch({
            type: 'UPDATE_GAUGES',
            playerGauge: Math.min(100, coreState.player.gauge),
            enemyGauge: Math.min(100, coreState.enemy.gauge),
            playerShield: coreState.playerShield,
            playerMaxShield: coreState.playerMaxShield,
            enemyChill: coreState.enemyChillState,
            enemyFreeze: coreState.enemyFreezeState,
            playerChill: coreState.playerChillState,
            playerFreeze: coreState.playerFreezeState,
          });
        }
        // UberUberクラーケンの触手乱打カウントダウン更新
        const bossEffects = engine.getBossEffects();
        if (enemyId === 'uber_uber_kraken') {
          const remaining = Math.max(0, 10 - bossEffects.krakenFlurryCounter);
          setKrakenFlurryCountdown((prev) => (prev === remaining ? prev : remaining));
        } else {
          setKrakenFlurryCountdown((prev) => (prev === null ? prev : null));
        }
      } finally {
        isProcessingRef.current = false;
      }
    }, TICK_INTERVAL);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [state.phase, activeEnemyId, isPaused, isAutoRunning, staticBattle]);

  // 戦闘終了時に経験値を付与
  useEffect(() => {
    const saveResults = async () => {
      if (state.phase === 'cleared' || state.phase === 'defeat') {
        // BGMを停止
        stopBattleBgm();

        if (state.phase === 'cleared') {
          // ダンジョンクリア記録を保存
          const season = usePlayerStore.getState().season;
          await settingsRepository.saveDungeonClearRecord(
            state.dungeonId,
            state.maxFloor,
            season
          );

          Analytics.logDungeonClear({
            dungeon_id: state.dungeonId,
            floors_cleared: state.currentFloor,
            max_floor: state.maxFloor,
          });

          if (state.dungeonId === 'final_land') {
            const alreadyUnlocked = await settingsRepository.getEndContentUnlocked(season);
            if (!alreadyUnlocked) {
              await settingsRepository.setEndContentUnlocked(true, season);
            }
          }

          // Uberボスクリアバッジ付与
          const uberBadgeId = getUberBossClearBadgeId(state.dungeonId);
          if (uberBadgeId && characterId) {
            const newlyAwarded = await badgeRepository.awardBadge(characterId, uberBadgeId);
            // UberUberボスを「そのキャラで初めて」クリアしたときだけ Firestore に記録
            // （バッジは1キャラ1回のみ付与されるため newlyAwarded が初回クリアの判定になる）
            if (newlyAwarded && UBER_UBER_DUNGEON_IDS.includes(state.dungeonId)) {
              await submitUberUberClearRecord(state.dungeonId);
            }
          }
        }

        // 次元回廊で敗北した場合はランキングスコアを送信 & バッジチェック
        if (isDimensionalCorridorDungeon(state.dungeonId)) {
          if (state.phase === 'defeat') {
            await submitDimensionalCorridorScore(state.currentFloor);
          }
          // 次元回廊4000階バッジ（クリア/敗北問わず到達フロアで判定）
          if (state.currentFloor >= DIMENSIONAL_BADGE_FLOOR && characterId) {
            await badgeRepository.awardBadge(characterId, DIMENSIONAL_BADGE_ID);
          }
        }

        if (state.totalExpGained > 0) {
          await gainExp(state.totalExpGained);
        }
        // ドロップアイテムをインベントリに追加（空き枠分のみ）
        const availableSpace = getInventorySpace();
        const itemsToAdd = state.droppedItems.slice(0, availableSpace);

        for (const item of itemsToAdd) {
          await addToInventory(item);
        }
      }
    };
    saveResults();
  }, [state.phase, state.dungeonId, state.totalExpGained, state.droppedItems, state.currentFloor, gainExp, addToInventory, getInventorySpace]);

  // 自動周回処理（クリア時に次の周回を開始、敗北時は終了）
  useEffect(() => {
    if (!isAutoRunning) return;

    if (state.phase === 'defeat' || state.phase === 'retreat') {
      // 敗北時は自動周回を終了
      isAutoRunningRef.current = false;
      setIsAutoRunning(false);
      return;
    }

    if (state.phase === 'cleared') {
      // クリア時は次の周回を開始
      const timer = setTimeout(() => {
        const currentStats = getTotalStats();
        const currentMods = getCombinedModEffects();
        const currentVitals = calculateBattleHpAndShield(currentStats.maxHp, currentMods);
        // イグナイト伝染状態をリセット（新しい周回開始）
        spreadIgniteRef.current = null;
        dispatch({ type: 'RESET_DUNGEON', playerMaxHp: currentVitals.maxHp, playerMaxShield: currentVitals.maxShield });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [state.phase, isAutoRunning, getTotalStats, getCombinedModEffects]);

  // 戦闘SE のプリロード/アンロード & 戦闘開始
  const [soundsReady, setSoundsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await preloadBattleSounds(characterType);
      if (mounted) {
        setSoundsReady(true);
      }
    };
    init();
    return () => {
      mounted = false;
      unloadBattleSounds();
    };
  }, [characterType]);

  // 戦闘開始（プリロード完了後）
  useEffect(() => {
    if (soundsReady && !state.enemy && state.phase === 'fighting') {
      startBattle();
    }
  }, [soundsReady, state.enemy, state.phase, startBattle]);

  // 戦闘速度の変更
  const changeBattleSpeed = useCallback(async (newSpeed: BattleSpeedMultiplier) => {
    setBattleSpeed(newSpeed);
    battleSpeedRef.current = newSpeed;
    await settingsRepository.setBattleSpeed(newSpeed);
  }, []);

  const getPetsGained = useCallback((): string[] => petsGainedRef.current.slice(), []);

  return {
    state,
    startBattle,
    isPaused,
    togglePause,
    isAutoRunning,
    startAutoRun,
    stopAutoRun,
    retreat,
    battleSpeed,
    changeBattleSpeed,
    krakenFlurryCountdown,
    getPetsGained,
    blockChance: screenshotBattle ? 20 : Math.min(50, Math.max(0, modEffects.blockChance)),
    evasion: Math.max(0, modEffects.evasion),
  };
};
