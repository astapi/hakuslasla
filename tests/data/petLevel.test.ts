import { describe, it, expect } from 'vitest';
import { getPetLevelFactor, getPetUpgradeCost, PET_MIN_LEVEL, PET_MAX_LEVEL } from '../../data/pets';

describe('data/pets ペット強化レベル', () => {
  it('Lv1は等倍、Lvごとに+20%、最大Lv6で2倍', () => {
    expect(getPetLevelFactor(1)).toBeCloseTo(1.0);
    expect(getPetLevelFactor(2)).toBeCloseTo(1.2);
    expect(getPetLevelFactor(3)).toBeCloseTo(1.4);
    expect(getPetLevelFactor(6)).toBeCloseTo(2.0);
  });

  it('範囲外のレベルはクランプされる', () => {
    expect(getPetLevelFactor(0)).toBeCloseTo(getPetLevelFactor(PET_MIN_LEVEL));
    expect(getPetLevelFactor(99)).toBeCloseTo(getPetLevelFactor(PET_MAX_LEVEL));
  });

  it('次レベルへの必要重複数は現在のレベルと等しい（段階式）', () => {
    expect(getPetUpgradeCost(1)).toBe(1); // Lv1→2
    expect(getPetUpgradeCost(2)).toBe(2); // Lv2→3
    expect(getPetUpgradeCost(5)).toBe(5); // Lv5→6
  });

  it('最大レベルではアップグレード不可（null）', () => {
    expect(getPetUpgradeCost(PET_MAX_LEVEL)).toBeNull();
  });

  it('Lv1から最大まで上げるのに必要な累計重複数は15体', () => {
    let total = 0;
    for (let lv = PET_MIN_LEVEL; lv < PET_MAX_LEVEL; lv++) {
      total += getPetUpgradeCost(lv) as number;
    }
    expect(total).toBe(15);
  });
});
