import { describe, it, expect } from 'vitest';
import { applyPetBuff } from '../../core/petEffects';
import { createEmptyModEffects } from '../../core/modEffects';
import { PetBuff } from '../../types';

describe('core/petEffects', () => {
  it('buffがnullなら元のmodsをそのまま返す', () => {
    const base = createEmptyModEffects();
    base.hpRegen = 5;
    const result = applyPetBuff(base, null);
    expect(result).toEqual(base);
  });

  it('hpRegen / attackSpeedPct / poisonChance / igniteChance / freezeChance を加算する', () => {
    const base = createEmptyModEffects();
    base.hpRegen = 10;
    base.attackSpeedPct = 5;
    base.poisonChance = 20;
    base.igniteChance = 0;
    base.freezeChance = 0;
    const buff: PetBuff = {
      hpRegen: 20,
      attackSpeedPct: 10,
      poisonChance: 15,
      igniteChance: 15,
      freezeChance: 5,
    };
    const result = applyPetBuff(base, buff);
    expect(result.hpRegen).toBe(30);
    expect(result.attackSpeedPct).toBe(15);
    expect(result.poisonChance).toBe(35);
    expect(result.igniteChance).toBe(15);
    expect(result.freezeChance).toBe(5);
  });

  it('multiplierでバフ効果が倍化する（テイマーのペット効果2倍）', () => {
    const base = createEmptyModEffects();
    base.hpRegen = 10;
    base.poisonChance = 20;
    const buff: PetBuff = {
      hpRegen: 20,
      attackSpeedPct: 10,
      poisonChance: 15,
      igniteChance: 5,
      freezeChance: 5,
    };
    const result = applyPetBuff(base, buff, 2);
    expect(result.hpRegen).toBe(10 + 20 * 2);      // 50
    expect(result.attackSpeedPct).toBe(10 * 2);    // 20
    expect(result.poisonChance).toBe(20 + 15 * 2); // 50
    expect(result.igniteChance).toBe(5 * 2);       // 10
    expect(result.freezeChance).toBe(5 * 2);       // 10
  });

  it('multiplier省略時は等倍（1倍）として扱う', () => {
    const base = createEmptyModEffects();
    const buff: PetBuff = { hpRegen: 20 };
    expect(applyPetBuff(base, buff).hpRegen).toBe(20);
  });

  it('atkIncreasedPct / defIncreasedPct はCombinedModEffectsには反映されない（ステータス側で処理）', () => {
    const base = createEmptyModEffects();
    const buff: PetBuff = { atkIncreasedPct: 15, defIncreasedPct: 30 };
    const result = applyPetBuff(base, buff);
    // 値は変わらない（PetBuffのこれらはgetTotalStats側で取り込む契約）
    expect(result.hpRegen).toBe(0);
    expect(result.attackSpeedPct).toBe(0);
  });
});
