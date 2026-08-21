import { describe, it, expect } from 'vitest';
import {
  computeSuddenDeathMult,
  createPvpEngine,
  clonePvpMods,
  resolveActionOrder,
  runPvpBattle,
  woundMultiplier,
} from '../../../core/pvpEngine';
import { createPvpRngStreams } from '../../../core/pvp/rng';
import { PVP_RULESET_V1 } from '../../../core/pvp/ruleset';
import { calculateDamage } from '../../../core/battle';
import { DEFAULT_BATTLE_CONFIG } from '../../../core/types';
import type { PvpBuildSnapshot, PvpEvent, PvpRngStreams } from '../../../core';
import { MAKOPI, SALT, build, mirrorEvents, mods } from './helpers';

const V1 = 1;

const run = (a: PvpBuildSnapshot, b: PvpBuildSnapshot, seed: number, streams?: PvpRngStreams) =>
  runPvpBattle({ sides: [a, b], seed, rulesetVersion: V1 }, streams);

describe('core/pvpEngine - 決定性', () => {
  it('同一入力なら勝者・ティック・イベント列が完全一致する', () => {
    for (const seed of [1, 2, 3, 7919, -12345]) {
      const r1 = run(SALT, MAKOPI, seed);
      const r2 = run(SALT, MAKOPI, seed);
      expect(r2.winner).toBe(r1.winner);
      expect(r2.elapsedTicks).toBe(r1.elapsedTicks);
      expect(r2.finalHp).toEqual(r1.finalHp);
      expect(JSON.stringify(r2.events)).toBe(JSON.stringify(r1.events));
    }
  });

  it('advanceTicks を刻んでも runToEnd と同じ状態になる', () => {
    const input = { sides: [SALT, MAKOPI] as [PvpBuildSnapshot, PvpBuildSnapshot], seed: 42, rulesetVersion: V1 };
    const whole = runPvpBattle(input);

    const stepped = createPvpEngine(input);
    const events: PvpEvent[] = [];
    while (!stepped.isFinished()) {
      events.push(...stepped.advanceTicks(1));
    }
    expect(stepped.getState().elapsedTicks).toBe(whole.elapsedTicks);
    expect(stepped.getState().winner).toBe(whole.winner);
    expect(JSON.stringify(events)).toBe(JSON.stringify(whole.events));
  });

  it('seed が違えば結果が変わる（全seedで同じにならない）', () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const r = run(SALT, MAKOPI, seed);
      return `${r.winner}:${r.elapsedTicks}:${r.finalHp.join(',')}`;
    });
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  it('rng は必須で Math.random / Date にフォールバックしない（seed=0 は例外）', () => {
    expect(() => run(SALT, MAKOPI, 0)).toThrow();
  });
});

describe('core/pvpEngine - 対称性', () => {
  /** sides を入れ替え、ストリーム割り当ても入れ替え、コイントスを反転させる */
  const swappedStreams = (seed: number): PvpRngStreams => {
    const base = createPvpRngStreams(seed);
    return {
      sides: [base.sides[1], base.sides[0]],
      // コイン反転: 元が「側0が先」なら、入れ替え後は「側1が先」になる必要がある
      order: () => (base.order() < 0.5 ? 0.75 : 0.25),
    };
  };

  it('sides 入れ替え + ストリーム入れ替え + コイン反転で勝者が反転する', () => {
    for (const seed of [1, 2, 3, 11, 101, 4242, 99991]) {
      const base = run(SALT, MAKOPI, seed);
      const swapped = run(MAKOPI, SALT, seed, swappedStreams(seed));
      expect(base.reason).toBe('ko');
      expect(swapped.reason).toBe(base.reason);
      expect(swapped.elapsedTicks).toBe(base.elapsedTicks);
      expect(swapped.winner).toBe(base.winner === 'draw' ? 'draw' : 1 - (base.winner as number));
      expect(swapped.finalHp).toEqual([base.finalHp[1], base.finalHp[0]]);
    }
  });

  it('イベント列も side が反転しただけの鏡像になる', () => {
    const seed = 31337;
    const base = run(SALT, MAKOPI, seed);
    const swapped = run(MAKOPI, SALT, seed, swappedStreams(seed));
    expect(JSON.stringify(mirrorEvents(swapped.events))).toBe(JSON.stringify(base.events));
  });

  it('ミラーマッチで side0 勝率が50%近傍（先攻固定になっていない）', () => {
    let side0 = 0;
    let side1 = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      const r = run(SALT, SALT, seed);
      if (r.winner === 0) side0 += 1;
      else if (r.winner === 1) side1 += 1;
    }
    expect(side0 + side1).toBe(N);
    const rate = side0 / N;
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });

  it('resolveActionOrder は AS が高い方を先にし、同値ならコイントス', () => {
    const never = () => {
      throw new Error('コイントスを消費してはいけない');
    };
    expect(resolveActionOrder(2, 1, never)).toEqual([0, 1]);
    expect(resolveActionOrder(1, 2, never)).toEqual([1, 0]);
    expect(resolveActionOrder(1, 1, () => 0.2)).toEqual([0, 1]);
    expect(resolveActionOrder(1, 1, () => 0.8)).toEqual([1, 0]);
  });
});

describe('core/pvpEngine - 決着条件', () => {
  it('両者同時HP0 は draw', () => {
    // 攻撃側がスイングで相手を倒し、相手の反撃で自分も倒れる
    const glass = build({ maxHp: 100, atk: 100000, def: 0 });
    const thorns = build({ maxHp: 10, atk: 1, def: 1000 }, { retaliateDefPct: 1000000 });
    const r = run(glass, thorns, 1234);
    expect(r.winner).toBe('draw');
    expect(r.reason).toBe('draw');
    expect(r.finalHp[0]).toBe(0);
    expect(r.finalHp[1]).toBe(0);
  });

  it('時間切れは残HP割合が高い方の勝ち', () => {
    // 直接ダメージ無効 + 巨大HP。side1 だけ毎秒わずかに削られる構図を作る
    const tankBig = build({ maxHp: 200000, atk: 1, def: 10000 });
    const tankSmall = build({ maxHp: 100000, atk: 1, def: 10000 });
    const r = run(tankBig, tankSmall, 555);
    expect(r.reason).toBe('timeout');
    expect(r.elapsedTicks).toBe(PVP_RULESET_V1.timeLimitSec * DEFAULT_BATTLE_CONFIG.ticksPerSecond);
    expect(r.finalHpPct[0]).toBeGreaterThan(r.finalHpPct[1]);
    expect(r.winner).toBe(0);
  });

  it('時間切れで完全同値なら防衛側（sides[1]）の勝ち', () => {
    const inert = build({ maxHp: 100000, atk: 1, def: 10000 }, { noDirectDamage: true });
    const r = run(inert, inert, 777);
    expect(r.reason).toBe('timeout');
    expect(r.finalHpPct[0]).toBe(r.finalHpPct[1]);
    expect(r.winner).toBe(1);
  });

  it('時間切れの残存割合はシールドを含む（HP満タン同士でもシールド残量で決着する）', () => {
    // 双方ともシールドで全ダメージを吸収しきり、HPは1も減らない構図
    const bigShield = build({ maxHp: 100000, atk: 200, def: 0 }, { shield: 100000 });
    const smallShield = build({ maxHp: 100000, atk: 200, def: 0 }, { shield: 20000 });
    const r = run(bigShield, smallShield, 20260821);

    expect(r.reason).toBe('timeout');
    // HPは両者とも満タン（旧定義 currentHp/maxHp なら完全同値 → 防衛側の不戦勝だった）
    expect(r.finalHp[0]).toBe(100000);
    expect(r.finalHp[1]).toBe(100000);
    // シールドは両者とも削られている
    expect(r.finalShield[0]).toBeLessThan(100000);
    expect(r.finalShield[1]).toBeLessThan(20000);
    // 残存割合はシールドを含むので同値にならず、割合が高い側が勝つ
    expect(r.finalHpPct[0]).not.toBe(r.finalHpPct[1]);
    expect(r.finalHpPct[0]).toBeGreaterThan(r.finalHpPct[1]);
    expect(r.winner).toBe(0);
  });

  it('finalHpPct は (hp + shield) / (maxHp + maxShield) で計算される', () => {
    const shielded = build({ maxHp: 10000, atk: 1, def: 100000 }, { shield: 5000 });
    const r = run(shielded, shielded, 4242);
    for (const side of [0, 1] as const) {
      const expected = (r.finalHp[side] + r.finalShield[side]) / (10000 + 5000);
      expect(r.finalHpPct[side]).toBeCloseTo(expected, 12);
    }
  });

  it('シールドを持たないビルドでは残存割合が HP割合と一致する', () => {
    const plain = build({ maxHp: 200000, atk: 1, def: 10000 });
    const r = run(plain, plain, 909);
    expect(r.finalShield).toEqual([0, 0]);
    expect(r.finalHpPct[0]).toBeCloseTo(r.finalHp[0] / 200000, 12);
  });

  it('サドンデス倍率は開始秒まで1、以降は毎秒 rampPct ずつ上がる', () => {
    const tps = DEFAULT_BATTLE_CONFIG.ticksPerSecond;
    expect(computeSuddenDeathMult(0, PVP_RULESET_V1, tps)).toBe(1);
    expect(computeSuddenDeathMult(45 * tps, PVP_RULESET_V1, tps)).toBe(1);
    expect(computeSuddenDeathMult(46 * tps, PVP_RULESET_V1, tps)).toBeCloseTo(1.05, 10);
    expect(computeSuddenDeathMult(90 * tps, PVP_RULESET_V1, tps)).toBeCloseTo(1 + 45 * 0.05, 10);
  });
});

describe('core/pvpEngine - PvEとの式一致', () => {
  it('1発ダメージが calculateDamage(atk * damageScale, def, 0) と一致する', () => {
    const atk = 6405;
    const def = 2224;
    // 相手は「攻撃しないダミー」（noDirectDamage・巨大HP）
    const attacker = build({ maxHp: 100000, atk, def: 0 });
    const dummy = build({ maxHp: 10_000_000, atk: 1, def }, { noDirectDamage: true });
    const r = run(attacker, dummy, 4649);

    const expected = calculateDamage(atk * PVP_RULESET_V1.damageScale, def, 0);
    // サドンデス突入前（45秒以内）のスイングだけを見る
    const suddenDeathTick = PVP_RULESET_V1.suddenDeathStartSec * DEFAULT_BATTLE_CONFIG.ticksPerSecond;
    const attacks = r.events.filter(
      (e) => e.type === 'attack' && e.side === 0 && !e.data.evaded && !e.data.blocked
        && e.tick <= suddenDeathTick
    );
    expect(attacks.length).toBeGreaterThan(0);
    for (const e of attacks) {
      expect(e.data.main).toBe(expected);
      expect(e.data.damage).toBe(expected);
    }
  });

  it('DEF軽減式（def/(def+500)）がそのまま効く', () => {
    // DEF 500 で 50% 軽減
    const atk = 10000;
    const attacker = build({ maxHp: 100000, atk, def: 0 });
    const dummy = build({ maxHp: 10_000_000, atk: 1, def: 500 }, { noDirectDamage: true });
    const r = run(attacker, dummy, 31);
    const hit = r.events.find((e) => e.type === 'attack' && e.side === 0 && !e.data.evaded);
    expect(hit?.data.main).toBe(Math.floor(atk * PVP_RULESET_V1.damageScale * 0.5));
  });

  it('重傷倍率は Math.pow を使わず 1.2 の反復乗算で計算される', () => {
    expect(woundMultiplier(0)).toBe(1);
    expect(woundMultiplier(1)).toBe(1.2);
    let expected = 1;
    for (let i = 0; i < 5; i++) expected *= 1.2;
    expect(woundMultiplier(5)).toBe(expected);
    // core/pvpEngine.ts に Math.pow / ** が存在しないこと
  });

  it('king_slam は 5回攻撃ごとに ATK×3 相当の追撃を出す', () => {
    const atk = 4000;
    const def = 1000;
    const attacker = build({ maxHp: 100000, atk, def: 0 }, { kingSlam: true });
    const dummy = build({ maxHp: 10_000_000, atk: 1, def }, { noDirectDamage: true });
    const r = run(attacker, dummy, 20260821);
    const slams = r.events.filter((e) => e.type === 'attack' && (e.data.kingSlam as number) > 0);
    expect(slams.length).toBeGreaterThan(0);
    const expected = calculateDamage(atk * PVP_RULESET_V1.damageScale * 3, def, 0);
    for (const e of slams) expect(e.data.kingSlam).toBe(expected);
  });

  it('playerAccuracy は両側に 500 が入る', () => {
    const engine = createPvpEngine({ sides: [SALT, MAKOPI], seed: 5, rulesetVersion: V1 });
    expect(engine.getState().sides[0].accuracy).toBe(500);
    expect(engine.getState().sides[1].accuracy).toBe(500);
  });

  it('maxActionsPerTick は 5', () => {
    // 極端に速い攻撃速度でも1ティック5行動までしか出ない
    const fast = build({ maxHp: 100000, atk: 100, def: 0 }, { attackSpeedPct: 100000 });
    const dummy = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const engine = createPvpEngine({ sides: [fast, dummy], seed: 9, rulesetVersion: V1 });
    const events = engine.advanceTicks(1);
    const attacks = events.filter((e) => e.type === 'attack' && e.side === 0);
    expect(attacks.length).toBe(PVP_RULESET_V1.maxActionsPerTick);
  });
});

describe('core/pvpEngine - hpToShield は回復のキルスイッチ', () => {
  /** 回復8系統それぞれを単独で発火させる最小MOD */
  const HEAL_CASES: { source: string; extra: Record<string, unknown> }[] = [
    { source: 'regen', extra: { hpRegen: 500 } },
    { source: 'lifesteal', extra: { lifestealPct: 100 } },
    { source: 'crit_lifesteal', extra: { criticalChance: 100, critLifestealPct: 50 } },
    { source: 'follow_up_on_hit', extra: { criticalChance: 100, criticalFollowUpAttack: true, hpOnHit: 500 } },
    { source: 'uber_follow_up_on_hit', extra: { criticalChance: 100, uberCriticalFollowUp: true, hpOnHit: 500 } },
    { source: 'ring_follow_up_on_hit', extra: { followUpAttackPct: 100, hpOnHit: 500 } },
    { source: 'poison_lifesteal', extra: { poisonChance: 100, poisonLifesteal: 100 } },
    { source: 'ignite_lifesteal', extra: { igniteChance: 100, igniteLifesteal: 100 } },
    { source: 'heavy_strike', extra: { heavyStrike: true } },
  ];

  // 回復量に対して被ダメージが十分大きく、常に HP < maxHp を保つ相手
  const HEAVY_FOE = build({ maxHp: 2_000_000, atk: 60000, def: 1000 });

  it.each(HEAL_CASES)('$source は hpToShield なしで発火し、ありで止まる', ({ source, extra }) => {
    const open = build({ maxHp: 500000, atk: 4000, def: 0 }, extra);
    const shielded = build({ maxHp: 500000, atk: 4000, def: 0 }, { ...extra, hpToShield: true });

    const openHeals = run(open, HEAVY_FOE, 555111).events
      .filter((e) => e.type === 'heal' && e.side === 0 && e.data.source === source);
    const shieldedHeals = run(shielded, HEAVY_FOE, 555111).events
      .filter((e) => e.type === 'heal' && e.side === 0 && e.data.source === source);

    expect(openHeals.length, `${source} が hpToShield なしで発火していない`).toBeGreaterThan(0);
    expect(shieldedHeals.length, `${source} が hpToShield で止まっていない`).toBe(0);
  });

  it('hpToShield ビルドの回復イベントは hp_on_taken_hit しか残らない', () => {
    const allHeals = HEAL_CASES.reduce<Record<string, unknown>>(
      (acc, c) => ({ ...acc, ...c.extra }),
      { hpToShield: true, hpOnTakenHit: 300 }
    );
    // heavyStrike は通常ライフスティールと排他なので外す
    delete allHeals.heavyStrike;
    const shielded = build({ maxHp: 500000, atk: 4000, def: 0 }, allHeals);
    const r = run(shielded, HEAVY_FOE, 4242);
    const sources = new Set(
      r.events.filter((e) => e.type === 'heal' && e.side === 0).map((e) => e.data.source as string)
    );
    expect([...sources]).toEqual(['hp_on_taken_hit']);
  });

  it('hpToShield は最大HPを30%に圧縮し、残りをシールドに移す', () => {
    const snapshot = build({ maxHp: 10000, atk: 100, def: 0 }, { hpToShield: true });
    const engine = createPvpEngine({ sides: [snapshot, snapshot], seed: 3, rulesetVersion: V1 });
    const side = engine.getState().sides[0];
    expect(side.maxHp).toBe(3000);
    expect(side.maxShield).toBe(10000);
  });

  it('被弾時HP回復（hpOnTakenHit）は hpToShield でも止まらない（PvEと同じ）', () => {
    const tank = build({ maxHp: 20000, atk: 1, def: 1000 }, { hpToShield: true, hpOnTakenHit: 300 });
    const foe = build({ maxHp: 20000, atk: 6000, def: 0 });
    const r = run(tank, foe, 6161);
    const heals = r.events.filter(
      (e) => e.type === 'heal' && e.side === 0 && e.data.source === 'hp_on_taken_hit'
    );
    expect(heals.length).toBeGreaterThan(0);
  });
});

describe('core/pvpEngine - 重傷（heavyStrike）の両側化', () => {
  it('ミラーマッチで両側に独立して重傷が積まれる', () => {
    const heavy = build({ maxHp: 30000, atk: 5000, def: 1500 }, { heavyStrike: true });
    const r = run(heavy, heavy, 2468);
    const applied0 = r.events.filter((e) => e.type === 'wound_applied' && e.side === 0);
    const applied1 = r.events.filter((e) => e.type === 'wound_applied' && e.side === 1);
    expect(applied0.length).toBeGreaterThan(0);
    expect(applied1.length).toBeGreaterThan(0);
    // 上限5
    for (const e of [...applied0, ...applied1]) {
      expect(e.data.stacks as number).toBeLessThanOrEqual(5);
    }
  });

  it('重傷は自分が行動するたびにカウントされ、4回で1減衰する', () => {
    const heavy = build({ maxHp: 60000, atk: 5000, def: 1500 }, { heavyStrike: true });
    const r = run(heavy, heavy, 13579);
    const decayed = r.events.filter((e) => e.type === 'wound_decayed');
    expect(decayed.length).toBeGreaterThan(0);
    expect(new Set(decayed.map((e) => e.side)).size).toBe(2);
  });

  it('重撃は攻撃速度-20%になる', () => {
    const snapshot = build({ maxHp: 100, atk: 1, def: 0 }, { heavyStrike: true });
    const engine = createPvpEngine({ sides: [snapshot, snapshot], seed: 3, rulesetVersion: V1 });
    expect(engine.getState().sides[0].attackSpeedBase).toBeCloseTo(0.8, 10);
  });
});

describe('core/pvpEngine - mods 非変異', () => {
  it('warlordEnrage が発動しても入力の mods オブジェクトは変わらない', () => {
    const warlordMods = mods({ warlordEnrage: true, attackSpeedPct: 30, hpOnHit: 10 });
    const attacker: PvpBuildSnapshot = { stats: { maxHp: 5000, atk: 100, def: 0 }, mods: warlordMods };
    const foe = build({ maxHp: 50000, atk: 4000, def: 0 });
    const before = JSON.stringify(warlordMods);

    const r = run(attacker, foe, 31415);
    const enrage = r.events.filter((e) => e.type === 'warlord_enrage');
    expect(enrage.length).toBeGreaterThan(0);
    expect(enrage[0].side).toBe(0);
    expect(JSON.stringify(warlordMods)).toBe(before);
    expect(warlordMods.attackSpeedPct).toBe(30);
    expect(warlordMods.hpOnHit).toBe(10);
  });

  it('同じ mods で2回戦っても結果が変わらない（PvEの潜在バグを持ち込まない）', () => {
    const warlordMods = mods({ warlordEnrage: true, attackSpeedPct: 30 });
    const attacker: PvpBuildSnapshot = { stats: { maxHp: 5000, atk: 100, def: 0 }, mods: warlordMods };
    const foe = build({ maxHp: 50000, atk: 4000, def: 0 });
    const r1 = run(attacker, foe, 31415);
    const r2 = run(attacker, foe, 31415);
    expect(JSON.stringify(r2.events)).toBe(JSON.stringify(r1.events));
  });

  it('clonePvpMods は配列5本を複製する', () => {
    const original = mods({
      poisonDamageMorePct: [10],
      igniteDamageMorePct: [20],
      shieldMorePct: [30],
      attackSpeedMorePct: [40],
      evasionMorePct: [50],
    });
    const copy = clonePvpMods(original);
    expect(copy).toEqual(original);
    for (const key of ['poisonDamageMorePct', 'igniteDamageMorePct', 'shieldMorePct', 'attackSpeedMorePct', 'evasionMorePct'] as const) {
      expect(copy[key]).not.toBe(original[key]);
    }
  });

  it('両側が同じスナップショットを参照しても side ごとに独立する', () => {
    const shared = build({ maxHp: 5000, atk: 3000, def: 500 }, { warlordEnrage: true });
    const engine = createPvpEngine({ sides: [shared, shared], seed: 5, rulesetVersion: V1 });
    const [s0, s1] = engine.getState().sides;
    expect(s0.mods).not.toBe(s1.mods);
    expect(s0.mods).not.toBe(shared.mods);
  });
});

describe('core/pvpEngine - 状態異常の両側化', () => {
  it('毒・発火・チル・フリーズが両側に乗る', () => {
    const dot = build({ maxHp: 40000, atk: 4000, def: 1000 }, {
      poisonChance: 100,
      igniteChance: 100,
      chillChance: 100,
      freezeChance: 100,
    });
    const r = run(dot, dot, 24680);
    for (const type of ['poison_applied', 'ignite_applied', 'chill_applied', 'freeze_applied'] as const) {
      const sides = new Set(r.events.filter((e) => e.type === type).map((e) => e.side));
      expect(sides.has(0), `${type} が side0 に無い`).toBe(true);
      expect(sides.has(1), `${type} が side1 に無い`).toBe(true);
    }
  });

  it('チル耐性・フリーズ耐性は確率減算型で効く（付与回数が減る）', () => {
    const attacker = build({ maxHp: 100000, atk: 100, def: 0 }, {
      chillChance: 100,
      freezeChance: 100,
      freezeChanceCapPct: 90,
    });
    const naked = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const resistant = build({ maxHp: 10_000_000, atk: 1, def: 0 }, {
      noDirectDamage: true,
      chillResistPct: 90,
      freezeResistPct: 90,
    });
    const a = run(attacker, naked, 112233);
    const b = run(attacker, resistant, 112233);
    const count = (r: typeof a, type: string) => r.events.filter((e) => e.type === type).length;
    expect(count(b, 'chill_applied')).toBeLessThan(count(a, 'chill_applied'));
    expect(count(b, 'freeze_applied')).toBeLessThan(count(a, 'freeze_applied'));
  });

  it('毒耐性はダメージ軽減として効く', () => {
    const poisoner = build({ maxHp: 100000, atk: 4000, def: 0 }, { poisonChance: 100 });
    const naked = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const resistant = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true, poisonResistPct: 90 });
    const sum = (b: PvpBuildSnapshot) => {
      const r = run(poisoner, b, 5150);
      return r.events
        .filter((e) => e.type === 'poison_damage')
        .reduce((acc, e) => acc + (e.data.damage as number), 0);
    };
    expect(sum(resistant)).toBeLessThan(sum(naked) * 0.2);
  });

  it('発火耐性（igniteResistPct）がPvPで有効化されている', () => {
    const igniter = build({ maxHp: 100000, atk: 4000, def: 0 }, { igniteChance: 100 });
    const naked = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const resistant = build({ maxHp: 10_000_000, atk: 1, def: 0 }, { noDirectDamage: true, igniteResistPct: 90 });
    const sum = (b: PvpBuildSnapshot) => {
      const r = run(igniter, b, 5151);
      return r.events
        .filter((e) => e.type === 'ignite_damage')
        .reduce((acc, e) => acc + (e.data.damage as number), 0);
    };
    expect(sum(resistant)).toBeLessThan(sum(naked) * 0.2);
  });

  it('フリーズ解除後は両側ともチルに移行する（PvEの片側非対称を潰す）', () => {
    const freezer = build({ maxHp: 200000, atk: 200, def: 0 }, { freezeChance: 100, freezeChanceCapPct: 90 });
    const r = run(freezer, freezer, 606060);
    const transitions = r.events.filter(
      (e) => e.type === 'chill_applied' && e.data.source === 'freeze_transition'
    );
    expect(new Set(transitions.map((e) => e.side)).size).toBe(2);
  });

  it('永久凍土（autoCleanse）は両側で状態異常を解除する', () => {
    const cleanser = build({ maxHp: 200000, atk: 2000, def: 0 }, {
      autoCleanseIntervalMs: 1000,
      poisonChance: 100,
      igniteChance: 100,
      chillChance: 100,
    });
    const r = run(cleanser, cleanser, 909090);
    const cleanses = r.events.filter((e) => e.type === 'cleanse' && e.data.source === 'auto_cleanse');
    expect(new Set(cleanses.map((e) => e.side)).size).toBe(2);
  });

  it('王の咆哮は3回攻撃ごとに自分の状態異常（発火含む）を解除する', () => {
    const roarer = build({ maxHp: 200000, atk: 2000, def: 0 }, { royalRoar: true, igniteChance: 100, poisonChance: 100 });
    const r = run(roarer, roarer, 30303);
    const roars = r.events.filter((e) => e.type === 'cleanse' && e.data.source === 'royal_roar');
    expect(roars.length).toBeGreaterThan(0);
  });
});

describe('core/pvpEngine - シールド・ブロック・遅延ダメージ', () => {
  it('シールドが先に削れてから HP が減る', () => {
    const tank = build({ maxHp: 20000, atk: 1, def: 0 }, { shield: 5000 });
    const striker = build({ maxHp: 100000, atk: 4000, def: 0 });
    const r = run(striker, tank, 4321);
    const first = r.events.find((e) => e.type === 'attack' && e.side === 0 && !e.data.evaded);
    expect(first!.data.shieldDamage as number).toBeGreaterThan(0);
    expect(first!.data.damage).toBe(0);
  });

  it('ブロックはダメージを0にする（ブロック率50%上限）', () => {
    const blocker = build({ maxHp: 100000, atk: 1, def: 0 }, { blockChance: 100 });
    const striker = build({ maxHp: 100000, atk: 4000, def: 0 });
    const r = run(striker, blocker, 246);
    const attacks = r.events.filter((e) => e.type === 'attack' && e.side === 0 && !e.data.evaded);
    const blockedCount = attacks.filter((e) => e.data.blocked).length;
    // 上限50%なので全ブロックにはならないが、ブロックは発生する
    expect(blockedCount).toBeGreaterThan(0);
    expect(blockedCount).toBeLessThan(attacks.length);
    for (const e of attacks.filter((x) => x.data.blocked)) {
      expect(e.data.damage).toBe(0);
      expect(e.data.shieldDamage).toBe(0);
    }
  });

  it('damageDeferPct は被ダメージを4秒に分割する', () => {
    const deferrer = build({ maxHp: 100000, atk: 1, def: 0 }, { damageDeferPct: 50 });
    const striker = build({ maxHp: 100000, atk: 4000, def: 0 });
    const r = run(striker, deferrer, 1357);
    const deferred = r.events.filter(
      (e) => e.type === 'damage' && e.side === 1 && e.data.source === 'deferred'
    );
    expect(deferred.length).toBeGreaterThan(0);
  });

  it('反撃（retaliateDefPct）は両側で機能する', () => {
    const thorny = build({ maxHp: 50000, atk: 2000, def: 3000 }, { retaliateDefPct: 100 });
    const r = run(thorny, thorny, 9753);
    const retaliates = r.events.filter((e) => e.type === 'damage' && e.data.source === 'retaliate');
    expect(new Set(retaliates.map((e) => e.side)).size).toBe(2);
  });
});

describe('core/pvpEngine - サドンデスは全ダメージに掛かる', () => {
  const SD_TICK = PVP_RULESET_V1.suddenDeathStartSec * DEFAULT_BATTLE_CONFIG.ticksPerSecond;

  /** サドンデス前後で最大ダメージがどれだけ伸びたかを返す */
  const growth = (events: PvpEvent[], type: string) => {
    const before = events.filter((e) => e.type === type && e.tick <= SD_TICK)
      .map((e) => e.data.damage as number);
    const after = events.filter((e) => e.type === type && e.tick > SD_TICK)
      .map((e) => e.data.damage as number);
    expect(before.length, `${type} がサドンデス前に発生していない`).toBeGreaterThan(0);
    expect(after.length, `${type} がサドンデス後に発生していない`).toBeGreaterThan(0);
    return { maxBefore: Math.max(...before), maxAfter: Math.max(...after) };
  };

  it('毒ダメージがサドンデス中に増える', () => {
    // 直接ダメージ無効の毒ビルド vs 巨大HPのダミー（90秒フルに走らせる）
    const poisoner = build({ maxHp: 1_000_000, atk: 4000, def: 0 }, {
      noDirectDamage: true,
      poisonChance: 100,
    });
    const dummy = build({ maxHp: 50_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const r = run(poisoner, dummy, 987654);
    expect(r.reason).toBe('timeout');

    const { maxBefore, maxAfter } = growth(r.events, 'poison_damage');
    expect(maxAfter).toBeGreaterThan(maxBefore);
    // 90秒時点の倍率は 1 + 45 * 0.05 = 3.25
    const maxMult = 1 + (PVP_RULESET_V1.timeLimitSec - PVP_RULESET_V1.suddenDeathStartSec)
      * (PVP_RULESET_V1.suddenDeathRampPctPerSec / 100);
    expect(maxAfter).toBeLessThanOrEqual(Math.floor(maxBefore * maxMult));
    expect(maxAfter).toBeGreaterThan(Math.floor(maxBefore * 2));
  });

  it('発火ダメージがサドンデス中に増える', () => {
    const igniter = build({ maxHp: 1_000_000, atk: 4000, def: 0 }, {
      noDirectDamage: true,
      igniteChance: 100,
    });
    const dummy = build({ maxHp: 50_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const r = run(igniter, dummy, 987654);
    expect(r.reason).toBe('timeout');

    const { maxBefore, maxAfter } = growth(r.events, 'ignite_damage');
    expect(maxAfter).toBeGreaterThan(maxBefore);
  });

  it('遅延ダメージの消化がサドンデス中に増える（生成時との二重適用にならない）', () => {
    const striker = build({ maxHp: 1_000_000, atk: 4000, def: 0 });
    const deferrer = build({ maxHp: 50_000_000, atk: 1, def: 0 }, {
      noDirectDamage: true,
      damageDeferPct: 50,
    });
    const r = run(striker, deferrer, 111222);
    expect(r.reason).toBe('timeout');

    const deferredEvents = r.events.filter(
      (e) => e.type === 'damage' && e.data.source === 'deferred'
    );
    const before = deferredEvents.filter((e) => e.tick <= SD_TICK).map((e) => e.data.damage as number);
    const after = deferredEvents.filter((e) => e.tick > SD_TICK).map((e) => e.data.damage as number);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);

    const maxBefore = Math.max(...before);
    const maxAfter = Math.max(...after);
    expect(maxAfter).toBeGreaterThan(maxBefore);
    // 二重適用（倍率の2乗 = 3.25^2 ≈ 10.6倍）になっていないこと
    const maxMult = 1 + (PVP_RULESET_V1.timeLimitSec - PVP_RULESET_V1.suddenDeathStartSec)
      * (PVP_RULESET_V1.suddenDeathRampPctPerSec / 100);
    expect(maxAfter).toBeLessThanOrEqual(Math.floor(maxBefore * maxMult) + 1);
  });

  it('反撃ダメージもサドンデス中に増える', () => {
    const thorny = build({ maxHp: 3_000_000, atk: 100, def: 20000 }, { retaliateDefPct: 100 });
    const r = run(thorny, thorny, 333444);
    expect(r.reason).toBe('timeout');
    const retaliates = r.events.filter((e) => e.type === 'damage' && e.data.source === 'retaliate');
    const before = retaliates.filter((e) => e.tick <= SD_TICK).map((e) => e.data.damage as number);
    const after = retaliates.filter((e) => e.tick > SD_TICK).map((e) => e.data.damage as number);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(Math.max(...after)).toBeGreaterThan(Math.max(...before));
  });

  it('サドンデス開始前は倍率1なので DoT のダメージが一定', () => {
    const poisoner = build({ maxHp: 1_000_000, atk: 4000, def: 0 }, {
      noDirectDamage: true,
      poisonChance: 100,
    });
    const dummy = build({ maxHp: 50_000_000, atk: 1, def: 0 }, { noDirectDamage: true });
    const r = run(poisoner, dummy, 987654);
    const before = r.events
      .filter((e) => e.type === 'poison_damage' && e.tick <= SD_TICK)
      .map((e) => e.data.damage as number);
    expect(new Set(before).size).toBe(1);
  });
});
