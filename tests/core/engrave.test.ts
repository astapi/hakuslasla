import { describe, it, expect } from 'vitest';
import {
  applyEngrave,
  hasEngravedMod,
  isUniqueItem,
  previewEngrave,
  MAX_ITEM_MODS,
} from '../../core/engrave';
import {
  ENGRAVE_DEFS,
  ENGRAVE_DROP_CHANCE_BOSS,
  ENGRAVE_DROP_CHANCE_NORMAL,
  canEngraveOnSlot,
  getEngraveDef,
} from '../../data/engraveMods';
import type { Item, ItemMod } from '../../types';

const mod = (type: ItemMod['type'], value: number, tier = 3): ItemMod => ({ type, value, tier });

/** レア装備（ランダムMOD）を作る。titan_gauntlets は fixedMods を持たない */
const rare = (mods: ItemMod[], slot: Item['slot'] = 'gloves'): Item => ({
  id: slot === 'gloves' ? 'titan_gauntlets' : 'copper_ring',
  instanceId: 'test_rare',
  name: 'テストレア',
  slot,
  atk: 10,
  def: 10,
  evasion: 0,
  mods,
});

describe('刻印カタログ', () => {
  it('毒系のMODは対象外（毒一強を助長しないため）', () => {
    const ids = ENGRAVE_DEFS.map((d) => d.id as string);
    expect(ids.some((id) => id.includes('poison'))).toBe(false);
  });

  it('_more_pct 系は対象外', () => {
    const ids = ENGRAVE_DEFS.map((d) => d.id as string);
    expect(ids.some((id) => id.endsWith('_more_pct'))).toBe(false);
  });

  it('上限があって盛る意味が薄いchance系は対象外', () => {
    const ids = ENGRAVE_DEFS.map((d) => d.id as string);
    for (const banned of ['critical_chance', 'ignite_chance', 'chill_chance', 'freeze_chance', 'block_chance']) {
      expect(ids).not.toContain(banned);
    }
  });

  it('スロット制限が尊重される', () => {
    const asDef = getEngraveDef('attack_speed_pct')!;
    expect(canEngraveOnSlot(asDef, 'gloves')).toBe(true);
    expect(canEngraveOnSlot(asDef, 'armor')).toBe(false);

    const drDef = getEngraveDef('damage_reduction_pct')!;
    expect(canEngraveOnSlot(drDef, 'armor')).toBe(true);
    expect(canEngraveOnSlot(drDef, 'boots')).toBe(false);
  });

  it('発火ダメージは杖の武器にのみ彫れる', () => {
    const def = getEngraveDef('ignite_damage_pct')!;
    expect(canEngraveOnSlot(def, 'weapon', 'staff')).toBe(true);
    expect(canEngraveOnSlot(def, 'weapon', 'sword')).toBe(false);
    expect(canEngraveOnSlot(def, 'armor')).toBe(false);
  });

  it('ドロップ率はボス確定・通常敵は低確率', () => {
    expect(ENGRAVE_DROP_CHANCE_BOSS).toBe(1.0);
    expect(ENGRAVE_DROP_CHANCE_NORMAL).toBeLessThan(0.1);
  });
});

describe('刻印の適用', () => {
  it('MODが3つ以下なら追加される（3→4）', () => {
    const item = rare([mod('critical_damage', 50), mod('hp_bonus', 200), mod('def_increased_pct', 20)]);
    const preview = previewEngrave(item, 'attack_speed_pct');
    expect(preview.ok).toBe(true);
    expect(preview.needsReplaceChoice).toBe(false);

    const result = applyEngrave(item, 'attack_speed_pct');
    expect('item' in result).toBe(true);
    if (!('item' in result)) return;
    expect(result.item.mods).toHaveLength(4);
    const added = result.item.mods!.find((m) => m.type === 'attack_speed_pct')!;
    expect(added.engraved).toBe(true);
    expect(added.tier).toBe(1);
  });

  it('MODが4つなら置換対象の指定が必要', () => {
    const item = rare([
      mod('critical_damage', 50),
      mod('hp_bonus', 200),
      mod('def_increased_pct', 20),
      mod('atk_bonus', 30),
    ]);
    const preview = previewEngrave(item, 'attack_speed_pct');
    expect(preview.ok).toBe(true);
    expect(preview.needsReplaceChoice).toBe(true);

    // 指定なしでは適用できない
    expect('error' in applyEngrave(item, 'attack_speed_pct')).toBe(true);

    // 指定すると置換される（MOD数は4のまま）
    const result = applyEngrave(item, 'attack_speed_pct', 1);
    expect('item' in result).toBe(true);
    if (!('item' in result)) return;
    expect(result.item.mods).toHaveLength(MAX_ITEM_MODS);
    expect(result.item.mods!.some((m) => m.type === 'hp_bonus')).toBe(false);
    expect(result.item.mods!.some((m) => m.engraved)).toBe(true);
  });

  it('同種MODが既にある場合はそれが置換される（選択不要）', () => {
    const item = rare([
      mod('attack_speed_pct', 12),
      mod('hp_bonus', 200),
      mod('def_increased_pct', 20),
      mod('atk_bonus', 30),
    ]);
    const preview = previewEngrave(item, 'attack_speed_pct');
    expect(preview.needsReplaceChoice).toBe(false);
    expect(preview.duplicateIndex).toBe(0);

    const result = applyEngrave(item, 'attack_speed_pct');
    if (!('item' in result)) throw new Error('should succeed');
    expect(result.item.mods).toHaveLength(4);
    const as = result.item.mods!.filter((m) => m.type === 'attack_speed_pct');
    expect(as).toHaveLength(1);
    expect(as[0].engraved).toBe(true);
  });

  it('1装備につき刻印は1つまで', () => {
    const item = rare([mod('hp_bonus', 200)]);
    const first = applyEngrave(item, 'attack_speed_pct');
    if (!('item' in first)) throw new Error('should succeed');
    expect(hasEngravedMod(first.item)).toBe(true);

    const second = previewEngrave(first.item, 'critical_damage');
    expect(second.ok).toBe(false);
    expect(second.error).toBe('already');
    expect('error' in applyEngrave(first.item, 'critical_damage')).toBe(true);
  });

  it('スロットが合わない刻印は適用できない', () => {
    const armor = rare([mod('hp_bonus', 200)], 'armor');
    const preview = previewEngrave(armor, 'attack_speed_pct'); // 手袋限定
    expect(preview.ok).toBe(false);
    expect(preview.error).toBe('slot');
  });

  it('元のアイテムは変更されない（イミュータブル）', () => {
    const item = rare([mod('hp_bonus', 200)]);
    const before = item.mods!.length;
    applyEngrave(item, 'attack_speed_pct');
    expect(item.mods!.length).toBe(before);
    expect(hasEngravedMod(item)).toBe(false);
  });

  it('未知の刻印IDは適用できない', () => {
    const item = rare([mod('hp_bonus', 200)]);
    expect(previewEngrave(item, 'unknown_mod').error).toBe('unknown');
  });
});

describe('ユニーク装備の判定', () => {
  it('fixedModsを持つアイテムはユニークで、刻印できない', () => {
    const unique: Item = {
      id: 'uber_uber_double_strike_ring',
      instanceId: 'u1',
      name: 'UberUber 双撃の指輪',
      slot: 'accessory',
      atk: 200,
      def: 200,
      evasion: 0,
      mods: [mod('hp_on_hit', 200, 0)],
    };
    expect(isUniqueItem(unique)).toBe(true);
    const preview = previewEngrave(unique, 'critical_damage');
    expect(preview.ok).toBe(false);
    expect(preview.error).toBe('unique');
  });

  it('通常/レア装備はユニークではない', () => {
    expect(isUniqueItem(rare([]))).toBe(false);
  });
});
