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
import type { CharacterType, ClassAbility } from '@/types';

// ========================================
// 定数
// ========================================

/** 初期ステータス（後方互換性のため残す） */
export const INITIAL_STATS: Stats = {
  maxHp: 100,
  atk: 10,
  def: 5,
};

/** クラス別初期ステータス */
export const CLASS_INITIAL_STATS: Record<CharacterType, Stats> = {
  warrior: { maxHp: 120, atk: 10, def: 5 },
  elementalist: { maxHp: 85, atk: 10, def: 4 },
  ranger: { maxHp: 100, atk: 10, def: 5 },
  frostmage: { maxHp: 80, atk: 10, def: 3 },
  tamer: { maxHp: 100, atk: 10, def: 4 },
};

/** クラス別固有能力 */
export const CLASS_ABILITIES: Record<CharacterType, ClassAbility> = {
  warrior: { criticalChance: 10, attackSpeedPct: 10 },  // クリティカル率10%, 攻撃速度+10%
  elementalist: { igniteChance: 20 },  // 発火確率20%
  ranger: { poisonChance: 20 },  // 毒付与率20%
  frostmage: { chillChance: 25 },  // フロストメイジ: チル付与率25%
  tamer: { petDropRatePct: 0.5, petEffectMultiplier: 2 },  // テイマー: ペットドロップ率+0.5%, ペット効果2倍
};

/**
 * クラスの初期ステータスを取得
 */
export function getClassInitialStats(type: CharacterType): Stats {
  return CLASS_INITIAL_STATS[type];
}

/**
 * クラスの固有能力を取得
 */
export function getClassAbilities(type: CharacterType): ClassAbility {
  return CLASS_ABILITIES[type];
}

/** レベルアップ時の上昇値 */
export const LEVEL_UP_BONUS = {
  maxHp: 5,
  atk: 0,
  def: 0,
  skillPoints: 1,
};

/** レベル上限 */
export const MAX_LEVEL = 80;

/** インベントリの最大サイズ（デフォルト） */
export const INVENTORY_MAX_SIZE = 50;

// ========================================
// 経験値計算
// ========================================

/**
 * 次のレベルに必要な経験値を計算
 * PoE風曲線: 100 × level^1.8
 * - Lv1→2: 100 EXP
 * - Lv25→26: 約32,000 EXP
 * - Lv49→50: 約100,000 EXP
 * - 累計約100万EXP でレベル50到達
 */
export function getExpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8));
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
  expGained: number,
  maxLevel: number = MAX_LEVEL
): LevelUpResult {
  let level = currentLevel;
  let exp = currentExp + expGained;
  let expToNext = getExpToNextLevel(level);
  let totalHpGained = 0;
  let totalAtkGained = 0;
  let totalDefGained = 0;
  let skillPointsGained = 0;

  // レベル上限チェック
  if (level >= maxLevel) {
    return {
      newLevel: maxLevel,
      newExp: 0, // 上限時は経験値を貯めない
      expToNextLevel: 0,
      skillPointsGained: 0,
      statsGained: { maxHp: 0, atk: 0, def: 0 },
    };
  }

  // レベルアップ処理（複数回レベルアップ対応）
  while (exp >= expToNext && level < maxLevel) {
    exp -= expToNext;
    level += 1;
    expToNext = getExpToNextLevel(level);

    totalHpGained += LEVEL_UP_BONUS.maxHp;
    totalAtkGained += LEVEL_UP_BONUS.atk;
    totalDefGained += LEVEL_UP_BONUS.def;
    skillPointsGained += LEVEL_UP_BONUS.skillPoints;
  }

  // 上限到達時は経験値をリセット
  if (level >= maxLevel) {
    exp = 0;
    expToNext = 0;
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

// ========================================
// パッシブルートプリセット
// ========================================

/** パッシブルート定義 */
export const PASSIVE_ROUTES = {
  // 基本ルート（分岐前まで）
  ATK_BASE: ['start', 'atk_1', 'atk_2', 'atk_3', 'merge'],
  HP_BASE: ['start', 'hp_1', 'hp_2', 'hp_3', 'merge'],
  DEF_BASE: ['start', 'def_1', 'def_2', 'def_3', 'merge'],

  // 特化ルート（Tier 1）
  POISON: ['poison_1', 'poison_2', 'poison_3'],
  CRIT: ['crit_1', 'crit_2', 'crit_3'],
  REGEN: ['regen_1', 'regen_2', 'regen_3'],
  ATK_PCT_1: ['atk_pct_1', 'atk_pct_2', 'atk_pct_3'],

  // Tier 2 (merge_2以降)
  MERGE_2: ['merge_2'],
  HP_PCT: ['hp_pct_1', 'hp_pct_2', 'hp_pct_3', 'notable_hp_more'],
  DEF_PCT: ['def_pct_1', 'def_pct_2', 'def_pct_3', 'notable_def_more'],
  ATK_PCT_2: ['atk_pct_4', 'atk_pct_5', 'atk_pct_6', 'notable_atk_more'],
  CRIT_DMG: ['crit_dmg_1', 'crit_dmg_2', 'crit_dmg_3', 'notable_crit'],

  // Tier 3 (merge_3以降)
  MERGE_3: ['merge_3'],
  ATK_PCT_3: ['atk_pct_7', 'atk_pct_8', 'notable_atk_more_2'],
  HP_PCT_2: ['hp_pct_4', 'hp_pct_5', 'notable_hp_more_2'],
  DEF_PCT_2: ['def_pct_4', 'def_pct_5', 'notable_def_more_2'],

  // 最終ノード
  FINAL: ['final_merge', 'legendary_node'],
} as const;

/** パッシブプリセット型 */
export interface PassivePreset {
  name: string;
  nodes: string[];
}

/** シミュレーション用パッシブプリセット */
export const PASSIVE_PRESETS: Record<string, PassivePreset> = {
  // パッシブなし
  NONE: {
    name: 'パッシブなし',
    nodes: [],
  },
  // 基本ルート（ATK）
  ATK_POISON: {
    name: 'ATK+毒',
    nodes: [...PASSIVE_ROUTES.ATK_BASE, ...PASSIVE_ROUTES.POISON],
  },
  ATK_CRIT: {
    name: 'ATK+クリ',
    nodes: [...PASSIVE_ROUTES.ATK_BASE, ...PASSIVE_ROUTES.CRIT],
  },
  ATK_REGEN: {
    name: 'ATK+回復',
    nodes: [...PASSIVE_ROUTES.ATK_BASE, ...PASSIVE_ROUTES.REGEN],
  },
  ATK_ATK_PCT: {
    name: 'ATK+ATK%',
    nodes: [...PASSIVE_ROUTES.ATK_BASE, ...PASSIVE_ROUTES.ATK_PCT_1],
  },
  // 基本ルート（HP）
  HP_POISON: {
    name: 'HP+毒',
    nodes: [...PASSIVE_ROUTES.HP_BASE, ...PASSIVE_ROUTES.POISON],
  },
  HP_CRIT: {
    name: 'HP+クリ',
    nodes: [...PASSIVE_ROUTES.HP_BASE, ...PASSIVE_ROUTES.CRIT],
  },
  HP_REGEN: {
    name: 'HP+回復',
    nodes: [...PASSIVE_ROUTES.HP_BASE, ...PASSIVE_ROUTES.REGEN],
  },
  // Tier 2完全版（ATK% moreまで）
  TIER2_ATK_MORE: {
    name: 'ATK% more',
    nodes: [
      ...PASSIVE_ROUTES.ATK_BASE,
      ...PASSIVE_ROUTES.ATK_PCT_1,
      ...PASSIVE_ROUTES.MERGE_2,
      ...PASSIVE_ROUTES.ATK_PCT_2,
    ],
  },
  // Tier 2完全版（HP% moreまで）
  TIER2_HP_MORE: {
    name: 'HP% more',
    nodes: [
      ...PASSIVE_ROUTES.HP_BASE,
      ...PASSIVE_ROUTES.ATK_PCT_1,
      ...PASSIVE_ROUTES.MERGE_2,
      ...PASSIVE_ROUTES.HP_PCT,
    ],
  },
  // Tier 3完全版（ATK特化）
  TIER3_ATK_FULL: {
    name: 'ATK特化フル',
    nodes: [
      ...PASSIVE_ROUTES.ATK_BASE,
      ...PASSIVE_ROUTES.ATK_PCT_1,
      ...PASSIVE_ROUTES.MERGE_2,
      ...PASSIVE_ROUTES.ATK_PCT_2,
      ...PASSIVE_ROUTES.MERGE_3,
      ...PASSIVE_ROUTES.ATK_PCT_3,
    ],
  },
  // フルビルド（伝説ノードまで）
  FULL_LEGENDARY: {
    name: '伝説フル',
    nodes: [
      ...PASSIVE_ROUTES.ATK_BASE,
      ...PASSIVE_ROUTES.ATK_PCT_1,
      ...PASSIVE_ROUTES.MERGE_2,
      ...PASSIVE_ROUTES.ATK_PCT_2,
      ...PASSIVE_ROUTES.MERGE_3,
      ...PASSIVE_ROUTES.ATK_PCT_3,
      ...PASSIVE_ROUTES.FINAL,
    ],
  },
};

export type PassivePresetKey = keyof typeof PASSIVE_PRESETS;

// ========================================
// レベル別パッシブプリセット（シミュレーション用）
// ========================================

/**
 * レベル別パッシブプリセット
 * - LV5: 4スキルポイント
 * - LV10: 9スキルポイント
 * - LV15: 14スキルポイント
 * - LV20: 19スキルポイント
 * - LV25: 24スキルポイント
 * - LV30: 29スキルポイント
 * - LV35: 34スキルポイント
 */
export const LEVEL_BASED_PRESETS: Record<string, Record<number, PassivePreset>> = {
  // ========================================
  // 特化ルート
  // ========================================

  /** 毒特化 */
  POISON: {
    5: {
      name: '毒特化LV5',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3'],
    },
    10: {
      name: '毒特化LV10',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1'],
    },
    15: {
      name: '毒特化LV15',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12'],
    },
    20: {
      name: '毒特化LV20',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_14'],
    },
    25: {
      name: '毒特化LV25',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17'],
    },
    30: {
      name: '毒特化LV30',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    35: {
      name: '毒特化LV35',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
    40: {
      name: '毒特化LV40',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13'],
    },
    45: {
      name: '毒特化LV45',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2'],
    },
    50: {
      name: '毒特化LV50',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2'],
    },
  },

  /** クリティカル特化 */
  CRIT: {
    5: {
      name: 'クリ特化LV5',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3'],
    },
    10: {
      name: 'クリ特化LV10',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1'],
    },
    15: {
      name: 'クリ特化LV15',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12'],
    },
    20: {
      name: 'クリ特化LV20',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_14'],
    },
    25: {
      name: 'クリ特化LV25',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17'],
    },
    30: {
      name: 'クリ特化LV30',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17', 'crit_final1', 'crit_final2', 'speed_1', 'speed_2', 'speed_3'],
    },
    35: {
      name: 'クリ特化LV35',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17', 'crit_final1', 'crit_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1'],
    },
    40: {
      name: 'クリ特化LV40',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17', 'crit_final1', 'crit_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13'],
    },
    45: {
      name: 'クリ特化LV45',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17', 'crit_final1', 'crit_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3'],
    },
    50: {
      name: 'クリ特化LV50',
      nodes: ['start', 'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5', 'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9', 'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1', 'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15', 'crit_16', 'crit_17', 'crit_final1', 'crit_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1'],
    },
  },

  /** HP回復特化 */
  REGEN: {
    5: {
      name: '回復特化LV5',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3'],
    },
    10: {
      name: '回復特化LV10',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
    15: {
      name: '回復特化LV15',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12'],
    },
    20: {
      name: '回復特化LV20',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_14'],
    },
    25: {
      name: '回復特化LV25',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    30: {
      name: '回復特化LV30',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3'],
    },
    35: {
      name: '回復特化LV35',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1'],
    },
    40: {
      name: '回復特化LV40',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13'],
    },
    45: {
      name: '回復特化LV45',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2'],
    },
    50: {
      name: '回復特化LV50',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2'],
    },
  },

  /** ライフスティール特化 */
  VAMP: {
    5: {
      name: '吸血特化LV5',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3'],
    },
    10: {
      name: '吸血特化LV10',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1'],
    },
    15: {
      name: '吸血特化LV15',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12'],
    },
    20: {
      name: '吸血特化LV20',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_14'],
    },
    25: {
      name: '吸血特化LV25',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17'],
    },
    30: {
      name: '吸血特化LV30',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3'],
    },
    35: {
      name: '吸血特化LV35',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1'],
    },
    40: {
      name: '吸血特化LV40',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13'],
    },
    45: {
      name: '吸血特化LV45',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    50: {
      name: '吸血特化LV50',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
  },

  /** 防御特化 */
  GUARD: {
    5: {
      name: '防御特化LV5',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3'],
    },
    10: {
      name: '防御特化LV10',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1'],
    },
    15: {
      name: '防御特化LV15',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12'],
    },
    20: {
      name: '防御特化LV20',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_14'],
    },
    25: {
      name: '防御特化LV25',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17'],
    },
    30: {
      name: '防御特化LV30',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    35: {
      name: '防御特化LV35',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
    40: {
      name: '防御特化LV40',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13'],
    },
    45: {
      name: '防御特化LV45',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2'],
    },
    50: {
      name: '防御特化LV50',
      nodes: ['start', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2'],
    },
  },

  /** 攻撃速度特化 */
  SPEED: {
    5: {
      name: '速度特化LV5',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3'],
    },
    10: {
      name: '速度特化LV10',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1'],
    },
    15: {
      name: '速度特化LV15',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12'],
    },
    20: {
      name: '速度特化LV20',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2'],
    },
    25: {
      name: '速度特化LV25',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6'],
    },
    30: {
      name: '速度特化LV30',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10'],
    },
    35: {
      name: '速度特化LV35',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2'],
    },
    40: {
      name: '速度特化LV40',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17'],
    },
    45: {
      name: '速度特化LV45',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    50: {
      name: '速度特化LV50',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
  },

  // ========================================
  // バランスルート（クリ・毒は混ぜない）
  // ========================================

  /** 回復+防御バランス */
  REGEN_GUARD: {
    5: {
      name: '回復防御LV5',
      nodes: ['start', 'regen_1', 'guard_1', 'regen_2'],
    },
    10: {
      name: '回復防御LV10',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'guard_1', 'guard_2', 'guard_3', 'guard_4'],
    },
    15: {
      name: '回復防御LV15',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7'],
    },
    20: {
      name: '回復防御LV20',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8'],
    },
    25: {
      name: '回復防御LV25',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10'],
    },
    30: {
      name: '回復防御LV30',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13'],
    },
    35: {
      name: '回復防御LV35',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2'],
    },
    40: {
      name: '回復防御LV40',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2'],
    },
    45: {
      name: '回復防御LV45',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17'],
    },
    50: {
      name: '回復防御LV50',
      nodes: ['start', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2'],
    },
  },

  /** 速度+回復バランス */
  SPEED_REGEN: {
    5: {
      name: '速度回復LV5',
      nodes: ['start', 'speed_1', 'regen_1', 'speed_2'],
    },
    10: {
      name: '速度回復LV10',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'regen_1', 'regen_2', 'regen_3', 'regen_4'],
    },
    15: {
      name: '速度回復LV15',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7'],
    },
    20: {
      name: '速度回復LV20',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8'],
    },
    25: {
      name: '速度回復LV25',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10'],
    },
    30: {
      name: '速度回復LV30',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13'],
    },
    35: {
      name: '速度回復LV35',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2'],
    },
    40: {
      name: '速度回復LV40',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    45: {
      name: '速度回復LV45',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3'],
    },
    50: {
      name: '速度回復LV50',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1'],
    },
  },

  /** 吸血+速度バランス */
  VAMP_SPEED: {
    5: {
      name: '吸血速度LV5',
      nodes: ['start', 'vamp_1', 'speed_1', 'vamp_2'],
    },
    10: {
      name: '吸血速度LV10',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'speed_1', 'speed_2', 'speed_3', 'speed_4'],
    },
    15: {
      name: '吸血速度LV15',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7'],
    },
    20: {
      name: '吸血速度LV20',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8'],
    },
    25: {
      name: '吸血速度LV25',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10'],
    },
    30: {
      name: '吸血速度LV30',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13'],
    },
    35: {
      name: '吸血速度LV35',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2'],
    },
    40: {
      name: '吸血速度LV40',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    45: {
      name: '吸血速度LV45',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6'],
    },
    50: {
      name: '吸血速度LV50',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
  },

  /** 吸血+回復バランス（生存重視） */
  VAMP_REGEN: {
    5: {
      name: '吸血回復LV5',
      nodes: ['start', 'vamp_1', 'regen_1', 'vamp_2'],
    },
    10: {
      name: '吸血回復LV10',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'regen_1', 'regen_2', 'regen_3', 'regen_4'],
    },
    15: {
      name: '吸血回復LV15',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7'],
    },
    20: {
      name: '吸血回復LV20',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8'],
    },
    25: {
      name: '吸血回復LV25',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10'],
    },
    30: {
      name: '吸血回復LV30',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13'],
    },
    35: {
      name: '吸血回復LV35',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2'],
    },
    40: {
      name: '吸血回復LV40',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    45: {
      name: '吸血回復LV45',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    50: {
      name: '吸血回復LV50',
      nodes: ['start', 'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5', 'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9', 'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1', 'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15', 'vamp_16', 'vamp_17', 'vamp_final1', 'vamp_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2'],
    },
  },

  /** 速度+防御バランス */
  SPEED_GUARD: {
    5: {
      name: '速度防御LV5',
      nodes: ['start', 'speed_1', 'guard_1', 'speed_2'],
    },
    10: {
      name: '速度防御LV10',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'guard_1', 'guard_2', 'guard_3', 'guard_4'],
    },
    15: {
      name: '速度防御LV15',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7'],
    },
    20: {
      name: '速度防御LV20',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8'],
    },
    25: {
      name: '速度防御LV25',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10'],
    },
    30: {
      name: '速度防御LV30',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13'],
    },
    35: {
      name: '速度防御LV35',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2'],
    },
    40: {
      name: '速度防御LV40',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17'],
    },
    45: {
      name: '速度防御LV45',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3'],
    },
    50: {
      name: '速度防御LV50',
      nodes: ['start', 'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5', 'speed_6', 'speed_7', 'speed_key1', 'speed_8', 'speed_9', 'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_final1', 'speed_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1'],
    },
  },

  // ========================================
  // 毒バランスルート
  // ========================================

  /** 毒+防御バランス（毒付与しつつダメージ軽減で耐える） */
  POISON_GUARD: {
    5: {
      name: '毒防御LV5',
      nodes: ['start', 'poison_1', 'guard_1', 'poison_2'],
    },
    10: {
      name: '毒防御LV10',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'guard_1', 'guard_2', 'guard_3', 'guard_4'],
    },
    15: {
      name: '毒防御LV15',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7'],
    },
    20: {
      name: '毒防御LV20',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8'],
    },
    25: {
      name: '毒防御LV25',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10'],
    },
    30: {
      name: '毒防御LV30',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13'],
    },
    35: {
      name: '毒防御LV35',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2'],
    },
    40: {
      name: '毒防御LV40',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17'],
    },
    45: {
      name: '毒防御LV45',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17'],
    },
    50: {
      name: '毒防御LV50',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5', 'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15', 'guard_16', 'guard_17', 'guard_final1', 'guard_final2'],
    },
  },

  /** 毒+回復バランス（毒付与しつつHP回復で耐える） */
  POISON_REGEN: {
    5: {
      name: '毒回復LV5',
      nodes: ['start', 'poison_1', 'regen_1', 'poison_2'],
    },
    10: {
      name: '毒回復LV10',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'regen_1', 'regen_2', 'regen_3', 'regen_4'],
    },
    15: {
      name: '毒回復LV15',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7'],
    },
    20: {
      name: '毒回復LV20',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8'],
    },
    25: {
      name: '毒回復LV25',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10'],
    },
    30: {
      name: '毒回復LV30',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13'],
    },
    35: {
      name: '毒回復LV35',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2'],
    },
    40: {
      name: '毒回復LV40',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    45: {
      name: '毒回復LV45',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17'],
    },
    50: {
      name: '毒回復LV50',
      nodes: ['start', 'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5', 'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9', 'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1', 'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15', 'poison_16', 'poison_17', 'poison_final1', 'poison_final2', 'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5', 'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9', 'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1', 'regen_a2', 'regen_b1', 'regen_b2', 'regen_14', 'regen_15', 'regen_16', 'regen_17', 'regen_final1', 'regen_final2'],
    },
  },
};

/**
 * レベル別プリセットを取得
 * @param presetType プリセットタイプ（POISON, CRIT, REGEN, VAMP, GUARD, SPEED, またはバランス系）
 * @param level レベル（5, 10, 15, 20, 25, 30, 35, 40, 45, 50）
 */
export function getLevelBasedPreset(
  presetType: keyof typeof LEVEL_BASED_PRESETS,
  level: 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50
): PassivePreset {
  return LEVEL_BASED_PRESETS[presetType][level];
}
