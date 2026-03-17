import { describe, it, expect } from 'vitest';
import { isRepeatDisabled } from '@/core/resultHelpers';

describe('isRepeatDisabled', () => {
  describe('Uberダンジョンの場合', () => {
    it('入場券が0枚のとき無効化される', () => {
      expect(isRepeatDisabled(true, 0)).toBe(true);
    });

    it('入場券がnull（未取得）のとき無効化される', () => {
      expect(isRepeatDisabled(true, null)).toBe(true);
    });

    it('入場券が負の値のとき無効化される', () => {
      expect(isRepeatDisabled(true, -1)).toBe(true);
    });

    it('入場券が1枚以上あるとき有効', () => {
      expect(isRepeatDisabled(true, 1)).toBe(false);
    });

    it('入場券が複数枚あるとき有効', () => {
      expect(isRepeatDisabled(true, 5)).toBe(false);
    });
  });

  describe('通常ダンジョンの場合', () => {
    it('入場券が0枚でも無効化されない', () => {
      expect(isRepeatDisabled(false, 0)).toBe(false);
    });

    it('入場券がnullでも無効化されない', () => {
      expect(isRepeatDisabled(false, null)).toBe(false);
    });

    it('入場券があっても無効化されない', () => {
      expect(isRepeatDisabled(false, 3)).toBe(false);
    });
  });
});
