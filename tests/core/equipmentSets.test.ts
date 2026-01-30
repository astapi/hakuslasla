import { describe, it, expect, vi } from 'vitest';
import {
  getDungeonEquipmentSet,
  getEquipmentSetForLevel,
  extractModsFromEquipmentSet,
  generateSimulationMods,
  generateRandomEquipmentSet,
} from '../../core/equipmentSets';
import type { EquipmentSet } from '../../core/equipmentSets';

describe('core/equipmentSets', () => {
  it('getDungeonEquipmentSet は存在しないIDで undefined を返す', () => {
    expect(getDungeonEquipmentSet('unknown', 'ATK')).toBeUndefined();
  });

  it('getEquipmentSetForLevel はレベルに応じた装備を返す', () => {
    const set = getEquipmentSetForLevel(1, 'ATK');
    expect(set).toBeDefined();
    expect(set?.weapon).toBeTruthy();
  });

  it('extractModsFromEquipmentSet は全装備の MOD を抽出する', () => {
    const set: EquipmentSet = {
      name: 'test',
      weapon: { id: 'w', instanceId: 'w1', name: 'W', slot: 'weapon', atk: 1, def: 0, mods: [{ type: 'atk_bonus', value: 1, tier: 1 }] },
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    };
    const mods = extractModsFromEquipmentSet(set);
    expect(mods.length).toBe(1);
  });

  it('generateSimulationMods は指定数以内で MOD を返す', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const mods = generateSimulationMods(3, 'grassland', 'weapon');
    expect(mods.length).toBeLessThanOrEqual(3);
    spy.mockRestore();
  });

  it('generateRandomEquipmentSet は全スロットを生成する', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const set = generateRandomEquipmentSet('random', 'grassland');
    expect(set.weapon).toBeTruthy();
    expect(set.armor).toBeTruthy();
    expect(set.gloves).toBeTruthy();
    expect(set.boots).toBeTruthy();
    expect(set.accessory).toBeTruthy();
    spy.mockRestore();
  });
});
