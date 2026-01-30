import { describe, it, expect } from 'vitest';
import {
  createRng,
  pickRandom,
  runSimulation,
  calculateSimulationStats,
  runGaugeSimulation,
  calculateGaugeSimulationStats,
} from '../../core/simulation';
import { createDefaultPlayerConfig } from '../../core/player';
import { EnemyConfig, DungeonConfig } from '../../core/types';
import { createEmptyModEffects } from '../../core/modEffects';

describe('core/simulation', () => {
  it('createRng は同じ seed で同じ乱数列を返す', () => {
    const rng1 = createRng(123);
    const rng2 = createRng(123);
    expect(rng1()).toBe(rng2());
    expect(rng1()).toBe(rng2());
  });

  it('pickRandom は配列から要素を返す', () => {
    const rng = () => 0;
    const item = pickRandom([1, 2, 3], rng);
    expect(item).toBe(1);
  });

  it('runSimulation は runs 回数分の結果を返す', () => {
    const enemy: EnemyConfig = { id: 'slime', name: 'Slime', maxHp: 10, atk: 1, def: 0, exp: 1 };
    const dungeon: DungeonConfig = {
      id: 'test_dungeon',
      name: 'Test',
      maxFloor: 1,
      enemies: [enemy.id],
      dropTable: [],
    };

    const enemyData = new Map<string, EnemyConfig>([[enemy.id, enemy]]);
    const playerConfig = createDefaultPlayerConfig(1);

    const result = runSimulation(
      { playerConfig, dungeonId: dungeon.id, runs: 3, seed: 42 },
      dungeon,
      enemyData,
      42
    );

    expect(result.results).toHaveLength(3);
    expect(result.stats.totalRuns).toBe(3);
  });

  it('calculateSimulationStats は空配列で 0 を返す', () => {
    const stats = calculateSimulationStats([]);
    expect(stats.totalRuns).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it('runGaugeSimulation は runs 回数分の結果を返す', () => {
    const enemy: EnemyConfig = { id: 'slime', name: 'Slime', maxHp: 10, atk: 1, def: 0, exp: 1 };
    const dungeon: DungeonConfig = {
      id: 'test_dungeon',
      name: 'Test',
      maxFloor: 1,
      enemies: [enemy.id],
      dropTable: [],
    };

    const enemyData = new Map<string, EnemyConfig>([[enemy.id, enemy]]);

    const result = runGaugeSimulation(
      {
        playerStats: { maxHp: 50, atk: 10, def: 2 },
        modEffects: createEmptyModEffects(),
        dungeonId: dungeon.id,
        runs: 2,
        seed: 7,
      },
      dungeon,
      enemyData,
      7
    );

    expect(result.results).toHaveLength(2);
    expect(result.stats.totalRuns).toBe(2);
  });

  it('calculateGaugeSimulationStats は空配列で 0 を返す', () => {
    const stats = calculateGaugeSimulationStats([]);
    expect(stats.totalRuns).toBe(0);
    expect(stats.winRate).toBe(0);
  });
});
