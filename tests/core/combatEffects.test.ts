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
  createHpRegenEvent,
  createLifestealEvent,
  createEnemyAttackEvent,
} from '../../core/combatEffects';
import { CombinedModEffects, GaugeBattleState, DEFAULT_BATTLE_CONFIG } from '../../core/types';

const baseState: GaugeBattleState = {
  player: { currentHp: 100, maxHp: 100, atk: 10, def: 5, attackSpeed: 1, gauge: 0 },
  enemy: { currentHp: 50, maxHp: 50, atk: 8, def: 2, attackSpeed: 1, gauge: 0 },
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

const emptyMods: CombinedModEffects = {
  hpRegen: 0,
  hpRegenPct: 0,
  poisonChance: 0,
  poisonDamagePct: 0,
  poisonDamageMorePct: [],
  poisonMaxStacks: 0,
  poisonDamageReduction: 0,
  poisonLifesteal: 0,
  noDirectDamage: false,
  criticalChance: 0,
  criticalDamage: 0,
  hpOnCrit: 0,
  critLifestealPct: 0,
  criticalFollowUpAttack: false,
  followUpAttackPct: 0,
  kingSlam: false,
  royalRoar: false,
  damageDeferPct: 0,
  damageReductionPct: 0,
  hpOnHit: 0,
  lifestealPct: 0,
  retaliateDefPct: 0,
  hpRegenToAtkPct: 0,
  attackSpeedPct: 0,
  attackSpeedMorePct: [],
  timeAtkIncPct: 0,
  timeDefIncPct: 0,
  timeHpRegen: 0,
  igniteChance: 0,
  igniteDamagePct: 0,
  igniteDamageMorePct: [],
  igniteDurationPct: 0,
  igniteTickSpeedPct: 0,
  igniteLifesteal: 0,
  igniteSpread: false,
  igniteStackingDamage: false,
  chillChance: 0,
  chillEffectPct: 0,
  chillDurationPct: 0,
  freezeChance: 0,
  freezeDurationPct: 0,
  freezeChanceCapPct: 0,
  warlordEnrage: false,
  heavyStrike: false,
  defHpToAtk: false,
  uberCriticalFollowUp: false,
  poisonMultiStack: 1,
  igniteIntensify: false,
  chillFreezeDamageMult: 1,
  igniteResistPct: 0,
};

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

  it('createHpRegenEvent / createLifestealEvent / createEnemyAttackEvent はイベントを返す', () => {
    expect(createHpRegenEvent(1, 10)?.type).toBe('hp_regen');
    expect(createLifestealEvent(1, 10)?.type).toBe('lifesteal');
    expect(createEnemyAttackEvent(1, 10).type).toBe('enemy_attack');
  });
});
