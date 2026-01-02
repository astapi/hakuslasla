/**
 * プレイヤー関連の純粋計算ロジック
 * React/DB依存なし
 */

import {
  Stats,
  PlayerConfig,
  EquipmentConfig,
  LevelUpResult,
} from './types';

// ========================================
// 定数
// ========================================

/** 初期ステータス */
export const INITIAL_STATS: Stats = {
  maxHp: 100,
  atk: 10,
  def: 5,
};

/** レベルアップ時の上昇値 */
export const LEVEL_UP_BONUS = {
  maxHp: 10,
  atk: 2,
  def: 1,
  skillPoints: 1,
};

/** インベントリの最大サイズ */
export const INVENTORY_MAX_SIZE = 50;

// ========================================
// 経験値計算
// ========================================

/**
 * 次のレベルに必要な経験値を計算
 */
export function getExpToNextLevel(level: number): number {
  return level * 50;
}

/**
 * 経験値獲得によるレベルアップを計算
 * @param currentLevel 現在のレベル
 * @param currentExp 現在の経験値
 * @param expGained 獲得経験値
 * @returns レベルアップ結果
 */
export function calculateLevelUp(
  currentLevel: number,
  currentExp: number,
  expGained: number
): LevelUpResult {
  let level = currentLevel;
  let exp = currentExp + expGained;
  let expToNext = getExpToNextLevel(level);
  let totalHpGained = 0;
  let totalAtkGained = 0;
  let totalDefGained = 0;
  let skillPointsGained = 0;

  // レベルアップ処理（複数回レベルアップ対応）
  while (exp >= expToNext) {
    exp -= expToNext;
    level += 1;
    expToNext = getExpToNextLevel(level);

    totalHpGained += LEVEL_UP_BONUS.maxHp;
    totalAtkGained += LEVEL_UP_BONUS.atk;
    totalDefGained += LEVEL_UP_BONUS.def;
    skillPointsGained += LEVEL_UP_BONUS.skillPoints;
  }

  return {
    newLevel: level,
    newExp: exp,
    expToNextLevel: expToNext,
    skillPointsGained,
    statsGained: {
      maxHp: totalHpGained,
      atk: totalAtkGained,
      def: totalDefGained,
    },
  };
}

// ========================================
// ステータス計算
// ========================================

/**
 * 装備込みの合計ステータスを計算
 */
export function calculateTotalStats(
  baseStats: Stats,
  equipment: EquipmentConfig
): Stats {
  let totalAtk = baseStats.atk;
  let totalDef = baseStats.def;
  const totalMaxHp = baseStats.maxHp;

  const slots = ['weapon', 'armor', 'gloves', 'boots', 'accessory'] as const;
  for (const slot of slots) {
    const item = equipment[slot];
    if (item) {
      totalAtk += item.atk;
      totalDef += item.def;
    }
  }

  return {
    maxHp: totalMaxHp,
    atk: totalAtk,
    def: totalDef,
  };
}

/**
 * レベルから基本ステータスを計算
 */
export function calculateBaseStatsForLevel(level: number): Stats {
  const levelsGained = level - 1;
  return {
    maxHp: INITIAL_STATS.maxHp + levelsGained * LEVEL_UP_BONUS.maxHp,
    atk: INITIAL_STATS.atk + levelsGained * LEVEL_UP_BONUS.atk,
    def: INITIAL_STATS.def + levelsGained * LEVEL_UP_BONUS.def,
  };
}

/**
 * プレイヤー設定から戦闘用ステータスを取得
 */
export function getPlayerCombatStats(config: PlayerConfig): Stats {
  return calculateTotalStats(config.baseStats, config.equipment);
}

// ========================================
// プレイヤー設定ヘルパー
// ========================================

/**
 * デフォルトのプレイヤー設定を作成
 */
export function createDefaultPlayerConfig(level: number = 1): PlayerConfig {
  return {
    level,
    baseStats: calculateBaseStatsForLevel(level),
    equipment: {
      weapon: null,
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    },
    unlockedSkills: [],
  };
}
