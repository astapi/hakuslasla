import { describe, it, expect } from 'vitest';
import {
  combineMods,
  getAttackSpeedFromMods,
  getPoisonDamageFromMods,
  calculateAttackSpeed,
  calculatePoisonDamage,
  createEmptyModEffects,
} from '../../core/modEffects';
import { CombinedModEffects } from '../../core/types';

describe('core/modEffects', () => {
  it('createEmptyModEffects は初期値をゼロで生成する', () => {
    const mods = createEmptyModEffects();
    expect(mods.hpRegen).toBe(0);
    expect(mods.poisonChance).toBe(0);
    expect(mods.attackSpeedMorePct.length).toBe(0);
  });

  it('combineMods は装備とパッシブの効果を合算する', () => {
    const equipment = [
      { mods: [{ type: 'hp_regen', value: 2 }] },
      { mods: [{ type: 'poison_chance', value: 10 }] },
    ];
    const passive = {
      hp: 0,
      atk: 0,
      def: 0,
      hp_increased_pct: 0,
      atk_increased_pct: 0,
      def_increased_pct: 0,
      hp_more_pct: [],
      atk_more_pct: [],
      def_more_pct: [],
      poison_chance: 5,
      poison_damage_pct: 0,
      poison_damage_more_pct: [],
      poison_max_stacks: 0,
      poison_damage_reduction: 0,
      poison_lifesteal: 0,
      no_direct_damage: false,
      critical_chance: 0,
      critical_damage: 0,
      hp_on_crit: 0,
      hp_regen: 3,
      hp_regen_pct: 0,
      damage_reduction_pct: 0,
      hp_on_hit: 0,
      attack_speed_pct: 0,
      attack_speed_more_pct: [],
    };

    const combined = combineMods(equipment, passive);
    expect(combined.hpRegen).toBe(5);
    expect(combined.poisonChance).toBe(15);
  });

  it('calculateAttackSpeed は increased/more を反映する', () => {
    const result = calculateAttackSpeed(1, 50, [20]);
    expect(result).toBeCloseTo(1.8, 5);
  });

  it('getAttackSpeedFromMods は combined mods を反映する', () => {
    const mods: CombinedModEffects = {
      hpRegen: 0,
      hpRegenPct: 0,
      poisonChance: 0,
      poisonDamagePct: 0,
      poisonDamageMorePct: [],
      poisonMaxStacks: 0,
      poisonDamageReduction: 0,
      poisonLifesteal: 0,
      noDirectDamage: false,
      criticalChance: 0,
      criticalDamage: 0,
      hpOnCrit: 0,
      criticalFollowUpAttack: false,
      damageReductionPct: 0,
      hpOnHit: 0,
      attackSpeedPct: 50,
      attackSpeedMorePct: [20],
      timeAtkIncPct: 0,
      timeDefIncPct: 0,
      timeHpRegen: 0,
    };

    const result = getAttackSpeedFromMods(mods, 1);
    expect(result).toBeCloseTo(1.8, 5);
  });

  it('calculatePoisonDamage / getPoisonDamageFromMods は増加を反映する', () => {
    const base = calculatePoisonDamage(10, 50, [20]);
    const mods: CombinedModEffects = {
      ...createEmptyModEffects(),
      poisonDamagePct: 50,
      poisonDamageMorePct: [20],
    };
    const fromMods = getPoisonDamageFromMods(10, mods);
    expect(fromMods).toBe(base);
  });
});
