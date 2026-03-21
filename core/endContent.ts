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

// 分割された異次元ラッシュダンジョンID
export const DIMENSIONAL_RUSH_IDS = [
  'dimensional_rush_1',
  'dimensional_rush_2',
  'dimensional_rush_3',
  'dimensional_rush_4',
  'dimensional_rush_5',
  'dimensional_rush_6',
] as const;

// 次元回廊ダンジョンID
export const DIMENSIONAL_CORRIDOR_ID = 'dimensional_corridor';

// 各分割ダンジョンのフロアオフセット（累積的な階層構成なのですべて0）
export const DIMENSIONAL_RUSH_FLOOR_OFFSET: Record<string, number> = {
  dimensional_rush_1: 0,   // 1-50階
  dimensional_rush_2: 0,   // 1-70階（50階にゴブリンキングも出現）
  dimensional_rush_3: 0,   // 1-90階
  dimensional_rush_4: 0,   // 1-110階
  dimensional_rush_5: 0,   // 1-120階
  dimensional_rush_6: 0,   // 1-200階
};

// 各分割ダンジョンの開放条件（前のダンジョンをクリアで開放）
export const DIMENSIONAL_RUSH_UNLOCK_CHAIN: Record<string, string | null> = {
  dimensional_rush_1: null,                // 終焉の地クリアで開放
  dimensional_rush_2: 'dimensional_rush_1',
  dimensional_rush_3: 'dimensional_rush_2',
  dimensional_rush_4: 'dimensional_rush_3',
  dimensional_rush_5: 'dimensional_rush_4',
  dimensional_rush_6: 'dimensional_rush_5',
};

export const DEBUG_DIMENSIONAL_DUNGEON_IDS: string[] = [
  'debug_dimensional_goblin_king',
  'debug_dimensional_bandit_leader',
  'debug_dimensional_vampire',
  'debug_dimensional_kraken',
  'debug_dimensional_demon_lord',
  'debug_dimensional_true_final_boss',
];

// 元の異次元ラッシュでのボス階層（スケーリング計算に使用）
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

export const UBER_UBER_BOSS_BY_UBER: Record<string, string> = {
  uber_goblin_king: 'uber_uber_goblin_king',
};

export const UBER_BY_UBER_UBER = Object.fromEntries(
  Object.entries(UBER_UBER_BOSS_BY_UBER).map(([uber, uberUber]) => [uberUber, uber])
);

export const UBER_UBER_DUNGEON_IDS = Object.values(UBER_UBER_BOSS_BY_UBER);

export const UBER_DUNGEON_IDS = Object.values(UBER_BOSS_BY_BASE);

export const isDimensionalRushDungeon = (dungeonId: string): boolean => {
  return (DIMENSIONAL_RUSH_IDS as readonly string[]).includes(dungeonId);
};

export const isDimensionalCorridorDungeon = (dungeonId: string): boolean => {
  return dungeonId === DIMENSIONAL_CORRIDOR_ID;
};

export const isEndContentDungeon = (dungeonId: string): boolean => {
  return isDimensionalRushDungeon(dungeonId)
    || isDimensionalCorridorDungeon(dungeonId)
    || UBER_DUNGEON_IDS.includes(dungeonId)
    || UBER_UBER_DUNGEON_IDS.includes(dungeonId)
    || DEBUG_DIMENSIONAL_DUNGEON_IDS.includes(dungeonId);
};

// 分割ダンジョンのローカルフロアを元の異次元ラッシュフロアに変換
export const toOriginalDimensionalRushFloor = (dungeonId: string, localFloor: number): number => {
  const offset = DIMENSIONAL_RUSH_FLOOR_OFFSET[dungeonId] ?? 0;
  return offset + localFloor;
};

export const getBaseBossId = (enemyId: string): string => {
  // UberUber → Uber → Base の順で解決
  const fromUberUber = UBER_BY_UBER_UBER[enemyId];
  if (fromUberUber) return BASE_BOSS_BY_UBER[fromUberUber] ?? fromUberUber;
  return BASE_BOSS_BY_UBER[enemyId] ?? enemyId;
};

export const isUberBoss = (enemyId: string): boolean => {
  return Boolean(BASE_BOSS_BY_UBER[enemyId]) || isUberUberBoss(enemyId);
};

export const isUberUberBoss = (enemyId: string): boolean => {
  return Boolean(UBER_BY_UBER_UBER[enemyId]);
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
  const uberUber = isUberUberBoss(enemyId);
  if (baseId === 'goblin_king') return uberUber ? 0.7 : uber ? 0.75 : 0.85;
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
  const uberUber = isUberUberBoss(enemyId);
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
  if (baseId === 'goblin_king') return isUberUberBoss(enemyId) ? 3000 : uber ? 2000 : 0;
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

// 次元回廊: 30階ごとにHP/ATKが+0.1倍（固定加算）
export const getDimensionalCorridorMultiplier = (floor: number): number => {
  const tier = Math.floor(floor / 30);
  return 1.0 + tier * 0.1;
};

// 次元回廊: ボスフロア判定（200階周期でループ）
export const getDimensionalCorridorBossId = (floor: number): string | null => {
  const floorInCycle = floor % 200 || 200; // 200→200, 400→200, 50→50
  const bossMap: Record<number, string> = {
    50: 'goblin_king',
    70: 'bandit_leader',
    90: 'vampire',
    110: 'kraken',
    120: 'demon_lord',
    200: 'true_final_boss',
  };
  return bossMap[floorInCycle] ?? null;
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
