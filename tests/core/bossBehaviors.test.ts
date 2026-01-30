import { describe, it, expect } from 'vitest';
import {
  applyEnemyAttackPreEffects,
  applyEnemyHpThresholdEffects,
  applyPlayerAttackPostEffects,
  createBossEffectState,
} from '../../core/bossBehaviors';

describe('core/bossBehaviors', () => {
  it('applyEnemyAttackPreEffects は 3回ごとに発火する', () => {
    const state = createBossEffectState();
    const ctx = {
      enemyId: 'goblin_king',
      enemyMaxHp: 100,
      enemyCurrentHp: 100,
      playerCurrentHp: 100,
      playerMaxHp: 100,
    };

    applyEnemyAttackPreEffects(ctx, state, 1);
    applyEnemyAttackPreEffects(ctx, state, 2);
    const result = applyEnemyAttackPreEffects(ctx, state, 3);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it('applyEnemyHpThresholdEffects は HP50% 以下で発火する', () => {
    const state = createBossEffectState();
    const ctx = {
      enemyId: 'kraken',
      enemyMaxHp: 100,
      enemyCurrentHp: 40,
      playerCurrentHp: 100,
      playerMaxHp: 100,
    };

    const events = applyEnemyHpThresholdEffects(ctx, state, 1);
    expect(events.length).toBeGreaterThan(0);
  });

  it('applyPlayerAttackPostEffects は残存ターンを減らす', () => {
    const state = createBossEffectState();
    state.playerAttackSpeedRemaining = 1;
    state.playerAttackSpeedMult = 0.8;

    const ctx = {
      enemyId: 'bandit_leader',
      enemyMaxHp: 100,
      enemyCurrentHp: 80,
      playerCurrentHp: 100,
      playerMaxHp: 100,
    };

    applyPlayerAttackPostEffects(ctx, state, 1);
    expect(state.playerAttackSpeedRemaining).toBe(0);
    expect(state.playerAttackSpeedMult).toBe(1);
  });
});
