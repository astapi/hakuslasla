import { Enemy, MonsterSpawn } from '@/types';
import dungeonsData from './json/dungeons.json';
import { getEnemy } from './enemies';
import {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOORS,
  DIMENSIONAL_RUSH_ID,
  UBER_BOSS_BY_BASE,
  UBER_DUNGEON_IDS,
  getDimensionalRushFloorMultiplier,
  scaleEnemyStats,
} from '@/core/endContent';

export {
  BASE_BOSS_BY_UBER,
  DIMENSIONAL_RUSH_BOSS_FLOORS,
  DIMENSIONAL_RUSH_ID,
  UBER_BOSS_BY_BASE,
  UBER_DUNGEON_IDS,
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
      return acc;
    },
    { totalWeight: 0, hp: 0, atk: 0, def: 0, exp: 0 }
  );

  const weight = totals.totalWeight || 1;
  return {
    hp: totals.hp / weight,
    atk: totals.atk / weight,
    def: totals.def / weight,
    exp: totals.exp / weight,
  };
};

const finalLandSpawns = collectSpawns(['final_land']);
const finalLandAverage = computeWeightedAverage(finalLandSpawns);

const earlySpawns = collectSpawns(EARLY_DUNGEON_IDS);
const lateSpawns = collectSpawns(LATE_DUNGEON_IDS);

const earlyAverage = computeWeightedAverage(earlySpawns);
const lateAverage = computeWeightedAverage(lateSpawns);

const toNormalization = (source: typeof earlyAverage) => ({
  hp: finalLandAverage.hp / source.hp,
  atk: finalLandAverage.atk / source.atk,
  def: finalLandAverage.def / source.def,
  exp: finalLandAverage.exp / source.exp,
});

const earlyNormalization = toNormalization(earlyAverage);
const lateNormalization = toNormalization(lateAverage);

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
    const normalization = floor <= 120 ? earlyNormalization : lateNormalization;
    return scaleEnemyStats(boss, {
      hp: normalization.hp * multiplier * 1.5,
      atk: normalization.atk * multiplier * 1.5,
      def: normalization.def * multiplier * 1.5,
      exp: normalization.exp * multiplier * 1.5,
    });
  }

  const isEarly = floor <= 120;
  const spawns = isEarly ? earlySpawns : lateSpawns;
  const baseEnemy = pickEnemyByRng(spawns, rng);
  if (!baseEnemy) return undefined;
  const normalization = isEarly ? earlyNormalization : lateNormalization;
  return scaleEnemyStats(baseEnemy, {
    hp: normalization.hp * multiplier,
    atk: normalization.atk * multiplier,
    def: normalization.def * multiplier,
    exp: normalization.exp * multiplier,
  });
};
