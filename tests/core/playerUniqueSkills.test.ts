import { describe, it, expect } from 'vitest';
import { createBattleEngine } from '../../core/battleEngine';
import { createEmptyModEffects } from '../../core/modEffects';
import { CombinedModEffects, EnemyConfig, Stats, BattleEvent } from '../../core/types';

// ========================================
// ヘルパー
// ========================================

const PLAYER: Stats = { maxHp: 5000, atk: 100, def: 50 };

// 十分にHPが高く、プレイヤーを1回も倒さない弱い敵
const DUMMY_ENEMY: EnemyConfig & { attackSpeed: number } = {
  id: 'training_dummy',
  name: 'Training Dummy',
  maxHp: 10_000_000,
  atk: 1,
  def: 0,
  exp: 0,
  attackSpeed: 0.001, // ほぼ攻撃しない
};

function buildEngine(overrides: Partial<CombinedModEffects> = {}) {
  const mods = { ...createEmptyModEffects(), ...overrides };
  return createBattleEngine({
    playerStats: PLAYER,
    playerCurrentHp: PLAYER.maxHp,
    playerMods: mods,
    enemy: DUMMY_ENEMY,
    rng: () => 0.99, // 確率系は極力発動させない
  });
}

function runUntilNthPlayerAttack(
  engine: ReturnType<typeof buildEngine>['engine'],
  initialEvents: BattleEvent[],
  nthAttack: number,
  maxTicks = 10000
): BattleEvent[] {
  const all = [...initialEvents];
  let ticks = 0;
  let normalAttackCount = all.filter(
    (e) => e.type === 'player_attack' && !(e.data as Record<string, unknown>).source
  ).length;

  while (normalAttackCount < nthAttack && ticks < maxTicks) {
    const ev = engine.advanceTicks(1);
    all.push(...ev);
    normalAttackCount = all.filter(
      (e) => e.type === 'player_attack' && !(e.data as Record<string, unknown>).source
    ).length;
    ticks += 1;
  }
  return all;
}

// ========================================
// 双撃の刃 (follow_up_attack_pct)
// ========================================

describe('プレイヤー装備: 双撃の刃 (follow_up_attack_pct)', () => {
  it('通常攻撃ごとに source="twin_blade" の追撃イベントが発火する', () => {
    const { engine, events: initial } = buildEngine({ followUpAttackPct: 100 });
    const events = runUntilNthPlayerAttack(engine, initial, 5);

    const normalAttacks = events.filter(
      (e) => e.type === 'player_attack' && !(e.data as Record<string, unknown>).source
    );
    const twinBladeHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'twin_blade'
    );

    expect(normalAttacks.length).toBeGreaterThanOrEqual(5);
    // 各通常攻撃に1回ずつ双撃の刃がついてくる
    expect(twinBladeHits.length).toBe(normalAttacks.length);
  });

  it('followUpAttackPct=100 の場合、追撃ダメージは通常攻撃と同等', () => {
    const { engine, events: initial } = buildEngine({ followUpAttackPct: 100 });
    const events = runUntilNthPlayerAttack(engine, initial, 3);

    // 最初の通常攻撃と最初の双撃の刃を突き合わせる
    const firstNormal = events.find(
      (e) => e.type === 'player_attack' && !(e.data as Record<string, unknown>).source
    );
    const firstTwin = events.find(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'twin_blade'
    );

    expect(firstNormal).toBeDefined();
    expect(firstTwin).toBeDefined();
    const normalDamage = Number((firstNormal!.data as Record<string, unknown>).damage);
    const twinDamage = Number((firstTwin!.data as Record<string, unknown>).damage);

    // 100%なので同等。クリティカル補正等がかからない前提。
    expect(twinDamage).toBe(normalDamage);
  });

  it('followUpAttackPct=0 では双撃の刃は発火しない', () => {
    const { engine, events: initial } = buildEngine({ followUpAttackPct: 0 });
    const events = runUntilNthPlayerAttack(engine, initial, 5);

    const twinBladeHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'twin_blade'
    );
    expect(twinBladeHits.length).toBe(0);
  });

  it('noDirectDamage=true の時は双撃の刃も発火しない', () => {
    const { engine, events: initial } = buildEngine({
      followUpAttackPct: 100,
      noDirectDamage: true,
    });
    const events = runUntilNthPlayerAttack(engine, initial, 5);

    const twinBladeHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'twin_blade'
    );
    expect(twinBladeHits.length).toBe(0);
  });
});

// ========================================
// キングスラム (king_slam)
// ========================================

describe('プレイヤー装備: キングスラム (king_slam)', () => {
  it('5回攻撃ごとに source="king_slam" の追撃が発火する', () => {
    const { engine, events: initial } = buildEngine({ kingSlam: true });
    const events = runUntilNthPlayerAttack(engine, initial, 5);

    const kingSlamHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    // 5回目の攻撃時に1回発動
    expect(kingSlamHits.length).toBe(1);
  });

  it('10回攻撃で2回、15回攻撃で3回発動する', () => {
    const { engine: e10, events: init10 } = buildEngine({ kingSlam: true });
    const events10 = runUntilNthPlayerAttack(e10, init10, 10);
    const hits10 = events10.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    expect(hits10.length).toBe(2);

    const { engine: e15, events: init15 } = buildEngine({ kingSlam: true });
    const events15 = runUntilNthPlayerAttack(e15, init15, 15);
    const hits15 = events15.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    expect(hits15.length).toBe(3);
  });

  it('4回攻撃までは発動しない', () => {
    const { engine, events: initial } = buildEngine({ kingSlam: true });
    const events = runUntilNthPlayerAttack(engine, initial, 4);

    const kingSlamHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    expect(kingSlamHits.length).toBe(0);
  });

  it('キングスラムのダメージは通常攻撃のおよそ3倍', () => {
    const { engine, events: initial } = buildEngine({ kingSlam: true });
    const events = runUntilNthPlayerAttack(engine, initial, 5);

    const firstNormal = events.find(
      (e) => e.type === 'player_attack' && !(e.data as Record<string, unknown>).source
    );
    const firstSlam = events.find(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );

    expect(firstNormal).toBeDefined();
    expect(firstSlam).toBeDefined();

    const normalDamage = Number((firstNormal!.data as Record<string, unknown>).damage);
    const slamDamage = Number((firstSlam!.data as Record<string, unknown>).damage);

    // ATK×3で計算されるので、おおよそ3倍（DEF減衰は同じ）
    // 厳密には calculateDamage(atk*3) / calculateDamage(atk) ≒ 3
    expect(slamDamage).toBeGreaterThanOrEqual(normalDamage * 2.5);
    expect(slamDamage).toBeLessThanOrEqual(normalDamage * 3.5);
  });

  it('kingSlam=false では発動しない', () => {
    const { engine, events: initial } = buildEngine({ kingSlam: false });
    const events = runUntilNthPlayerAttack(engine, initial, 10);

    const kingSlamHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    expect(kingSlamHits.length).toBe(0);
  });

  it('noDirectDamage=true の時はキングスラムも発動しない', () => {
    const { engine, events: initial } = buildEngine({
      kingSlam: true,
      noDirectDamage: true,
    });
    const events = runUntilNthPlayerAttack(engine, initial, 10);

    const kingSlamHits = events.filter(
      (e) =>
        e.type === 'player_attack' &&
        (e.data as Record<string, unknown>).source === 'king_slam'
    );
    expect(kingSlamHits.length).toBe(0);
  });
});

// ========================================
// 王の咆哮 (royal_roar)
// ========================================

describe('プレイヤー装備: 王の咆哮 (royal_roar)', () => {
  it('3回攻撃ごとにプレイヤーの毒スタックが解除される', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: true });

    // 1回目の攻撃より前に毒を付与
    engine.getState().playerPoisonStacks = [
      { damagePerTick: 10, remainingTicks: 1000 },
    ];

    runUntilNthPlayerAttack(engine, initial, 2);
    // 2回目までは解除されない
    expect(engine.getState().playerPoisonStacks.length).toBe(1);

    runUntilNthPlayerAttack(engine, [], 3);
    // 3回目で解除
    expect(engine.getState().playerPoisonStacks.length).toBe(0);
  });

  it('3回攻撃ごとにプレイヤーのチル状態が解除される', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: true });

    engine.getState().playerChillState = {
      speedMultiplier: 0.8,
      remainingMs: 10000,
    };

    runUntilNthPlayerAttack(engine, initial, 2);
    expect(engine.getState().playerChillState).not.toBeNull();

    runUntilNthPlayerAttack(engine, [], 3);
    expect(engine.getState().playerChillState).toBeNull();
  });

  it('毒・チル解除時に source="royal_roar" の player_heal イベントが発火する', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: true });
    engine.getState().playerPoisonStacks = [
      { damagePerTick: 10, remainingTicks: 1000 },
    ];

    const events = runUntilNthPlayerAttack(engine, initial, 3);
    const royalRoarEvents = events.filter(
      (e) =>
        e.type === 'player_heal' &&
        (e.data as Record<string, unknown>).source === 'royal_roar'
    );
    expect(royalRoarEvents.length).toBe(1);
  });

  it('毒もチルも無い場合は player_heal イベントは発火しない（内部カウンタは進む）', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: true });
    // 毒・チルなし
    const events = runUntilNthPlayerAttack(engine, initial, 6);

    const royalRoarEvents = events.filter(
      (e) =>
        e.type === 'player_heal' &&
        (e.data as Record<string, unknown>).source === 'royal_roar'
    );
    expect(royalRoarEvents.length).toBe(0);
  });

  it('royalRoar=false では毒・チルが解除されない', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: false });
    engine.getState().playerPoisonStacks = [
      { damagePerTick: 10, remainingTicks: 1000 },
    ];
    engine.getState().playerChillState = {
      speedMultiplier: 0.8,
      remainingMs: 10000,
    };

    runUntilNthPlayerAttack(engine, initial, 6);
    expect(engine.getState().playerPoisonStacks.length).toBeGreaterThan(0);
    expect(engine.getState().playerChillState).not.toBeNull();
  });

  it('6回攻撃で合計2回解除が発動する', () => {
    const { engine, events: initial } = buildEngine({ royalRoar: true });

    // 毒を毎回補充しながら観察するため、毒チェックだけ6回（3回×2）
    let royalRoarCount = 0;
    let all: BattleEvent[] = [...initial];

    for (let round = 0; round < 2; round++) {
      engine.getState().playerPoisonStacks = [
        { damagePerTick: 10, remainingTicks: 10000 },
      ];
      const targetAttack = (round + 1) * 3;
      all = runUntilNthPlayerAttack(engine, all, targetAttack);
      const newRoarEvents = all.filter(
        (e) =>
          e.type === 'player_heal' &&
          (e.data as Record<string, unknown>).source === 'royal_roar'
      );
      royalRoarCount = newRoarEvents.length;
    }

    expect(royalRoarCount).toBe(2);
  });
});
