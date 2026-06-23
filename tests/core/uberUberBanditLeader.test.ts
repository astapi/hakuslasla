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
  getEnemyAtkMultiplier,
  getPlayerAttackSpeedMultiplier,
  isEndContentDungeon,
  UBER_UBER_DUNGEON_IDS,
} from '../../core/endContent';

describe('UberUber盗賊の頭 判定', () => {
  it('uber_uber_bandit_leader はUberUberボスと判定される', () => {
    expect(isUberUberBoss('uber_uber_bandit_leader')).toBe(true);
  });

  it('uber_uber_bandit_leader はUberBossとしても判定される', () => {
    expect(isUberBoss('uber_uber_bandit_leader')).toBe(true);
  });

  it('ベースIDは bandit_leader', () => {
    expect(getBaseBossId('uber_uber_bandit_leader')).toBe('bandit_leader');
  });

  it('UBER_UBER_DUNGEON_IDS に含まれる', () => {
    expect(UBER_UBER_DUNGEON_IDS).toContain('uber_uber_bandit_leader');
  });

  it('エンドコンテンツダンジョンとして扱われる', () => {
    expect(isEndContentDungeon('uber_uber_bandit_leader')).toBe(true);
  });
});

describe('UberUber盗賊の頭 ステータス補正', () => {
  it('プレイヤー攻撃速度倍率がUberよりさらに低い', () => {
    const uber = getPlayerAttackSpeedMultiplier('uber_bandit_leader');
    const uberUber = getPlayerAttackSpeedMultiplier('uber_uber_bandit_leader');
    expect(uberUber).toBe(0.6);
    expect(uberUber).toBeLessThan(uber);
  });

  it('敵ATK倍率はUberUberで1.3倍', () => {
    expect(getEnemyAtkMultiplier('uber_uber_bandit_leader')).toBe(1.3);
    expect(getEnemyAtkMultiplier('uber_bandit_leader')).toBe(1);
  });
});

describe('UberUber盗賊の頭 戦闘開始時の常時化', () => {
  it('戦闘開始時にbear_trap・shadow_bindが常時発動（night_ambushは3回毎）', () => {
    const result = createBossIntroEvents(0, 'uber_uber_bandit_leader');
    const skillTypes = result.events
      .filter((e) => e.type === 'boss_skill')
      .map((e) => e.data.skillId);

    expect(skillTypes).toContain('bandit_bear_trap');
    expect(skillTypes).toContain('bandit_shadow_bind');
    // night_ambushは初期発動しない（Uber同様3回毎）
    expect(skillTypes).not.toContain('bandit_night_ambush');

    expect(result.initBossEffects).toBeDefined();
    // bear_trap常時: 攻撃速度-30%
    expect(result.initBossEffects!.playerAttackSpeedMult).toBe(0.7);
    expect(result.initBossEffects!.playerAttackSpeedRemaining).toBe(-1);
    // night_ambushの常時ATK倍率は設定されない
    expect(result.initBossEffects!.enemyAttackMult).toBeUndefined();
    // shadow_bind常時: 回復-25%
    expect(result.initBossEffects!.banditShadow).toBe(true);
    expect(result.initBossEffects!.playerHealingMult).toBe(0.75);
    expect(result.initBossEffects!.playerHealingRemaining).toBe(-1);
  });
});

describe('UberUber盗賊の頭 影縛りの絞縄', () => {
  const ctx = {
    enemyId: 'uber_uber_bandit_leader',
    enemyMaxHp: 250000,
    enemyCurrentHp: 250000,
    playerCurrentHp: 5000,
    playerMaxHp: 5000,
  };

  it('9回目までは発動せず、10回目で発動する', () => {
    const state = createBossEffectState();
    state.banditShadow = true;
    state.playerHealingRemaining = -1;
    state.playerAttackSpeedRemaining = -1;

    for (let i = 0; i < 9; i++) {
      const r = applyEnemyAttackPreEffects(ctx, state, i + 1);
      expect(r.applyPlayerFreeze).toBeUndefined();
    }

    const result = applyEnemyAttackPreEffects(ctx, state, 10);
    expect(state.banditGarroteCounter).toBe(0); // リセット
    expect(result.applyPlayerFreeze).toEqual({ remainingMs: 500 });

    const skillEvents = result.events.filter(
      (e) => e.type === 'boss_skill' && e.data.skillId === 'bandit_shadow_garrote'
    );
    expect(skillEvents.length).toBe(1);
  });

  it('bear_trapは常時化済みなので3回毎には発動しない', () => {
    const state = createBossEffectState();
    state.banditShadow = true;
    state.playerHealingRemaining = -1;
    state.playerAttackSpeedRemaining = -1;

    for (let i = 0; i < 3; i++) {
      const r = applyEnemyAttackPreEffects(ctx, state, i + 1);
      const skillIds = r.events
        .filter((e) => e.type === 'boss_skill')
        .map((e) => e.data.skillId);
      expect(skillIds).not.toContain('bandit_bear_trap');
    }
  });

  it('night_ambushはUber同様3回毎に発動し次撃+40%', () => {
    const state = createBossEffectState();
    state.banditShadow = true;
    state.playerHealingRemaining = -1;
    state.playerAttackSpeedRemaining = -1;

    // 1回目, 2回目: 発動なし
    applyEnemyAttackPreEffects(ctx, state, 1);
    applyEnemyAttackPreEffects(ctx, state, 2);
    expect(state.enemyNextAttackMult).toBe(1);

    // 3回目: night_ambush発動
    const r3 = applyEnemyAttackPreEffects(ctx, state, 3);
    expect(state.enemyNextAttackMult).toBe(1.4);
    const skillIds = r3.events
      .filter((e) => e.type === 'boss_skill')
      .map((e) => e.data.skillId);
    expect(skillIds).toContain('bandit_night_ambush');
  });

  it('通常bandit_leaderでは絞縄は発動しない', () => {
    const state = createBossEffectState();
    const baseCtx = {
      enemyId: 'bandit_leader',
      enemyMaxHp: 500,
      enemyCurrentHp: 500,
      playerCurrentHp: 100,
      playerMaxHp: 100,
    };

    for (let i = 0; i < 30; i++) {
      const r = applyEnemyAttackPreEffects(baseCtx, state, i + 1);
      expect(r.applyPlayerFreeze).toBeUndefined();
    }
    expect(state.banditGarroteCounter).toBe(0);
  });
});

describe('UberUber盗賊の頭 双撃の刃（battleEngine統合）', () => {
  it('UberUberbanditは追撃ダメージが通常時の2倍（0.5x→1.0x）になる', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const { createEmptyModEffects } = await import('../../core/modEffects');

    const player = { maxHp: 100000, atk: 100, def: 5000 };
    const enemy = {
      id: 'uber_uber_bandit_leader',
      name: 'UberUber Bandit',
      maxHp: 250000,
      atk: 4200,
      def: 1300,
      exp: 12000,
      attackSpeed: 1.4,
    };

    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: createEmptyModEffects(),
      enemy,
      dungeonId: 'uber_uber_bandit_leader',
      rng: () => 0.5,
    });

    const events = engine.advanceTicks(2000);
    const twinStrikeEvents = events.filter(
      (e) => e.type === 'boss_skill' && e.data.skillId === 'bandit_twin_strike'
    );
    expect(twinStrikeEvents.length).toBeGreaterThan(0);

    // 通常Uber盗賊と比較: 同条件で追撃ダメージが約2倍
    const uberEnemy = { ...enemy, id: 'uber_bandit_leader' };
    const { engine: uberEngine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: createEmptyModEffects(),
      enemy: uberEnemy,
      dungeonId: 'uber_bandit_leader',
      rng: () => 0.5,
    });
    const uberEvents = uberEngine.advanceTicks(2000);

    // 各エンジンで最初の敵攻撃ペアを取得
    const getFirstAttackPair = (evts: typeof events) => {
      const attacks = evts.filter((e) => e.type === 'enemy_attack');
      return [attacks[0]?.data.damage as number, attacks[1]?.data.damage as number];
    };
    const [uberUberMain, uberUberFollow] = getFirstAttackPair(events);
    const [uberMain, uberFollow] = getFirstAttackPair(uberEvents);

    // 追撃の倍率比較（main相対）
    expect(uberUberFollow / uberUberMain).toBeCloseTo(uberFollow / uberMain * 2, 1);
  });
});
