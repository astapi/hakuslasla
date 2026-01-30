import { describe, it, expect } from 'vitest';
import {
  generateSimulationReport,
  generateBalanceReport,
  runBalanceTest,
  generateGaugeSimulationReport,
  generateGaugeBalanceReport,
  runGaugeBalanceTest,
} from '../../core/simulation';
import { createDefaultPlayerConfig } from '../../core/player';
import { createEmptyModEffects } from '../../core/modEffects';
import { EnemyConfig, DungeonConfig, SimulationResult, SimulationStats } from '../../core/types';

const enemy: EnemyConfig = { id: 'slime', name: 'Slime', maxHp: 10, atk: 1, def: 0, exp: 1 };
const dungeon: DungeonConfig = {
  id: 'test_dungeon',
  name: 'Test',
  maxFloor: 1,
  enemies: [enemy.id],
  dropTable: [],
};
const enemyData = new Map<string, EnemyConfig>([[enemy.id, enemy]]);

describe('core/reports', () => {
  it('generateSimulationReport は文字列を返す', () => {
    const stats: SimulationStats = {
      winRate: 1,
      avgTurns: 1,
      avgExpGained: 1,
      avgFloorsCleared: 1,
      avgPlayerHpRemaining: 1,
      minTurns: 1,
      maxTurns: 1,
      totalRuns: 1,
      wins: 1,
      losses: 0,
    };
    const result: SimulationResult = {
      config: { playerConfig: createDefaultPlayerConfig(1), dungeonId: dungeon.id, runs: 1 },
      stats,
      results: [],
    };

    const report = generateSimulationReport(result);
    expect(report.length).toBeGreaterThan(0);
  });

  it('runBalanceTest / generateBalanceReport はレポートを作る', () => {
    const balance = runBalanceTest(
      { playerLevels: [1, 5], dungeonId: dungeon.id, runsPerLevel: 1, seed: 1 },
      dungeon,
      enemyData,
      (level) => createDefaultPlayerConfig(level)
    );
    const report = generateBalanceReport(balance);
    expect(report.includes('バランステスト結果')).toBe(true);
  });

  it('generateGaugeSimulationReport は文字列を返す', () => {
    const report = generateGaugeSimulationReport({
      config: { playerStats: { maxHp: 10, atk: 5, def: 1 }, modEffects: createEmptyModEffects(), dungeonId: dungeon.id, runs: 1 },
      stats: {
        winRate: 1,
        avgTicks: 10,
        avgSeconds: 0.3,
        avgExpGained: 1,
        avgFloorsCleared: 1,
        avgPlayerHpRemaining: 1,
        minTicks: 10,
        maxTicks: 10,
        totalRuns: 1,
        wins: 1,
        losses: 0,
      },
      results: [],
    });
    expect(report.length).toBeGreaterThan(0);
  });

  it('runGaugeBalanceTest / generateGaugeBalanceReport はレポートを作る', () => {
    const balance = runGaugeBalanceTest(
      { playerLevels: [1, 5], dungeonId: dungeon.id, runsPerLevel: 1, seed: 1 },
      dungeon,
      enemyData,
      (level) => ({ maxHp: 10 + level, atk: 5, def: 1 })
    );
    const report = generateGaugeBalanceReport(balance);
    expect(report.includes('ゲージ制バランステスト結果')).toBe(true);
  });
});
