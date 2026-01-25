import { EnemyConfig } from './types';

type I18nLike = {
  exists: (key: string) => boolean;
  t: (key: string) => string;
};

let cachedI18n: I18nLike | null | undefined;

const getI18n = (): I18nLike | null => {
  if (cachedI18n !== undefined) return cachedI18n ?? null;
  try {
    // Lazy load to avoid pulling React Native deps in scripts.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@/lib/i18n');
    cachedI18n = (mod?.default ?? mod) as I18nLike;
    return cachedI18n ?? null;
  } catch {
    cachedI18n = null;
    return null;
  }
};

export const DIMENSIONAL_RUSH_ID = 'dimensional_rush';

export const DEBUG_DIMENSIONAL_DUNGEON_IDS: string[] = [
  'debug_dimensional_goblin_king',
  'debug_dimensional_bandit_leader',
  'debug_dimensional_vampire',
  'debug_dimensional_kraken',
  'debug_dimensional_demon_lord',
  'debug_dimensional_true_final_boss',
];

export const DIMENSIONAL_RUSH_BOSS_FLOORS: Record<number, string> = {
  50: 'goblin_king',
  70: 'bandit_leader',
  90: 'vampire',
  110: 'kraken',
  120: 'demon_lord',
  200: 'true_final_boss',
};

export const DIMENSIONAL_RUSH_BOSS_IDS = Object.values(DIMENSIONAL_RUSH_BOSS_FLOORS);
export const DIMENSIONAL_RUSH_BOSS_FLOOR_BY_ID: Record<string, number> = Object.fromEntries(
  Object.entries(DIMENSIONAL_RUSH_BOSS_FLOORS).map(([floor, id]) => [id, Number(floor)])
);

// 異次元ラッシュのスケーリング係数
export const DIMENSIONAL_RUSH_BOSS_STAT_MULT = 1.5;
export const DIMENSIONAL_RUSH_BOSS_HP_MULT = 2.5;
export const DIMENSIONAL_RUSH_NORMAL_HP_MULT = DIMENSIONAL_RUSH_BOSS_HP_MULT / DIMENSIONAL_RUSH_BOSS_STAT_MULT;
export const DIMENSIONAL_RUSH_NORMALIZE_ALPHA = 0.9;

export const UBER_BOSS_BY_BASE: Record<string, string> = {
  goblin_king: 'uber_goblin_king',
  bandit_leader: 'uber_bandit_leader',
  vampire: 'uber_vampire',
  kraken: 'uber_kraken',
  demon_lord: 'uber_demon_lord',
  true_final_boss: 'uber_true_final_boss',
};

export const BASE_BOSS_BY_UBER = Object.fromEntries(
  Object.entries(UBER_BOSS_BY_BASE).map(([base, uber]) => [uber, base])
);

export const UBER_DUNGEON_IDS = Object.values(UBER_BOSS_BY_BASE);

export const isEndContentDungeon = (dungeonId: string): boolean => {
  return dungeonId === DIMENSIONAL_RUSH_ID
    || UBER_DUNGEON_IDS.includes(dungeonId)
    || DEBUG_DIMENSIONAL_DUNGEON_IDS.includes(dungeonId);
};

export const getBaseBossId = (enemyId: string): string => {
  return BASE_BOSS_BY_UBER[enemyId] ?? enemyId;
};

export const isUberBoss = (enemyId: string): boolean => {
  return Boolean(BASE_BOSS_BY_UBER[enemyId]);
};

export const getBossSkillName = (enemyId: string): string | null => {
  const baseId = getBaseBossId(enemyId);
  const key = `bossSkills.${baseId}.name`;
  const i18n = getI18n();
  if (!i18n) return null;
  if (!i18n.exists(key)) return null;
  return i18n.t(key);
};

export const getPlayerAtkMultiplier = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'goblin_king') return uber ? 0.75 : 0.85;
  return 1;
};

export const getPlayerDefMultiplier = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'kraken') return uber ? 0.75 : 0.85;
  return 1;
};

export const getPlayerAttackSpeedMultiplier = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'bandit_leader') return uber ? 0.7 : 0.8;
  return 1;
};

export const getEnemyAtkMultiplier = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'goblin_king') return uber ? 1.35 : 1.2;
  if (baseId === 'kraken') return uber ? 1.3 : 1.15;
  if (baseId === 'true_final_boss') return uber ? 1.8 : 1.5;
  return 1;
};

export const getEnemyAttackSpeedMultiplier = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'kraken') return uber ? 1.35 : 1.2;
  return 1;
};

export const getEnemyDamageReductionPct = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'demon_lord') return uber ? 4 : 2;
  return 0;
};

export const getEnemyHpOnHit = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'vampire') return uber ? 160 : 100;
  return 0;
};

export const getEnemyRegenPerSecond = (enemyId: string): number => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'goblin_king') return uber ? 2000 : 0;
  if (baseId === 'kraken') return uber ? 150 : 100;
  if (baseId === 'demon_lord') return uber ? 1400 : 1000;
  if (baseId === 'true_final_boss') return uber ? 3000 : 2200;
  return 0;
};

export const getPlayerPoisonFromBoss = (
  enemyId: string
): { damage: number; turns: number } | null => {
  const baseId = getBaseBossId(enemyId);
  const uber = isUberBoss(enemyId);
  if (baseId === 'vampire') {
    return { damage: uber ? 120 : 80, turns: 5 };
  }
  if (baseId === 'demon_lord') {
    return { damage: uber ? 180 : 120, turns: 6 };
  }
  return null;
};

export const getDimensionalRushFloorMultiplier = (floor: number): number => {
  if (floor <= 119) return 1.1;
  if (floor <= 149) return 1.3;
  if (floor <= 179) return 1.3;
  return 1.3;
};

export const scaleEnemyStats = <T extends EnemyConfig>(
  enemy: T,
  multipliers: { hp: number; atk: number; def: number; exp: number }
): T => {
  return {
    ...enemy,
    maxHp: Math.max(1, Math.floor(enemy.maxHp * multipliers.hp)),
    atk: Math.max(1, Math.floor(enemy.atk * multipliers.atk)),
    def: Math.max(1, Math.floor(enemy.def * multipliers.def)),
    exp: Math.max(1, Math.floor(enemy.exp * multipliers.exp)),
  };
};
