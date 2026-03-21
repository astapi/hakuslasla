import { describe, it, expect } from 'vitest';
import {
  applyEnemyAttackPreEffects,
  createBossEffectState,
  createBossIntroEvents,
} from '../../core/bossBehaviors';
import {
  getBaseBossId,
  isUberBoss,
  isUberUberBoss,
  getEnemyRegenPerSecond,
  getEnemyAtkMultiplier,
  isEndContentDungeon,
  UBER_UBER_DUNGEON_IDS,
} from '../../core/endContent';

// ========================================
// UberUber判定
// ========================================

describe('UberUber判定', () => {
  it('uber_uber_goblin_king は UberUberボスと判定される', () => {
    expect(isUberUberBoss('uber_uber_goblin_king')).toBe(true);
  });

  it('uber_uber_goblin_king は UberBoss としても判定される', () => {
    expect(isUberBoss('uber_uber_goblin_king')).toBe(true);
  });

  it('uber_uber_goblin_king のベースIDは goblin_king', () => {
    expect(getBaseBossId('uber_uber_goblin_king')).toBe('goblin_king');
  });

  it('uber_goblin_king は UberUberではない', () => {
    expect(isUberUberBoss('uber_goblin_king')).toBe(false);
  });

  it('UBER_UBER_DUNGEON_IDS に uber_uber_goblin_king が含まれる', () => {
    expect(UBER_UBER_DUNGEON_IDS).toContain('uber_uber_goblin_king');
  });

  it('uber_uber_goblin_king はエンドコンテンツダンジョン', () => {
    expect(isEndContentDungeon('uber_uber_goblin_king')).toBe(true);
  });
});

// ========================================
// UberUberゴブリンキングのステータス補正
// ========================================

describe('UberUberゴブリンキングのステータス補正', () => {
  it('HP再生が通常Uberより高い', () => {
    const uberRegen = getEnemyRegenPerSecond('uber_goblin_king');
    const uberUberRegen = getEnemyRegenPerSecond('uber_uber_goblin_king');
    expect(uberUberRegen).toBeGreaterThan(uberRegen);
    expect(uberUberRegen).toBe(3000);
  });

  it('ATK倍率が正しい', () => {
    const mult = getEnemyAtkMultiplier('uber_uber_goblin_king');
    expect(mult).toBe(1.35);
  });
});

// ========================================
// UberUberゴブリンキングのボス行動
// ========================================

describe('UberUberゴブリンキングのボス行動', () => {
  it('戦闘開始時にゴブリンシールドとウォーロードが常時発動する', () => {
    const result = createBossIntroEvents(0, 'uber_uber_goblin_king');

    expect(result.events.length).toBeGreaterThanOrEqual(2);
    const skillTypes = result.events
      .filter(e => e.type === 'boss_skill')
      .map(e => e.data.skillId);
    expect(skillTypes).toContain('goblin_shield');
    expect(skillTypes).toContain('goblin_warlord');

    // 初期効果が設定される
    expect(result.initBossEffects).toBeDefined();
    expect(result.initBossEffects!.enemyDamageReductionTempPct).toBe(20);
    expect(result.initBossEffects!.enemyDamageReductionTempRemaining).toBe(-1); // 永続
    expect(result.initBossEffects!.playerCritChanceMult).toBe(0.5);
    expect(result.initBossEffects!.playerPoisonChanceMult).toBe(0.5);
    expect(result.initBossEffects!.goblinEnrage).toBe(true);
    expect(result.initBossEffects!.enemyAttackSpeedMult).toBe(1.3);
    expect(result.initBossEffects!.enemyHpOnHitBonus).toBe(500);
  });

  it('キングスラム: 10回目の攻撃でATK3倍になる', () => {
    const state = createBossEffectState();
    // UberUberの初期状態を設定
    state.goblinEnrage = true;
    state.enemyDamageReductionTempRemaining = -1;
    state.playerCritPoisonRemaining = -1;

    const ctx = {
      enemyId: 'uber_uber_goblin_king',
      enemyMaxHp: 240000,
      enemyCurrentHp: 240000,
      playerCurrentHp: 500,
      playerMaxHp: 500,
    };

    // 9回攻撃: キングスラムは発動しない
    for (let i = 0; i < 9; i++) {
      applyEnemyAttackPreEffects(ctx, state, i + 1);
    }
    expect(state.enemyNextAttackMult).toBe(1); // まだ発動していない

    // 10回目: キングスラム発動
    const result = applyEnemyAttackPreEffects(ctx, state, 10);
    expect(state.goblinSlamCounter).toBe(0); // リセットされる
    expect(state.enemyNextAttackMult).toBe(3.0);

    const skillEvents = result.events.filter(
      e => e.type === 'boss_skill' && e.data.skillId === 'goblin_kings_slam'
    );
    expect(skillEvents.length).toBe(1);
  });

  it('王の咆哮: 3回ごとに毒・発火浄化フラグが返る', () => {
    const state = createBossEffectState();
    state.goblinEnrage = true;
    state.enemyDamageReductionTempRemaining = -1;
    state.playerCritPoisonRemaining = -1;

    const ctx = {
      enemyId: 'uber_uber_goblin_king',
      enemyMaxHp: 240000,
      enemyCurrentHp: 240000,
      playerCurrentHp: 500,
      playerMaxHp: 500,
    };

    // 1回目, 2回目: 浄化なし
    const r1 = applyEnemyAttackPreEffects(ctx, state, 1);
    expect(r1.cleansePoisonIgnite).toBeFalsy();
    const r2 = applyEnemyAttackPreEffects(ctx, state, 2);
    expect(r2.cleansePoisonIgnite).toBeFalsy();

    // 3回目: 王の咆哮で浄化
    const r3 = applyEnemyAttackPreEffects(ctx, state, 3);
    expect(r3.cleansePoisonIgnite).toBe(true);

    const roarEvents = r3.events.filter(
      e => e.type === 'boss_skill' && e.data.skillId === 'goblin_kings_roar'
    );
    expect(roarEvents.length).toBe(1);
  });

  it('通常ゴブリンキングではキングスラムは発動しない', () => {
    const state = createBossEffectState();
    const ctx = {
      enemyId: 'goblin_king',
      enemyMaxHp: 10000,
      enemyCurrentHp: 10000,
      playerCurrentHp: 500,
      playerMaxHp: 500,
    };

    // 30回攻撃してもキングスラムは発動しない
    for (let i = 0; i < 30; i++) {
      applyEnemyAttackPreEffects(ctx, state, i + 1);
    }
    expect(state.goblinSlamCounter).toBe(0);
  });
});

// ========================================
// フリーズとキングスラムカウンタの相互作用
// ========================================

describe('フリーズとキングスラムカウンタ', () => {
  it('フリーズ時にキングスラムカウンタがリセットされる', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const { createEmptyModEffects } = await import('../../core/modEffects');

    const mods = { ...createEmptyModEffects(), freezeChance: 10 };
    const player = { maxHp: 5000, atk: 500, def: 200 };
    const enemy = {
      id: 'uber_uber_goblin_king', name: 'UberUber GK',
      maxHp: 240000, atk: 3500, def: 100, exp: 100,
      attackSpeed: 1,
    };

    const { engine } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: mods, enemy, dungeonId: 'uber_uber_goblin_king',
      rng: () => 0.01, // フリーズ確実発動
    });

    const events = engine.advanceTicks(300);

    // フリーズが発生している
    const freezeEvents = events.filter(e => e.type === 'freeze_applied');
    expect(freezeEvents.length).toBeGreaterThan(0);
  });
});
