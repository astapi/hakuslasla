import { describe, it, expect } from 'vitest';
import {
  executeAttack,
  calculateIncomingDamage,
  calculateHitChance,
  rollHit,
  calculateLifesteal,
  calculateHpRegen,
} from '../../../core/combat';
import { createEmptyModEffects } from '../../../core/modEffects';
import { CombinedModEffects, DEFAULT_BATTLE_CONFIG } from '../../../core/types';

const mods = (overrides: Partial<CombinedModEffects> = {}): CombinedModEffects => ({
  ...createEmptyModEffects(),
  ...overrides,
});

describe('core/combat/damage - executeAttack', () => {
  it('クリティカルと追撃を発動する', () => {
    const result = executeAttack(
      10,
      2,
      mods({ criticalChance: 100, criticalDamage: 100, criticalFollowUpAttack: true }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );

    expect(result.isCritical).toBe(true);
    expect(result.hasFollowUp).toBe(true);
    expect(result.followUpDamage).toBeGreaterThan(0);
  });

  it('criticalChance が 0 のときは RNG を消費しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    const result = executeAttack(10, 2, mods({ criticalChance: 0 }), DEFAULT_BATTLE_CONFIG, rng);

    expect(calls).toBe(0);
    expect(result.isCritical).toBe(false);
  });

  it('noDirectDamage では本体ダメージが0になり追撃も出ない', () => {
    const result = executeAttack(
      1000,
      0,
      mods({ criticalChance: 100, criticalFollowUpAttack: true, noDirectDamage: true }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );

    expect(result.damage).toBe(0);
    expect(result.isCritical).toBe(true);
    expect(result.hasFollowUp).toBe(false);
    expect(result.followUpDamage).toBe(0);
  });

  it('防御側のダメージ軽減%を反映する', () => {
    const plain = executeAttack(1000, 0, mods(), DEFAULT_BATTLE_CONFIG, () => 1, 0);
    const reduced = executeAttack(1000, 0, mods(), DEFAULT_BATTLE_CONFIG, () => 1, 50);
    expect(reduced.damage).toBeLessThan(plain.damage);
  });
});

describe('core/combat/damage - 両方向で使える', () => {
  // 攻撃側・防御側を入れ替えて同じ関数を呼べることを示す（PvPエンジンの前提）
  const alice = { atk: 1200, def: 400, mods: mods({ criticalChance: 100, criticalDamage: 50 }) };
  const bob = { atk: 800, def: 900, mods: mods({ damageReductionPct: 20 }) };

  it('executeAttack は攻撃側・防御側を入れ替えて呼べる', () => {
    const aliceHitsBob = executeAttack(alice.atk, bob.def, alice.mods, DEFAULT_BATTLE_CONFIG, () => 0);
    const bobHitsAlice = executeAttack(bob.atk, alice.def, bob.mods, DEFAULT_BATTLE_CONFIG, () => 0);

    // アリスだけがクリティカルMODを持つので、役割が入れ替わっても結果が非対称になる
    expect(aliceHitsBob.isCritical).toBe(true);
    expect(bobHitsAlice.isCritical).toBe(false);
    expect(aliceHitsBob.damage).toBeGreaterThan(bobHitsAlice.damage);
  });

  it('calculateIncomingDamage は防御側のMODだけを見る（左右対称）', () => {
    // 同一ステータスの2人を用意し、MODだけを入れ替える
    const atk = 1000;
    const def = 500;

    const bobDefends = calculateIncomingDamage(atk, def, bob.mods, false);
    const aliceDefends = calculateIncomingDamage(atk, def, alice.mods, false);

    // ダメージ軽減20%を持つボブが受ける側のときだけ軽減される
    expect(bobDefends).toBeLessThan(aliceDefends);

    // MODを入れ替えれば結果も入れ替わる（役割固定の参照がないことの確認）
    expect(calculateIncomingDamage(atk, def, alice.mods, false)).toBe(aliceDefends);
    expect(calculateIncomingDamage(atk, def, bob.mods, false)).toBe(bobDefends);
  });

  it('calculateIncomingDamage は攻撃側が毒/発火のとき追加軽減する', () => {
    const defender = mods({ poisonDamageReduction: 20, igniteDamageReduction: 20 });

    const normal = calculateIncomingDamage(1000, 0, defender, false, false);
    const poisoned = calculateIncomingDamage(1000, 0, defender, true, false);
    const ignited = calculateIncomingDamage(1000, 0, defender, false, true);
    const both = calculateIncomingDamage(1000, 0, defender, true, true);

    expect(poisoned).toBeLessThan(normal);
    expect(ignited).toBeLessThan(normal);
    expect(both).toBeLessThan(poisoned);
  });
});

describe('core/combat/damage - 命中', () => {
  it('calculateHitChance は逓減式で 5〜95 にクランプする', () => {
    expect(calculateHitChance(500, 0)).toBe(95);
    expect(calculateHitChance(500, 500)).toBe(50);
    expect(calculateHitChance(500, 9500)).toBe(5);
    expect(calculateHitChance(410, 77)).toBe(84);
  });

  it('calculateHitChance は accuracy 未指定なら 100 として扱う', () => {
    expect(calculateHitChance(undefined, 100)).toBe(50);
  });

  it('rollHit は命中率と RNG の比較で判定する', () => {
    // 命中率50% → 0.49 は命中、0.51 は失敗
    expect(rollHit(500, 500, () => 0.49)).toBe(true);
    expect(rollHit(500, 500, () => 0.51)).toBe(false);
  });

  it('rollHit は両側で使える（回避側を入れ替えても同じ関数）', () => {
    const aliceEvasion = 0;
    const bobEvasion = 9500;

    expect(rollHit(500, aliceEvasion, () => 0.9)).toBe(true);   // 95%命中
    expect(rollHit(500, bobEvasion, () => 0.9)).toBe(false);    // 5%命中
  });
});

describe('core/combat/damage - 回復', () => {
  it('calculateLifesteal はクリティカル時に回復量が増える', () => {
    const m = mods({ hpOnHit: 5, hpOnCrit: 5 });
    expect(calculateLifesteal(10, true, m)).toBe(calculateLifesteal(10, false, m) + 5);
  });

  it('calculateLifesteal はダメージ0なら回復しない', () => {
    expect(calculateLifesteal(0, true, mods({ hpOnHit: 100, hpOnCrit: 100 }))).toBe(0);
  });

  it('calculateLifesteal は lifestealPct を切り捨てで加算する', () => {
    expect(calculateLifesteal(105, false, mods({ lifestealPct: 10 }))).toBe(10);
  });

  it('calculateHpRegen は最大HPを超えない', () => {
    expect(calculateHpRegen(95, 100, mods({ hpRegen: 20, hpRegenPct: 10 }))).toBe(5);
  });

  it('calculateHpRegen は満タンなら0', () => {
    expect(calculateHpRegen(100, 100, mods({ hpRegen: 20 }))).toBe(0);
  });
});
