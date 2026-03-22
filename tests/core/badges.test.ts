import { describe, it, expect } from 'vitest';
import {
  BADGES,
  getBadgeById,
  ALL_BADGE_IDS,
  BADGE_IDS_EXCEPT_UBER_UBER,
  getUberBossClearBadgeId,
  DIMENSIONAL_BADGE_FLOOR,
  DIMENSIONAL_BADGE_ID,
  UBER_UBER_BADGE_ID,
} from '../../data/badges';

describe('バッジシステム', () => {
  it('8種類のバッジが定義されている', () => {
    expect(BADGES.length).toBe(8);
  });

  it('ALL_BADGE_IDS は全バッジIDを含む', () => {
    expect(ALL_BADGE_IDS.length).toBe(8);
    expect(ALL_BADGE_IDS).toContain('badge_uber_goblin_king');
    expect(ALL_BADGE_IDS).toContain('badge_dimensional_4000');
    expect(ALL_BADGE_IDS).toContain('badge_uber_uber_goblin_king');
  });

  it('BADGE_IDS_EXCEPT_UBER_UBER はUberUberゴブリンキングバッジを除外する', () => {
    expect(BADGE_IDS_EXCEPT_UBER_UBER).not.toContain('badge_uber_uber_goblin_king');
    expect(BADGE_IDS_EXCEPT_UBER_UBER.length).toBe(7);
  });

  it('getBadgeById は既知のバッジを返す', () => {
    const badge = getBadgeById('badge_uber_goblin_king');
    expect(badge).toBeDefined();
    expect(badge!.condition.type).toBe('uber_boss_clear');
    expect(badge!.condition.dungeonId).toBe('uber_goblin_king');
  });

  it('getBadgeById は未知のIDで undefined を返す', () => {
    expect(getBadgeById('nonexistent')).toBeUndefined();
  });

  it('getUberBossClearBadgeId は各Uberダンジョンに対応するバッジIDを返す', () => {
    expect(getUberBossClearBadgeId('uber_goblin_king')).toBe('badge_uber_goblin_king');
    expect(getUberBossClearBadgeId('uber_bandit_leader')).toBe('badge_uber_bandit_leader');
    expect(getUberBossClearBadgeId('uber_vampire')).toBe('badge_uber_vampire');
    expect(getUberBossClearBadgeId('uber_kraken')).toBe('badge_uber_kraken');
    expect(getUberBossClearBadgeId('uber_demon_lord')).toBe('badge_uber_demon_lord');
    expect(getUberBossClearBadgeId('uber_true_final_boss')).toBe('badge_uber_true_final_boss');
    expect(getUberBossClearBadgeId('uber_uber_goblin_king')).toBe('badge_uber_uber_goblin_king');
  });

  it('getUberBossClearBadgeId は非Uberダンジョンで undefined を返す', () => {
    expect(getUberBossClearBadgeId('goblin_forest')).toBeUndefined();
    expect(getUberBossClearBadgeId('unknown')).toBeUndefined();
  });

  it('次元回廊バッジの定数が正しい', () => {
    expect(DIMENSIONAL_BADGE_FLOOR).toBe(4000);
    expect(DIMENSIONAL_BADGE_ID).toBe('badge_dimensional_4000');
  });

  it('UberUberバッジIDが正しい', () => {
    expect(UBER_UBER_BADGE_ID).toBe('badge_uber_uber_goblin_king');
  });

  it('uber_boss_clearバッジが7つ存在する', () => {
    const uberBadges = BADGES.filter(b => b.condition.type === 'uber_boss_clear');
    expect(uberBadges.length).toBe(7);
  });

  it('dimensional_floorバッジが1つ存在する', () => {
    const dimBadges = BADGES.filter(b => b.condition.type === 'dimensional_floor');
    expect(dimBadges.length).toBe(1);
    expect(dimBadges[0].condition.floor).toBe(4000);
  });

  it('全バッジにnameKeyとdescriptionKeyが設定されている', () => {
    for (const badge of BADGES) {
      expect(badge.nameKey).toBeTruthy();
      expect(badge.descriptionKey).toBeTruthy();
      expect(badge.icon).toBeTruthy();
    }
  });
});
