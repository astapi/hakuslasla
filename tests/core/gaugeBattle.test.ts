import { describe, it, expect } from 'vitest';
import {
  createGaugeBattleState,
  createGaugeBattleStateWithHp,
  runGaugeBattle,
  runGaugeDungeon,
  ticksToSeconds,
  formatBattleTime,
} from '../../core/gaugeBattle';
import { createEmptyModEffects } from '../../core/modEffects';
import { EnemyConfig, DungeonConfig, Stats } from '../../core/types';

describe('core/gaugeBattle', () => {
  const player: Stats = { maxHp: 100, atk: 20, def: 5 };
  const enemy: EnemyConfig = { id: 'slime', name: 'Slime', maxHp: 20, atk: 1, def: 0, exp: 1 };
  const mods = createEmptyModEffects();

  it('createGaugeBattleState は初期ゲージを 0 にする', () => {
    const state = createGaugeBattleState(player, mods, enemy);
    expect(state.player.gauge).toBe(0);
    expect(state.enemy.gauge).toBe(0);
  });

  it('createGaugeBattleStateWithHp は指定HPを反映する', () => {
    const state = createGaugeBattleStateWithHp(player, 42, mods, enemy);
    expect(state.player.currentHp).toBe(42);
  });

  it('runGaugeBattle は勝利を返す', () => {
    const result = runGaugeBattle(player, player.maxHp, mods, enemy, undefined, () => 0);
    expect(result.victory).toBe(true);
    expect(result.expGained).toBe(enemy.exp);
  });

  it('runGaugeDungeon はフロアを進行する', () => {
    const dungeon: DungeonConfig = {
      id: 'd1',
      name: 'D',
      maxFloor: 2,
      enemies: [enemy.id],
      dropTable: [],
    };

    const result = runGaugeDungeon(
      player,
      mods,
      dungeon,
      () => enemy,
      (ids) => ids[0],
      undefined,
      undefined,
      () => 0
    );

    expect(result.floorsCleared).toBe(2);
    expect(result.cleared).toBe(true);
  });

  it('ticksToSeconds / formatBattleTime が正しく変換する', () => {
    const seconds = ticksToSeconds(30);
    expect(seconds).toBeCloseTo(1, 5);
    const text = formatBattleTime(30);
    expect(text.includes('秒')).toBe(true);
  });
});
