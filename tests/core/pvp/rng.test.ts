import { describe, it, expect } from 'vitest';
import {
  assertValidPvpSeed,
  createPvpRngStreams,
  derivePvpSeed,
} from '../../../core/pvp/rng';

describe('core/pvp/rng', () => {
  it('seed=0 は弾く（createRng の不動点のため）', () => {
    expect(() => assertValidPvpSeed(0)).toThrow();
    expect(() => createPvpRngStreams(0)).toThrow();
  });

  it('非整数・非有限のseedは弾く', () => {
    expect(() => assertValidPvpSeed(1.5)).toThrow();
    expect(() => assertValidPvpSeed(NaN)).toThrow();
    expect(() => assertValidPvpSeed(Infinity)).toThrow();
  });

  it('派生シードは必ず0以外（奇数）になる', () => {
    for (let seed = -50; seed <= 50; seed++) {
      if (seed === 0) continue;
      for (let i = 0; i < 3; i++) {
        const derived = derivePvpSeed(seed, i);
        expect(derived).not.toBe(0);
        expect(Math.abs(derived % 2)).toBe(1);
      }
    }
  });

  it('同じseedからは同じ列が出る（決定的）', () => {
    const a = createPvpRngStreams(12345);
    const b = createPvpRngStreams(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.sides[0]()).toBe(b.sides[0]());
      expect(a.sides[1]()).toBe(b.sides[1]());
      expect(a.order()).toBe(b.order());
    }
  });

  it('3本のストリームは互いに異なる列を出す', () => {
    const s = createPvpRngStreams(777);
    const a = Array.from({ length: 20 }, () => s.sides[0]());
    const b = Array.from({ length: 20 }, () => s.sides[1]());
    const c = Array.from({ length: 20 }, () => s.order());
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(b).not.toEqual(c);
  });

  it('seedが違えば列も違う', () => {
    const a = createPvpRngStreams(1);
    const b = createPvpRngStreams(2);
    const seqA = Array.from({ length: 20 }, () => a.sides[0]());
    const seqB = Array.from({ length: 20 }, () => b.sides[0]());
    expect(seqA).not.toEqual(seqB);
  });

  it('出力は [0, 1] に収まる', () => {
    const s = createPvpRngStreams(99);
    for (let i = 0; i < 500; i++) {
      const v = s.sides[0]();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
