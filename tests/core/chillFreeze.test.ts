import { describe, it, expect } from 'vitest';
import {
  tryApplyChill,
  processChillState,
  tryApplyFreeze,
  processFreezeState,
} from '../../core/combatEffects';
import { createEmptyModEffects } from '../../core/modEffects';
import { GaugeBattleState, DEFAULT_BATTLE_CONFIG, CombinedModEffects } from '../../core/types';

const baseState: GaugeBattleState = {
  player: { currentHp: 100, maxHp: 100, atk: 10, def: 5, attackSpeed: 1, gauge: 0 },
  enemy: { currentHp: 50, maxHp: 50, atk: 8, def: 2, attackSpeed: 1, gauge: 0 },
  enemyPoisonStacks: [],
  playerPoisonStacks: [],
  enemyIgniteState: null,
  enemyChillState: null,
  enemyFreezeState: null,
  playerChillState: null,
  playerFreezeState: null,
  igniteApplyCount: 0,
  warlordEnrageActivated: false,
  enemyWoundStacks: 0,
  enemyWoundActionCounter: 0,
  deferredDamages: [],
  poisonStackAccumulator: 0,
  playerAttackCount: 0,
  elapsedTicks: 0,
  isFinished: false,
  winner: null,
};

function createMods(overrides: Partial<CombinedModEffects> = {}): CombinedModEffects {
  return { ...createEmptyModEffects(), ...overrides };
}

// ========================================
// チルシステム
// ========================================

describe('チルシステム', () => {
  it('tryApplyChill はチル状態とイベントを生成する', () => {
    const mods = createMods({ chillChance: 100 });
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.chillState).not.toBeNull();
    expect(result.event).not.toBeNull();
    expect(result.event!.type).toBe('chill_applied');
    expect(result.chillState!.speedMultiplier).toBe(DEFAULT_BATTLE_CONFIG.chillBaseSpeedMultiplier);
    expect(result.chillState!.remainingMs).toBe(DEFAULT_BATTLE_CONFIG.chillDurationMs);
  });

  it('chillChance=0 ではチルが発生しない', () => {
    const mods = createMods({ chillChance: 0 });
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.chillState).toBeNull();
    expect(result.event).toBeNull();
  });

  it('乱数がchillChance以上の場合はチルが発生しない', () => {
    const mods = createMods({ chillChance: 50 });
    // rng() * 100 = 60 >= 50 なのでチルなし
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0.6);
    expect(result.chillState).toBeNull();
  });

  it('chillEffectPct で速度倍率がさらに低下する', () => {
    const mods = createMods({ chillChance: 100, chillEffectPct: 50 });
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.chillState).not.toBeNull();
    // effectReduction = 50/100 = 0.5
    // speedMultiplier = max(0.5, 0.8 - 0.5 * (1 - 0.8)) = max(0.5, 0.8 - 0.1) = 0.7
    expect(result.chillState!.speedMultiplier).toBeCloseTo(0.7, 5);
  });

  it('速度倍率は最低値（0.5）を下回らない', () => {
    const mods = createMods({ chillChance: 100, chillEffectPct: 500 });
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.chillState!.speedMultiplier).toBe(DEFAULT_BATTLE_CONFIG.chillMinSpeedMultiplier);
  });

  it('chillDurationPct で持続時間が延長される', () => {
    const mods = createMods({ chillChance: 100, chillDurationPct: 50 });
    const result = tryApplyChill(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    // 3000 * 1.5 = 4500
    expect(result.chillState!.remainingMs).toBe(4500);
  });

  it('processChillState は時間経過で残り時間を減らす', () => {
    const chillState = { speedMultiplier: 0.8, remainingMs: 3000 };
    const result = processChillState(chillState, 1, DEFAULT_BATTLE_CONFIG);

    expect(result.updatedState).not.toBeNull();
    const deltaMs = 1000 / DEFAULT_BATTLE_CONFIG.ticksPerSecond;
    expect(result.updatedState!.remainingMs).toBeCloseTo(3000 - deltaMs, 5);
    expect(result.event).toBeNull();
  });

  it('processChillState は残り時間0以下でチル解除イベントを返す', () => {
    const chillState = { speedMultiplier: 0.8, remainingMs: 10 };
    const result = processChillState(chillState, 1, DEFAULT_BATTLE_CONFIG);

    expect(result.updatedState).toBeNull();
    expect(result.event).not.toBeNull();
    expect(result.event!.type).toBe('chill_expired');
  });

  it('processChillState は null を受け取ると何もしない', () => {
    const result = processChillState(null, 1, DEFAULT_BATTLE_CONFIG);
    expect(result.updatedState).toBeNull();
    expect(result.event).toBeNull();
  });
});

// ========================================
// フリーズシステム
// ========================================

describe('フリーズシステム', () => {
  it('tryApplyFreeze はフリーズ状態・チル移行状態・イベントを生成する', () => {
    const mods = createMods({ freezeChance: 10 });
    const result = tryApplyFreeze(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.freezeState).not.toBeNull();
    expect(result.chillAfterFreeze).not.toBeNull();
    expect(result.event).not.toBeNull();
    expect(result.event!.type).toBe('freeze_applied');
    expect(result.freezeState!.remainingMs).toBe(DEFAULT_BATTLE_CONFIG.freezeDurationMs);
  });

  it('フリーズ中は再フリーズしない', () => {
    const mods = createMods({ freezeChance: 100 });
    const frozenState: GaugeBattleState = {
      ...baseState,
      enemyFreezeState: { remainingMs: 1000 },
    };
    const result = tryApplyFreeze(frozenState, mods, DEFAULT_BATTLE_CONFIG, () => 0);
    expect(result.freezeState).toBeNull();
  });

  it('freezeChance はハードキャップ（10%）が適用される', () => {
    const mods = createMods({ freezeChance: 50 });
    // rng() * 100 = 15 >= 10（キャップ後）なのでフリーズしない
    const result = tryApplyFreeze(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0.15);
    expect(result.freezeState).toBeNull();
  });

  it('freezeDurationPct で持続時間が延長される', () => {
    const mods = createMods({ freezeChance: 10, freezeDurationPct: 100 });
    const result = tryApplyFreeze(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    // 1500 * 2.0 = 3000
    expect(result.freezeState!.remainingMs).toBe(3000);
  });

  it('フリーズ解除後のチル移行状態がchillEffectPctを反映する', () => {
    const mods = createMods({ freezeChance: 10, chillEffectPct: 50 });
    const result = tryApplyFreeze(baseState, mods, DEFAULT_BATTLE_CONFIG, () => 0);

    expect(result.chillAfterFreeze).not.toBeNull();
    // 0.8 - 0.5 * 0.2 = 0.7
    expect(result.chillAfterFreeze!.speedMultiplier).toBeCloseTo(0.7, 5);
  });

  it('processFreezeState は時間経過で残り時間を減らす', () => {
    const freezeState = { remainingMs: 1500 };
    const result = processFreezeState(freezeState, null, 1, DEFAULT_BATTLE_CONFIG);

    expect(result.updatedState).not.toBeNull();
    expect(result.chillTransition).toBeNull();
    expect(result.event).toBeNull();
  });

  it('processFreezeState は残り時間0以下でフリーズ解除しチルに移行する', () => {
    const freezeState = { remainingMs: 10 };
    const pendingChill = { speedMultiplier: 0.8, remainingMs: 3000 };
    const result = processFreezeState(freezeState, pendingChill, 1, DEFAULT_BATTLE_CONFIG);

    expect(result.updatedState).toBeNull();
    expect(result.event).not.toBeNull();
    expect(result.event!.type).toBe('freeze_expired');
    expect(result.chillTransition).not.toBeNull();
    expect(result.chillTransition!.speedMultiplier).toBe(0.8);
  });

  it('processFreezeState は null を受け取ると何もしない', () => {
    const result = processFreezeState(null, null, 1, DEFAULT_BATTLE_CONFIG);
    expect(result.updatedState).toBeNull();
    expect(result.chillTransition).toBeNull();
    expect(result.event).toBeNull();
  });
});

// ========================================
// チル/フリーズの戦闘エンジン統合
// ========================================

describe('チル/フリーズ戦闘エンジン統合', () => {
  it('チルで敵の攻撃速度が低下する', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const player = { maxHp: 500, atk: 100, def: 50 };
    const enemy = { id: 'test', name: 'Test', maxHp: 100000, atk: 10, def: 0, exp: 1 };

    // チルなし
    const modsNoChill = createMods({});
    const { engine: e1 } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: modsNoChill, enemy, rng: () => 0.99,
    });
    e1.advanceTicks(300);
    const enemyHpNoChill = e1.getState().enemy.currentHp;

    // チルあり（敵の攻撃速度が下がるが、ダメージ量は変わらないのでHPは同程度）
    // ただしチルでは敵の攻撃が遅くなるだけなので、プレイヤーのHPに差が出る
    const modsChill = createMods({ chillChance: 100 });
    const { engine: e2 } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: modsChill, enemy, rng: () => 0.01,
    });
    e2.advanceTicks(300);

    // チルで敵が遅くなるので、プレイヤーのHPがより多く残る
    expect(e2.getState().player.currentHp).toBeGreaterThanOrEqual(e1.getState().player.currentHp);
  });

  it('フリーズ中は敵が行動不能になる', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const player = { maxHp: 500, atk: 100, def: 50 };
    const enemy = { id: 'test', name: 'Test', maxHp: 100000, atk: 100, def: 0, exp: 1 };

    const mods = createMods({ freezeChance: 10 });
    const { engine } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: mods, enemy, rng: () => 0.01,
    });

    const events = engine.advanceTicks(300);

    // フリーズイベントが発生している
    const freezeEvents = events.filter(e => e.type === 'freeze_applied');
    expect(freezeEvents.length).toBeGreaterThan(0);

    // フリーズ解除後にチルに移行する
    const chillAfterFreeze = events.filter(
      e => e.type === 'chill_applied' && e.data.source === 'freeze_transition'
    );
    expect(chillAfterFreeze.length).toBeGreaterThan(0);
  });
});
