import { describe, it, expect } from 'vitest';
import { createBattleEngine, runBattleEngineToEnd } from '../../core/battleEngine';
import { createEmptyModEffects } from '../../core/modEffects';
import { EnemyConfig, Stats } from '../../core/types';

describe('core/battleEngine', () => {
  const player: Stats = { maxHp: 100, atk: 50, def: 5 };
  const enemy: EnemyConfig = { id: 'slime', name: 'Slime', maxHp: 20, atk: 1, def: 0, exp: 3 };

  it('runBattleEngineToEnd は勝利結果を返す', () => {
    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: createEmptyModEffects(),
      enemy,
      rng: () => 0,
    });
    const result = runBattleEngineToEnd(engine, enemy.exp, 5000);
    expect(result.victory).toBe(true);
    expect(result.expGained).toBe(enemy.exp);
    expect(result.totalTicks).toBeGreaterThan(0);
  });

  it('advanceTicks は tick を進める', () => {
    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: createEmptyModEffects(),
      enemy,
      rng: () => 0,
    });

    const before = engine.getState().elapsedTicks;
    engine.advanceTicks(5);
    const after = engine.getState().elapsedTicks;
    expect(after - before).toBe(5);
  });
});
