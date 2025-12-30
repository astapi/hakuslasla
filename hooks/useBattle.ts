import { useReducer, useCallback, useEffect, useRef } from 'react';
import { BattleState, BattleAction, BattleEnemy, Item, Enemy } from '@/types';
import { getDungeon } from '@/data/dungeons';
import { getRandomEnemy } from '@/data/enemies';
import { getRandomItem } from '@/data/items';
import { usePlayerStore } from '@/stores/usePlayerStore';

// ダメージ計算
const calculateDamage = (atk: number, def: number): number => {
  const damage = atk - def;
  return Math.max(1, damage); // 最低ダメージは1
};

// 敵をBattleEnemy形式に変換
const createBattleEnemy = (enemy: Enemy): BattleEnemy => ({
  id: enemy.id,
  name: enemy.name,
  currentHp: enemy.maxHp,
  maxHp: enemy.maxHp,
  atk: enemy.atk,
  def: enemy.def,
  exp: enemy.exp,
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
    phase: 'fighting',
    battleLog: [],
    droppedItems: [],
    totalExpGained: 0,
  };
};

// ログIDカウンター
let logIdCounter = 0;

// リデューサー
const battleReducer = (state: BattleState, action: BattleAction): BattleState => {
  switch (action.type) {
    case 'START_BATTLE':
      return {
        ...state,
        enemy: action.enemy,
        phase: 'fighting',
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `${action.enemy.name}が現れた！`,
            type: 'info',
          },
        ],
      };

    case 'PLAYER_ATTACK':
      if (!state.enemy) return state;
      const newEnemyHp = state.enemy.currentHp - action.damage;
      return {
        ...state,
        enemy: {
          ...state.enemy,
          currentHp: Math.max(0, newEnemyHp),
        },
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `プレイヤーの攻撃！ ${state.enemy.name}に${action.damage}ダメージ！`,
            type: 'player_attack',
          },
        ],
      };

    case 'ENEMY_ATTACK':
      const newPlayerHp = state.playerCurrentHp - action.damage;
      return {
        ...state,
        playerCurrentHp: Math.max(0, newPlayerHp),
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `${state.enemy?.name}の攻撃！ ${action.damage}ダメージを受けた！`,
            type: 'enemy_attack',
          },
        ],
      };

    case 'ENEMY_DEFEATED':
      return {
        ...state,
        totalExpGained: state.totalExpGained + action.exp,
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `${state.enemy?.name}を倒した！ 経験値${action.exp}を獲得！`,
            type: 'victory',
          },
        ],
      };

    case 'PLAYER_DEFEATED':
      return {
        ...state,
        phase: 'defeat',
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: 'プレイヤーは倒れた...',
            type: 'defeat',
          },
        ],
      };

    case 'NEXT_FLOOR':
      return {
        ...state,
        currentFloor: state.currentFloor + 1,
        enemy: action.enemy,
        phase: 'fighting',
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `--- ${state.currentFloor + 1}階へ進む ---`,
            type: 'floor_clear',
          },
          {
            id: logIdCounter++,
            message: `${action.enemy.name}が現れた！`,
            type: 'info',
          },
        ],
      };

    case 'DUNGEON_CLEARED':
      return {
        ...state,
        phase: 'cleared',
        droppedItems: action.items,
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: 'ダンジョンを踏破した！',
            type: 'victory',
          },
        ],
      };

    case 'ADD_LOG':
      return {
        ...state,
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            ...action.entry,
          },
        ],
      };

    default:
      return state;
  }
};

export const useBattle = (dungeonId: string) => {
  const { getTotalStats, gainExp, addToInventory } = usePlayerStore();
  const stats = getTotalStats();

  const [state, dispatch] = useReducer(
    battleReducer,
    createInitialState(dungeonId, stats.maxHp)
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  // 戦闘開始
  const startBattle = useCallback(() => {
    const dungeon = getDungeon(dungeonId);
    if (!dungeon) return;

    const enemy = getRandomEnemy(dungeon.enemies);
    if (!enemy) return;

    dispatch({ type: 'START_BATTLE', enemy: createBattleEnemy(enemy) });
  }, [dungeonId]);

  // 1ターン実行
  const executeTurn = useCallback(() => {
    if (state.phase !== 'fighting' || !state.enemy || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const stats = getTotalStats();
    const dungeon = getDungeon(dungeonId);

    // プレイヤーの攻撃
    const playerDamage = calculateDamage(stats.atk, state.enemy.def);
    dispatch({ type: 'PLAYER_ATTACK', damage: playerDamage });

    const enemyHpAfterPlayerAttack = state.enemy.currentHp - playerDamage;

    // 敵を倒したかチェック
    if (enemyHpAfterPlayerAttack <= 0) {
      dispatch({ type: 'ENEMY_DEFEATED', exp: state.enemy.exp });

      // 最終階層かチェック
      if (state.currentFloor >= state.maxFloor) {
        // ダンジョンクリア
        const droppedItems: Item[] = [];
        if (dungeon) {
          const item = getRandomItem(dungeon.dropTable);
          if (item) {
            droppedItems.push(item);
          }
        }
        dispatch({ type: 'DUNGEON_CLEARED', items: droppedItems });
      } else {
        // 次の階層へ
        if (dungeon) {
          const nextEnemy = getRandomEnemy(dungeon.enemies);
          if (nextEnemy) {
            setTimeout(() => {
              dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
              isProcessingRef.current = false;
            }, 500);
            return;
          }
        }
      }
      isProcessingRef.current = false;
      return;
    }

    // 敵の攻撃
    setTimeout(() => {
      const enemyDamage = calculateDamage(state.enemy!.atk, stats.def);
      dispatch({ type: 'ENEMY_ATTACK', damage: enemyDamage });

      const playerHpAfterEnemyAttack = state.playerCurrentHp - enemyDamage;

      // プレイヤーが倒れたかチェック
      if (playerHpAfterEnemyAttack <= 0) {
        dispatch({ type: 'PLAYER_DEFEATED' });
      }

      isProcessingRef.current = false;
    }, 500);
  }, [state, getTotalStats, dungeonId]);

  // 自動戦闘
  useEffect(() => {
    if (state.phase !== 'fighting' || !state.enemy) return;

    timerRef.current = setTimeout(() => {
      executeTurn();
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state.phase, state.enemy, state.playerCurrentHp, state.battleLog.length, executeTurn]);

  // 戦闘終了時に経験値を付与
  useEffect(() => {
    const saveResults = async () => {
      if (state.phase === 'cleared' || state.phase === 'defeat') {
        if (state.totalExpGained > 0) {
          await gainExp(state.totalExpGained);
        }
        // ドロップアイテムをインベントリに追加
        for (const item of state.droppedItems) {
          await addToInventory(item.id, 1);
        }
      }
    };
    saveResults();
  }, [state.phase, state.totalExpGained, state.droppedItems, gainExp, addToInventory]);

  // 初回マウント時に戦闘開始
  useEffect(() => {
    if (!state.enemy && state.phase === 'fighting') {
      startBattle();
    }
  }, []);

  return {
    state,
    startBattle,
  };
};
