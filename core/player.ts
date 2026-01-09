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
  maxHp: 0,       // ステータス強化はスキルツリーで行う
  atk: 0,         // ステータス強化はスキルツリーで行う
  def: 0,         // ステータス強化はスキルツリーで行う
  skillPoints: 1, // スキルポイントのみ獲得
};

/** レベル上限 */
export const MAX_LEVEL = 50;

/** インベントリの最大サイズ */
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
  expGained: number
): LevelUpResult {
  let level = currentLevel;
  let exp = currentExp + expGained;
  let expToNext = getExpToNextLevel(level);
  let totalHpGained = 0;
  let totalAtkGained = 0;
  let totalDefGained = 0;
  let skillPointsGained = 0;

  // レベル上限チェック
  if (level >= MAX_LEVEL) {
    return {
      newLevel: MAX_LEVEL,
      newExp: 0, // 上限時は経験値を貯めない
      expToNextLevel: 0,
      skillPointsGained: 0,
      statsGained: { maxHp: 0, atk: 0, def: 0 },
    };
  }

  // レベルアップ処理（複数回レベルアップ対応）
  while (exp >= expToNext && level < MAX_LEVEL) {
    exp -= expToNext;
    level += 1;
    expToNext = getExpToNextLevel(level);

    totalHpGained += LEVEL_UP_BONUS.maxHp;
    totalAtkGained += LEVEL_UP_BONUS.atk;
    totalDefGained += LEVEL_UP_BONUS.def;
    skillPointsGained += LEVEL_UP_BONUS.skillPoints;
  }

  // 上限到達時は経験値をリセット
  if (level >= MAX_LEVEL) {
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
