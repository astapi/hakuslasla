import { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { BattleState, BattleAction, BattleEnemy, Item, Enemy, PoisonState } from '@/types';
import { getDungeon } from '@/data/dungeons';
import { getRandomEnemy, getEnemy } from '@/data/enemies';
import { tryUniqueDrop, rollDropCount, rollDropItems, ModEffects } from '@/data/items';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { calculateDamage } from '@/core';

// 毒ダメージ計算（攻撃ダメージの50%）
const POISON_DAMAGE_RATIO = 0.5;
// 毒の持続ターン数
const POISON_DURATION = 5;
// 基本毒スタック上限
const BASE_POISON_MAX_STACKS = 1;

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
  };
};

// ログIDカウンター
let logIdCounter = 0;

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
      const attackMessage = action.isCritical
        ? `クリティカルヒット！ ${state.enemy.name}に${action.damage}ダメージ！`
        : `プレイヤーの攻撃！ ${state.enemy.name}に${action.damage}ダメージ！`;
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
            message: attackMessage,
            type: action.isCritical ? 'critical' : 'player_attack',
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
        battleLog: [...state.battleLog, ...defeatLogs],
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
        enemyPoison: [], // 次の敵には毒状態をリセット
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
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `${state.enemy?.name}に毒を付与した！（${action.damagePerTurn}ダメージ x ${action.turns}ターン）${currentStacks > 0 ? ` [${currentStacks + 1}スタック]` : ''}`,
            type: 'poison',
          },
        ],
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
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `毒ダメージ！ ${state.enemy.name}に${action.damage}ダメージ！${updatedPoisonStacks.length > 0 ? `（${updatedPoisonStacks.length}スタック継続）` : '（毒が切れた）'}${stacksRemoved > 0 ? `（${stacksRemoved}スタック消失）` : ''}`,
            type: 'poison',
          },
        ],
      };

    case 'HP_REGEN':
      const healedHp = Math.min(state.playerMaxHp, state.playerCurrentHp + action.amount);
      const actualHeal = healedHp - state.playerCurrentHp;
      if (actualHeal <= 0) return state; // 既にMAXHPなら何もしない
      return {
        ...state,
        playerCurrentHp: healedHp,
        battleLog: [
          ...state.battleLog,
          {
            id: logIdCounter++,
            message: `HP回復！ HPが${actualHeal}回復した！`,
            type: 'heal',
          },
        ],
      };

    default:
      return state;
  }
};

// 拡張されたMOD効果の型
interface CombinedModEffects {
  hpRegen: number;
  hpRegenPct: number;
  poisonChance: number;
  poisonDamagePct: number;
  poisonDamageMorePct: number[];
  poisonMaxStacks: number;
  poisonDamageReduction: number;
  noDirectDamage: boolean;
  criticalChance: number;
  criticalDamage: number;
  criticalLifesteal: number;
  damageReductionPct: number;
  lifesteal: number;
}

export const useBattle = (dungeonId: string) => {
  const { getTotalStats, gainExp, addToInventory, getInventorySpace, equipment, unlockedSkills } = usePlayerStore();
  const stats = getTotalStats();

  // 装備品+パッシブから戦闘時MOD効果を取得（ATK/DEFはgetTotalStats()で反映済み）
  const getCombinedModEffects = useCallback((): CombinedModEffects => {
    const combined: CombinedModEffects = {
      hpRegen: 0,
      hpRegenPct: 0,
      poisonChance: 0,
      poisonDamagePct: 0,
      poisonDamageMorePct: [],
      poisonMaxStacks: 0,
      poisonDamageReduction: 0,
      noDirectDamage: false,
      criticalChance: 0,
      criticalDamage: 0,
      criticalLifesteal: 0,
      damageReductionPct: 0,
      lifesteal: 0,
    };

    // 装備MODからの効果
    Object.values(equipment).forEach((item) => {
      if (item && item.mods) {
        for (const mod of item.mods) {
          switch (mod.type) {
            case 'hp_regen': combined.hpRegen += mod.value; break;
            case 'hp_regen_pct': combined.hpRegenPct += mod.value; break;
            case 'poison_chance': combined.poisonChance += mod.value; break;
            case 'critical_chance': combined.criticalChance += mod.value; break;
            case 'critical_damage': combined.criticalDamage += mod.value; break;
            case 'damage_reduction_pct': combined.damageReductionPct += mod.value; break;
            case 'lifesteal': combined.lifesteal += mod.value; break;
          }
        }
      }
    });

    // パッシブツリーからの効果を加算
    const passiveEffects = calculatePassiveEffects(unlockedSkills);
    combined.hpRegen += passiveEffects.hp_regen;
    combined.hpRegenPct += passiveEffects.hp_regen_pct;
    combined.poisonChance += passiveEffects.poison_chance;
    combined.poisonDamagePct += passiveEffects.poison_damage_pct;
    combined.poisonDamageMorePct.push(...passiveEffects.poison_damage_more_pct);
    combined.poisonMaxStacks += passiveEffects.poison_max_stacks;
    combined.poisonDamageReduction += passiveEffects.poison_damage_reduction;
    combined.noDirectDamage = passiveEffects.no_direct_damage;
    combined.criticalChance += passiveEffects.critical_chance;
    combined.criticalDamage += passiveEffects.critical_damage;
    combined.criticalLifesteal += passiveEffects.critical_lifesteal;
    combined.damageReductionPct += passiveEffects.damage_reduction_pct;
    combined.lifesteal += passiveEffects.lifesteal;

    return combined;
  }, [equipment, unlockedSkills]);

  const [state, dispatch] = useReducer(
    battleReducer,
    createExtendedInitialState(dungeonId, stats.maxHp)
  );

  const [isPaused, setIsPaused] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false); // 自動周回モード
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

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

  // 毒ダメージを計算（increased%とmore%を適用）
  const calculatePoisonDamage = useCallback((baseDamage: number, modEffects: CombinedModEffects): number => {
    // PoE式: base × (1 + increased%) × more1 × more2 × ...
    let damage = baseDamage * (1 + modEffects.poisonDamagePct / 100);
    for (const more of modEffects.poisonDamageMorePct) {
      damage *= (1 + more / 100);
    }
    return Math.floor(damage);
  }, []);

  // 1ターン実行
  const executeTurn = useCallback(() => {
    if (state.phase !== 'fighting' || !state.enemy || isProcessingRef.current) return;

    isProcessingRef.current = true;
    const stats = getTotalStats();
    const dungeon = getDungeon(dungeonId);
    const modEffects = getCombinedModEffects();

    // ターン開始時のHP回復（MOD効果）
    const flatRegen = modEffects.hpRegen;
    const pctRegen = Math.floor(state.playerMaxHp * modEffects.hpRegenPct / 100);
    const totalRegen = flatRegen + pctRegen;
    if (totalRegen > 0 && state.playerCurrentHp < state.playerMaxHp) {
      dispatch({ type: 'HP_REGEN', amount: totalRegen });
    }

    // 毒ダメージ処理（敵に毒が付与されている場合）
    let currentEnemyHp = state.enemy.currentHp;
    if (state.enemyPoison.length > 0) {
      // 全スタックのダメージを合計
      const totalPoisonDamage = state.enemyPoison.reduce((sum, p) => sum + p.damagePerTurn, 0);
      dispatch({ type: 'POISON_DAMAGE', damage: totalPoisonDamage });
      currentEnemyHp -= totalPoisonDamage;
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

        dispatch({
          type: 'ENEMY_DEFEATED',
          exp: state.enemy.exp,
          droppedItems,
        });

        if (state.currentFloor >= state.maxFloor) {
          dispatch({ type: 'DUNGEON_CLEARED' });
        } else {
          const nextFloor = state.currentFloor + 1;
          const nextEnemy = getEnemyForFloor(nextFloor);
          if (nextEnemy) {
            setTimeout(() => {
              dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
              isProcessingRef.current = false;
            }, 500);
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

    // ライフスティール処理
    let totalLifesteal = modEffects.lifesteal;
    // クリティカル時の追加ライフスティール
    if (isCritical && modEffects.criticalLifesteal > 0) {
      totalLifesteal += modEffects.criticalLifesteal;
    }
    if (totalLifesteal > 0 && playerDamage > 0 && state.playerCurrentHp < state.playerMaxHp) {
      const lifestealAmount = Math.max(1, Math.floor(playerDamage * totalLifesteal / 100));
      dispatch({ type: 'HP_REGEN', amount: lifestealAmount });
    }

    const enemyHpAfterPlayerAttack = currentEnemyHp - playerDamage;

    // 毒付与判定（スタック上限チェック）
    const maxPoisonStacks = BASE_POISON_MAX_STACKS + modEffects.poisonMaxStacks;
    if (state.enemyPoison.length < maxPoisonStacks && modEffects.poisonChance > 0 && Math.random() * 100 < modEffects.poisonChance) {
      const rawPoisonDamage = Math.max(1, Math.floor(baseDamage * POISON_DAMAGE_RATIO));
      const poisonDamage = calculatePoisonDamage(rawPoisonDamage, modEffects);
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

      dispatch({
        type: 'ENEMY_DEFEATED',
        exp: state.enemy.exp,
        droppedItems,
      });

      // 最終階層かチェック
      if (state.currentFloor >= state.maxFloor) {
        dispatch({ type: 'DUNGEON_CLEARED' });
      } else {
        // 次の階層へ
        const nextFloor = state.currentFloor + 1;
        const nextEnemy = getEnemyForFloor(nextFloor);
        if (nextEnemy) {
          setTimeout(() => {
            dispatch({ type: 'NEXT_FLOOR', enemy: createBattleEnemy(nextEnemy) });
            isProcessingRef.current = false;
          }, 500);
          return;
        }
      }
      isProcessingRef.current = false;
      return;
    }

    // 敵の攻撃（DEFボーナスはgetTotalStats()で既に反映済み、ダメージ軽減MODも考慮）
    setTimeout(() => {
      // 敵が毒状態時の追加ダメージ軽減
      let totalDamageReduction = modEffects.damageReductionPct;
      if (state.enemyPoison.length > 0) {
        totalDamageReduction += modEffects.poisonDamageReduction;
      }

      const enemyDamage = calculateDamage(state.enemy!.atk, stats.def, totalDamageReduction);
      dispatch({ type: 'ENEMY_ATTACK', damage: enemyDamage });

      const playerHpAfterEnemyAttack = state.playerCurrentHp - enemyDamage;

      // プレイヤーが倒れたかチェック
      if (playerHpAfterEnemyAttack <= 0) {
        dispatch({ type: 'PLAYER_DEFEATED' });
      }

      isProcessingRef.current = false;
    }, 500);
  }, [state, getTotalStats, dungeonId, getCombinedModEffects, calculatePoisonDamage, getEnemyForFloor]);

  // 自動戦闘
  useEffect(() => {
    if (state.phase !== 'fighting' || !state.enemy || isPaused) return;

    timerRef.current = setTimeout(() => {
      executeTurn();
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [state.phase, state.enemy, state.playerCurrentHp, state.battleLog.length, executeTurn, isPaused]);

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
