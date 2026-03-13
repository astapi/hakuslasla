import { describe, expect, it } from 'vitest';
import { isUniqueItem } from '../../utils/item';

describe('utils/item', () => {
  it('isUniqueItem は fixedMods を持つアイテムをユニークとして判定する', () => {
    expect(
      isUniqueItem({
        fixedMods: [{ type: 'hp_regen', value: 20, tier: 0 }],
      })
    ).toBe(true);
  });

  it('isUniqueItem は通常ドロップ装備をユニークとして扱わない', () => {
    expect(isUniqueItem({ fixedMods: undefined })).toBe(false);
  });
});
