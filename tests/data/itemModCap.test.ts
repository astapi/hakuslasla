import { describe, expect, it } from 'vitest';
import itemsData from '../../data/json/items.json';
import modsData from '../../data/json/mods.json';

const getItem = (id: string) => (itemsData.items as Record<string, any>)[id];

describe('MOD上限設計', () => {
  const MAX_TOTAL_MODS = 4;

  describe('fixedMods付きcommonドロップのMOD数制限', () => {
    // fixedMods 3個のアイテム群
    const fixedMod3Items = [
      'uber_venom_fang', 'uber_venom_plate', 'uber_venom_grip', 'uber_venom_stride', 'uber_venom_heart',
      'uber_assassin_blade', 'uber_assassin_coat', 'uber_assassin_grip', 'uber_assassin_steps', 'uber_assassin_pendant',
      'uber_fortress_blade', 'uber_fortress_plate', 'uber_fortress_grip', 'uber_fortress_stomp', 'uber_fortress_bulwark',
    ];

    it.each(fixedMod3Items)('%s のfixedModsは3個で、ランダムMOD1個を足しても上限4を超えない', (itemId) => {
      const item = getItem(itemId);
      expect(item).toBeDefined();
      expect(item.fixedMods).toBeDefined();
      expect(item.fixedMods.length).toBe(3);
      // fixedMods 3 + ランダム最大1 = 4 <= MAX_TOTAL_MODS
      expect(item.fixedMods.length + 1).toBeLessThanOrEqual(MAX_TOTAL_MODS);
    });

    // fixedMods 4個のユニークアイテム（ランダムMOD 0個になるべき）
    const fixedMod4Items = [
      'uber_bandit_dagger', 'uber_bandit_coat', 'uber_bandit_grip', 'uber_bandit_steps', 'uber_bandit_crown',
    ];

    it.each(fixedMod4Items)('%s のfixedModsは4個で、ランダムMOD付与余地なし', (itemId) => {
      const item = getItem(itemId);
      expect(item).toBeDefined();
      expect(item.fixedMods).toBeDefined();
      expect(item.fixedMods.length).toBe(4);
      // fixedMods 4 → ランダムMOD枠 = MAX_TOTAL_MODS - 4 = 0
      expect(MAX_TOTAL_MODS - item.fixedMods.length).toBe(0);
    });
  });

  describe('damage_reduction_pct fixedModのランダム化 (min/max)', () => {
    const drItems = [
      'uber_venom_plate', 'uber_assassin_coat',
      'uber_fortress_plate', 'uber_fortress_grip', 'uber_fortress_bulwark',
    ];

    it.each(drItems)('%s のdamage_reduction_pctはmin:1, max:5のレンジを持つ', (itemId) => {
      const item = getItem(itemId);
      expect(item).toBeDefined();
      const drMod = item.fixedMods.find((m: any) => m.type === 'damage_reduction_pct');
      expect(drMod).toBeDefined();
      expect(drMod.min).toBe(1);
      expect(drMod.max).toBe(5);
      // valueは持たない（min/maxに置き換え済み）
      expect(drMod.value).toBeUndefined();
    });

    it('damage_reduction_pct以外のfixedModsは固定値(value)を持つ', () => {
      const item = getItem('uber_venom_plate');
      const otherMods = item.fixedMods.filter((m: any) => m.type !== 'damage_reduction_pct');
      for (const mod of otherMods) {
        expect(mod.value).toBeDefined();
        expect(typeof mod.value).toBe('number');
      }
    });
  });

  describe('freeze_chanceが装備MODに存在しない', () => {
    it('mods.jsonにfreeze_chanceが含まれない', () => {
      const modTypes = (modsData as any).modConfigs.map((m: { type: string }) => m.type);
      expect(modTypes).not.toContain('freeze_chance');
    });

    it('chill系MODは装備MODとして存在する', () => {
      const modTypes = (modsData as any).modConfigs.map((m: { type: string }) => m.type);
      expect(modTypes).toContain('chill_chance');
      expect(modTypes).toContain('chill_effect_pct');
      expect(modTypes).toContain('chill_duration_pct');
    });
  });
});
