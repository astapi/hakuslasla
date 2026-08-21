import { describe, it, expect } from 'vitest';
import {
  tryApplyPoison,
  processPoisonDamage,
  tryApplyIgnite,
  processIgniteDamage,
  isPoisoned,
  isIgnited,
  createEmptyStatusView,
} from '../../../core/combat';
import { createEmptyModEffects } from '../../../core/modEffects';
import { CombinedModEffects, DEFAULT_BATTLE_CONFIG } from '../../../core/types';

const mods = (overrides: Partial<CombinedModEffects> = {}): CombinedModEffects => ({
  ...createEmptyModEffects(),
  ...overrides,
});

describe('core/combat/dot - 毒', () => {
  it('スタック上限に達していると付与せず RNG も消費しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    // basePoisonMaxStacks=1, poisonMaxStacks=0 → 上限1
    const result = tryApplyPoison(1, 10, mods({ poisonChance: 100 }), DEFAULT_BATTLE_CONFIG, rng);

    expect(result.poisonStack).toBeNull();
    expect(result.stackCount).toBe(1);
    expect(calls).toBe(0);
  });

  it('付与に成功するとスタック数が1増える', () => {
    const result = tryApplyPoison(0, 10, mods({ poisonChance: 100 }), DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.poisonStack).not.toBeNull();
    expect(result.stackCount).toBe(1);
    expect(result.poisonStack?.remainingTicks).toBe(DEFAULT_BATTLE_CONFIG.poisonDuration);
    // 10 * 1.2 = 12
    expect(result.poisonStack?.damagePerTick).toBe(12);
  });

  it('poisonChance が 0 なら RNG を消費せず付与しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    const result = tryApplyPoison(0, 10, mods({ poisonChance: 0 }), DEFAULT_BATTLE_CONFIG, rng);

    expect(result.poisonStack).toBeNull();
    expect(calls).toBe(0);
  });

  it('毒ダメージ最低値は1', () => {
    const result = tryApplyPoison(0, 0, mods({ poisonChance: 100 }), DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.poisonStack?.damagePerTick).toBe(1);
  });

  it('processPoisonDamage は合計ダメージ・吸収・スタック減衰を返す', () => {
    const result = processPoisonDamage(
      [
        { damagePerTick: 5, remainingTicks: 1 },
        { damagePerTick: 5, remainingTicks: 2 },
      ],
      mods({ poisonLifesteal: 50 })
    );

    expect(result.totalDamage).toBe(10);
    expect(result.healAmount).toBe(5);
    expect(result.updatedStacks.length).toBe(1);
    expect(result.stacksRemoved).toBe(1);
    expect(result.expired).toBe(false);
  });

  it('processPoisonDamage は全スタック消滅時に expired を立てる', () => {
    const result = processPoisonDamage([{ damagePerTick: 5, remainingTicks: 1 }], mods());

    expect(result.updatedStacks.length).toBe(0);
    expect(result.stacksRemoved).toBe(1);
    expect(result.expired).toBe(true);
  });

  it('processPoisonDamage はスタック無しなら何もしない', () => {
    const result = processPoisonDamage([], mods({ poisonLifesteal: 100 }));

    expect(result.totalDamage).toBe(0);
    expect(result.healAmount).toBe(0);
    expect(result.expired).toBe(false);
  });

  it('入力のスタック配列を破壊しない', () => {
    const stacks = [{ damagePerTick: 5, remainingTicks: 3 }];
    processPoisonDamage(stacks, mods());
    expect(stacks[0].remainingTicks).toBe(3);
  });

  it('両方向で使える: 誰が毒を持っているかは引数だけで決まる', () => {
    const attackerMods = mods({ poisonChance: 100, poisonLifesteal: 50 });

    // アリスがボブに毒を入れる
    const aliceToBob = tryApplyPoison(0, 100, attackerMods, DEFAULT_BATTLE_CONFIG, () => 0);
    // 同じ関数でボブがアリスに毒を入れる（既に1スタック乗っている想定）
    const bobToAlice = tryApplyPoison(1, 100, attackerMods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(aliceToBob.poisonStack).not.toBeNull();
    expect(bobToAlice.poisonStack).toBeNull();  // 上限に達しているので付与されない
  });
});

describe('core/combat/dot - 発火', () => {
  it('付与に成功すると IgniteState を返す', () => {
    const state = tryApplyIgnite(
      10,
      0,
      0,
      mods({
        igniteChance: 100,
        igniteDamagePct: 50,
        igniteDurationPct: 20,
        igniteTickSpeedPct: 100,
      }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );

    expect(state).not.toBeNull();
    expect(state?.damage).toBe(7);            // 10 * 0.5 * 1.5 = 7.5 → 7
    expect(state?.remainingMs).toBe(3600);    // 3000 * 1.2
    expect(state?.tickIntervalMs).toBe(150);  // 300 / 2
    expect(state?.lastTickMs).toBe(0);
  });

  it('igniteChance が 0 なら RNG を消費せず付与しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    expect(tryApplyIgnite(10, 0, 0, mods({ igniteChance: 0 }), DEFAULT_BATTLE_CONFIG, rng)).toBeNull();
    expect(calls).toBe(0);
  });

  it('elapsedTicks から lastTickMs を導出する', () => {
    const state = tryApplyIgnite(10, 0, 60, mods({ igniteChance: 100 }), DEFAULT_BATTLE_CONFIG, () => 0);
    expect(state?.lastTickMs).toBe(2000);  // 60 tick / 30tps = 2秒
  });

  it('processIgniteDamage はダメージ回数と残り時間を返す', () => {
    const result = processIgniteDamage(
      { damage: 5, remainingMs: 5000, tickIntervalMs: 1000, lastTickMs: 0 },
      30,
      mods(),
      DEFAULT_BATTLE_CONFIG
    );

    expect(result.totalDamage).toBe(5);
    expect(result.tickCount).toBe(1);
    expect(result.expired).toBe(false);
    expect(result.updatedState).not.toBeNull();
    expect(result.remainingMs).toBeCloseTo(result.updatedState!.remainingMs, 5);
  });

  it('processIgniteDamage は igniteLifesteal で回復量を計算する', () => {
    const result = processIgniteDamage(
      { damage: 10, remainingMs: 5000, tickIntervalMs: 1000, lastTickMs: 0 },
      30,
      mods({ igniteLifesteal: 30 }),
      DEFAULT_BATTLE_CONFIG
    );

    expect(result.totalDamage).toBe(10);
    expect(result.healAmount).toBe(3);
  });

  it('processIgniteDamage は残り時間が尽きたら expired を立てる', () => {
    const result = processIgniteDamage(
      { damage: 5, remainingMs: 10, tickIntervalMs: 1000, lastTickMs: 0 },
      1,
      mods(),
      DEFAULT_BATTLE_CONFIG
    );

    expect(result.expired).toBe(true);
    expect(result.updatedState).toBeNull();
    expect(result.remainingMs).toBe(0);
  });

  it('processIgniteDamage は発火なしなら何もしない', () => {
    const result = processIgniteDamage(null, 30, mods({ igniteLifesteal: 100 }), DEFAULT_BATTLE_CONFIG);

    expect(result.totalDamage).toBe(0);
    expect(result.tickCount).toBe(0);
    expect(result.expired).toBe(false);
  });
});

describe('core/combat/dot - 状態判定', () => {
  it('isPoisoned / isIgnited は中立ビューを見る', () => {
    const status = createEmptyStatusView();
    expect(isPoisoned(status)).toBe(false);
    expect(isIgnited(status)).toBe(false);

    status.poisonStacks.push({ damagePerTick: 1, remainingTicks: 1 });
    status.igniteState = { damage: 1, remainingMs: 100, tickIntervalMs: 100, lastTickMs: 0 };

    expect(isPoisoned(status)).toBe(true);
    expect(isIgnited(status)).toBe(true);
  });
});
