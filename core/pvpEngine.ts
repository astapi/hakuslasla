/**
 * PvP対称バトルエンジン
 *
 * 設計: docs/pvp-design.md §3
 * 実装仕様: docs/pvp-p1-engine-spec.md（battleEngine.ts の全数監査結果）
 *
 * 方針:
 * - `core/battleEngine.ts` / `core/bossBehaviors.ts` は一切参照しない（PvEバランス保護）
 * - 共有ルールは `core/combat/` の中立関数を「攻撃側・防御側」を入れ替えて2方向に使う
 * - 式はPvEのものをそのまま使う。PvP用のアーキタイプ別補正は新設しない
 * - `Math.pow` / `**` / `Math.random` / `Date` を一切使わない（決定性のため）
 * - 入力の `mods` は必ずディープコピーしてから戦闘に入る（warlordEnrage が破壊的に変更するため）
 *
 * ティックの構成（仕様メモ §2.3）:
 *   P0 経過ティック加算 + サドンデス倍率算出
 *   P1 時間バフ（実効ATK/DEF）+ 乱軍の王の発動判定   ※両側 固定順 [0,1]
 *   P2 チル/フリーズの持続処理（フリーズ→チル移行も両側）
 *   P3 自動解除（永久凍土）
 *   P4 ゲージ加算                                     ※必ず固定順（浮動小数の加算順を固定）
 *   P5 1秒ごと: HP回復 → シールド再構築 → 遅延ダメージ → 死亡解決
 *   P6 発火ダメージ → 死亡解決
 *   P7 行動順を決めて行動ループ → 死亡解決
 */

import { calculateDamage } from './battle';
import {
  calculateHpRegen,
  calculateLifesteal,
  executeAttack,
  isIgnited,
  isPoisoned,
  processChillState,
  processFreezeState,
  processIgniteDamage,
  processPoisonDamage,
  rollHit,
  tryApplyChill,
  tryApplyFreeze,
  tryApplyIgnite,
  tryApplyPoison,
} from './combat';
import { calculateBattleHpAndShield, getAttackSpeedFromMods } from './modEffects';
import {
  BattleConfig,
  ChillState,
  CombinedModEffects,
  DEFAULT_BATTLE_CONFIG,
} from './types';
import { createPvpRngStreams, PvpRngStreams } from './pvp/rng';
import { getPvpRuleset, PvpRuleset } from './pvp/ruleset';
import type {
  PvpBattleInput,
  PvpBattleState,
  PvpBuildSnapshot,
  PvpCombatant,
  PvpEndReason,
  PvpEngine,
  PvpEvent,
  PvpEventType,
  PvpResult,
  PvpSideIndex,
} from './pvp/types';

// ========================================
// ユーティリティ
// ========================================

/** 側の反転 */
const other = (side: PvpSideIndex): PvpSideIndex => (side === 0 ? 1 : 0);

/**
 * 1.2^stacks を反復乗算で計算する
 *
 * `Math.pow` は ECMA-262 で実装依存の近似が許されており、Hermes と Node V8 で
 * 最終ビットが一致する保証がない（仕様メモ §6-A）。stacks は 0〜5 の整数なので
 * 反復乗算に置き換える。定数テーブル化はしない（ビット一致の保証が無いため）。
 */
export function woundMultiplier(stacks: number): number {
  let m = 1;
  for (let i = 0; i < stacks; i++) {
    m *= 1.2;
  }
  return m;
}

/**
 * CombinedModEffects のディープコピー
 *
 * 配列フィールド5本も複製する。浅いスプレッドでは warlordEnrage 以外にも
 * 配列共有の事故が起きうるため必ずこれを通す（仕様メモ §6-D）。
 */
export function clonePvpMods(mods: CombinedModEffects): CombinedModEffects {
  return {
    ...mods,
    poisonDamageMorePct: [...mods.poisonDamageMorePct],
    igniteDamageMorePct: [...mods.igniteDamageMorePct],
    shieldMorePct: [...mods.shieldMorePct],
    attackSpeedMorePct: [...mods.attackSpeedMorePct],
    evasionMorePct: [...mods.evasionMorePct],
  };
}

// ========================================
// エンジン内部状態
// ========================================

interface PvpEngineState {
  state: PvpBattleState;
  ruleset: PvpRuleset;
  config: BattleConfig;
  rngs: PvpRngStreams;
  /** 現在ティックのサドンデス倍率 */
  suddenDeathMult: number;
  timeLimitTicks: number;
}

// ========================================
// 初期化
// ========================================

function createCombatant(
  snapshot: PvpBuildSnapshot,
  ruleset: PvpRuleset,
  rng: () => number
): PvpCombatant {
  const mods = clonePvpMods(snapshot.mods);
  const shieldStats = calculateBattleHpAndShield(snapshot.stats.maxHp, mods);
  // 重撃: 攻撃速度-20%（battleEngine.ts:244-246 と同形。エンドコンテンツ倍率は持ち込まない）
  const attackSpeedBase = getAttackSpeedFromMods(mods) * (mods.heavyStrike ? 0.8 : 1);

  return {
    currentHp: shieldStats.maxHp,
    maxHp: shieldStats.maxHp,
    atk: Math.max(1, Math.floor(snapshot.stats.atk)),
    def: Math.max(0, Math.floor(snapshot.stats.def)),
    accuracy: ruleset.playerAccuracy,
    attackSpeedBase,
    gauge: 0,
    mods,

    effectiveAtk: 0,
    scaledAtk: 0,
    effectiveDef: 0,
    effectiveAttackSpeed: 0,
    timeHpRegenBonus: 0,

    shield: shieldStats.maxShield,
    maxShield: shieldStats.maxShield,
    lastShieldDamageTick: null,
    lastHitDamageTick: null,
    lastAutoCleanseTick: null,

    poisonStacks: [],
    igniteState: null,
    chillState: null,
    freezeState: null,
    pendingChillAfterFreeze: null,
    woundStacks: 0,
    woundActionCounter: 0,

    attackCount: 0,
    consecutiveEvades: 0,
    igniteApplyCount: 0,
    poisonStackAccumulator: 0,
    deferredDamages: [],
    regenCounter: 0,
    warlordEnrageActivated: false,

    rng,
  };
}

// ========================================
// イベント
// ========================================

function pushEvent(
  events: PvpEvent[],
  type: PvpEventType,
  tick: number,
  side: PvpSideIndex,
  data: Record<string, unknown>
): void {
  events.push({ type, tick, side, data });
}

// ========================================
// ダメージ適用（battleEngine.ts:110-157 の対称版）
// ========================================

interface ApplyDamageResult {
  hpDamage: number;
  shieldDamage: number;
  blocked: boolean;
}

/** シールド回復（battleEngine.ts:98-103） */
function restoreShield(target: PvpCombatant, amount: number): number {
  if (amount <= 0 || target.maxShield <= 0) return 0;
  const before = target.shield;
  target.shield = Math.min(target.maxShield, target.shield + amount);
  return target.shield - before;
}

/** ブロック判定（battleEngine.ts:105-108）。防御側ストリームを消費する */
function rollBlock(target: PvpCombatant): boolean {
  const blockChance = Math.min(50, Math.max(0, target.mods.blockChance));
  return blockChance > 0 && target.rng() * 100 < blockChance;
}

/**
 * 防御側にダメージを適用する
 *
 * B1〜B5（仕様メモ §3-B）をすべて含む。ブロック判定だけは呼び出し側で
 * 防御側ストリームを使って先に行い、`blocked` として渡す。
 */
function applyDamageTo(
  engine: PvpEngineState,
  target: PvpCombatant,
  damage: number,
  options: { bypassShield?: boolean; hit?: boolean; blocked?: boolean } = {}
): ApplyDamageResult {
  const elapsedTicks = engine.state.elapsedTicks;
  let remaining = Math.max(0, damage);
  const blocked = options.blocked === true;

  if (options.hit && remaining > 0) {
    if (blocked) {
      remaining = 0;
    } else {
      // B2: 短時間の連続被弾軽減
      const lastHitTick = target.lastHitDamageTick;
      if (
        lastHitTick !== null &&
        elapsedTicks - lastHitTick <= engine.config.ticksPerSecond &&
        target.mods.repeatHitDamageReductionPct > 0
      ) {
        const reduction = Math.min(80, Math.max(0, target.mods.repeatHitDamageReductionPct));
        remaining = Math.floor(remaining * (1 - reduction / 100));
      }
      // B3: 低HP軽減（B2 → B3 の順。両方 floor するため順序が結果に影響する）
      if (
        target.mods.lowHpDamageReductionPct > 0 &&
        target.currentHp <= target.maxHp * 0.3
      ) {
        const reduction = Math.min(80, Math.max(0, target.mods.lowHpDamageReductionPct));
        remaining = Math.floor(remaining * (1 - reduction / 100));
      }
    }
    // B4: ブロックされても更新する
    target.lastHitDamageTick = elapsedTicks;
  }

  let shieldDamage = 0;
  if (!options.bypassShield && target.shield > 0 && remaining > 0) {
    shieldDamage = Math.min(target.shield, remaining);
    target.shield -= shieldDamage;
    remaining -= shieldDamage;
    if (shieldDamage > 0) {
      target.lastShieldDamageTick = elapsedTicks;
    }
  }

  const hpDamage = Math.min(target.currentHp, remaining);
  target.currentHp = Math.max(0, target.currentHp - remaining);
  return { hpDamage, shieldDamage, blocked };
}

/**
 * 被弾後処理（battleEngine.ts:159-214 の対称版）
 * 連続回避カウンタ / 被弾時HP回復 / 連続回避後の被弾シールド回復
 */
function applyDefenderAftermath(
  engine: PvpEngineState,
  defender: PvpCombatant,
  defenderSide: PvpSideIndex,
  result: ApplyDamageResult,
  evaded: boolean,
  events: PvpEvent[]
): void {
  const tick = engine.state.elapsedTicks;

  if (evaded) {
    defender.consecutiveEvades += 1;
    return;
  }
  if (result.blocked) return;

  const tookDamage = result.hpDamage + result.shieldDamage > 0;
  if (!tookDamage) {
    defender.consecutiveEvades = 0;
    return;
  }
  if (defender.currentHp <= 0) {
    defender.consecutiveEvades = 0;
    return;
  }

  if (defender.mods.hpOnTakenHit > 0) {
    const before = defender.currentHp;
    defender.currentHp = Math.min(defender.maxHp, defender.currentHp + defender.mods.hpOnTakenHit);
    const actualHeal = defender.currentHp - before;
    if (actualHeal > 0) {
      pushEvent(events, 'heal', tick, defenderSide, { amount: actualHeal, source: 'hp_on_taken_hit' });
    }
  }

  if (
    defender.consecutiveEvades > 0 &&
    defender.mods.shieldOnEvadeStreakHitPct > 0 &&
    defender.maxShield > 0
  ) {
    const recoverPct = Math.min(100, defender.consecutiveEvades * defender.mods.shieldOnEvadeStreakHitPct);
    const recovered = restoreShield(defender, Math.floor(defender.maxShield * recoverPct / 100));
    if (recovered > 0) {
      pushEvent(events, 'shield_restored', tick, defenderSide, {
        amount: recovered,
        source: 'shield_on_evade_streak_hit',
      });
    }
  }

  defender.consecutiveEvades = 0;
}

/** 回復（hpToShield は回復の全面キルスイッチ。仕様メモ §3-A の注） */
function healSide(
  engine: PvpEngineState,
  target: PvpCombatant,
  side: PvpSideIndex,
  amount: number,
  source: string,
  events: PvpEvent[]
): number {
  if (target.mods.hpToShield) return 0;
  if (amount <= 0) return 0;
  const before = target.currentHp;
  target.currentHp = Math.min(target.maxHp, target.currentHp + amount);
  const actual = target.currentHp - before;
  if (actual > 0) {
    pushEvent(events, 'heal', engine.state.elapsedTicks, side, { amount: actual, source });
  }
  return actual;
}

/**
 * サドンデス倍率を1つのダメージ値に適用する（整数維持）
 *
 * 設計書 §3.4(c) は「両者の**被ダメージ倍率**」なので、通常攻撃だけでなく
 * 毒・発火・遅延ダメージの消化・反撃にも同じ倍率が掛かる。
 */
function applySuddenDeath(engine: PvpEngineState, damage: number): number {
  if (engine.suddenDeathMult === 1 || damage <= 0) return damage;
  return Math.floor(damage * engine.suddenDeathMult);
}

/** 状態異常耐性の適用（確率減算型に統一） */
function resistMultiplier(engine: PvpEngineState, resistPct: number): number {
  if (resistPct <= 0) return 1;
  return 1 - Math.min(engine.ruleset.statusResistCapPct, Math.max(0, resistPct)) / 100;
}

// ========================================
// P0: サドンデス
// ========================================

/**
 * サドンデスの被ダメージ倍率
 * `suddenDeathStartSec` 秒を超えた分だけ毎秒 `suddenDeathRampPctPerSec`% ずつ増える。
 * UberUber魔王の「滅びの刻限」（endContent.ts:245-251）と同形。
 */
export function computeSuddenDeathMult(
  elapsedTicks: number,
  ruleset: PvpRuleset,
  ticksPerSecond: number
): number {
  const elapsedSec = elapsedTicks / ticksPerSecond;
  const over = elapsedSec - ruleset.suddenDeathStartSec;
  if (over <= 0) return 1;
  return 1 + over * (ruleset.suddenDeathRampPctPerSec / 100);
}

// ========================================
// P1: 時間バフ + 乱軍の王
// ========================================

function deriveTimeBuffs(engine: PvpEngineState, side: PvpSideIndex): void {
  const c = engine.state.sides[side];
  const timeStacks = Math.floor(
    engine.state.elapsedTicks / (engine.config.ticksPerSecond * 5)
  );
  const timeAtkIncPct = c.mods.timeAtkIncPct * timeStacks;
  const timeDefIncPct = c.mods.timeDefIncPct * timeStacks;
  c.timeHpRegenBonus = c.mods.timeHpRegen * timeStacks;

  let regenToAtkBonus = 0;
  if (c.mods.hpRegenToAtkPct > 0) {
    const baseRegen = c.mods.hpRegen + c.timeHpRegenBonus;
    const pctRegen = Math.floor(c.maxHp * c.mods.hpRegenPct / 100);
    regenToAtkBonus = Math.floor((baseRegen + pctRegen) * c.mods.hpRegenToAtkPct / 100);
  }

  c.effectiveAtk = Math.max(1, Math.floor(c.atk * (1 + timeAtkIncPct / 100)) + regenToAtkBonus);
  c.effectiveDef = Math.max(0, Math.floor(c.def * (1 + timeDefIncPct / 100)));
  // damageScale はここで1回だけ掛ける（仕様メモ §6-H）。
  // 通常攻撃・追撃・king_slam・毒・発火はすべて scaledAtk から派生させる。
  c.scaledAtk = c.effectiveAtk * engine.ruleset.damageScale;
}

/** 乱軍の王: HP30%以下で1度だけ発動（PvPは毎ティック両側判定） */
function checkWarlordEnrage(engine: PvpEngineState, side: PvpSideIndex, events: PvpEvent[]): void {
  const c = engine.state.sides[side];
  if (
    !c.mods.warlordEnrage ||
    c.warlordEnrageActivated ||
    c.currentHp <= 0 ||
    c.currentHp > c.maxHp * 0.3
  ) {
    return;
  }
  c.warlordEnrageActivated = true;
  // c.mods は入力からのディープコピーなので、入力オブジェクトは変異しない
  c.mods.attackSpeedPct += 20;
  c.mods.hpOnHit += 300;
  c.attackSpeedBase = getAttackSpeedFromMods(c.mods) * (c.mods.heavyStrike ? 0.8 : 1);
  pushEvent(events, 'warlord_enrage', engine.state.elapsedTicks, side, {
    attackSpeedPct: 20,
    hpOnHit: 300,
  });
}

// ========================================
// P2: チル / フリーズの持続処理
// ========================================

function processStatusDurations(engine: PvpEngineState, side: PvpSideIndex, events: PvpEvent[]): void {
  const c = engine.state.sides[side];
  const tick = engine.state.elapsedTicks;

  if (c.chillState) {
    const result = processChillState(c.chillState, engine.config);
    c.chillState = result.updatedState;
    if (result.expired) {
      pushEvent(events, 'chill_expired', tick, side, {});
    }
  }

  if (c.freezeState) {
    const result = processFreezeState(c.freezeState, c.pendingChillAfterFreeze, engine.config);
    c.freezeState = result.updatedState;
    if (result.expired) {
      pushEvent(events, 'freeze_expired', tick, side, {});
    }
    // 両側でフリーズ→チル移行する（PvEはプレイヤー側だけ移行しない非対称があった）
    if (result.chillTransition) {
      c.chillState = result.chillTransition;
      c.pendingChillAfterFreeze = null;
      pushEvent(events, 'chill_applied', tick, side, {
        speedMultiplier: result.chillTransition.speedMultiplier,
        durationMs: result.chillTransition.remainingMs,
        source: 'freeze_transition',
      });
    }
  }
}

// ========================================
// P3: 自動解除（永久凍土）
// ========================================

function processAutoCleanse(engine: PvpEngineState, side: PvpSideIndex, events: PvpEvent[]): void {
  const c = engine.state.sides[side];
  if (c.mods.autoCleanseIntervalMs <= 0) return;

  const intervalTicks = Math.ceil(
    (c.mods.autoCleanseIntervalMs / 1000) * engine.config.ticksPerSecond
  );
  const last = c.lastAutoCleanseTick;
  if (last !== null && engine.state.elapsedTicks - last < intervalTicks) return;

  const hadPoison = c.poisonStacks.length > 0;
  const hadChill = c.chillState !== null;
  const hadFreeze = c.freezeState !== null;
  const hadIgnite = engine.ruleset.autoCleanseCleansesIgnite && c.igniteState !== null;
  if (!hadPoison && !hadChill && !hadFreeze && !hadIgnite) return;

  c.poisonStacks = [];
  c.chillState = null;
  c.freezeState = null;
  c.pendingChillAfterFreeze = null;
  if (engine.ruleset.autoCleanseCleansesIgnite) c.igniteState = null;
  c.lastAutoCleanseTick = engine.state.elapsedTicks;
  pushEvent(events, 'cleanse', engine.state.elapsedTicks, side, { source: 'auto_cleanse' });
}

// ========================================
// P4: ゲージ加算
// ========================================

function accumulateGauge(engine: PvpEngineState, side: PvpSideIndex): void {
  const c = engine.state.sides[side];
  let asFinal = c.attackSpeedBase;
  if (c.freezeState) {
    asFinal = 0;
  } else if (c.chillState) {
    asFinal *= c.chillState.speedMultiplier;
  }
  c.effectiveAttackSpeed = asFinal;
  const gaugePerTick = engine.config.baseGaugePerSecond / engine.config.ticksPerSecond;
  c.gauge += asFinal * gaugePerTick;
}

// ========================================
// P5: 1秒ごとの処理
// ========================================

function processPerSecond(engine: PvpEngineState, side: PvpSideIndex, events: PvpEvent[]): void {
  const c = engine.state.sides[side];
  c.regenCounter += 1;
  while (c.regenCounter >= engine.config.ticksPerSecond) {
    c.regenCounter -= engine.config.ticksPerSecond;

    // HP回復
    const regenMods = c.timeHpRegenBonus > 0
      ? { ...c.mods, hpRegen: c.mods.hpRegen + c.timeHpRegenBonus }
      : c.mods;
    const regenAmount = c.mods.hpToShield
      ? 0
      : calculateHpRegen(c.currentHp, c.maxHp, regenMods);
    if (regenAmount > 0) {
      healSide(engine, c, side, regenAmount, 'regen', events);
    }

    // シールド再構築
    if (c.mods.shieldRechargePct > 0 && c.shield < c.maxShield) {
      const delayTicks = Math.ceil(
        (c.mods.shieldRechargeDelayMs / 1000) * engine.config.ticksPerSecond
      );
      const canRecharge = c.lastShieldDamageTick === null ||
        engine.state.elapsedTicks - c.lastShieldDamageTick >= delayTicks;
      if (canRecharge) {
        const recovered = restoreShield(
          c,
          Math.floor(c.maxShield * c.mods.shieldRechargePct / 100)
        );
        if (recovered > 0) {
          pushEvent(events, 'shield_restored', engine.state.elapsedTicks, side, {
            amount: recovered,
            source: 'recharge',
          });
        }
      }
    }

    // 遅延ダメージ消化
    if (c.deferredDamages.length > 0) {
      let total = 0;
      const remaining: typeof c.deferredDamages = [];
      for (const dd of c.deferredDamages) {
        total += dd.damagePerTick;
        if (dd.remainingTicks > 1) {
          remaining.push({ damagePerTick: dd.damagePerTick, remainingTicks: dd.remainingTicks - 1 });
        }
      }
      c.deferredDamages = remaining;
      // 遅延ダメージは素の値でキューに積まれているので、消化する瞬間に倍率を掛ける
      // （生成時に掛けると倍率が2乗になるため）
      const deferredDamage = engine.ruleset.suddenDeathAppliesToDot
        ? applySuddenDeath(engine, total)
        : total;
      if (deferredDamage > 0) {
        const result = applyDamageTo(engine, c, deferredDamage, { bypassShield: !c.mods.shieldBlocksDot });
        pushEvent(events, 'damage', engine.state.elapsedTicks, side, {
          damage: result.hpDamage,
          shieldDamage: result.shieldDamage,
          source: 'deferred',
        });
        if (c.currentHp <= 0) break;
      }
    }
  }
}

// ========================================
// P6: 発火ダメージ
// ========================================

interface IgniteTickOutcome {
  damage: number;
  heal: number;
  tickCount: number;
  expired: boolean;
}

/**
 * 発火フェーズ（両側）
 *
 * 「ダメージ適用 → 吸収回復」を2パスに分けているのは**対称性のため**。
 * 発火のダメージは自分に、吸収回復は相手に入るので、側ごとに逐次処理すると
 * 「側0を先に処理したか側1を先に処理したか」で HP のクランプ結果が変わる。
 * 対象が side ごとに独立になるようパスを分けることで、処理順に依存しなくなる。
 */
function processIgnitePhase(engine: PvpEngineState, events: PvpEvent[]): void {
  const tick = engine.state.elapsedTicks;
  const outcomes: (IgniteTickOutcome | null)[] = [null, null];

  // Pass 1: 各側の発火状態を進めてダメージ/回復量を確定させる
  for (const s of FIXED_ORDER) {
    const victim = engine.state.sides[s];
    if (!victim.igniteState) continue;
    // 発火を付与したのは常に相手側（1対1なので）
    const applier = engine.state.sides[other(s)];
    const result = processIgniteDamage(victim.igniteState, tick, applier.mods, engine.config);
    victim.igniteState = result.updatedState;

    // 発火耐性（PvEでは死に効果だったMOD #69 をPvPで有効化。毒耐性と同形の軽減）
    const mult = engine.ruleset.igniteResistEnabled
      ? resistMultiplier(engine, victim.mods.igniteResistPct)
      : 1;
    const resisted = mult === 1 ? result.totalDamage : Math.floor(result.totalDamage * mult);
    outcomes[s] = {
      // サドンデス倍率は耐性適用後の最終値に掛ける。吸収回復には掛けない
      // （スイングのライフスティールもサドンデス前の値から計算しているのと揃える）
      damage: engine.ruleset.suddenDeathAppliesToDot ? applySuddenDeath(engine, resisted) : resisted,
      heal: mult === 1 ? result.healAmount : Math.floor(result.healAmount * mult),
      tickCount: result.tickCount,
      expired: result.expired,
    };
  }

  // Pass 2: ダメージ適用（対象は自分だけなので順序非依存）
  for (const s of FIXED_ORDER) {
    const outcome = outcomes[s];
    if (!outcome) continue;
    const victim = engine.state.sides[s];
    if (outcome.damage > 0) {
      const applied = applyDamageTo(engine, victim, outcome.damage, {
        bypassShield: !victim.mods.shieldBlocksDot,
      });
      pushEvent(events, 'ignite_damage', tick, s, {
        damage: applied.hpDamage,
        shieldDamage: applied.shieldDamage,
        ticks: outcome.tickCount,
      });
    }
    if (outcome.expired) {
      pushEvent(events, 'ignite_expired', tick, s, {});
    }
  }

  // Pass 3: 発火ダメージ吸収（対象は相手だけなので順序非依存）
  for (const s of FIXED_ORDER) {
    const outcome = outcomes[s];
    if (!outcome || outcome.damage <= 0 || outcome.heal <= 0) continue;
    const applierSide = other(s);
    healSide(engine, engine.state.sides[applierSide], applierSide, outcome.heal, 'ignite_lifesteal', events);
  }
}

// ========================================
// P7: 行動順
// ========================================

/**
 * 行動順を決める（設計書 §3.2）
 * 1. 実効攻撃速度（チル/フリーズ反映後）が高い方が先
 * 2. 同値なら seed 由来のコイントス（毎ティック判定）
 */
export function resolveActionOrder(
  asSide0: number,
  asSide1: number,
  orderRng: () => number
): [PvpSideIndex, PvpSideIndex] {
  if (asSide0 > asSide1) return [0, 1];
  if (asSide1 > asSide0) return [1, 0];
  return orderRng() < 0.5 ? [0, 1] : [1, 0];
}

// ========================================
// P7: 1行動
// ========================================

/**
 * 攻撃側 `a` が防御側 `d` に1行動する
 *
 * 順序は battleEngine.ts:651-1040（プレイヤー行動）を両側化したもの。
 * 防御側固有の処理（命中・ブロック・遅延分割・被弾後処理・反撃）は
 * battleEngine.ts:1127-1199（敵行動）から該当箇所を持ってきて合流させている。
 */
function takeAction(
  engine: PvpEngineState,
  attackerSide: PvpSideIndex,
  events: PvpEvent[]
): void {
  const defenderSide = other(attackerSide);
  const a = engine.state.sides[attackerSide];
  const d = engine.state.sides[defenderSide];
  const tick = engine.state.elapsedTicks;
  const mods = a.mods;

  // --- 1. 相手に乗っている毒を1ティック進める（battleEngine.ts:655 / :1093 と同形） ---
  if (d.poisonStacks.length > 0) {
    const poison = processPoisonDamage(d.poisonStacks, mods);
    d.poisonStacks = poison.updatedStacks;
    // 毒耐性は「ダメージ軽減」に統一（PvEの付与ロールとの二重適用は持ち込まない）
    const mult = engine.ruleset.poisonResistAppliesTo === 'apply'
      ? 1
      : resistMultiplier(engine, d.mods.poisonResistPct);
    const resistedPoison = mult === 1 ? poison.totalDamage : Math.floor(poison.totalDamage * mult);
    // サドンデス倍率は耐性適用後の最終値に掛ける。吸収回復には掛けない
    const damage = engine.ruleset.suddenDeathAppliesToDot
      ? applySuddenDeath(engine, resistedPoison)
      : resistedPoison;
    const heal = mult === 1 ? poison.healAmount : Math.floor(poison.healAmount * mult);
    if (damage > 0) {
      const applied = applyDamageTo(engine, d, damage, {
        bypassShield: !d.mods.shieldBlocksDot,
      });
      pushEvent(events, 'poison_damage', tick, defenderSide, {
        damage: applied.hpDamage,
        shieldDamage: applied.shieldDamage,
      });
      if (heal > 0) {
        healSide(engine, a, attackerSide, heal, 'poison_lifesteal', events);
      }
      // 毒で倒れたら以降の攻撃は行わない（死亡解決は呼び出し側のフェーズ末尾）
      if (d.currentHp <= 0) return;
    }
  }

  // --- 2. 攻撃 ---
  // 防御側の追加ダメージ軽減（core/combat.calculateIncomingDamage と同一の式）
  const defenderReductionPct =
    d.mods.damageReductionPct +
    (isPoisoned(a) ? d.mods.poisonDamageReduction : 0) +
    (isIgnited(a) ? d.mods.igniteDamageReduction : 0);

  const outcome = executeAttack(
    a.scaledAtk,
    d.effectiveDef,
    mods,
    engine.config,
    a.rng,
    defenderReductionPct
  );

  // チル/フリーズダメージ倍率
  let chillFreezeMult = 1;
  if (mods.chillFreezeDamageMult > 1 && (d.chillState || d.freezeState)) {
    chillFreezeMult = mods.chillFreezeDamageMult;
  }
  // 重傷スタック倍率（相手に乗っている重傷）
  let woundMult = 1;
  if (mods.heavyStrike && d.woundStacks > 0) {
    woundMult = woundMultiplier(d.woundStacks);
  }
  const combinedMult = chillFreezeMult * woundMult;

  const scaledMainDamage = Math.floor(outcome.damage * combinedMult);
  const scaledFollowUpDamage = Math.floor(outcome.followUpDamage * combinedMult);
  const totalDamage = scaledMainDamage + scaledFollowUpDamage;

  a.gauge = Math.max(0, a.gauge - 100);

  // Uberクリティカル追撃（ATK100%）
  let uberFollowUpDamage = 0;
  if (outcome.isCritical && mods.uberCriticalFollowUp && !mods.noDirectDamage) {
    const base = calculateDamage(a.scaledAtk, d.effectiveDef, defenderReductionPct);
    uberFollowUpDamage = Math.floor(base * combinedMult);
  }

  // 通常攻撃回数カウント
  a.attackCount += 1;
  if (mods.shieldOn10AttacksPct > 0 && a.maxShield > 0 && a.attackCount % 10 === 0) {
    const recovered = restoreShield(a, Math.floor(a.maxShield * mods.shieldOn10AttacksPct / 100));
    if (recovered > 0) {
      pushEvent(events, 'shield_restored', tick, attackerSide, {
        amount: recovered,
        source: 'shield_on_10_attacks',
      });
    }
  }

  // 双撃の指輪（毎攻撃、クリ非依存）
  let ringFollowUpDamage = 0;
  if (mods.followUpAttackPct > 0 && !mods.noDirectDamage) {
    const ringAtk = a.scaledAtk * mods.followUpAttackPct / 100;
    const base = calculateDamage(ringAtk, d.effectiveDef, defenderReductionPct);
    ringFollowUpDamage = Math.floor(base * combinedMult);
  }

  // キングスラム（5回攻撃ごとにATK×3）
  let kingSlamDamage = 0;
  if (mods.kingSlam && !mods.noDirectDamage && a.attackCount % 5 === 0) {
    const base = calculateDamage(a.scaledAtk * 3, d.effectiveDef, defenderReductionPct);
    kingSlamDamage = Math.floor(base * combinedMult);
  }

  // 王の咆哮（3回攻撃ごとに自分の毒・チル（+発火）を解除）
  if (mods.royalRoar && a.attackCount % 3 === 0) {
    const hadPoison = a.poisonStacks.length > 0;
    const hadChill = a.chillState !== null;
    const hadIgnite = engine.ruleset.royalRoarCleansesIgnite && a.igniteState !== null;
    if (hadPoison) a.poisonStacks = [];
    if (hadChill) a.chillState = null;
    if (hadIgnite) a.igniteState = null;
    if (hadPoison || hadChill || hadIgnite) {
      pushEvent(events, 'cleanse', tick, attackerSide, { source: 'royal_roar' });
    }
  }

  // --- 3. スイング総ダメージ → 遅延分割 → サドンデス → 命中/ブロック → 適用 ---
  const swingRaw = totalDamage + uberFollowUpDamage + ringFollowUpDamage + kingSlamDamage;
  const dotMode = engine.ruleset.suddenDeathAppliesToDot;
  // dotMode=true : 素の値で遅延分を切り出し、**受ける瞬間**にサドンデス倍率を掛ける。
  //                遅延分は消化時に掛かるので、ここで掛けると倍率が2乗になる。
  // dotMode=false: P1初版の挙動（「最終ダメージ算出後・遅延分割前」に掛ける）。
  const swingBase = dotMode ? swingRaw : applySuddenDeath(engine, swingRaw);

  // 命中・ブロックは防御側ストリームで判定する（仕様メモ §5.3）
  const hit = rollHit(a.accuracy, d.mods.evasion, d.rng);
  const blocked = hit ? rollBlock(d) : false;

  const deferPct = Math.min(50, d.mods.damageDeferPct);
  let immediateDamage: number;
  if (deferPct > 0 && swingBase > 0) {
    const deferredTotal = Math.floor(swingBase * deferPct / 100);
    immediateDamage = swingBase - deferredTotal;
    if (deferredTotal > 0 && hit && !blocked) {
      d.deferredDamages.push({
        damagePerTick: Math.max(1, Math.floor(deferredTotal / 4)),
        remainingTicks: 4,
      });
    }
  } else {
    immediateDamage = swingBase;
  }

  const swingScaled = dotMode ? applySuddenDeath(engine, immediateDamage) : immediateDamage;
  const finalDamage = !hit || blocked ? 0 : swingScaled;

  const applied = applyDamageTo(engine, d, finalDamage, { hit: true, blocked });
  const connected = hit && !blocked;

  pushEvent(events, 'attack', tick, attackerSide, {
    damage: applied.hpDamage,
    shieldDamage: applied.shieldDamage,
    blocked,
    evaded: !hit,
    critical: outcome.isCritical,
    swing: swingScaled,
    main: scaledMainDamage,
    followUp: scaledFollowUpDamage,
    uberFollowUp: uberFollowUpDamage,
    ringFollowUp: ringFollowUpDamage,
    kingSlam: kingSlamDamage,
    defenderShield: d.shield,
  });

  applyDefenderAftermath(engine, d, defenderSide, applied, !hit, events);

  // 反撃（DEF減衰・シールド・命中を無視して相手HPから直接減算）
  if (d.mods.retaliateDefPct > 0 && applied.hpDamage + applied.shieldDamage > 0) {
    let retaliate = Math.floor(d.effectiveDef * d.mods.retaliateDefPct / 100);
    if (engine.ruleset.damageScaleAppliesToRetaliate) {
      retaliate = Math.floor(retaliate * engine.ruleset.damageScale);
    }
    // 反撃も「被ダメージ」なのでサドンデス倍率が掛かる
    retaliate = applySuddenDeath(engine, retaliate);
    if (retaliate > 0) {
      a.currentHp = Math.max(0, a.currentHp - retaliate);
      pushEvent(events, 'damage', tick, attackerSide, {
        damage: retaliate,
        shieldDamage: 0,
        source: 'retaliate',
      });
    }
  }

  // --- 4. 重傷付与 / 各種回復（スイングが通ったときのみ） ---
  if (connected) {
    if (mods.heavyStrike && totalDamage > 0 && d.woundStacks < 5) {
      d.woundStacks += 1;
      pushEvent(events, 'wound_applied', tick, defenderSide, { stacks: d.woundStacks });
    }

    // 重撃: 与ダメージの100%をHP吸収（通常ライフスティールとは排他）
    if (mods.heavyStrike && totalDamage + uberFollowUpDamage > 0) {
      const cap = Math.min(totalDamage + uberFollowUpDamage, a.maxHp - a.currentHp);
      if (cap > 0) healSide(engine, a, attackerSide, cap, 'heavy_strike', events);
    }

    if (!mods.heavyStrike && scaledMainDamage > 0 && a.currentHp < a.maxHp) {
      const amount = calculateLifesteal(scaledMainDamage, outcome.isCritical, mods);
      healSide(engine, a, attackerSide, amount, 'lifesteal', events);
    }

    if (outcome.isCritical && mods.critLifestealPct > 0 && totalDamage > 0 && a.currentHp < a.maxHp) {
      healSide(
        engine, a, attackerSide,
        Math.floor(totalDamage * mods.critLifestealPct / 100),
        'crit_lifesteal', events
      );
    }

    // HIT時HP回復の追加発動（クリ追撃 / Uber追撃 / 双撃追撃）
    if (mods.hpOnHit > 0) {
      if (outcome.hasFollowUp && a.currentHp < a.maxHp) {
        healSide(engine, a, attackerSide, mods.hpOnHit, 'follow_up_on_hit', events);
      }
      if (uberFollowUpDamage > 0 && a.currentHp < a.maxHp) {
        healSide(engine, a, attackerSide, mods.hpOnHit, 'uber_follow_up_on_hit', events);
      }
      if (ringFollowUpDamage > 0 && a.currentHp < a.maxHp) {
        healSide(engine, a, attackerSide, mods.hpOnHit, 'ring_follow_up_on_hit', events);
      }
    }
  }

  // --- 5. 状態異常付与（相手へ） ---
  const baseDamage = calculateDamage(a.scaledAtk, d.effectiveDef, defenderReductionPct);

  // 毒
  const poisonOutcome = tryApplyPoison(d.poisonStacks.length, baseDamage, mods, engine.config, a.rng);
  if (poisonOutcome.poisonStack) {
    const stack = poisonOutcome.poisonStack;
    const multiStack = mods.poisonMultiStack;
    if (multiStack > 1) {
      a.poisonStackAccumulator += multiStack;
      const stacksToApply = Math.floor(a.poisonStackAccumulator);
      a.poisonStackAccumulator -= stacksToApply;
      for (let s = 0; s < stacksToApply; s++) {
        d.poisonStacks = [...d.poisonStacks, { ...stack }];
      }
    } else {
      d.poisonStacks = [...d.poisonStacks, stack];
    }
    pushEvent(events, 'poison_applied', tick, defenderSide, {
      damagePerTick: stack.damagePerTick,
      turns: stack.remainingTicks,
      stacks: d.poisonStacks.length,
    });
  }

  // 発火
  const igniteState = tryApplyIgnite(
    baseDamage, a.igniteApplyCount, tick, mods, engine.config, a.rng
  );
  if (igniteState) {
    a.igniteApplyCount += 1;
    let finalIgnite = igniteState;
    if (mods.igniteIntensify) {
      finalIgnite = {
        ...finalIgnite,
        remainingMs: Math.floor(finalIgnite.remainingMs / 2),
        tickIntervalMs: Math.max(50, Math.floor(finalIgnite.tickIntervalMs / 2)),
      };
    }
    const existingLastTickMs = d.igniteState?.lastTickMs;
    d.igniteState = {
      ...finalIgnite,
      lastTickMs: existingLastTickMs ?? finalIgnite.lastTickMs,
    };
    pushEvent(events, 'ignite_applied', tick, defenderSide, {
      damage: d.igniteState.damage,
      durationMs: d.igniteState.remainingMs,
      tickIntervalMs: d.igniteState.tickIntervalMs,
    });
  }

  // チル（防御側のチル耐性を確率減算型で適用）
  const chillState = tryApplyChill(
    mods, engine.config, a.rng, d.mods.chillResistPct, engine.ruleset.statusResistCapPct
  );
  if (chillState) {
    d.chillState = chillState;
    pushEvent(events, 'chill_applied', tick, defenderSide, {
      speedMultiplier: chillState.speedMultiplier,
      durationMs: chillState.remainingMs,
      source: 'attack',
    });
  }

  // フリーズ（防御側のフリーズ耐性を確率減算型で適用）
  const freezeOutcome = tryApplyFreeze(
    d.freezeState !== null, mods, engine.config, a.rng,
    d.mods.freezeResistPct, engine.ruleset.statusResistCapPct
  );
  if (freezeOutcome.freezeState) {
    d.freezeState = freezeOutcome.freezeState;
    d.chillState = null;
    d.pendingChillAfterFreeze = freezeOutcome.chillAfterFreeze as ChillState | null;
    pushEvent(events, 'freeze_applied', tick, defenderSide, {
      durationMs: freezeOutcome.freezeState.remainingMs,
    });
  }

  // --- 6. 自分に乗っている重傷の減衰（自分が行動するたびに+1、4で1減少） ---
  if (a.woundStacks > 0) {
    a.woundActionCounter += 1;
    if (a.woundActionCounter >= 4) {
      a.woundActionCounter = 0;
      a.woundStacks = Math.max(0, a.woundStacks - 1);
      pushEvent(events, 'wound_decayed', tick, attackerSide, { stacks: a.woundStacks });
    }
  }
}

// ========================================
// 死亡解決
// ========================================

/** 両側まとめて死亡判定する。両者HP0は draw */
function resolveDeaths(engine: PvpEngineState, events: PvpEvent[]): boolean {
  const [s0, s1] = engine.state.sides;
  const dead0 = s0.currentHp <= 0;
  const dead1 = s1.currentHp <= 0;
  if (!dead0 && !dead1) return false;

  const tick = engine.state.elapsedTicks;
  if (dead0) pushEvent(events, 'defeated', tick, 0, {});
  if (dead1) pushEvent(events, 'defeated', tick, 1, {});

  engine.state.isFinished = true;
  if (dead0 && dead1) {
    engine.state.winner = 'draw';
    engine.state.reason = 'draw';
  } else {
    engine.state.winner = dead0 ? 1 : 0;
    engine.state.reason = 'ko';
  }
  return true;
}

/**
 * 残存割合 `(currentHp + shield) / (maxHp + maxShield)`
 *
 * HPだけで判定すると、シールドで全ダメージを吸収しきったビルド同士が
 * 「両者HP満タン＝完全同値」となり、実際には削られている側が
 * 防衛側というだけで不戦勝になってしまう（P1総当たりで全体の8.2%が該当）。
 */
export function pvpRemainingPct(c: PvpCombatant): number {
  return (c.currentHp + c.shield) / (c.maxHp + c.maxShield);
}

/** 時間切れ判定: 残存割合（HP+シールド）が高い方。完全同値なら防衛側（sides[1]） */
function resolveTimeout(engine: PvpEngineState): void {
  const [s0, s1] = engine.state.sides;
  const pct0 = pvpRemainingPct(s0);
  const pct1 = pvpRemainingPct(s1);
  engine.state.isFinished = true;
  engine.state.reason = 'timeout';
  if (pct0 > pct1) {
    engine.state.winner = 0;
  } else {
    // 同値なら防衛側の勝ち
    engine.state.winner = 1;
  }
}

// ========================================
// 1ティック
// ========================================

const FIXED_ORDER: [PvpSideIndex, PvpSideIndex] = [0, 1];

function advanceOneTick(engine: PvpEngineState, events: PvpEvent[]): void {
  const state = engine.state;

  // P0
  state.elapsedTicks += 1;
  engine.suddenDeathMult = computeSuddenDeathMult(
    state.elapsedTicks,
    engine.ruleset,
    engine.config.ticksPerSecond
  );

  // P1: 時間バフ + 乱軍の王（AS再計算があるのでゲージ加算より前）
  for (const s of FIXED_ORDER) deriveTimeBuffs(engine, s);
  if (engine.ruleset.warlordEnrageCheckPhase === 'tick') {
    for (const s of FIXED_ORDER) checkWarlordEnrage(engine, s, events);
  }

  // P2: チル/フリーズ持続
  for (const s of FIXED_ORDER) processStatusDurations(engine, s, events);

  // P3: 自動解除
  for (const s of FIXED_ORDER) processAutoCleanse(engine, s, events);

  // P4: ゲージ加算（浮動小数の加算順を固定するため必ず [0,1]）
  for (const s of FIXED_ORDER) accumulateGauge(engine, s);

  // P5: 1秒ごとの処理
  for (const s of FIXED_ORDER) processPerSecond(engine, s, events);
  if (resolveDeaths(engine, events)) return;

  // P6: 発火
  processIgnitePhase(engine, events);
  if (resolveDeaths(engine, events)) return;

  // P7: 行動
  const order = resolveActionOrder(
    state.sides[0].effectiveAttackSpeed,
    state.sides[1].effectiveAttackSpeed,
    engine.rngs.order
  );
  for (const s of order) {
    let actions = 0;
    while (state.sides[s].gauge >= 100 && actions < engine.ruleset.maxActionsPerTick) {
      actions += 1;
      takeAction(engine, s, events);
      if (resolveDeaths(engine, events)) return;
    }
  }

  // 時間切れ
  if (state.elapsedTicks >= engine.timeLimitTicks) {
    resolveTimeout(engine);
  }
}

// ========================================
// 公開API
// ========================================

/**
 * PvPエンジンを生成する
 *
 * @param input ビルドスナップショット2件 + seed + rulesetVersion
 * @param streamsOverride RNGストリームの差し替え（対称性テスト専用）。通常は指定しない
 */
export function createPvpEngine(
  input: PvpBattleInput,
  streamsOverride?: PvpRngStreams
): PvpEngine {
  const ruleset = getPvpRuleset(input.rulesetVersion);
  const config = DEFAULT_BATTLE_CONFIG;
  const rngs = streamsOverride ?? createPvpRngStreams(input.seed);

  const state: PvpBattleState = {
    sides: [
      createCombatant(input.sides[0], ruleset, rngs.sides[0]),
      createCombatant(input.sides[1], ruleset, rngs.sides[1]),
    ],
    elapsedTicks: 0,
    isFinished: false,
    winner: null,
    reason: null,
  };

  const engine: PvpEngineState = {
    state,
    ruleset,
    config,
    rngs,
    suddenDeathMult: 1,
    timeLimitTicks: Math.floor(ruleset.timeLimitSec * config.ticksPerSecond),
  };

  const allEvents: PvpEvent[] = [];

  const advanceTicks = (ticks: number): PvpEvent[] => {
    const events: PvpEvent[] = [];
    if (state.isFinished || ticks <= 0) return events;
    for (let i = 0; i < ticks; i++) {
      if (state.isFinished) break;
      advanceOneTick(engine, events);
      if (state.elapsedTicks >= ruleset.maxTicks && !state.isFinished) {
        resolveTimeout(engine);
        break;
      }
    }
    allEvents.push(...events);
    return events;
  };

  const buildResult = (): PvpResult => {
    const [s0, s1] = state.sides;
    return {
      winner: state.winner ?? 'draw',
      elapsedTicks: state.elapsedTicks,
      finalHp: [s0.currentHp, s1.currentHp],
      finalShield: [s0.shield, s1.shield],
      finalHpPct: [pvpRemainingPct(s0), pvpRemainingPct(s1)],
      reason: (state.reason ?? 'draw') as PvpEndReason,
      events: allEvents,
    };
  };

  return {
    advanceTicks,
    runToEnd: () => {
      while (!state.isFinished && state.elapsedTicks < ruleset.maxTicks) {
        advanceTicks(1);
      }
      if (!state.isFinished) resolveTimeout(engine);
      return buildResult();
    },
    getState: () => state,
    isFinished: () => state.isFinished,
  };
}

/** 1試合を最後まで実行して結果を返す */
export function runPvpBattle(
  input: PvpBattleInput,
  streamsOverride?: PvpRngStreams
): PvpResult {
  return createPvpEngine(input, streamsOverride).runToEnd();
}
