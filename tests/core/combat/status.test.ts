import { describe, it, expect } from 'vitest';
import {
  tryApplyChill,
  processChillState,
  tryApplyFreeze,
  processFreezeState,
} from '../../../core/combat';
import { createEmptyModEffects } from '../../../core/modEffects';
import { CombinedModEffects, DEFAULT_BATTLE_CONFIG } from '../../../core/types';

const mods = (overrides: Partial<CombinedModEffects> = {}): CombinedModEffects => ({
  ...createEmptyModEffects(),
  ...overrides,
});

describe('core/combat/status - チル', () => {
  it('付与に成功すると速度倍率と持続時間を返す', () => {
    const state = tryApplyChill(
      mods({ chillChance: 100, chillEffectPct: 50, chillDurationPct: 50 }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );

    expect(state).not.toBeNull();
    // 0.8 - 0.5 * (1 - 0.8) = 0.7
    expect(state?.speedMultiplier).toBeCloseTo(0.7, 10);
    expect(state?.remainingMs).toBe(4500);  // 3000 * 1.5
  });

  it('速度倍率は下限でクランプされる', () => {
    const state = tryApplyChill(
      mods({ chillChance: 100, chillEffectPct: 1000 }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );
    expect(state?.speedMultiplier).toBe(DEFAULT_BATTLE_CONFIG.chillMinSpeedMultiplier);
  });

  it('chillChance が 0 なら RNG を消費せず付与しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    expect(tryApplyChill(mods({ chillChance: 0 }), DEFAULT_BATTLE_CONFIG, rng)).toBeNull();
    expect(calls).toBe(0);
  });

  it('processChillState は時間を減らし、尽きたら expired を立てる', () => {
    const running = processChillState({ speedMultiplier: 0.8, remainingMs: 1000 }, DEFAULT_BATTLE_CONFIG);
    expect(running.expired).toBe(false);
    expect(running.updatedState?.remainingMs).toBeCloseTo(1000 - 1000 / 30, 10);

    const done = processChillState({ speedMultiplier: 0.8, remainingMs: 10 }, DEFAULT_BATTLE_CONFIG);
    expect(done.expired).toBe(true);
    expect(done.updatedState).toBeNull();
  });

  it('processChillState はチルなしなら何もしない', () => {
    const result = processChillState(null, DEFAULT_BATTLE_CONFIG);
    expect(result.expired).toBe(false);
    expect(result.updatedState).toBeNull();
  });
});

describe('core/combat/status - フリーズ', () => {
  it('フリーズ中は再フリーズせず RNG も消費しない', () => {
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0;
    };

    const result = tryApplyFreeze(true, mods({ freezeChance: 100 }), DEFAULT_BATTLE_CONFIG, rng);

    expect(result.freezeState).toBeNull();
    expect(result.chillAfterFreeze).toBeNull();
    expect(calls).toBe(0);
  });

  it('発生率は freezeChanceCap でハードキャップされる', () => {
    // freezeChance 100 でも上限は10% → rng 0.5 (=50%) では発生しない
    expect(
      tryApplyFreeze(false, mods({ freezeChance: 100 }), DEFAULT_BATTLE_CONFIG, () => 0.5).freezeState
    ).toBeNull();
    // rng 0.05 (=5%) なら発生する
    expect(
      tryApplyFreeze(false, mods({ freezeChance: 100 }), DEFAULT_BATTLE_CONFIG, () => 0.05).freezeState
    ).not.toBeNull();
  });

  it('freezeChanceCapPct でキャップを引き上げられる', () => {
    const result = tryApplyFreeze(
      false,
      mods({ freezeChance: 100, freezeChanceCapPct: 30 }),
      DEFAULT_BATTLE_CONFIG,
      () => 0.35
    );
    expect(result.freezeState).not.toBeNull();  // 上限40% > 35%
  });

  it('付与時にフリーズ解除後のチル状態も用意する', () => {
    const result = tryApplyFreeze(
      false,
      mods({ freezeChance: 100, freezeDurationPct: 100, chillEffectPct: 50, chillDurationPct: 50 }),
      DEFAULT_BATTLE_CONFIG,
      () => 0
    );

    expect(result.freezeState?.remainingMs).toBe(3000);  // 1500 * 2
    expect(result.chillAfterFreeze?.speedMultiplier).toBeCloseTo(0.7, 10);
    expect(result.chillAfterFreeze?.remainingMs).toBe(4500);
  });

  it('processFreezeState は解除時にチルへ移行する', () => {
    const pendingChill = { speedMultiplier: 0.7, remainingMs: 3000 };

    const running = processFreezeState({ remainingMs: 1000 }, pendingChill, DEFAULT_BATTLE_CONFIG);
    expect(running.expired).toBe(false);
    expect(running.chillTransition).toBeNull();

    const done = processFreezeState({ remainingMs: 10 }, pendingChill, DEFAULT_BATTLE_CONFIG);
    expect(done.expired).toBe(true);
    expect(done.updatedState).toBeNull();
    expect(done.chillTransition).toBe(pendingChill);
  });

  it('processFreezeState はフリーズなしなら何もしない', () => {
    const result = processFreezeState(null, { speedMultiplier: 0.7, remainingMs: 3000 }, DEFAULT_BATTLE_CONFIG);
    expect(result.expired).toBe(false);
    expect(result.updatedState).toBeNull();
    expect(result.chillTransition).toBeNull();
  });

  it('両方向で使える: 凍っているのがどちら側かは引数だけで決まる', () => {
    const attackerMods = mods({ freezeChance: 100 });

    // アリスがボブを凍らせる（ボブは未凍結）
    const aliceFreezesBob = tryApplyFreeze(false, attackerMods, DEFAULT_BATTLE_CONFIG, () => 0);
    // 同じ関数でボブがアリスを凍らせようとする（アリスは既に凍結中）
    const bobFreezesAlice = tryApplyFreeze(true, attackerMods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(aliceFreezesBob.freezeState).not.toBeNull();
    expect(bobFreezesAlice.freezeState).toBeNull();
  });
});
