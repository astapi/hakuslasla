import { describe, it, expect } from 'vitest';
import {
  DIMENSIONAL_RUSH_ID,
  DEBUG_DIMENSIONAL_DUNGEON_IDS,
  isEndContentDungeon,
  getBaseBossId,
  isUberBoss,
  getEnemyAtkMultiplier,
  getEnemyDamageReductionPct,
  getPlayerPoisonFromBoss,
  getDimensionalRushFloorMultiplier,
  getBossSkillName,
  scaleEnemyStats,
  getEnemyRegenPerSecond,
} from '../../core/endContent';

describe('core/endContent', () => {
  it('isEndContentDungeon は異次元ラッシュを判定する', () => {
    expect(isEndContentDungeon(DIMENSIONAL_RUSH_ID)).toBe(true);
  });

  it('isEndContentDungeon はデバッグIDを判定する', () => {
    expect(isEndContentDungeon(DEBUG_DIMENSIONAL_DUNGEON_IDS[0])).toBe(true);
  });

  it('getBaseBossId は UBER を正規化する', () => {
    expect(getBaseBossId('uber_goblin_king')).toBe('goblin_king');
    expect(isUberBoss('uber_goblin_king')).toBe(true);
  });

  it('補正関数は既定値を返す', () => {
    expect(getEnemyAtkMultiplier('unknown')).toBe(1);
    expect(getEnemyDamageReductionPct('unknown')).toBe(0);
  });

  it('getEnemyRegenPerSecond は既知ボスで再生値を返す', () => {
    expect(getEnemyRegenPerSecond('kraken')).toBeGreaterThan(0);
  });

  it('getPlayerPoisonFromBoss は該当ボスで毒を返す', () => {
    const poison = getPlayerPoisonFromBoss('vampire');
    expect(poison).not.toBeNull();
  });

  it('getDimensionalRushFloorMultiplier は階層で変化する', () => {
    expect(getDimensionalRushFloorMultiplier(100)).toBe(1.1);
    expect(getDimensionalRushFloorMultiplier(150)).toBe(1.3);
  });

  it('getBossSkillName は i18n 不在時に null を返す', () => {
    const name = getBossSkillName('goblin_king');
    expect(name).toBeNull();
  });

  it('scaleEnemyStats は倍率で数値をスケールする', () => {
    const enemy = { id: 'e', name: 'E', maxHp: 10, atk: 5, def: 2, exp: 1 };
    const scaled = scaleEnemyStats(enemy, { hp: 2, atk: 2, def: 2, exp: 3 });
    expect(scaled.maxHp).toBe(20);
    expect(scaled.atk).toBe(10);
    expect(scaled.def).toBe(4);
    expect(scaled.exp).toBe(3);
  });
});
