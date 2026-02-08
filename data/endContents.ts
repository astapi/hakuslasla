import { Enemy, MonsterSpawn } from '@/types';
import dungeonsData from './json/dungeons.json';
import { getEnemy } from './enemies';
import {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOORS,
  DIMENSIONAL_RUSH_IDS,
  DIMENSIONAL_RUSH_FLOOR_OFFSET,
  DIMENSIONAL_RUSH_UNLOCK_CHAIN,
  UBER_BOSS_BY_BASE,
  UBER_DUNGEON_IDS,
  DIMENSIONAL_RUSH_BOSS_HP_MULT,
  DIMENSIONAL_RUSH_BOSS_STAT_MULT,
  DIMENSIONAL_RUSH_NORMAL_HP_MULT,
  DIMENSIONAL_RUSH_NORMALIZE_ALPHA,
  getDimensionalRushFloorMultiplier,
  getDimensionalCorridorMultiplier,
  getDimensionalCorridorBossId,
  scaleEnemyStats,
  isDimensionalRushDungeon,
  isDimensionalCorridorDungeon,
  toOriginalDimensionalRushFloor,
  DIMENSIONAL_CORRIDOR_ID,
} from '@/core/endContent';

export {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOORS,
  DIMENSIONAL_RUSH_IDS,
  DIMENSIONAL_RUSH_FLOOR_OFFSET,
  DIMENSIONAL_RUSH_UNLOCK_CHAIN,
  UBER_BOSS_BY_BASE,
  UBER_DUNGEON_IDS,
  isDimensionalRushDungeon,
  isDimensionalCorridorDungeon,
  toOriginalDimensionalRushFloor,
  DIMENSIONAL_CORRIDOR_ID,
};

const EARLY_DUNGEON_IDS = [
  'grassland',
  'cave',
  'ruins',
  'goblin_fort',
  'bandit_hideout',
  'vampire_mansion',
  'underwater_cave',
  'orc_fortress',
  'volcano',
  'demon_castle',
];

const LATE_DUNGEON_IDS = [
  'ice_cave',
  'dark_forest',
  'sky_tower',
  'hell_gate',
  'dragon_nest',
  'sacred_temple',
  'chaos_realm',
  'final_land',
];

const dungeonMonsters = (dungeonsData.dungeons as Record<string, { monsters?: MonsterSpawn[] }>);

const collectSpawns = (ids: string[]): MonsterSpawn[] => {
  return ids.flatMap((id) => dungeonMonsters[id]?.monsters ?? []);
};

const computeWeightedAverage = (spawns: MonsterSpawn[]) => {
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
    hp: totals.hp / weight,
    atk: totals.atk / weight,
    def: totals.def / weight,
    exp: totals.exp / weight,
    attackSpeed: totals.attackSpeed / weight,
  };
};

const finalLandSpawns = collectSpawns(['final_land']);
const finalLandAverage = computeWeightedAverage(finalLandSpawns);

const earlySpawns = collectSpawns(EARLY_DUNGEON_IDS);
const lateSpawns = collectSpawns(LATE_DUNGEON_IDS);

const toNormalization = (enemy: Enemy) => {
  const hpRatio = finalLandAverage.hp / Math.max(1, enemy.maxHp);
  const atkRatio = finalLandAverage.atk / Math.max(1, enemy.atk);
  const defRatio = finalLandAverage.def / Math.max(1, enemy.def);
  const expRatio = finalLandAverage.exp / Math.max(1, enemy.exp);
  const speedRatio = finalLandAverage.attackSpeed / Math.max(0.1, enemy.attackSpeed ?? 1);
  return {
    hp: Math.max(1, Math.pow(hpRatio, DIMENSIONAL_RUSH_NORMALIZE_ALPHA)),
    atk: Math.max(1, Math.pow(atkRatio, DIMENSIONAL_RUSH_NORMALIZE_ALPHA)),
    def: Math.max(1, Math.pow(defRatio, DIMENSIONAL_RUSH_NORMALIZE_ALPHA)),
    exp: Math.max(1, Math.pow(expRatio, DIMENSIONAL_RUSH_NORMALIZE_ALPHA)),
    attackSpeed: Math.max(1, Math.pow(speedRatio, DIMENSIONAL_RUSH_NORMALIZE_ALPHA)),
  };
};

const pickEnemyByRng = (spawns: MonsterSpawn[], rng: () => number): Enemy | undefined => {
  if (spawns.length === 0) return undefined;
  const totalRate = spawns.reduce((sum, spawn) => sum + spawn.spawnRate, 0);
  let roll = rng() * totalRate;
  for (const spawn of spawns) {
    roll -= spawn.spawnRate;
    if (roll <= 0) {
      return getEnemy(spawn.monsterId);
    }
  }
  return getEnemy(spawns[spawns.length - 1].monsterId);
};

export const getDimensionalRushEnemy = (
  floor: number,
  rng: () => number = Math.random
): Enemy | undefined => {
  const bossId = DIMENSIONAL_RUSH_BOSS_FLOORS[floor];
  const multiplier = getDimensionalRushFloorMultiplier(floor);

  if (bossId) {
    const boss = getEnemy(bossId);
    if (!boss) return undefined;
    const normalization = toNormalization(boss);
    return {
      ...scaleEnemyStats(boss, {
        hp: normalization.hp * multiplier * DIMENSIONAL_RUSH_BOSS_HP_MULT,
        atk: normalization.atk * multiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT,
        def: normalization.def * multiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT,
        exp: normalization.exp * multiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT,
      }),
      attackSpeed: Math.max(0.1, (boss.attackSpeed ?? 1) * normalization.attackSpeed),
    };
  }

  const isEarly = floor <= 120;
  const spawns = isEarly ? earlySpawns : lateSpawns;
  const baseEnemy = pickEnemyByRng(spawns, rng);
  if (!baseEnemy) return undefined;
  const normalization = toNormalization(baseEnemy);
  return {
    ...scaleEnemyStats(baseEnemy, {
      hp: normalization.hp * multiplier * DIMENSIONAL_RUSH_NORMAL_HP_MULT,
      atk: normalization.atk * multiplier,
      def: normalization.def * multiplier,
      exp: normalization.exp * multiplier,
    }),
    attackSpeed: Math.max(0.1, (baseEnemy.attackSpeed ?? 1) * normalization.attackSpeed),
  };
};

/**
 * 次元回廊の敵生成
 * - ベースは異次元ラッシュと同じ
 * - 30階ごとにHP/ATKが+0.1倍（固定加算）、DEF/EXP/攻撃速度はスケールなし
 * - ボスは200階周期でループ
 */
export const getDimensionalCorridorEnemy = (
  floor: number,
  rng: () => number = Math.random
): Enemy | undefined => {
  const corridorMult = getDimensionalCorridorMultiplier(floor);
  const bossId = getDimensionalCorridorBossId(floor);
  // 異次元ラッシュの基準フロア（ボスステータス計算用）
  const rushFloor = bossId
    ? Object.entries(DIMENSIONAL_RUSH_BOSS_FLOORS).find(([, id]) => id === bossId)?.[0]
    : null;
  const rushFloorNum = rushFloor ? Number(rushFloor) : floor;
  const rushMultiplier = getDimensionalRushFloorMultiplier(rushFloorNum);

  if (bossId) {
    const boss = getEnemy(bossId);
    if (!boss) return undefined;
    const normalization = toNormalization(boss);
    // HP/ATKのみ corridorMult を適用、DEF/EXP/攻撃速度はスケールなし
    return {
      ...scaleEnemyStats(boss, {
        hp: normalization.hp * rushMultiplier * DIMENSIONAL_RUSH_BOSS_HP_MULT * corridorMult,
        atk: normalization.atk * rushMultiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT * corridorMult,
        def: normalization.def * rushMultiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT,
        exp: normalization.exp * rushMultiplier * DIMENSIONAL_RUSH_BOSS_STAT_MULT,
      }),
      attackSpeed: Math.max(0.1, (boss.attackSpeed ?? 1) * normalization.attackSpeed),
    };
  }

  // 通常敵: 120階以下は早期ダンジョン、それ以降は後期ダンジョンから選択
  const isEarly = floor <= 120;
  const spawns = isEarly ? earlySpawns : lateSpawns;
  const baseEnemy = pickEnemyByRng(spawns, rng);
  if (!baseEnemy) return undefined;
  const normalization = toNormalization(baseEnemy);
  // HP/ATKのみ corridorMult を適用、DEF/EXP/攻撃速度はスケールなし
  return {
    ...scaleEnemyStats(baseEnemy, {
      hp: normalization.hp * rushMultiplier * DIMENSIONAL_RUSH_NORMAL_HP_MULT * corridorMult,
      atk: normalization.atk * rushMultiplier * corridorMult,
      def: normalization.def * rushMultiplier,
      exp: normalization.exp * rushMultiplier,
    }),
    attackSpeed: Math.max(0.1, (baseEnemy.attackSpeed ?? 1) * normalization.attackSpeed),
  };
};
