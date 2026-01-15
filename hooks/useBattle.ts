import { useReducer, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { BattleState, BattleAction, BattleEnemy, Item, Enemy, PoisonState, DropFilterSettings, DEFAULT_DROP_FILTER } from '@/types';
import { getDungeon } from '@/data/dungeons';
import { getRandomEnemy, getEnemy } from '@/data/enemies';
import { tryUniqueDrop, rollDropCount, rollDropItems, ModEffects } from '@/data/items';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { usePlayerStore } from '@/stores/usePlayerStore';
import {
  calculateDamage,
  CombinedModEffects,
  combineMods,
  getAttackSpeedFromMods,
  getPoisonDamageFromMods,
  DEFAULT_BATTLE_CONFIG,
  // Core関数（戦闘効果）
  processPoisonDamage,
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
  GaugeBattleState,
  PoisonStack,
} from '@/core';
import { settingsRepository, BattleSpeedMultiplier, DEFAULT_BATTLE_SPEED } from '@/db/repositories/settingsRepository';

// Core設定の定数を使用
const POISON_DAMAGE_RATIO = DEFAULT_BATTLE_CONFIG.poisonDamageRatio;
const POISON_DURATION = DEFAULT_BATTLE_CONFIG.poisonDuration;
const BASE_POISON_MAX_STACKS = DEFAULT_BATTLE_CONFIG.basePoisonMaxStacks;

// UIの状態からCore関数用のGaugeBattleState形式に変換するヘルパー
const createCoreStateForPoisonDamage = (
  playerCurrentHp: number,
  playerMaxHp: number,
  enemyCurrentHp: number,
  enemyMaxHp: number,
  enemyPoison: PoisonState[],
  elapsedTicks: number = 0
): GaugeBattleState => ({
  player: {
    currentHp: playerCurrentHp,
    maxHp: playerMaxHp,
    atk: 0, // 毒ダメージ計算には不要
    def: 0,
    attackSpeed: 1,
    gauge: 0,
  },
  enemy: {
    currentHp: enemyCurrentHp,
    maxHp: enemyMaxHp,
    atk: 0,
    def: 0,
    attackSpeed: 1,
    gauge: 0,
  },
  // PoisonState[] → PoisonStack[] の変換
  enemyPoisonStacks: enemyPoison.map(p => ({
    damagePerTick: p.damagePerTurn,
    remainingTicks: p.remainingTurns,
  })),
  elapsedTicks,
  isFinished: false,
  winner: null,
});

// 敵をBattleEnemy形式に変換
const createBattleEnemy = (enemy: Enemy): BattleEnemy => ({
  id: enemy.id,
  name: enemy.name,
  image: enemy.image,
  currentHp: enemy.maxHp,
  maxHp: enemy.maxHp,
  atk: enemy.atk,
  def: enemy.def,
  exp: enemy.exp,
  attackSpeed: enemy.attackSpeed ?? 1.0, // デフォルト1.0
  uniqueDrop: enemy.uniqueDrop,
});

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
    phase: 'fighting',
    battleLog: [],
    droppedItems: [],
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
    phase: 'fighting',
    battleLog: runCount > 1 ? [{
      id: logIdCounter++,
      message: `=== ${runCount}周目開始 ===`,
      type: 'info',
    }] : [],
    droppedItems: [],
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
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: `${action.enemy.name}が現れた！`,
          type: 'info',
        }),
      };

    case 'PLAYER_ATTACK':
      if (!state.enemy) return state;
      const newEnemyHp = state.enemy.currentHp - action.damage;
      const attackMessage = action.isCritical
        ? `クリティカルヒット！ ${state.enemy.name}に${action.damage}ダメージ！`
        : `プレイヤーの攻撃！ ${state.enemy.name}に${action.damage}ダメージ！`;
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
          message: `${state.enemy?.name}の攻撃！ ${action.damage}ダメージを受けた！`,
          type: 'enemy_attack',
        }),
      };

    case 'ENEMY_DEFEATED':
      const defeatLogs = [
        {
          id: logIdCounter++,
          message: `${state.enemy?.name}を倒した！ 経験値${action.exp}を獲得！`,
          type: 'victory' as const,
        },
      ];
      // ドロップアイテムがあればログに追加
      for (const item of action.droppedItems) {
        defeatLogs.push({
          id: logIdCounter++,
          message: `${item.name}をドロップした！`,
          type: 'victory' as const,
        });
      }
      return {
        ...state,
        totalExpGained: state.totalExpGained + action.exp,
        droppedItems: [...state.droppedItems, ...action.droppedItems],
        battleLog: addToLog(state.battleLog, defeatLogs),
      };

    case 'PLAYER_DEFEATED':
      return {
        ...state,
        phase: 'defeat',
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: 'プレイヤーは倒れた...',
          type: 'defeat',
        }),
      };

    case 'NEXT_FLOOR':
      return {
        ...state,
        currentFloor: state.currentFloor + 1,
        enemy: action.enemy,
        enemyPoison: [], // 次の敵には毒状態をリセット
        playerGauge: 0,  // ゲージリセット
        enemyGauge: 0,   // ゲージリセット
        phase: 'fighting',
        battleLog: addToLog(state.battleLog, [
          {
            id: logIdCounter++,
            message: `--- ${state.currentFloor + 1}階へ進む ---`,
            type: 'floor_clear' as const,
          },
          {
            id: logIdCounter++,
            message: `${action.enemy.name}が現れた！`,
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
          message: 'ダンジョンを踏破した！',
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
      return {
        ...state,
        enemyPoison: [...state.enemyPoison, newPoisonStack],
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: `${state.enemy?.name}に毒を付与した！（${action.damagePerTurn}ダメージ x ${action.turns}ターン）${currentStacks > 0 ? ` [${currentStacks + 1}スタック]` : ''}`,
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
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: poisonedEnemyHp,
        },
        enemyPoison: updatedPoisonStacks,
        battleLog: addToLog(state.battleLog, {
          id: logIdCounter++,
          message: `毒ダメージ！ ${state.enemy.name}に${action.damage}ダメージ！${updatedPoisonStacks.length > 0 ? `（${updatedPoisonStacks.length}スタック継続）` : '（毒が切れた）'}${stacksRemoved > 0 ? `（${stacksRemoved}スタック消失）` : ''}`,
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
  const { getTotalStats, gainExp, addToInventory, getInventorySpace, equipment, unlockedSkills } = usePlayerStore();
  const stats = getTotalStats();

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // executeTurnとexecuteEnemyAttackをrefで保持（ゲームループの依存配列から外すため）
  const executeTurnRef = useRef<() => void>(() => {});
  const executeEnemyAttackRef = useRef<() => void>(() => {});

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

  // 指定フロアの敵を取得（ボスフロアならボスを返す）
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

  // 戦闘開始
  const startBattle = useCallback(() => {
    const enemy = getEnemyForFloor(1);
    if (!enemy) return;

    dispatch({ type: 'START_BATTLE', enemy: createBattleEnemy(enemy) });
  }, [getEnemyForFloor]);

  // 毒ダメージを計算（coreロジック使用）
  const calculatePoisonDamageLocal = useCallback((baseDamage: number, mods: CombinedModEffects): number => {
    return getPoisonDamageFromMods(baseDamage, mods);
  }, []);

  // プレイヤーの攻撃実行（ゲージ100%時に呼ばれる）
  const executeTurn = useCallback(() => {
    if (state.phase !== 'fighting' || !state.enemy || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const stats = getTotalStats();
    const dungeon = getDungeon(dungeonId);
    const modEffects = getCombinedModEffects();

    // HP回復は別タイマーで処理するため削除

    // 毒ダメージ処理（敵に毒が付与されている場合）- Core関数使用
    let currentEnemyHp = state.enemy.currentHp;
    if (state.enemyPoison.length > 0) {
      // Core関数用の状態を作成
      const coreState = createCoreStateForPoisonDamage(
        state.playerCurrentHp,
        state.playerMaxHp,
        state.enemy.currentHp,
        state.enemy.maxHp,
        state.enemyPoison
      );

      // Core関数で毒ダメージ処理
      const poisonResult = processPoisonDamage(coreState, 0, modEffects);

      dispatch({ type: 'POISON_DAMAGE', damage: poisonResult.totalDamage });
      currentEnemyHp -= poisonResult.totalDamage;

      // 毒ダメージ吸収による回復（poison_lifesteal）- Core関数の結果を使用
      if (poisonResult.healAmount > 0 && state.playerCurrentHp < state.playerMaxHp) {
        dispatch({ type: 'HP_REGEN', amount: poisonResult.healAmount });
      }
      // 毒で倒れた場合
      if (currentEnemyHp <= 0) {
        // ドロップアイテム収集
        const droppedItems: Item[] = [];

        // 1. ユニークドロップ判定（モンスター固有）
        if (state.enemy.uniqueDrop) {
          const uniqueItem = tryUniqueDrop(
            state.enemy.uniqueDrop.itemId,
            state.enemy.uniqueDrop.dropRate
          );
          if (uniqueItem) {
            droppedItems.push(uniqueItem);
          }
        }

        // 2. 通常ドロップ判定（ドロップテーブルから）
        if (dungeon) {
          const dropCount = rollDropCount();
          const normalDrops = rollDropItems(dungeon.dropTable, dropCount, state.dungeonId);
          droppedItems.push(...normalDrops);
        }

        // フィルタリングを適用
        const filteredItems = filterDroppedItems(droppedItems, dropFilter);

        dispatch({
          type: 'ENEMY_DEFEATED',
          exp: state.enemy.exp,
          droppedItems: filteredItems,
        });

        if (state.currentFloor >= state.maxFloor) {
          dispatch({ type: 'DUNGEON_CLEARED' });
        } else {
          const nextFloor = state.currentFloor + 1;
          const nextEnemy = getEnemyForFloor(nextFloor);
          if (nextEnemy) {
            // 敵切り替わり待機時間も戦闘速度に合わせて調整
            const transitionDelay = 500 / battleSpeedRef.current;
            setTimeout(() => {
              dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
              isProcessingRef.current = false;
            }, transitionDelay);
            return;
          }
        }
        isProcessingRef.current = false;
        return;
      }
    }

    // クリティカル判定（MOD効果+パッシブ効果）
    const isCritical = modEffects.criticalChance > 0 && Math.random() * 100 < modEffects.criticalChance;
    // クリティカルダメージ倍率: 基礎150% + ボーナス%（modEffects.criticalDamageは%で加算）
    const criticalMultiplier = isCritical ? (1.5 + modEffects.criticalDamage / 100) : 1;

    // プレイヤーの攻撃（ATK/DEFボーナスはgetTotalStats()で既に反映済み）
    const baseDamage = calculateDamage(stats.atk, state.enemy.def);

    // 通常ダメージ無効化チェック（キーストーン効果）
    const playerDamage = modEffects.noDirectDamage ? 0 : Math.floor(baseDamage * criticalMultiplier);

    if (playerDamage > 0) {
      dispatch({ type: 'PLAYER_ATTACK', damage: playerDamage, isCritical });
    }

    // ライフスティール処理 - Core関数使用
    if (playerDamage > 0 && state.playerCurrentHp < state.playerMaxHp) {
      const lifestealAmount = calculateLifesteal(playerDamage, isCritical, modEffects);
      if (lifestealAmount > 0) {
        dispatch({ type: 'HP_REGEN', amount: lifestealAmount });
      }
    }

    const enemyHpAfterPlayerAttack = currentEnemyHp - playerDamage;

    // 毒付与判定（スタック上限チェック）
    const maxPoisonStacks = BASE_POISON_MAX_STACKS + modEffects.poisonMaxStacks;
    if (state.enemyPoison.length < maxPoisonStacks && modEffects.poisonChance > 0 && Math.random() * 100 < modEffects.poisonChance) {
      const rawPoisonDamage = Math.max(1, Math.floor(baseDamage * POISON_DAMAGE_RATIO));
      const poisonDamage = calculatePoisonDamageLocal(rawPoisonDamage, modEffects);
      dispatch({ type: 'APPLY_POISON', damagePerTurn: poisonDamage, turns: POISON_DURATION });
    }

    // 敵を倒したかチェック
    if (enemyHpAfterPlayerAttack <= 0) {
      // ドロップアイテム収集
      const droppedItems: Item[] = [];

      // 1. ユニークドロップ判定（モンスター固有）
      if (state.enemy.uniqueDrop) {
        const uniqueItem = tryUniqueDrop(
          state.enemy.uniqueDrop.itemId,
          state.enemy.uniqueDrop.dropRate
        );
        if (uniqueItem) {
          droppedItems.push(uniqueItem);
        }
      }

      // 2. 通常ドロップ判定（ドロップテーブルから）
      if (dungeon) {
        const dropCount = rollDropCount();
        const normalDrops = rollDropItems(dungeon.dropTable, dropCount, state.dungeonId);
        droppedItems.push(...normalDrops);
      }

      // フィルタリングを適用
      const filteredItems = filterDroppedItems(droppedItems, dropFilter);

      dispatch({
        type: 'ENEMY_DEFEATED',
        exp: state.enemy.exp,
        droppedItems: filteredItems,
      });

      // 最終階層かチェック
      if (state.currentFloor >= state.maxFloor) {
        dispatch({ type: 'DUNGEON_CLEARED' });
      } else {
        // 次の階層へ
        const nextFloor = state.currentFloor + 1;
        const nextEnemy = getEnemyForFloor(nextFloor);
        if (nextEnemy) {
          // 敵切り替わり待機時間も戦闘速度に合わせて調整
          const transitionDelay = 500 / battleSpeedRef.current;
          setTimeout(() => {
            dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
            isProcessingRef.current = false;
          }, transitionDelay);
          return;
        }
      }
      isProcessingRef.current = false;
      return;
    }

    // 敵の攻撃はゲージ制で独立して実行されるため削除
    isProcessingRef.current = false;
  }, [state, getTotalStats, dungeonId, getCombinedModEffects, calculatePoisonDamageLocal, getEnemyForFloor, dropFilter]);

  // 敵の攻撃実行（敵ゲージ100%時に呼ばれる）- Core関数使用
  const executeEnemyAttack = useCallback(() => {
    if (state.phase !== 'fighting' || !state.enemy) return;

    const stats = getTotalStats();
    const modEffects = getCombinedModEffects();

    // Core関数で敵のダメージを計算（毒状態時の軽減も含む）
    const isEnemyPoisoned = state.enemyPoison.length > 0;
    const enemyDamage = calculateEnemyDamage(
      state.enemy.atk,
      stats.def,
      modEffects,
      isEnemyPoisoned
    );

    dispatch({ type: 'ENEMY_ATTACK', damage: enemyDamage });

    const playerHpAfterEnemyAttack = state.playerCurrentHp - enemyDamage;

    // プレイヤーが倒れたかチェック
    if (playerHpAfterEnemyAttack <= 0) {
      dispatch({ type: 'PLAYER_DEFEATED' });
    }
  }, [state, getTotalStats, getCombinedModEffects]);

  // executeTurnとexecuteEnemyAttackをrefに保持（常に最新の関数を参照するため）
  useEffect(() => {
    executeTurnRef.current = executeTurn;
  }, [executeTurn]);

  useEffect(() => {
    executeEnemyAttackRef.current = executeEnemyAttack;
  }, [executeEnemyAttack]);

  // プレイヤーの攻撃速度を計算（coreロジック使用）
  const getPlayerAttackSpeed = useCallback((): number => {
    return getAttackSpeedFromMods(modEffects);
  }, [modEffects]);

  // ゲージ制ゲームループ（33msごとに更新 = 約30fps）
  const TICK_INTERVAL = 33;
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const regenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerGaugeRef = useRef(0);
  const enemyGaugeRef = useRef(0);
  // HP回復タイマー用のref（stateが変わってもタイマーをリセットしないため）
  const playerHpRef = useRef({ current: state.playerCurrentHp, max: state.playerMaxHp });

  // playerHpRefを常に最新のstateで更新
  useEffect(() => {
    playerHpRef.current = { current: state.playerCurrentHp, max: state.playerMaxHp };
  }, [state.playerCurrentHp, state.playerMaxHp]);

  // ゲームループ本体
  useEffect(() => {
    if (state.phase !== 'fighting' || !state.enemy || isPaused) {
      // 停止時はタイマーをクリア
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    // refの初期化
    playerGaugeRef.current = state.playerGauge;
    enemyGaugeRef.current = state.enemyGauge;

    const playerAS = getPlayerAttackSpeed();
    const enemyAS = state.enemy.attackSpeed;
    const ticksPerSecond = 1000 / TICK_INTERVAL;

    gameLoopRef.current = setInterval(() => {
      if (isProcessingRef.current) return;

      // ゲージ増加量 = AS × 200 / ticks/sec × 速度倍率 (AS 1.0 = 0.5秒で1回攻撃)
      const playerGaugeIncrease = (playerAS * 200 * battleSpeed) / ticksPerSecond;
      const enemyGaugeIncrease = (enemyAS * 200 * battleSpeed) / ticksPerSecond;

      playerGaugeRef.current += playerGaugeIncrease;
      enemyGaugeRef.current += enemyGaugeIncrease;

      // プレイヤーゲージが100に達したら攻撃
      if (playerGaugeRef.current >= 100) {
        playerGaugeRef.current = 0;
        executeTurnRef.current();
      }

      // 敵ゲージが100に達したら攻撃
      if (enemyGaugeRef.current >= 100) {
        enemyGaugeRef.current = 0;
        executeEnemyAttackRef.current();
      }

      // UIのゲージ表示を更新
      dispatch({
        type: 'UPDATE_GAUGES',
        playerGauge: Math.min(100, playerGaugeRef.current),
        enemyGauge: Math.min(100, enemyGaugeRef.current)
      });
    }, TICK_INTERVAL);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  // 注意: executeTurn, executeEnemyAttackはrefで参照するため依存配列に含めない
  // （含めるとstate更新のたびにタイマーがリセットされ、ゲージが進まなくなる）
  }, [state.phase, state.enemy, isPaused, getPlayerAttackSpeed, battleSpeed]);

  // HP回復タイマー（ゲーム内1秒ごと、ダンジョン滞在中は常時）
  // 戦闘速度に合わせて間隔を調整（10倍速なら100msごと = ゲーム内1秒）
  useEffect(() => {
    // 敗北時・一時停止時は回復停止
    if (state.phase === 'defeat' || isPaused) {
      if (regenTimerRef.current) {
        clearInterval(regenTimerRef.current);
        regenTimerRef.current = null;
      }
      return;
    }

    const regenInterval = 1000 / battleSpeed;

    regenTimerRef.current = setInterval(() => {
      const modEffects = getCombinedModEffects();
      // refから最新のHP値を取得（依存配列でタイマーリセットを防ぐため）
      const { current: currentHp, max: maxHp } = playerHpRef.current;
      // Core関数でHP回復量を計算
      const regenAmount = calculateHpRegen(currentHp, maxHp, modEffects);
      if (regenAmount > 0) {
        dispatch({ type: 'HP_REGEN', amount: regenAmount });
      }
    }, regenInterval);

    return () => {
      if (regenTimerRef.current) {
        clearInterval(regenTimerRef.current);
        regenTimerRef.current = null;
      }
    };
  }, [state.phase, isPaused, getCombinedModEffects, battleSpeed]);

  // 戦闘終了時に経験値を付与
  useEffect(() => {
    const saveResults = async () => {
      if (state.phase === 'cleared' || state.phase === 'defeat') {
        if (state.totalExpGained > 0) {
          await gainExp(state.totalExpGained);
        }
        // ドロップアイテムをインベントリに追加（空き枠分のみ）
        const availableSpace = getInventorySpace();
        const itemsToAdd = state.droppedItems.slice(0, availableSpace);

        for (const item of itemsToAdd) {
          await addToInventory(item);
        }

        // 追加できなかったアイテム数（ログは結果画面で表示）
        const discardedCount = state.droppedItems.length - itemsToAdd.length;
        if (discardedCount > 0) {
          console.log(`[Battle] ${discardedCount}個のアイテムがインベントリ満杯で破棄されました`);
        }
      }
    };
    saveResults();
  }, [state.phase, state.totalExpGained, state.droppedItems, gainExp, addToInventory, getInventorySpace]);

  // 自動周回処理（クリア時に次の周回を開始、敗北時は終了）
  useEffect(() => {
    if (!isAutoRunning) return;

    if (state.phase === 'defeat') {
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
  };
};
