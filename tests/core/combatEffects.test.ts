import { describe, it, expect } from 'vitest';
import {
  executePlayerAttack,
  tryApplyPoison,
  tryApplyIgnite,
  processPoisonDamage,
  processIgniteDamage,
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
  calculateEnemyHitChance,
  createHpRegenEvent,
  createLifestealEvent,
  createEnemyAttackEvent,
} from '../../core/combatEffects';
import { createEmptyModEffects } from '../../core/modEffects';
import { CombinedModEffects, GaugeBattleState, DEFAULT_BATTLE_CONFIG } from '../../core/types';

const baseState: GaugeBattleState = {
  player: { currentHp: 100, maxHp: 100, atk: 10, def: 5, attackSpeed: 1, gauge: 0 },
  enemy: { currentHp: 50, maxHp: 50, atk: 8, def: 2, attackSpeed: 1, gauge: 0 },
  playerShield: 0,
  playerMaxShield: 0,
  playerLastShieldDamageTick: null,
  playerLastHitDamageTick: null,
  playerLastAutoCleanseTick: null,
  enemyPoisonStacks: [],
  playerPoisonStacks: [],
  enemyIgniteState: null,
  enemyChillState: null,
  enemyFreezeState: null,
  playerChillState: null,
  playerFreezeState: null,
  igniteApplyCount: 0,
  warlordEnrageActivated: false,
  enemyWoundStacks: 0,
  enemyWoundActionCounter: 0,
  deferredDamages: [],
  poisonStackAccumulator: 0,
  playerAttackCount: 0,
  elapsedTicks: 0,
  isFinished: false,
  winner: null,
};

const emptyMods: CombinedModEffects = createEmptyModEffects();

describe('core/combatEffects', () => {
  it('executePlayerAttack はクリティカルと追撃を発動する', () => {
    const mods: CombinedModEffects = {
      ...emptyMods,
      criticalChance: 100,
      criticalDamage: 100,
      criticalFollowUpAttack: true,
    };

    const result = executePlayerAttack(baseState, 10, mods, DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.isCritical).toBe(true);
    expect(result.hasFollowUp).toBe(true);
    expect(result.followUpDamage).toBeGreaterThan(0);
  });

  it('tryApplyPoison はスタック上限を超えない', () => {
    const mods: CombinedModEffects = {
      ...emptyMods,
      poisonChance: 100,
    };

    const state: GaugeBattleState = {
      ...baseState,
      enemyPoisonStacks: [{ damagePerTick: 1, remainingTicks: 1 }],
    };

    const result = tryApplyPoison(state, 10, mods, DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.poisonStack).toBeNull();
  });

  it('processPoisonDamage は毒ダメージとスタック減衰を処理する', () => {
    const state: GaugeBattleState = {
      ...baseState,
      enemyPoisonStacks: [
        { damagePerTick: 5, remainingTicks: 1 },
        { damagePerTick: 5, remainingTicks: 2 },
      ],
    };
    const result = processPoisonDamage(state, 1, { ...emptyMods, poisonLifesteal: 50 });
    expect(result.totalDamage).toBe(10);
    expect(result.healAmount).toBe(5);
    expect(result.updatedStacks.length).toBe(1);
  });

  it('tryApplyIgnite は発火状態とイベントを生成する', () => {
    const mods: CombinedModEffects = {
      ...emptyMods,
      igniteChance: 100,
      igniteDamagePct: 50,
      igniteDurationPct: 20,
      igniteTickSpeedPct: 100,
    };

    const result = tryApplyIgnite(baseState, 10, mods, DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.igniteState).not.toBeNull();
    expect(result.event?.type).toBe('ignite_applied');
    expect(result.event?.data.damage).toBe(7);  // 10 * 0.5 * 1.5 = 7.5 → 7
    expect(result.event?.data.durationMs).toBe(3600);  // 3000 * 1.2 = 3600
    expect(result.event?.data.tickIntervalMs).toBe(150);  // 300ms / 2 (igniteTickSpeedPct: 100)
  });

  it('processIgniteDamage は ignite_damage イベントに remainingMs を含める', () => {
    const state: GaugeBattleState = {
      ...baseState,
      enemyIgniteState: {
        damage: 5,
        remainingMs: 5000,
        tickIntervalMs: 1000,
        lastTickMs: 0,
      },
    };

    const result = processIgniteDamage(state, 30, emptyMods, DEFAULT_BATTLE_CONFIG);
    const igniteDamageEvent = result.events.find((event) => event.type === 'ignite_damage');

    expect(result.totalDamage).toBe(5);
    expect(result.updatedState).not.toBeNull();
    expect(igniteDamageEvent).toBeDefined();
    expect(igniteDamageEvent?.data.tickCount).toBe(1);
    expect(igniteDamageEvent?.data.remainingMs).toBeCloseTo(result.updatedState!.remainingMs, 5);
  });

  it('calculateHpRegen は上限を超えない', () => {
    const mods: CombinedModEffects = { ...emptyMods, hpRegen: 20, hpRegenPct: 10 };
    const regen = calculateHpRegen(95, 100, mods);
    expect(regen).toBe(5);
  });

  it('calculateLifesteal はクリティカル時に回復量が増える', () => {
    const mods: CombinedModEffects = { ...emptyMods, hpOnHit: 5, hpOnCrit: 5 };
    const normal = calculateLifesteal(10, false, mods);
    const crit = calculateLifesteal(10, true, mods);
    expect(crit).toBe(normal + 5);
  });

  it('calculateEnemyDamage は毒状態で追加軽減を適用する', () => {
    const mods: CombinedModEffects = { ...emptyMods, poisonDamageReduction: 20 };
    const damagePoisoned = calculateEnemyDamage(10, 0, mods, true);
    const damageNormal = calculateEnemyDamage(10, 0, mods, false);
    expect(damagePoisoned).toBeLessThanOrEqual(damageNormal);
  });

  it('calculateEnemyDamage は発火状態で追加軽減を適用する', () => {
    const mods: CombinedModEffects = { ...emptyMods, igniteDamageReduction: 20 };
    const damageIgnited = calculateEnemyDamage(10, 0, mods, false, true);
    const damageNormal = calculateEnemyDamage(10, 0, mods, false, false);
    expect(damageIgnited).toBeLessThanOrEqual(damageNormal);
  });

  it('calculateEnemyHitChance はAccuracyとEVAの逓減式で命中率を計算する', () => {
    expect(calculateEnemyHitChance(500, 0)).toBe(95);
    expect(calculateEnemyHitChance(500, 500)).toBe(50);
    expect(calculateEnemyHitChance(500, 9500)).toBe(5);
    expect(calculateEnemyHitChance(410, 77)).toBe(84);
  });

  it('createHpRegenEvent / createLifestealEvent / createEnemyAttackEvent はイベントを返す', () => {
    expect(createHpRegenEvent(1, 10)?.type).toBe('hp_regen');
    expect(createLifestealEvent(1, 10)?.type).toBe('lifesteal');
    expect(createEnemyAttackEvent(1, 10).type).toBe('enemy_attack');
  });
});
