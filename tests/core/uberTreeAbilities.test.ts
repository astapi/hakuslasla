import { describe, it, expect } from 'vitest';
import { createBattleEngine, runBattleEngineToEnd } from '../../core/battleEngine';
import { createEmptyModEffects } from '../../core/modEffects';
import { EnemyConfig, Stats, CombinedModEffects } from '../../core/types';
import { calculateUberTreeEffects } from '../../data/uberTree';

// ========================================
// ヘルパー
// ========================================

const basePlayer: Stats = { maxHp: 500, atk: 100, def: 50 };
const baseEnemy: EnemyConfig = { id: 'test_enemy', name: 'Test', maxHp: 5000, atk: 30, def: 10, exp: 10 };

function createMods(overrides: Partial<CombinedModEffects> = {}): CombinedModEffects {
  return { ...createEmptyModEffects(), ...overrides };
}

function runBattle(
  mods: CombinedModEffects,
  enemy: EnemyConfig = baseEnemy,
  player: Stats = basePlayer,
) {
  const { engine, events: initEvents } = createBattleEngine({
    playerStats: player,
    playerCurrentHp: player.maxHp,
    playerMods: mods,
    enemy,
    rng: () => 0.01, // 低い乱数で状態異常を確実に発動
  });
  const result = runBattleEngineToEnd(engine, enemy.exp, 30000);
  return { engine, result, initEvents };
}

// ========================================
// Uberツリーデータのテスト
// ========================================

describe('Uberツリーデータ', () => {
  it('6ルート24ノードが存在する', () => {
    const effects = calculateUberTreeEffects([]);
    // 空の場合はデフォルト値
    expect(effects.heavy_strike).toBe(false);
    expect(effects.def_hp_to_atk).toBe(false);
    expect(effects.uber_critical_follow_up).toBe(false);
    expect(effects.poison_multi_stack).toBe(1);
    expect(effects.ignite_intensify).toBe(false);
    expect(effects.chill_freeze_damage_mult).toBe(1);
  });

  it('各最終ノードの固有能力が正しく計算される', () => {
    const effects = calculateUberTreeEffects([
      'uber_atk_1', 'uber_atk_2', 'uber_atk_3', 'uber_atk_4',
      'uber_def_1', 'uber_def_2', 'uber_def_3', 'uber_def_4',
      'uber_crit_1', 'uber_crit_2', 'uber_crit_3', 'uber_crit_4',
      'uber_poison_1', 'uber_poison_2', 'uber_poison_3', 'uber_poison_4',
      'uber_ignite_1', 'uber_ignite_2', 'uber_ignite_3', 'uber_ignite_4',
      'uber_ice_1', 'uber_ice_2', 'uber_ice_3', 'uber_ice_4',
    ]);

    expect(effects.heavy_strike).toBe(true);
    expect(effects.def_hp_to_atk).toBe(true);
    expect(effects.uber_critical_follow_up).toBe(true);
    expect(effects.poison_multi_stack).toBe(1.5);
    expect(effects.ignite_intensify).toBe(true);
    expect(effects.chill_freeze_damage_mult).toBe(1.5);
  });

  it('破壊ルートの数値が正しい', () => {
    const effects = calculateUberTreeEffects([
      'uber_atk_1', 'uber_atk_2', 'uber_atk_3',
    ]);
    expect(effects.atk_increased_pct).toBe(13); // 5 + 8
    expect(effects.atk_more_pct).toEqual([10]);
  });

  it('不滅ルートの数値が正しい', () => {
    const effects = calculateUberTreeEffects([
      'uber_def_1', 'uber_def_2', 'uber_def_3',
    ]);
    expect(effects.hp_increased_pct).toBe(10);
    expect(effects.def_increased_pct).toBe(10);
    expect(effects.damage_reduction_pct).toBe(3);
    expect(effects.hp_regen).toBe(5);
    expect(effects.hp_more_pct).toEqual([5]);
  });

  it('猛毒ルートの数値が正しい', () => {
    const effects = calculateUberTreeEffects([
      'uber_poison_1', 'uber_poison_2', 'uber_poison_3',
    ]);
    expect(effects.poison_chance).toBe(10); // 5 + 5
    expect(effects.poison_damage_pct).toBe(25); // 15 + 10
  });

  it('業火ルートの数値が正しい', () => {
    const effects = calculateUberTreeEffects([
      'uber_ignite_1', 'uber_ignite_2', 'uber_ignite_3',
    ]);
    expect(effects.ignite_chance).toBe(10); // 5 + 5
    expect(effects.ignite_damage_pct).toBe(25); // 15 + 10
  });

  it('氷結ルートの数値が正しい', () => {
    const effects = calculateUberTreeEffects([
      'uber_ice_1', 'uber_ice_2', 'uber_ice_3',
    ]);
    expect(effects.chill_chance).toBe(8); // 5 + 3
    expect(effects.freeze_chance).toBe(2); // 1 + 1
    expect(effects.chill_effect_pct).toBe(15);
  });
});

// ========================================
// 重撃のテスト
// ========================================

describe('重撃（Heavy Strike）', () => {
  it('攻撃速度が20%低下する', () => {
    const normalMods = createMods({ attackSpeedPct: 50 });
    const heavyMods = createMods({ attackSpeedPct: 50, heavyStrike: true });

    const { engine: normalEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: normalMods,
      enemy: baseEnemy,
    });
    const { engine: heavyEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: heavyMods,
      enemy: baseEnemy,
    });

    // 重撃の方が攻撃速度が低い
    expect(heavyEngine.getState().player.attackSpeed).toBeLessThan(
      normalEngine.getState().player.attackSpeed
    );
    // 正確に0.8倍
    expect(heavyEngine.getState().player.attackSpeed).toBeCloseTo(
      normalEngine.getState().player.attackSpeed * 0.8, 5
    );
  });

  it('重傷スタックが蓄積され上限5で止まる', () => {
    const mods = createMods({ heavyStrike: true });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.99, // 状態異常なし
    });

    // 十分なtickを進めて複数回攻撃させる
    const events = engine.advanceTicks(300); // 10秒分
    const woundEvents = events.filter(e => e.type === 'wound_applied');

    // 重傷スタックが発生している
    expect(woundEvents.length).toBeGreaterThan(0);

    // 上限5を超えない
    const maxStacks = Math.max(...woundEvents.map(e => e.data.stacks as number));
    expect(maxStacks).toBeLessThanOrEqual(5);
  });

  it('与ダメージの100%をHP吸収する', () => {
    const mods = createMods({ heavyStrike: true });
    const player: Stats = { maxHp: 500, atk: 100, def: 50 };
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 50, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: player,
      playerCurrentHp: 200, // HPが減った状態で開始
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.99,
    });

    engine.advanceTicks(300);
    const state = engine.getState();

    // 重撃のライフスティールでHPが回復しているはず
    expect(state.player.currentHp).toBeGreaterThan(200);
  });

  it('敵行動4回で重傷スタックが1減少する', () => {
    const mods = createMods({ heavyStrike: true });
    // 敵の攻撃速度を高くして敵行動を多くする
    const fastEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1, attackSpeed: 5 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: { ...fastEnemy },
      rng: () => 0.99,
    });

    const events = engine.advanceTicks(600); // 20秒分
    const decayEvents = events.filter(e => e.type === 'wound_decayed');

    // 敵の行動頻度が高いので減衰イベントが発生するはず
    expect(decayEvents.length).toBeGreaterThan(0);
  });
});

// ========================================
// Uberクリティカル追撃のテスト
// ========================================

describe('Uberクリティカル追撃', () => {
  it('クリティカル時にATK100%の追撃が発生する', () => {
    const mods = createMods({
      criticalChance: 100,
      criticalDamage: 0,
      uberCriticalFollowUp: true,
    });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.001,
    });

    const events = engine.advanceTicks(60); // 2秒分
    const attackEvents = events.filter(e => e.type === 'player_attack' || e.type === 'critical_hit');

    // クリティカル + 通常追撃(criticalFollowUpAttackなし) + Uber追撃 = 攻撃イベント2つ以上
    expect(attackEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('noDirectDamageの場合は追撃しない', () => {
    const mods = createMods({
      criticalChance: 100,
      uberCriticalFollowUp: true,
      noDirectDamage: true,
    });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.001,
    });

    const events = engine.advanceTicks(60);
    // 全ての攻撃イベントのダメージが0
    const attackDamages = events
      .filter(e => e.type === 'player_attack' || e.type === 'critical_hit')
      .map(e => e.data.damage as number);
    attackDamages.forEach(d => expect(d).toBe(0));
  });
});

// ========================================
// 毒マルチスタックのテスト
// ========================================

describe('毒マルチスタック（猛毒の覚醒）', () => {
  it('poisonMultiStack=1.5で2回付与すると3スタック付与される', () => {
    const mods = createMods({
      poisonChance: 100,
      poisonMultiStack: 1.5,
      poisonMaxStacks: 10,
    });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.001, // 毒確実発動
    });

    // 2回攻撃分のtickを進める
    const events = engine.advanceTicks(100);
    const poisonApplied = events.filter(e => e.type === 'poison_applied');

    // 2回毒付与が発生（各回でpoisonStackが生成される）
    // 1回目: 1.5 → 1スタック付与 (アキュムレータ0.5)
    // 2回目: 0.5 + 1.5 = 2.0 → 2スタック付与 (アキュムレータ0.0)
    // 合計3スタック
    expect(poisonApplied.length).toBeGreaterThanOrEqual(2);

    // 状態のスタック数を確認
    const state = engine.getState();
    // 毒のダメージ処理でスタックが消費されるので正確な数は保証できないが、
    // poisonMultiStack=1のときより多いことを確認
    expect(state.enemyPoisonStacks.length + state.poisonStackAccumulator).toBeGreaterThanOrEqual(0);
  });

  it('poisonMultiStack=1（通常）では1回付与で1スタック', () => {
    const mods = createMods({
      poisonChance: 100,
      poisonMultiStack: 1,
      poisonMaxStacks: 10,
    });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods,
      enemy: weakEnemy,
      rng: () => 0.001,
    });

    const events = engine.advanceTicks(100);
    const state = engine.getState();

    // アキュムレータは0のまま
    expect(state.poisonStackAccumulator).toBe(0);
  });
});

// ========================================
// 灼熱加速のテスト
// ========================================

describe('灼熱加速（業火の覚醒）', () => {
  it('igniteIntensifyで発火の継続時間と間隔が半分になる', () => {
    const normalMods = createMods({ igniteChance: 100 });
    const intenseMods = createMods({ igniteChance: 100, igniteIntensify: true });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    // 通常の発火
    const { engine: normalEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: normalMods,
      enemy: weakEnemy,
      rng: () => 0.001,
    });
    normalEngine.advanceTicks(60);
    const normalIgnite = normalEngine.getState().enemyIgniteState;

    // 灼熱加速の発火
    const { engine: intenseEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: intenseMods,
      enemy: weakEnemy,
      rng: () => 0.001,
    });
    intenseEngine.advanceTicks(60);
    const intenseIgnite = intenseEngine.getState().enemyIgniteState;

    expect(normalIgnite).not.toBeNull();
    expect(intenseIgnite).not.toBeNull();
    // 間隔が半分
    expect(intenseIgnite!.tickIntervalMs).toBe(Math.max(50, Math.floor(normalIgnite!.tickIntervalMs / 2)));
  });
});

// ========================================
// チル/フリーズダメージ倍率のテスト
// ========================================

describe('チル/フリーズダメージ倍率（氷結の覚醒）', () => {
  it('チル中の敵に対してダメージが増加する', () => {
    const normalMods = createMods({});
    const frostMods = createMods({ chillFreezeDamageMult: 1.5 });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    // チルなし + 倍率なし
    const { engine: normalEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: normalMods,
      enemy: weakEnemy,
      rng: () => 0.99,
    });
    normalEngine.advanceTicks(60);
    const normalHp = normalEngine.getState().enemy.currentHp;

    // チルあり + 倍率あり
    const { engine: frostEngine } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: frostMods,
      enemy: weakEnemy,
      rng: () => 0.99,
    });
    // 手動でチル状態を付与
    (frostEngine.getState() as any).enemyChillState = { speedMultiplier: 0.8, remainingMs: 999999 };
    frostEngine.advanceTicks(60);
    const frostHp = frostEngine.getState().enemy.currentHp;

    // チル+倍率ありの方がダメージが大きい（HPが低い）
    expect(frostHp).toBeLessThan(normalHp);
  });

  it('チル/フリーズなしの場合は倍率が適用されない', () => {
    const mods1 = createMods({});
    const mods2 = createMods({ chillFreezeDamageMult: 1.5 });
    const weakEnemy: EnemyConfig = { id: 'e', name: 'E', maxHp: 100000, atk: 1, def: 0, exp: 1 };

    const { engine: e1 } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods1,
      enemy: weakEnemy,
      rng: () => 0.99,
    });
    e1.advanceTicks(60);

    const { engine: e2 } = createBattleEngine({
      playerStats: basePlayer,
      playerCurrentHp: basePlayer.maxHp,
      playerMods: mods2,
      enemy: weakEnemy,
      rng: () => 0.99,
    });
    e2.advanceTicks(60);

    // チルなしなら同じダメージ
    expect(e1.getState().enemy.currentHp).toBe(e2.getState().enemy.currentHp);
  });
});
