import { useReducer, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { BattleState, BattleAction, BattleEnemy, Item, Enemy, PoisonState, DropFilterSettings, DEFAULT_DROP_FILTER, Dungeon } from '@/types';
import { getDungeon } from '@/data/dungeons';
import {
  isDimensionalRushDungeon,
  toOriginalDimensionalRushFloor,
  getDimensionalRushEnemy,
} from '@/data/endContents';
import { getRandomEnemy, getEnemy } from '@/data/enemies';
import { tryUniqueDrop, rollDropCount, rollDropItems } from '@/data/items';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAdBoostStore } from '@/stores/useAdBoostStore';
import {
  CombinedModEffects,
  combineMods,
  createBattleEngine,
  BattleEvent,
  BossSkillId,
} from '@/core';
import { settingsRepository, BattleSpeedMultiplier, DEFAULT_BATTLE_SPEED } from '@/db/repositories/settingsRepository';
import { Analytics } from '@/lib/analytics';
import {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOOR_BY_ID,
  getBaseBossId,
  DIMENSIONAL_RUSH_BOSS_IDS,
  DEBUG_DIMENSIONAL_DUNGEON_IDS,
} from '@/core/endContent';
import i18n from '@/lib/i18n';

const BOSS_SKILL_KEY = {
  goblin: {
    shield: 'bossSkills.goblin_king.shield',
    warlord: 'bossSkills.goblin_king.warlord',
  },
  bandit: {
    bearTrap: 'bossSkills.bandit_leader.bearTrap',
    nightAmbush: 'bossSkills.bandit_leader.nightAmbush',
    shadowBind: 'bossSkills.bandit_leader.shadowBind',
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
  vampire_blood_feast: BOSS_SKILL_KEY.vampire.bloodFeast,
  vampire_night_feast: BOSS_SKILL_KEY.vampire.nightFeast,
  vampire_crimson_pact: BOSS_SKILL_KEY.vampire.crimsonPact,
  kraken_tsunami: BOSS_SKILL_KEY.kraken.tsunami,
  kraken_deep_embrace: BOSS_SKILL_KEY.kraken.deepEmbrace,
  kraken_abyssal_ebb: BOSS_SKILL_KEY.kraken.abyssalEbb,
  demon_death_hand: BOSS_SKILL_KEY.demon.deathHand,
  demon_black_flame: BOSS_SKILL_KEY.demon.blackFlame,
  demon_crown: BOSS_SKILL_KEY.demon.crown,
  final_end: BOSS_SKILL_KEY.final.end,
  final_convergence: BOSS_SKILL_KEY.final.convergence,
  final_time_sever: BOSS_SKILL_KEY.final.timeSever,
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
  exp: enemy.exp,
  attackSpeed: enemy.attackSpeed ?? 1.0,
  uniqueDrop: enemy.uniqueDrop,
  uniqueDrops: enemy.uniqueDrops,
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
      return acc;
    },
    { totalWeight: 0, hp: 0, atk: 0, def: 0, exp: 0, attackSpeed: 0 }
  );

  const weight = totals.totalWeight || 1;
  return {
    ...baseMimic,
    maxHp: Math.max(1, Math.round(totals.hp / weight)),
    atk: Math.max(1, Math.round(totals.atk / weight)),
    def: Math.max(0, Math.round(totals.def / weight)),
    exp: Math.max(1, Math.round(totals.exp / weight)),
    attackSpeed: Math.max(0.1, totals.attackSpeed / weight),
  };
};

// 初期状態を作成
const createInitialState = (dungeonId: string, playerMaxHp: number): BattleState => {
  const dungeon = getDungeon(dungeonId);
  return {
    dungeonId,
    currentFloor: 1,
    maxFloor: dungeon?.maxFloor || 5,
    playerCurrentHp: playerMaxHp,
    playerMaxHp: playerMaxHp,
    enemy: null,
    enemyPoison: [],
    playerPoison: [],
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
    enemyPoison: [],
    playerPoison: [],
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
type ExtendedBattleAction = BattleAction | { type: 'RESET_DUNGEON'; playerMaxHp: number };

// リデューサー
const battleReducer = (state: ExtendedBattleState, action: ExtendedBattleAction): ExtendedBattleState => {
  switch (action.type) {
    case 'RESET_DUNGEON':
      // 周回完了時に累計を更新
      return createExtendedInitialState(
        state.dungeonId,
        action.playerMaxHp,
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
      const newPlayerHp = state.playerCurrentHp - action.damage;
      return {
        ...state,
        playerCurrentHp: Math.max(0, newPlayerHp),
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

    case 'HP_REGEN':
      const healedHp = Math.min(state.playerMaxHp, state.playerCurrentHp + action.amount);
      const actualHeal = healedHp - state.playerCurrentHp;
      if (actualHeal <= 0) return state; // 既にMAXHPなら何もしない
      return {
        ...state,
        playerCurrentHp: healedHp,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: `HP回復！ HPが${actualHeal}回復した！`,
          type: 'heal',
        }),
      };

    case 'UPDATE_GAUGES':
      return {
        ...state,
        playerGauge: action.playerGauge,
        enemyGauge: action.enemyGauge,
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
    // カテゴリフィルター
    if (!filter.categories[item.slot]) {
      return false;
    }

    // MOD数フィルター（0の場合は無効）
    if (filter.minModCount > 0 && item.mods.length < filter.minModCount) {
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

export const useBattle = (dungeonId: string) => {
  const { getTotalStats, gainExp, addToInventory, getInventorySpace, equipment, unlockedSkills, setLevelCap } = usePlayerStore();
  const stats = getTotalStats();
  const { getDropRateMultiplier, isTierBoosted, checkExpiredBoosts } = useAdBoostStore();

  // フィルター設定
  const [dropFilter, setDropFilter] = useState<DropFilterSettings>(DEFAULT_DROP_FILTER);

  // 戦闘速度設定
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);
  const battleSpeedRef = useRef<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);

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

  // 装備品+パッシブから戦闘時MOD効果を取得（coreロジック使用）
  const modEffects = useMemo((): CombinedModEffects => {
    const passiveEffects = calculatePassiveEffects(unlockedSkills);
    return combineMods(Object.values(equipment), passiveEffects);
  }, [equipment, unlockedSkills]);

  // 後方互換性のためのラッパー（将来的に直接modEffectsを使用するよう移行）
  const getCombinedModEffects = useCallback((): CombinedModEffects => {
    return modEffects;
  }, [modEffects]);

  const [state, dispatch] = useReducer(
    battleReducer,
    createExtendedInitialState(dungeonId, stats.maxHp)
  );

  const [isPaused, setIsPaused] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false); // 自動周回モード
  const isProcessingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const battleEngineRef = useRef<ReturnType<typeof createBattleEngine>['engine'] | null>(null);

  // 一時停止の切り替え
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // 自動周回の開始
  const startAutoRun = useCallback(() => {
    setIsAutoRunning(true);
    setIsPaused(false);
  }, []);

  // 自動周回の停止
  const stopAutoRun = useCallback(() => {
    setIsAutoRunning(false);
  }, []);

  const retreat = useCallback(async () => {
    setIsAutoRunning(false);
    dispatch({ type: 'RETREAT' });

    // 撤退時は経験値を付与せず、取得済みアイテムのみ持ち帰る
    const availableSpace = getInventorySpace();
    const itemsToAdd = state.droppedItems.slice(0, availableSpace);
    for (const item of itemsToAdd) {
      await addToInventory(item);
    }
  }, [addToInventory, getInventorySpace, state.droppedItems]);

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
        };
      }
      return uberBoss;
    }
    if (isDimensionalRushDungeon(dungeonId)) {
      const originalFloor = toOriginalDimensionalRushFloor(dungeonId, floor);
      return getDimensionalRushEnemy(originalFloor);
    }
    const dungeon = getDungeon(dungeonId);
    if (!dungeon) return undefined;

    // ボスフロアかチェック
    if (dungeon.boss && dungeon.boss.floor === floor) {
      return getEnemy(dungeon.boss.monsterId);
    }

    // 通常の敵をランダム選択
    const enemy = getRandomEnemy(dungeon.monsters);
    if (enemy?.id === 'mimic') {
      return buildMimicForDungeon(dungeon) ?? enemy;
    }
    return enemy;
  }, [dungeonId]);

  // 戦闘開始
  const startBattle = useCallback(() => {
    const enemy = getEnemyForFloor(1);
    if (!enemy) return;

    dispatch({ type: 'START_BATTLE', enemy: createBattleEnemy(enemy, dungeonId) });
  }, [getEnemyForFloor, dungeonId]);


  const handleDimensionalRushBossDefeat = useCallback((enemyId: string, enemyName: string) => {
    const baseBossId = getBaseBossId(enemyId);
    if (!DIMENSIONAL_RUSH_BOSS_IDS.includes(baseBossId)) return;

    void (async () => {
      await settingsRepository.unlockUberBoss(enemyId);
      dispatch({
        type: 'ADD_LOG',
        entry: {
          message: i18n.t('battleLog.uberUnlocked', { enemy: enemyName }),
          type: 'info',
        },
      });

      const ticketRoll = Math.random() * 100 < 90;
      if (ticketRoll) {
        const count = await settingsRepository.addUberTicket(enemyId);
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

    handleMimicDefeat(state.enemy.id);

    dispatch({
      type: 'ENEMY_DEFEATED',
      exp: state.enemy.exp,
      droppedItems: filteredItems,
    });

    // 異次元ラッシュまたはデバッグダンジョンでボスを倒した場合のみ Uber 版解放と入場券ドロップ
    if (isDimensionalRushDungeon(dungeonId) || DEBUG_DIMENSIONAL_DUNGEON_IDS.includes(dungeonId)) {
      handleDimensionalRushBossDefeat(state.enemy.id, state.enemy.name);
    }

    if (state.currentFloor >= state.maxFloor) {
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
  }, [state, dungeonId, dropFilter, handleDimensionalRushBossDefeat, handleMimicDefeat, getEnemyForFloor]);

  const handleBattleEvents = useCallback((events: BattleEvent[]) => {
    if (!state.enemy) return;
    for (const event of events) {
      const data = event.data as Record<string, unknown>;
      switch (event.type) {
        case 'player_attack': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'PLAYER_ATTACK', damage, isCritical: false });
          break;
        }
        case 'critical_hit': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'PLAYER_ATTACK', damage, isCritical: true });
          break;
        }
        case 'enemy_attack': {
          const damage = Number(data.damage ?? 0);
          dispatch({ type: 'ENEMY_ATTACK', damage });
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
        case 'enemy_heal': {
          const amount = Number(data.amount ?? 0);
          const source = String(data.source ?? 'regen') as 'regen' | 'on_hit';
          dispatch({ type: 'ENEMY_HEAL', amount, source });
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
  }, [state.enemy, handleEnemyDefeated]);

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
    const { engine, events } = createBattleEngine({
      playerStats: {
        maxHp: state.playerMaxHp,
        atk: playerStats.atk,
        def: playerStats.def,
      },
      playerCurrentHp: state.playerCurrentHp,
      playerMods: getCombinedModEffects(),
      enemy: {
        id: state.enemy.id,
        name: state.enemy.name,
        maxHp: state.enemy.maxHp,
        atk: state.enemy.atk,
        def: state.enemy.def,
        exp: state.enemy.exp,
        attackSpeed: state.enemy.attackSpeed,
      },
      dungeonId,
    });
    (engine as any).__key = key;
    battleEngineRef.current = engine;
    isTransitioningRef.current = false;
    if (events.length > 0) {
      handleBattleEvents(events);
    }
  }, [state.enemy?.id, state.currentFloor, state.phase, state.playerMaxHp, dungeonId, getCombinedModEffects, getTotalStats, handleBattleEvents]);

  // ゲージ制ゲームループ（33msごとに更新 = 約30fps）
  const TICK_INTERVAL = 33;
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.phase !== 'fighting' || !state.enemy || isPaused) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    gameLoopRef.current = setInterval(() => {
      if (isProcessingRef.current) return;
      const engine = battleEngineRef.current;
      if (!engine) return;

      isProcessingRef.current = true;
      const events = engine.advanceTicks(Math.max(1, Math.floor(battleSpeed)));
      if (events.length > 0) {
        handleBattleEvents(events);
      }
      const coreState = engine.getState();
      dispatch({
        type: 'UPDATE_GAUGES',
        playerGauge: Math.min(100, coreState.player.gauge),
        enemyGauge: Math.min(100, coreState.enemy.gauge),
      });
      isProcessingRef.current = false;
    }, TICK_INTERVAL);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [state.phase, state.enemy, isPaused, battleSpeed, handleBattleEvents]);

  // 戦闘終了時に経験値を付与
  useEffect(() => {
    const saveResults = async () => {
      if (state.phase === 'cleared' || state.phase === 'defeat') {
        if (state.phase === 'cleared') {
          // ダンジョンクリア記録を保存
          await settingsRepository.saveDungeonClearRecord(
            state.dungeonId,
            state.maxFloor
          );

          Analytics.logDungeonClear({
            dungeon_id: state.dungeonId,
            floors_cleared: state.currentFloor,
            max_floor: state.maxFloor,
          });

          if (state.dungeonId === 'final_land') {
            const alreadyUnlocked = await settingsRepository.getEndContentUnlocked();
            if (!alreadyUnlocked) {
              await settingsRepository.setEndContentUnlocked(true);
              setLevelCap(60);
            }
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
  }, [state.phase, state.dungeonId, state.totalExpGained, state.droppedItems, gainExp, addToInventory, getInventorySpace, setLevelCap]);

  // 自動周回処理（クリア時に次の周回を開始、敗北時は終了）
  useEffect(() => {
    if (!isAutoRunning) return;

    if (state.phase === 'defeat' || state.phase === 'retreat') {
      // 敗北時は自動周回を終了
      setIsAutoRunning(false);
      return;
    }

    if (state.phase === 'cleared') {
      // クリア時は次の周回を開始
      const timer = setTimeout(() => {
        const currentStats = getTotalStats();
        dispatch({ type: 'RESET_DUNGEON', playerMaxHp: currentStats.maxHp });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [state.phase, isAutoRunning, getTotalStats]);

  // 戦闘開始（初回マウント時 & RESET_DUNGEON後）
  useEffect(() => {
    if (!state.enemy && state.phase === 'fighting') {
      startBattle();
    }
  }, [state.enemy, state.phase, startBattle]);

  return {
    state,
    startBattle,
    isPaused,
    togglePause,
    isAutoRunning,
    startAutoRun,
    stopAutoRun,
    retreat,
  };
};
