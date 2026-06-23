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

  it('シールドは通常被ダメージをHPより先に受ける', () => {
    const mods = {
      ...createEmptyModEffects(),
      shield: 50,
    };
    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: mods,
      enemy: { ...enemy, maxHp: 999, atk: 10, attackSpeed: 1 },
      rng: () => 0.99,
    });

    engine.advanceTicks(15);
    const state = engine.getState();
    expect(state.player.currentHp).toBe(player.maxHp);
    expect(state.playerShield).toBeLessThan(state.playerMaxShield);
  });

  it('ブロック成功時は通常被ダメージを100%軽減する', () => {
    const mods = {
      ...createEmptyModEffects(),
      blockChance: 100,
      shield: 50,
    };
    const { engine } = createBattleEngine({
      playerStats: { ...player, atk: 0 },
      playerCurrentHp: player.maxHp,
      playerMods: mods,
      enemy: { ...enemy, maxHp: 999, atk: 100, attackSpeed: 1 },
      rng: () => 0.49,
    });

    const events = engine.advanceTicks(30);
    const state = engine.getState();
    expect(state.player.currentHp).toBe(player.maxHp);
    expect(state.playerShield).toBe(state.playerMaxShield);
    expect(events.some((event) => event.type === 'enemy_attack' && event.data.blocked === true)).toBe(true);
  });

  it('ブロック率は50%で上限になる', () => {
    const mods = {
      ...createEmptyModEffects(),
      blockChance: 100,
    };
    const { engine } = createBattleEngine({
      playerStats: { ...player, atk: 0 },
      playerCurrentHp: player.maxHp,
      playerMods: mods,
      enemy: { ...enemy, maxHp: 999, atk: 100, attackSpeed: 1 },
      rng: () => 0.51,
    });

    const events = engine.advanceTicks(30);
    expect(events.some((event) => event.type === 'enemy_attack' && event.data.blocked === true)).toBe(false);
  });

  it('霊体装甲は最大HPを圧縮し、変換前HPをシールドにする', () => {
    const mods = {
      ...createEmptyModEffects(),
      hpToShield: true,
    };
    const { engine } = createBattleEngine({
      playerStats: { ...player, maxHp: 1000 },
      playerCurrentHp: 1000,
      playerMods: mods,
      enemy,
      rng: () => 0,
    });

    const state = engine.getState();
    expect(state.player.maxHp).toBe(300);
    expect(state.player.currentHp).toBe(300);
    expect(state.playerMaxShield).toBe(1000);
    expect(state.playerShield).toBe(1000);
  });
});
