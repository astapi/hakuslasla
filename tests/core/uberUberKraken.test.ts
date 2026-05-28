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
  getEnemyAttackSpeedMultiplier,
  getPlayerDefMultiplier,
  getEnemyRegenPerSecond,
  isEndContentDungeon,
  UBER_UBER_DUNGEON_IDS,
} from '../../core/endContent';

describe('UberUberクラーケン 判定', () => {
  it('uber_uber_kraken はUberUberボス', () => {
    expect(isUberUberBoss('uber_uber_kraken')).toBe(true);
  });

  it('uber_uber_kraken はUberBossとしても扱われる', () => {
    expect(isUberBoss('uber_uber_kraken')).toBe(true);
  });

  it('ベースIDは kraken', () => {
    expect(getBaseBossId('uber_uber_kraken')).toBe('kraken');
  });

  it('UBER_UBER_DUNGEON_IDS に含まれる', () => {
    expect(UBER_UBER_DUNGEON_IDS).toContain('uber_uber_kraken');
  });

  it('エンドコンテンツダンジョンと判定される', () => {
    expect(isEndContentDungeon('uber_uber_kraken')).toBe(true);
  });
});

describe('UberUberクラーケン ステータス補正', () => {
  it('敵ATK倍率はUberよりさらに高い', () => {
    expect(getEnemyAtkMultiplier('uber_uber_kraken')).toBe(1.5);
    expect(getEnemyAtkMultiplier('uber_kraken')).toBe(1.3);
  });

  it('敵攻撃速度倍率はUberよりさらに高い', () => {
    expect(getEnemyAttackSpeedMultiplier('uber_uber_kraken')).toBe(1.5);
    expect(getEnemyAttackSpeedMultiplier('uber_kraken')).toBe(1.35);
  });

  it('プレイヤーDEF倍率はUberより低い', () => {
    expect(getPlayerDefMultiplier('uber_uber_kraken')).toBe(0.65);
    expect(getPlayerDefMultiplier('uber_kraken')).toBe(0.75);
  });

  it('HP再生がUberより大幅に強化されている', () => {
    expect(getEnemyRegenPerSecond('uber_uber_kraken')).toBe(2500);
    expect(getEnemyRegenPerSecond('uber_kraken')).toBe(150);
  });
});

describe('UberUberクラーケン 戦闘開始時の付与', () => {
  it('チル/フリーズ確率とフリーズ耐性が常時付与される', () => {
    const result = createBossIntroEvents(0, 'uber_uber_kraken');
    expect(result.initBossEffects).toBeDefined();
    expect(result.initBossEffects!.enemyFreezeResistPct).toBe(70);
    expect(result.initBossEffects!.enemyAttackPlayerChillChance).toBe(20);
    expect(result.initBossEffects!.enemyAttackPlayerFreezeChance).toBe(10);
  });

  it('発火耐性: 受ける発火ダメージが2/3になる', () => {
    const result = createBossIntroEvents(0, 'uber_uber_kraken');
    expect(result.initBossEffects).toBeDefined();
    expect(result.initBossEffects!.enemyIgniteDamageMult).toBeCloseTo(2 / 3);
  });

  it('通常クラーケンには付与されない', () => {
    const result = createBossIntroEvents(0, 'kraken');
    expect(result.initBossEffects).toBeUndefined();
  });
});

describe('UberUberクラーケン 触手乱打', () => {
  const ctx = {
    enemyId: 'uber_uber_kraken',
    enemyMaxHp: 500000,
    enemyCurrentHp: 500000,
    playerCurrentHp: 5000,
    playerMaxHp: 5000,
  };

  it('9回目までは発動せず、10回目で9連撃追加が返る', () => {
    const state = createBossEffectState();

    for (let i = 0; i < 9; i++) {
      const r = applyEnemyAttackPreEffects(ctx, state, i + 1);
      expect(r.extraEnemyAttacks ?? 0).toBe(0);
    }

    const result = applyEnemyAttackPreEffects(ctx, state, 10);
    expect(state.krakenFlurryCounter).toBe(0);
    expect(result.extraEnemyAttacks).toBe(9);

    const skillEvents = result.events.filter(
      (e) => e.type === 'boss_skill' && e.data.skillId === 'kraken_tentacle_flurry'
    );
    expect(skillEvents.length).toBe(1);
  });

  it('通常クラーケンでは触手乱打は発動しない', () => {
    const state = createBossEffectState();
    const baseCtx = {
      enemyId: 'kraken',
      enemyMaxHp: 600,
      enemyCurrentHp: 600,
      playerCurrentHp: 100,
      playerMaxHp: 100,
    };
    for (let i = 0; i < 20; i++) {
      const r = applyEnemyAttackPreEffects(baseCtx, state, i + 1);
      expect(r.extraEnemyAttacks ?? 0).toBe(0);
    }
    expect(state.krakenFlurryCounter).toBe(0);
  });
});

describe('UberUberクラーケン 発火耐性とドロップユニーク', () => {
  it('battleEngine上で発火ダメージが2/3に軽減される', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const { createEmptyModEffects } = await import('../../core/modEffects');

    // 100%発火付与のプレイヤー
    const mods = {
      ...createEmptyModEffects(),
      igniteChance: 100,
      igniteDurationPct: 0,
    };
    const player = { maxHp: 5000, atk: 1000, def: 200 };

    const makeEnemy = (id: string) => ({
      id, name: id,
      maxHp: 10_000_000, atk: 1, def: 0, exp: 100,
      attackSpeed: 0.001, // ほぼ攻撃しない
    });

    const { engine: krakenEngine } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: mods, enemy: makeEnemy('uber_uber_kraken'),
      dungeonId: 'uber_uber_kraken', rng: () => 0.5,
    });
    const { engine: baseEngine } = createBattleEngine({
      playerStats: player, playerCurrentHp: player.maxHp,
      playerMods: mods, enemy: makeEnemy('kraken'),
      dungeonId: 'kraken', rng: () => 0.5,
    });

    const krakenEvents = krakenEngine.advanceTicks(500);
    const baseEvents = baseEngine.advanceTicks(500);

    const sumIgnite = (evts: typeof krakenEvents) =>
      evts.filter(e => e.type === 'ignite_damage')
          .reduce((s, e) => s + (e.data.damage as number), 0);

    const krakenTotal = sumIgnite(krakenEvents);
    const baseTotal = sumIgnite(baseEvents);
    expect(krakenTotal).toBeGreaterThan(0);
    expect(baseTotal).toBeGreaterThan(0);
    // UberUberは通常の約2/3のダメージ
    expect(krakenTotal / baseTotal).toBeCloseTo(2 / 3, 1);
  });

  it('uber_uber_kraken_pendant がドロップに含まれる', async () => {
    const { getEnemy } = await import('../../data/enemies');
    const enemy = getEnemy('uber_uber_kraken');
    expect(enemy).toBeDefined();
    const dropIds = (enemy!.uniqueDrops ?? []).map(d => d.itemId);
    expect(dropIds).toContain('uber_uber_kraken_pendant');
  });

  it('uber_uber_kraken_pendant が ignite_resist_pct を持つ', async () => {
    const items = await import('../../data/json/items.json');
    const pendant = (items as unknown as { items: Record<string, { fixedMods?: Array<{ type: string; value: number }> }> })
      .items['uber_uber_kraken_pendant'];
    expect(pendant).toBeDefined();
    const igniteResist = pendant.fixedMods?.find(m => m.type === 'ignite_resist_pct');
    expect(igniteResist).toBeDefined();
    expect(igniteResist!.value).toBeGreaterThan(0);
  });
});

describe('UberUberクラーケン battleEngine統合', () => {
  it('触手乱打発動時にプレイヤーが大量の敵攻撃を受ける', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const { createEmptyModEffects } = await import('../../core/modEffects');

    const player = { maxHp: 1_000_000, atk: 1, def: 100000 };
    const enemy = {
      id: 'uber_uber_kraken',
      name: 'UberUber Kraken',
      maxHp: 500000,
      atk: 4500,
      def: 1800,
      exp: 12000,
      attackSpeed: 1.0,
    };

    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: createEmptyModEffects(),
      enemy,
      dungeonId: 'uber_uber_kraken',
      rng: () => 0.99, // チル/フリーズを避ける
    });

    const events = engine.advanceTicks(20000);
    const flurryEvents = events.filter(
      (e) => e.type === 'boss_skill' && e.data.skillId === 'kraken_tentacle_flurry'
    );
    expect(flurryEvents.length).toBeGreaterThan(0);
  });

  it('フリーズ耐性: 必ずフリーズ判定をresistするrngでフリーズが入らない', async () => {
    const { createBattleEngine } = await import('../../core/battleEngine');
    const { createEmptyModEffects } = await import('../../core/modEffects');

    // プレイヤーは100%フリーズを試みるが、ボスは100% resist（rngが常に0.01 → resist判定で50%未満 → resist成功）
    const mods = { ...createEmptyModEffects(), freezeChance: 100 };
    const player = { maxHp: 5000, atk: 500, def: 200 };
    const enemy = {
      id: 'uber_uber_kraken',
      name: 'UberUber Kraken',
      maxHp: 500000,
      atk: 100,
      def: 1800,
      exp: 12000,
      attackSpeed: 0.1,
    };

    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: player.maxHp,
      playerMods: mods,
      enemy,
      dungeonId: 'uber_uber_kraken',
      rng: () => 0.01, // フリーズ判定通る → resist判定で50%未満 → 全て耐性成功
    });

    const events = engine.advanceTicks(2000);
    const freezeAppliedOnEnemy = events.filter(
      (e) => e.type === 'freeze_applied' && (e.data as { target?: string }).target !== 'player'
    );
    expect(freezeAppliedOnEnemy.length).toBe(0);
  });
});
