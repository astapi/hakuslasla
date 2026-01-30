import { describe, it, expect } from 'vitest';
import { DEFAULT_BATTLE_CONFIG } from '../../core/types';

describe('core/types', () => {
  it('DEFAULT_BATTLE_CONFIG は正の値を持つ', () => {
    expect(DEFAULT_BATTLE_CONFIG.ticksPerSecond).toBeGreaterThan(0);
    expect(DEFAULT_BATTLE_CONFIG.baseGaugePerSecond).toBeGreaterThan(0);
  });
});
