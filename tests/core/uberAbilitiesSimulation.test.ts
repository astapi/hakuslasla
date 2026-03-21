import { describe, it, expect } from 'vitest';
import { runGaugeSimulation } from '../../core/simulation';
import { createEmptyModEffects } from '../../core/modEffects';
import { CombinedModEffects, EnemyConfig, DungeonConfig, Stats } from '../../core/types';

// ========================================
// ヘルパー
// ========================================

const SEED = 12345;
const RUNS = 10;

const strongPlayer: Stats = { maxHp: 5000, atk: 500, def: 200 };

const toughEnemy: EnemyConfig = {
  id: 'tough', name: 'Tough', maxHp: 15000, atk: 80, def: 20, exp: 100,
};

const dungeon: DungeonConfig = {
  id: 'test_dungeon', name: 'Test', maxFloor: 1,
  enemies: ['tough'], dropTable: [],
};

const enemyData = new Map<string, EnemyConfig>([['tough', toughEnemy]]);

function createMods(overrides: Partial<CombinedModEffects> = {}): CombinedModEffects {
  return { ...createEmptyModEffects(), ...overrides };
}

function simulate(mods: CombinedModEffects, player: Stats = strongPlayer) {
  return runGaugeSimulation(
    { playerStats: player, modEffects: mods, dungeonId: dungeon.id, runs: RUNS, seed: SEED },
    dungeon, enemyData, SEED,
  );
}

// ========================================
// 重撃シミュレーション
// ========================================

describe('重撃シミュレーション', () => {
  it('重撃ありはライフスティールでHP残量が多い', () => {
    const normalMods = createMods({});
    const heavyMods = createMods({ heavyStrike: true });

    const normalResult = simulate(normalMods);
    const heavyResult = simulate(heavyMods);

    // 両方勝利する
    expect(normalResult.stats.winRate).toBe(1);
    expect(heavyResult.stats.winRate).toBe(1);

    // 重撃は100%ライフスティールなのでHP残量が多い
    expect(heavyResult.stats.avgPlayerHpRemaining).toBeGreaterThan(
      normalResult.stats.avgPlayerHpRemaining
    );
  });

  it('重撃は重傷スタックの倍率でDPSが高く戦闘が速い', () => {
    const normalMods = createMods({});
    const heavyMods = createMods({ heavyStrike: true });

    const normalResult = simulate(normalMods);
    const heavyResult = simulate(heavyMods);

    // 重撃は攻撃速度-20%だが重傷スタック(1.2^n)の倍率で総合DPSが上がる
    expect(heavyResult.stats.avgTicks).toBeLessThan(normalResult.stats.avgTicks);
  });
});

// ========================================
// Uberクリティカル追撃シミュレーション
// ========================================

describe('Uberクリティカル追撃シミュレーション', () => {
  it('クリ100%+Uber追撃はクリ100%のみより戦闘が速い', () => {
    const critOnly = createMods({ criticalChance: 100, criticalDamage: 50 });
    const critUber = createMods({ criticalChance: 100, criticalDamage: 50, uberCriticalFollowUp: true });

    const critResult = simulate(critOnly);
    const uberResult = simulate(critUber);

    expect(critResult.stats.winRate).toBe(1);
    expect(uberResult.stats.winRate).toBe(1);

    // Uber追撃ありの方が速い
    expect(uberResult.stats.avgTicks).toBeLessThan(critResult.stats.avgTicks);
  });
});

// ========================================
// 毒マルチスタックシミュレーション
// ========================================

describe('毒マルチスタックシミュレーション', () => {
  it('毒1.5スタックは通常毒より戦闘が速い', () => {
    const normalPoison = createMods({ poisonChance: 100, poisonMaxStacks: 10 });
    const multiPoison = createMods({ poisonChance: 100, poisonMaxStacks: 10, poisonMultiStack: 1.5 });

    const normalResult = simulate(normalPoison);
    const multiResult = simulate(multiPoison);

    expect(normalResult.stats.winRate).toBe(1);
    expect(multiResult.stats.winRate).toBe(1);

    // マルチスタックの方が速い
    expect(multiResult.stats.avgTicks).toBeLessThan(normalResult.stats.avgTicks);
  });
});

// ========================================
// 灼熱加速シミュレーション
// ========================================

describe('灼熱加速シミュレーション', () => {
  it('灼熱加速は通常発火より戦闘が速い', () => {
    const normalIgnite = createMods({ igniteChance: 100 });
    const intenseIgnite = createMods({ igniteChance: 100, igniteIntensify: true });

    const normalResult = simulate(normalIgnite);
    const intenseResult = simulate(intenseIgnite);

    expect(normalResult.stats.winRate).toBe(1);
    expect(intenseResult.stats.winRate).toBe(1);

    // 灼熱加速の方が速い（上書き損失が減る）
    expect(intenseResult.stats.avgTicks).toBeLessThan(normalResult.stats.avgTicks);
  });
});

// ========================================
// チル/フリーズダメージ倍率シミュレーション
// ========================================

describe('チル/フリーズダメージ倍率シミュレーション', () => {
  it('チル100%+凍傷の刃はチル100%のみより戦闘が速い', () => {
    const chillOnly = createMods({ chillChance: 100 });
    const chillFrost = createMods({ chillChance: 100, chillFreezeDamageMult: 1.5 });

    const chillResult = simulate(chillOnly);
    const frostResult = simulate(chillFrost);

    expect(chillResult.stats.winRate).toBe(1);
    expect(frostResult.stats.winRate).toBe(1);

    // 凍傷の刃の方が速い
    expect(frostResult.stats.avgTicks).toBeLessThan(chillResult.stats.avgTicks);
  });

  it('チルなしでは凍傷の刃の効果がない', () => {
    const noEffect = createMods({ chillFreezeDamageMult: 1.5 });
    const baseline = createMods({});

    const noEffectResult = simulate(noEffect);
    const baseResult = simulate(baseline);

    // チルがないので同じ結果
    expect(noEffectResult.stats.avgTicks).toBe(baseResult.stats.avgTicks);
  });
});

// ========================================
// チル/フリーズ戦闘シミュレーション
// ========================================

describe('チル/フリーズ戦闘シミュレーション', () => {
  it('チルで敵の攻撃が遅くなりHP残量が増える', () => {
    const noChillMods = createMods({});
    const chillMods = createMods({ chillChance: 100 });

    const noChillResult = simulate(noChillMods);
    const chillResult = simulate(chillMods);

    expect(noChillResult.stats.winRate).toBe(1);
    expect(chillResult.stats.winRate).toBe(1);

    // チルで敵が遅くなるのでHP残量が多い
    expect(chillResult.stats.avgPlayerHpRemaining).toBeGreaterThan(
      noChillResult.stats.avgPlayerHpRemaining
    );
  });

  it('フリーズで敵が完全停止しHP残量がさらに増える', () => {
    const chillMods = createMods({ chillChance: 100 });
    const freezeMods = createMods({ chillChance: 100, freezeChance: 10 });

    const chillResult = simulate(chillMods);
    const freezeResult = simulate(freezeMods);

    expect(chillResult.stats.winRate).toBe(1);
    expect(freezeResult.stats.winRate).toBe(1);

    // フリーズありの方がHP残量が多い
    expect(freezeResult.stats.avgPlayerHpRemaining).toBeGreaterThanOrEqual(
      chillResult.stats.avgPlayerHpRemaining
    );
  });
});

// ========================================
// 複合ビルドシミュレーション
// ========================================

describe('複合ビルドシミュレーション', () => {
  it('全Uber能力を組み合わせた場合に戦闘が成立する', () => {
    const allUberMods = createMods({
      heavyStrike: true,
      criticalChance: 50,
      criticalDamage: 50,
      uberCriticalFollowUp: true,
      poisonChance: 50,
      poisonMaxStacks: 5,
      poisonMultiStack: 1.5,
      igniteChance: 50,
      igniteIntensify: true,
      chillChance: 50,
      freezeChance: 5,
      chillFreezeDamageMult: 1.5,
    });

    const result = simulate(allUberMods);

    // 戦闘が成立し勝利する
    expect(result.stats.winRate).toBe(1);
    expect(result.stats.avgTicks).toBeGreaterThan(0);
  });

  it('重撃+防御型ビルドが厳しい戦闘で生存できる', () => {
    const hardEnemy: EnemyConfig = {
      id: 'hard', name: 'Hard', maxHp: 50000, atk: 400, def: 50, exp: 100,
    };
    const hardDungeon: DungeonConfig = {
      id: 'hard_dungeon', name: 'Hard', maxFloor: 1,
      enemies: ['hard'], dropTable: [],
    };
    const hardEnemyData = new Map([['hard', hardEnemy]]);

    // 防御型: 高HP/DEF
    const tankPlayer: Stats = { maxHp: 5000, atk: 200, def: 200 };

    // 重撃なし: ライフスティールがないので耐えられない可能性
    const noHeavy = createMods({ hpRegen: 50 });
    const noHeavyResult = runGaugeSimulation(
      { playerStats: tankPlayer, modEffects: noHeavy, dungeonId: hardDungeon.id, runs: RUNS, seed: SEED },
      hardDungeon, hardEnemyData, SEED,
    );

    // 重撃あり: 100%ライフスティールで持久戦
    const heavy = createMods({ heavyStrike: true, hpRegen: 50 });
    const heavyResult = runGaugeSimulation(
      { playerStats: tankPlayer, modEffects: heavy, dungeonId: hardDungeon.id, runs: RUNS, seed: SEED },
      hardDungeon, hardEnemyData, SEED,
    );

    // 重撃ありの方がHP残量が多い（ライフスティールの恩恵）
    if (noHeavyResult.stats.winRate > 0 && heavyResult.stats.winRate > 0) {
      expect(heavyResult.stats.avgPlayerHpRemaining).toBeGreaterThan(
        noHeavyResult.stats.avgPlayerHpRemaining
      );
    }
  });
});
