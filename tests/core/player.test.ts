import { describe, it, expect } from 'vitest';
import {
  getExpToNextLevel,
  calculateLevelUp,
  calculateTotalStats,
  calculateBaseStatsForLevel,
  getPlayerCombatStats,
  createDefaultPlayerConfig,
  getLevelBasedPreset,
} from '../../core/player';

describe('core/player', () => {
  it('getExpToNextLevel は Lv1 で 100 を返す', () => {
    expect(getExpToNextLevel(1)).toBe(100);
  });

  it('calculateLevelUp は複数回レベルアップを処理する', () => {
    const result = calculateLevelUp(1, 0, 1000, 10);
    expect(result.newLevel).toBeGreaterThan(1);
    expect(result.newExp).toBeGreaterThanOrEqual(0);
  });

  it('calculateLevelUp はレベル上限で EXP を 0 にする', () => {
    const result = calculateLevelUp(50, 9999, 9999, 50);
    expect(result.newLevel).toBe(50);
    expect(result.newExp).toBe(0);
    expect(result.expToNextLevel).toBe(0);
  });

  it('calculateTotalStats は装備の atk/def を加算する', () => {
    const base = calculateBaseStatsForLevel(1);
    const config = createDefaultPlayerConfig(1);
    config.equipment.weapon = { id: 'w1', atk: 5, def: 0 };
    config.equipment.armor = { id: 'a1', atk: 0, def: 3 };

    const total = calculateTotalStats(base, config.equipment);
    expect(total.atk).toBe(base.atk + 5);
    expect(total.def).toBe(base.def + 3);
    expect(total.maxHp).toBe(base.maxHp);
  });

  it('getPlayerCombatStats は calculateTotalStats 相当の結果を返す', () => {
    const config = createDefaultPlayerConfig(1);
    config.equipment.weapon = { id: 'w1', atk: 5, def: 0 };
    const stats = getPlayerCombatStats(config);
    expect(stats.atk).toBe(config.baseStats.atk + 5);
  });

  it('getLevelBasedPreset は指定レベルのプリセットを返す', () => {
    const preset = getLevelBasedPreset('POISON', 5);
    expect(preset.nodes.length).toBeGreaterThan(0);
  });
});
