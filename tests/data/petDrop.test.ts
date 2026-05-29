import { afterEach, describe, expect, it, vi } from 'vitest';
import { tryPetDrop } from '@/data/pets';

/**
 * tryPetDrop のドロップ率ボーナス（テイマーのクラス固有能力など）のテスト
 * pet_slime は通常レア（基本ドロップ率 0.5%）
 */
describe('tryPetDrop ドロップ率ボーナス', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('対応ペットがいないモンスターは常にnull', () => {
    expect(tryPetDrop('unknown_monster', 100)).toBeNull();
  });

  it('ボーナスなしでは基本ドロップ率（0.5%）で判定される', () => {
    // 0.8% の乱数 → 基本0.5%を超えるためドロップしない
    vi.spyOn(Math, 'random').mockReturnValue(0.008);
    expect(tryPetDrop('slime')).toBeNull();
  });

  it('ボーナス+0.5%でドロップ率が1.0%に上がり、同じ乱数でドロップする', () => {
    // 0.8% の乱数 → ボーナス込み1.0%未満なのでドロップする
    vi.spyOn(Math, 'random').mockReturnValue(0.008);
    expect(tryPetDrop('slime', 0.5)).toBe('pet_slime');
  });
});
