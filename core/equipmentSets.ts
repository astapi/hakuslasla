/**
 * シミュレーション用装備セット
 * 各ダンジョン段階での最大MOD数・Tierで構成された装備セット
 */

import { Item, ItemMod, EquipmentSlot } from '../types';

// ========================================
// 型定義
// ========================================

/** 装備セット */
export interface EquipmentSet {
  name: string;
  weapon: Item | null;
  armor: Item | null;
  gloves: Item | null;
  boots: Item | null;
  accessory: Item | null;
}

/** ダンジョン別装備セット（ATK/DEF/クリ/毒 + HP回復） */
export interface DungeonEquipmentSets {
  dungeonId: string;
  recommendedLevel: number;
  maxTier: number;
  maxModCount: number;
  sets: {
    ATK: EquipmentSet;
    DEF: EquipmentSet;
    CRIT: EquipmentSet;
    POISON: EquipmentSet;
  };
}

// ========================================
// ヘルパー関数
// ========================================

let instanceCounter = 0;

function createItem(
  id: string,
  name: string,
  slot: EquipmentSlot,
  atk: number,
  def: number,
  mods: ItemMod[]
): Item {
  instanceCounter++;
  return {
    id,
    instanceId: `sim_${id}_${instanceCounter}`,
    name,
    slot,
    atk,
    def,
    mods,
  };
}

function createMod(type: ItemMod['type'], value: number, tier: number): ItemMod {
  return { type, value, tier };
}

// ========================================
// 草原 (LV1) - Tier10, MOD 0-1
// ========================================

const GRASSLAND_SETS: DungeonEquipmentSets = {
  dungeonId: 'grassland',
  recommendedLevel: 1,
  maxTier: 10,
  maxModCount: 1,
  sets: {
    ATK: {
      name: '草原ATK型',
      weapon: createItem('grassland_sword', '草原の剣', 'weapon', 5, 0, [
        createMod('atk_bonus', 2, 10),
      ]),
      armor: createItem('light_leather', '軽量レザー', 'armor', 0, 4, [
        createMod('hp_regen', 1, 10),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('copper_ring', '銅の指輪', 'accessory', 1, 1, []),
    },
    DEF: {
      name: '草原DEF型',
      weapon: createItem('grassland_sword', '草原の剣', 'weapon', 5, 0, []),
      armor: createItem('light_leather', '軽量レザー', 'armor', 0, 4, [
        createMod('def_bonus', 2, 10),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, [
        createMod('hp_regen', 1, 10),
      ]),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('traveler_amulet', '旅人の護符', 'accessory', 0, 2, []),
    },
    CRIT: {
      name: '草原クリ型',
      weapon: createItem('wolf_fang', '狼の牙', 'weapon', 6, 0, [
        createMod('critical_chance', 15, 10),
      ]),
      armor: createItem('light_leather', '軽量レザー', 'armor', 0, 4, [
        createMod('hp_regen', 1, 10),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('copper_ring', '銅の指輪', 'accessory', 1, 1, []),
    },
    POISON: {
      name: '草原毒型',
      weapon: createItem('grassland_sword', '草原の剣', 'weapon', 5, 0, [
        createMod('def_bonus', 2, 10),
      ]),
      armor: createItem('light_leather', '軽量レザー', 'armor', 0, 4, [
        createMod('hp_regen', 1, 10),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('poison_needle_ring', '毒針の指輪', 'accessory', 0, 2, [
        createMod('poison_chance', 38, 10),
      ]),
    },
  },
};

// ========================================
// 洞窟 (LV5) - Tier9, MOD 0-1
// ========================================

const CAVE_SETS: DungeonEquipmentSets = {
  dungeonId: 'cave',
  recommendedLevel: 5,
  maxTier: 9,
  maxModCount: 1,
  sets: {
    ATK: {
      name: '洞窟ATK型',
      weapon: createItem('cave_iron_sword', '洞窟の鉄剣', 'weapon', 8, 0, [
        createMod('atk_bonus', 3, 9),
      ]),
      armor: createItem('bone_shield', '骨の盾', 'armor', 0, 6, [
        createMod('hp_regen', 2, 9),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('warrior_ring', '戦士の指輪', 'accessory', 3, 1, []),
    },
    DEF: {
      name: '洞窟DEF型',
      weapon: createItem('cave_iron_sword', '洞窟の鉄剣', 'weapon', 8, 0, []),
      armor: createItem('dark_night_mantle', '闇夜のマント', 'armor', 2, 7, [
        createMod('def_bonus', 5, 9),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, [
        createMod('hp_regen', 2, 9),
      ]),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('underground_charm', '地底のお守り', 'accessory', 0, 4, []),
    },
    CRIT: {
      name: '洞窟クリ型',
      weapon: createItem('bone_sword', '骨の剣', 'weapon', 10, 0, [
        createMod('atk_bonus', 5, 9),
      ]),
      armor: createItem('bone_shield', '骨の盾', 'armor', 0, 6, [
        createMod('hp_regen', 2, 9),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, [
        createMod('critical_chance', 5, 9),
      ]),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('warrior_ring', '戦士の指輪', 'accessory', 3, 1, []),
    },
    POISON: {
      name: '洞窟毒型',
      weapon: createItem('cave_iron_sword', '洞窟の鉄剣', 'weapon', 8, 0, [
        createMod('def_bonus', 3, 9),
      ]),
      armor: createItem('bone_shield', '骨の盾', 'armor', 0, 6, [
        createMod('hp_regen', 3, 9),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('rabbit_boots', 'うさぎのブーツ', 'boots', 1, 3, []),
      accessory: createItem('poison_needle_ring', '毒針の指輪', 'accessory', 0, 3, [
        createMod('poison_chance', 38, 9),
      ]),
    },
  },
};

// ========================================
// 遺跡 (LV10) - Tier8, MOD 0-1
// ========================================

const RUINS_SETS: DungeonEquipmentSets = {
  dungeonId: 'ruins',
  recommendedLevel: 10,
  maxTier: 8,
  maxModCount: 1,
  sets: {
    ATK: {
      name: '遺跡ATK型',
      weapon: createItem('ruins_magic_sword', '遺跡の魔剣', 'weapon', 12, 0, [
        createMod('atk_bonus', 4, 8),
      ]),
      armor: createItem('cursed_robe', '呪われたローブ', 'armor', 3, 8, [
        createMod('hp_regen', 3, 8),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('gargoyle_boots', 'ガーゴイルブーツ', 'boots', 2, 6, []),
      accessory: createItem('ancient_ring', '古代の指輪', 'accessory', 4, 4, []),
    },
    DEF: {
      name: '遺跡DEF型',
      weapon: createItem('ruins_magic_sword', '遺跡の魔剣', 'weapon', 12, 0, []),
      armor: createItem('cursed_robe', '呪われたローブ', 'armor', 3, 8, [
        createMod('def_bonus', 4, 8),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, [
        createMod('hp_regen', 3, 8),
      ]),
      boots: createItem('stone_wing_boots', '石翼のブーツ', 'boots', 3, 8, [
        createMod('def_bonus', 5, 8),
      ]),
      accessory: createItem('core_stone', '心核石', 'accessory', 0, 10, [
        createMod('hp_regen', 10, 8), createMod('def_bonus', 5, 8),
      ]),
    },
    CRIT: {
      name: '遺跡クリ型',
      weapon: createItem('ruins_magic_sword', '遺跡の魔剣', 'weapon', 12, 0, [
        createMod('critical_chance', 8, 8),
      ]),
      armor: createItem('cursed_robe', '呪われたローブ', 'armor', 3, 8, [
        createMod('hp_regen', 3, 8),
      ]),
      gloves: createItem('leather_gloves', '革の手袋', 'gloves', 1, 1, []),
      boots: createItem('gargoyle_boots', 'ガーゴイルブーツ', 'boots', 2, 6, []),
      accessory: createItem('lost_grimoire', '失われた魔導書', 'accessory', 8, 0, [
        createMod('ignite_chance', 50, 8),
        createMod('poison_chance', 50, 8),
        createMod('def_bonus', 40, 8),
      ]),
    },
    POISON: {
      name: '遺跡毒型',
      weapon: createItem('ruins_magic_sword', '遺跡の魔剣', 'weapon', 12, 0, [
        createMod('def_bonus', 4, 8),
      ]),
      armor: createItem('cursed_robe', '呪われたローブ', 'armor', 3, 8, [
        createMod('hp_regen', 5, 8),
      ]),
      gloves: createItem('curse_bandage', '呪縛の包帯', 'gloves', 0, 6, [
        createMod('hp_bonus', 20, 8),
      ]),
      boots: createItem('gargoyle_boots', 'ガーゴイルブーツ', 'boots', 2, 6, []),
      accessory: createItem('poison_needle_ring', '毒針の指輪', 'accessory', 0, 4, [
        createMod('poison_chance', 38, 8),
      ]),
    },
  },
};

// ========================================
// ゴブリン砦 (LV15) - Tier7, MOD 0-3
// ========================================

const GOBLIN_FORT_SETS: DungeonEquipmentSets = {
  dungeonId: 'goblin_fort',
  recommendedLevel: 15,
  maxTier: 7,
  maxModCount: 3,
  sets: {
    ATK: {
      name: 'ゴブリン砦ATK型',
      weapon: createItem('champion_axe', 'チャンピオンアクス', 'weapon', 16, 0, [
        createMod('atk_bonus', 8, 7), createMod('critical_chance', 15, 7),
      ]),
      armor: createItem('goblin_mail', 'ゴブリンメイル', 'armor', 0, 10, [
        createMod('hp_regen', 5, 7), createMod('def_bonus', 3, 7),
      ]),
      gloves: createItem('spiked_gauntlets', '棘付きの篭手', 'gloves', 3, 4, [
        createMod('atk_bonus', 3, 7),
      ]),
      boots: createItem('raider_boots', '略奪者のブーツ', 'boots', 2, 7, []),
      accessory: createItem('tribal_ring', '蛮族の指輪', 'accessory', 5, 5, [
        createMod('atk_bonus', 3, 7),
      ]),
    },
    DEF: {
      name: 'ゴブリン砦DEF型',
      weapon: createItem('goblin_blade', 'ゴブリンの蛮刀', 'weapon', 14, 0, []),
      armor: createItem('goblin_shield', 'ゴブリンの大盾', 'armor', 0, 14, [
        createMod('def_bonus', 8, 7),
      ]),
      gloves: createItem('spiked_gauntlets', '棘付きの篭手', 'gloves', 3, 4, [
        createMod('hp_regen', 5, 7), createMod('def_bonus', 3, 7),
      ]),
      boots: createItem('raider_boots', '略奪者のブーツ', 'boots', 2, 7, [
        createMod('def_bonus', 3, 7),
      ]),
      accessory: createItem('kings_crown', 'ゴブリンキングの王冠', 'accessory', 10, 10, [
        createMod('atk_bonus', 10, 7), createMod('def_bonus', 10, 7), createMod('hp_regen', 30, 7),
      ]),
    },
    CRIT: {
      name: 'ゴブリン砦クリ型',
      weapon: createItem('champion_axe', 'チャンピオンアクス', 'weapon', 16, 0, [
        createMod('atk_bonus', 8, 7), createMod('critical_chance', 15, 7),
      ]),
      armor: createItem('goblin_mail', 'ゴブリンメイル', 'armor', 0, 10, [
        createMod('hp_regen', 5, 7),
      ]),
      gloves: createItem('spiked_gauntlets', '棘付きの篭手', 'gloves', 3, 4, [
        createMod('critical_chance', 10, 7), createMod('critical_damage', 15, 7),
      ]),
      boots: createItem('raider_boots', '略奪者のブーツ', 'boots', 2, 7, []),
      accessory: createItem('tribal_ring', '蛮族の指輪', 'accessory', 5, 5, [
        createMod('critical_chance', 10, 7), createMod('critical_damage', 20, 7),
      ]),
    },
    POISON: {
      name: 'ゴブリン砦毒型',
      weapon: createItem('shaman_staff', 'シャーマンの杖', 'weapon', 10, 0, [
        createMod('def_bonus', 5, 7), createMod('hp_regen', 5, 7),
      ]),
      armor: createItem('goblin_mail', 'ゴブリンメイル', 'armor', 0, 10, [
        createMod('hp_regen', 8, 7), createMod('hp_bonus', 30, 7),
      ]),
      gloves: createItem('curse_bandage', '呪縛の包帯', 'gloves', 0, 8, [
        createMod('def_bonus', 4, 7), createMod('hp_regen', 4, 7),
      ]),
      boots: createItem('raider_boots', '略奪者のブーツ', 'boots', 2, 7, [
        createMod('hp_bonus', 20, 7),
      ]),
      accessory: createItem('poison_needle_ring', '毒針の指輪', 'accessory', 0, 5, [
        createMod('poison_chance', 38, 7), createMod('hp_regen', 5, 7),
      ]),
    },
  },
};

// ========================================
// 魔王城 (LV20) - Tier6, MOD 0-3
// ========================================

const DEMON_CASTLE_SETS: DungeonEquipmentSets = {
  dungeonId: 'demon_castle',
  recommendedLevel: 20,
  maxTier: 6,
  maxModCount: 3,
  sets: {
    ATK: {
      name: '魔王城ATK型',
      weapon: createItem('demon_blade', '魔剣デモンブレイド', 'weapon', 18, 0, [
        createMod('atk_bonus', 8, 6), createMod('atk_increased_pct', 10, 6),
      ]),
      armor: createItem('dark_plate', '闇騎士の鎧', 'armor', 0, 14, [
        createMod('hp_regen', 8, 6), createMod('def_bonus', 5, 6),
      ]),
      gloves: createItem('dragon_gauntlets', '竜鱗の篭手', 'gloves', 4, 6, [
        createMod('atk_bonus', 5, 6),
      ]),
      boots: createItem('inferno_boots', '業火のブーツ', 'boots', 3, 10, []),
      accessory: createItem('demon_horn', 'デーモンホーン', 'accessory', 8, 8, [
        createMod('atk_bonus', 10, 6), createMod('def_bonus', 10, 6),
      ]),
    },
    DEF: {
      name: '魔王城DEF型',
      weapon: createItem('demon_blade', '魔剣デモンブレイド', 'weapon', 18, 0, []),
      armor: createItem('wyvern_scale', '飛竜の鱗鎧', 'armor', 5, 16, [
        createMod('def_bonus', 10, 6),
      ]),
      gloves: createItem('dragon_gauntlets', '竜鱗の篭手', 'gloves', 4, 6, [
        createMod('hp_regen', 8, 6), createMod('def_bonus', 5, 6),
      ]),
      boots: createItem('inferno_boots', '業火のブーツ', 'boots', 3, 10, [
        createMod('def_bonus', 5, 6),
      ]),
      accessory: createItem('demon_crown', '魔王の冠', 'accessory', 12, 12, [
        createMod('atk_bonus', 15, 6), createMod('def_bonus', 15, 6), createMod('hp_regen', 40, 6),
      ]),
    },
    CRIT: {
      name: '魔王城クリ型',
      weapon: createItem('demon_blade', '魔剣デモンブレイド', 'weapon', 18, 0, [
        createMod('critical_chance', 15, 6), createMod('critical_damage', 30, 6),
      ]),
      armor: createItem('dark_plate', '闘騎士の鎧', 'armor', 0, 14, [
        createMod('hp_regen', 8, 6),
      ]),
      gloves: createItem('dragon_gauntlets', '竜鱗の篭手', 'gloves', 4, 6, [
        createMod('critical_chance', 10, 6),
      ]),
      boots: createItem('inferno_boots', '業火のブーツ', 'boots', 3, 10, []),
      accessory: createItem('dark_grimoire', '闇の魔導書', 'accessory', 12, 0, [
        createMod('critical_chance', 30, 6),
      ]),
    },
    POISON: {
      name: '魔王城毒型',
      weapon: createItem('demon_blade', '魔剣デモンブレイド', 'weapon', 18, 0, [
        createMod('def_bonus', 8, 6), createMod('hp_regen', 8, 6),
      ]),
      armor: createItem('dark_plate', '闇騎士の鎧', 'armor', 0, 14, [
        createMod('hp_regen', 12, 6), createMod('hp_bonus', 50, 6),
      ]),
      gloves: createItem('curse_bandage', '呪縛の包帯', 'gloves', 0, 10, [
        createMod('def_bonus', 6, 6), createMod('hp_regen', 6, 6),
      ]),
      boots: createItem('inferno_boots', '業火のブーツ', 'boots', 3, 10, [
        createMod('hp_bonus', 30, 6),
      ]),
      accessory: createItem('poison_needle_ring', '毒針の指輪', 'accessory', 0, 8, [
        createMod('poison_chance', 38, 6), createMod('hp_regen', 8, 6),
      ]),
    },
  },
};

// ========================================
// 氷結の洞窟 (LV25) - Tier5, MOD 0-3
// ========================================

const ICE_CAVE_SETS: DungeonEquipmentSets = {
  dungeonId: 'ice_cave',
  recommendedLevel: 25,
  maxTier: 5,
  maxModCount: 3,
  sets: {
    ATK: {
      name: '氷結洞窟ATK型',
      weapon: createItem('frost_blade', '氷結の剣', 'weapon', 22, 0, [
        createMod('atk_bonus', 12, 5), createMod('atk_increased_pct', 15, 5),
      ]),
      armor: createItem('ice_armor', 'アイスアーマー', 'armor', 0, 18, [
        createMod('hp_regen', 10, 5), createMod('def_bonus', 8, 5),
      ]),
      gloves: createItem('frozen_gauntlets', '凍てつく篭手', 'gloves', 5, 8, [
        createMod('atk_bonus', 6, 5),
      ]),
      boots: createItem('blizzard_boots', 'ブリザードブーツ', 'boots', 4, 12, []),
      accessory: createItem('ice_crystal_ring', '氷晶の指輪', 'accessory', 8, 8, [
        createMod('atk_bonus', 6, 5),
      ]),
    },
    DEF: {
      name: '氷結洞窟DEF型',
      weapon: createItem('frost_blade', '氷結の剣', 'weapon', 22, 0, []),
      armor: createItem('yeti_fur', 'イエティの毛皮', 'armor', 0, 22, [
        createMod('def_bonus', 15, 5), createMod('hp_regen', 20, 5),
      ]),
      gloves: createItem('frozen_gauntlets', '凍てつく篭手', 'gloves', 5, 8, [
        createMod('hp_regen', 10, 5), createMod('def_bonus', 6, 5),
      ]),
      boots: createItem('blizzard_boots', 'ブリザードブーツ', 'boots', 4, 12, [
        createMod('def_bonus', 8, 5),
      ]),
      accessory: createItem('ice_crystal_ring', '氷晶の指輪', 'accessory', 8, 8, [
        createMod('def_bonus', 6, 5),
      ]),
    },
    CRIT: {
      name: '氷結洞窟クリ型',
      weapon: createItem('frost_blade', '氷結の剣', 'weapon', 22, 0, [
        createMod('critical_chance', 18, 5), createMod('critical_damage', 40, 5),
      ]),
      armor: createItem('ice_armor', 'アイスアーマー', 'armor', 0, 18, [
        createMod('hp_regen', 10, 5),
      ]),
      gloves: createItem('frozen_gauntlets', '凍てつく篭手', 'gloves', 5, 8, [
        createMod('critical_chance', 12, 5),
      ]),
      boots: createItem('blizzard_boots', 'ブリザードブーツ', 'boots', 4, 12, []),
      accessory: createItem('ice_crystal_ring', '氷晶の指輪', 'accessory', 8, 8, [
        createMod('critical_chance', 12, 5), createMod('critical_damage', 25, 5),
      ]),
    },
    POISON: {
      name: '氷結洞窟毒型',
      weapon: createItem('frozen_staff', '凍結の杖', 'weapon', 20, 0, [
        createMod('def_bonus', 10, 5), createMod('hp_regen', 10, 5),
      ]),
      armor: createItem('ice_armor', 'アイスアーマー', 'armor', 0, 18, [
        createMod('hp_regen', 15, 5), createMod('hp_bonus', 60, 5),
      ]),
      gloves: createItem('curse_bandage', '呪縛の包帯', 'gloves', 0, 12, [
        createMod('def_bonus', 8, 5), createMod('hp_regen', 8, 5),
      ]),
      boots: createItem('blizzard_boots', 'ブリザードブーツ', 'boots', 4, 12, [
        createMod('hp_bonus', 40, 5),
      ]),
      accessory: createItem('ice_crystal_ring', '氷晶の指輪', 'accessory', 0, 10, [
        createMod('poison_chance', 38, 5), createMod('hp_regen', 10, 5),
      ]),
    },
  },
};

// ========================================
// 火山 (LV30) - Tier4, MOD 1-4
// ========================================

const VOLCANO_SETS: DungeonEquipmentSets = {
  dungeonId: 'volcano',
  recommendedLevel: 30,
  maxTier: 4,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '火山ATK型',
      weapon: createItem('flame_sword', '炎剣フレイムソード', 'weapon', 32, 0, [
        createMod('atk_bonus', 15, 4),
      ]),
      armor: createItem('volcano_armor', '火山の鎧', 'armor', 0, 24, [
        createMod('hp_regen', 15, 4), createMod('def_bonus', 10, 4), createMod('hp_regen_pct', 2, 4),
      ]),
      gloves: createItem('flame_gauntlets', '炎の篭手', 'gloves', 7, 10, [
        createMod('atk_bonus', 8, 4), createMod('atk_increased_pct', 10, 4),
      ]),
      boots: createItem('ember_boots', '灼熱のブーツ', 'boots', 5, 15, [
        createMod('atk_bonus', 5, 4),
      ]),
      accessory: createItem('magma_core', 'マグマコア', 'accessory', 15, 5, [
        createMod('atk_bonus', 20, 4), createMod('critical_chance', 20, 4),
      ]),
    },
    DEF: {
      name: '火山DEF型',
      weapon: createItem('magma_blade', 'マグマブレイド', 'weapon', 28, 0, [
        createMod('hp_on_hit', 5, 4),
      ]),
      armor: createItem('volcano_armor', '火山の鎧', 'armor', 0, 24, [
        createMod('hp_regen', 15, 4), createMod('def_bonus', 12, 4), createMod('damage_reduction_pct', 5, 4),
      ]),
      gloves: createItem('flame_gauntlets', '炎の篭手', 'gloves', 7, 10, [
        createMod('def_bonus', 8, 4), createMod('hp_regen', 8, 4),
      ]),
      boots: createItem('ember_boots', '灼熱のブーツ', 'boots', 5, 15, [
        createMod('def_bonus', 8, 4),
      ]),
      accessory: createItem('fire_ruby_ring', '炎のルビー指輪', 'accessory', 10, 10, [
        createMod('hp_regen', 10, 4), createMod('def_bonus', 8, 4),
      ]),
    },
    CRIT: {
      name: '火山クリ型',
      weapon: createItem('flame_sword', '炎剣フレイムソード', 'weapon', 32, 0, [
        createMod('atk_bonus', 15, 4),
      ]),
      armor: createItem('volcano_armor', '火山の鎧', 'armor', 0, 24, [
        createMod('hp_regen', 15, 4),
      ]),
      gloves: createItem('flame_gauntlets', '炎の篭手', 'gloves', 7, 10, [
        createMod('critical_chance', 15, 4), createMod('critical_damage', 35, 4),
      ]),
      boots: createItem('ember_boots', '灼熱のブーツ', 'boots', 5, 15, []),
      accessory: createItem('magma_core', 'マグマコア', 'accessory', 15, 5, [
        createMod('atk_bonus', 20, 4), createMod('critical_chance', 20, 4),
      ]),
    },
    POISON: {
      name: '火山毒型',
      weapon: createItem('magma_blade', 'マグマブレイド', 'weapon', 28, 0, [
        createMod('def_bonus', 12, 4), createMod('hp_regen', 12, 4),
      ]),
      armor: createItem('volcano_armor', '火山の鎧', 'armor', 0, 24, [
        createMod('hp_regen', 20, 4), createMod('hp_bonus', 80, 4), createMod('hp_regen_pct', 2, 4),
      ]),
      gloves: createItem('flame_gauntlets', '炎の篭手', 'gloves', 0, 14, [
        createMod('def_bonus', 10, 4), createMod('hp_regen', 10, 4),
      ]),
      boots: createItem('ember_boots', '灼熱のブーツ', 'boots', 5, 15, [
        createMod('hp_bonus', 50, 4),
      ]),
      accessory: createItem('fire_ruby_ring', '炎のルビー指輪', 'accessory', 0, 12, [
        createMod('poison_chance', 38, 4), createMod('hp_regen', 12, 4),
      ]),
    },
  },
};

// ========================================
// 深淵の森 (LV35) - Tier3, MOD 1-4
// ========================================

const DARK_FOREST_SETS: DungeonEquipmentSets = {
  dungeonId: 'dark_forest',
  recommendedLevel: 35,
  maxTier: 3,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '深淵の森ATK型',
      weapon: createItem('shadow_blade', 'シャドウブレイド', 'weapon', 38, 0, [
        createMod('atk_bonus', 20, 3), createMod('atk_increased_pct', 20, 3),
      ]),
      armor: createItem('dark_bark_armor', '暗黒樹皮の鎧', 'armor', 0, 32, [
        createMod('hp_regen', 20, 3), createMod('def_bonus', 15, 3),
      ]),
      gloves: createItem('nightmare_gauntlets', '悪夢の篭手', 'gloves', 10, 14, [
        createMod('atk_bonus', 12, 3), createMod('atk_increased_pct', 12, 3),
      ]),
      boots: createItem('forest_walker_boots', '森歩きのブーツ', 'boots', 7, 20, [
        createMod('atk_bonus', 8, 3),
      ]),
      accessory: createItem('chimera_fang', 'キメラの牙', 'accessory', 20, 10, [
        createMod('atk_bonus', 25, 3), createMod('critical_chance', 25, 3),
      ]),
    },
    DEF: {
      name: '深淵の森DEF型',
      weapon: createItem('shadow_blade', 'シャドウブレイド', 'weapon', 38, 0, [
        createMod('hp_on_hit', 8, 3),
      ]),
      armor: createItem('dark_bark_armor', '暗黒樹皮の鎧', 'armor', 0, 32, [
        createMod('hp_regen', 25, 3), createMod('def_bonus', 18, 3), createMod('damage_reduction_pct', 8, 3),
      ]),
      gloves: createItem('nightmare_gauntlets', '悪夢の篭手', 'gloves', 10, 14, [
        createMod('def_bonus', 12, 3), createMod('hp_regen', 12, 3),
      ]),
      boots: createItem('forest_walker_boots', '森歩きのブーツ', 'boots', 7, 20, [
        createMod('def_bonus', 12, 3),
      ]),
      accessory: createItem('cursed_eye_ring', '呪眼の指輪', 'accessory', 14, 14, [
        createMod('hp_regen', 15, 3), createMod('def_bonus', 12, 3),
      ]),
    },
    CRIT: {
      name: '深淵の森クリ型',
      weapon: createItem('shadow_blade', 'シャドウブレイド', 'weapon', 38, 0, [
        createMod('critical_chance', 22, 3), createMod('critical_damage', 50, 3),
      ]),
      armor: createItem('dark_bark_armor', '暗黒樹皮の鎧', 'armor', 0, 32, [
        createMod('hp_regen', 20, 3),
      ]),
      gloves: createItem('nightmare_gauntlets', '悪夢の篭手', 'gloves', 10, 14, [
        createMod('critical_chance', 18, 3), createMod('critical_damage', 40, 3),
      ]),
      boots: createItem('forest_walker_boots', '森歩きのブーツ', 'boots', 7, 20, []),
      accessory: createItem('chimera_fang', 'キメラの牙', 'accessory', 20, 10, [
        createMod('atk_bonus', 25, 3), createMod('critical_chance', 25, 3),
      ]),
    },
    POISON: {
      name: '深淵の森毒型',
      weapon: createItem('cursed_branch', '呪いの枝', 'weapon', 35, 0, [
        createMod('def_bonus', 15, 3), createMod('hp_regen', 15, 3),
      ]),
      armor: createItem('dark_bark_armor', '暗黒樹皮の鎧', 'armor', 0, 32, [
        createMod('hp_regen', 25, 3), createMod('hp_bonus', 100, 3), createMod('hp_regen_pct', 3, 3),
      ]),
      gloves: createItem('nightmare_gauntlets', '悪夢の篭手', 'gloves', 0, 18, [
        createMod('def_bonus', 12, 3), createMod('hp_regen', 12, 3),
      ]),
      boots: createItem('forest_walker_boots', '森歩きのブーツ', 'boots', 7, 20, [
        createMod('hp_bonus', 60, 3),
      ]),
      accessory: createItem('cursed_eye_ring', '呪眼の指輪', 'accessory', 0, 16, [
        createMod('poison_chance', 38, 3), createMod('hp_regen', 15, 3),
      ]),
    },
  },
};

// ========================================
// 天空の塔 (LV40) - Tier2, MOD 1-4
// ========================================

const SKY_TOWER_SETS: DungeonEquipmentSets = {
  dungeonId: 'sky_tower',
  recommendedLevel: 40,
  maxTier: 2,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '天空の塔ATK型',
      weapon: createItem('sky_blade', '天空剣', 'weapon', 50, 0, [
        createMod('atk_bonus', 30, 2), createMod('atk_increased_pct', 25, 2),
      ]),
      armor: createItem('cloud_armor', '雲海の鎧', 'armor', 0, 42, [
        createMod('hp_regen', 30, 2), createMod('def_bonus', 20, 2),
      ]),
      gloves: createItem('storm_gauntlets', '嵐の篭手', 'gloves', 14, 18, [
        createMod('atk_bonus', 18, 2), createMod('atk_increased_pct', 15, 2),
      ]),
      boots: createItem('wind_walker_boots', '風渡りのブーツ', 'boots', 10, 26, [
        createMod('atk_bonus', 12, 2),
      ]),
      accessory: createItem('thunder_feather', '雷鳥の羽', 'accessory', 25, 15, [
        createMod('critical_chance', 35, 2), createMod('atk_bonus', 20, 2),
      ]),
    },
    DEF: {
      name: '天空の塔DEF型',
      weapon: createItem('sky_blade', '天空剣', 'weapon', 50, 0, [
        createMod('hp_on_hit', 10, 2),
      ]),
      armor: createItem('cloud_armor', '雲海の鎧', 'armor', 0, 42, [
        createMod('hp_regen', 35, 2), createMod('def_bonus', 25, 2), createMod('damage_reduction_pct', 10, 2),
      ]),
      gloves: createItem('storm_gauntlets', '嵐の篭手', 'gloves', 14, 18, [
        createMod('def_bonus', 18, 2), createMod('hp_regen', 18, 2),
      ]),
      boots: createItem('wind_walker_boots', '風渡りのブーツ', 'boots', 10, 26, [
        createMod('def_bonus', 18, 2),
      ]),
      accessory: createItem('giant_belt', '巨人の帯', 'accessory', 15, 30, [
        createMod('def_bonus', 30, 2), createMod('hp_regen', 40, 2),
      ]),
    },
    CRIT: {
      name: '天空の塔クリ型',
      weapon: createItem('sky_blade', '天空剣', 'weapon', 50, 0, [
        createMod('critical_chance', 28, 2), createMod('critical_damage', 60, 2),
      ]),
      armor: createItem('cloud_armor', '雲海の鎧', 'armor', 0, 42, [
        createMod('hp_regen', 30, 2),
      ]),
      gloves: createItem('storm_gauntlets', '嵐の篭手', 'gloves', 14, 18, [
        createMod('critical_chance', 22, 2), createMod('critical_damage', 50, 2),
      ]),
      boots: createItem('wind_walker_boots', '風渡りのブーツ', 'boots', 10, 26, []),
      accessory: createItem('thunder_feather', '雷鳥の羽', 'accessory', 25, 15, [
        createMod('critical_chance', 35, 2), createMod('atk_bonus', 20, 2),
      ]),
    },
    POISON: {
      name: '天空の塔毒型',
      weapon: createItem('sky_blade', '天空剣', 'weapon', 50, 0, [
        createMod('def_bonus', 20, 2), createMod('hp_regen', 20, 2),
      ]),
      armor: createItem('cloud_armor', '雲海の鎧', 'armor', 0, 42, [
        createMod('hp_regen', 35, 2), createMod('hp_bonus', 120, 2), createMod('hp_regen_pct', 4, 2),
      ]),
      gloves: createItem('storm_gauntlets', '嵐の篭手', 'gloves', 0, 24, [
        createMod('def_bonus', 16, 2), createMod('hp_regen', 16, 2),
      ]),
      boots: createItem('wind_walker_boots', '風渡りのブーツ', 'boots', 10, 26, [
        createMod('hp_bonus', 80, 2),
      ]),
      accessory: createItem('sky_sapphire_ring', '蒼空のサファイア指輪', 'accessory', 0, 20, [
        createMod('poison_chance', 38, 2), createMod('hp_regen', 20, 2),
      ]),
    },
  },
};

// ========================================
// 地獄の門 (LV50) - Tier1, MOD 2-4
// ========================================

const HELL_GATE_SETS: DungeonEquipmentSets = {
  dungeonId: 'hell_gate',
  recommendedLevel: 50,
  maxTier: 1,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '地獄の門ATK型',
      weapon: createItem('balrog_whip', 'バルログの鞭', 'weapon', 75, 0, [
        createMod('atk_bonus', 35, 1), createMod('critical_chance', 30, 1),
      ]),
      armor: createItem('infernal_plate', '煉獄の鎧', 'armor', 0, 56, [
        createMod('hp_regen', 40, 1), createMod('def_bonus', 30, 1),
      ]),
      gloves: createItem('demon_gauntlets', '魔人の篭手', 'gloves', 20, 24, [
        createMod('atk_bonus', 25, 1), createMod('atk_increased_pct', 20, 1),
      ]),
      boots: createItem('hellwalker_boots', '地獄歩きのブーツ', 'boots', 14, 35, [
        createMod('atk_bonus', 18, 1),
      ]),
      accessory: createItem('infernal_ruby_ring', '煉獄のルビー指輪', 'accessory', 25, 25, [
        createMod('atk_bonus', 20, 1), createMod('atk_increased_pct', 15, 1),
      ]),
    },
    DEF: {
      name: '地獄の門DEF型',
      weapon: createItem('hellfire_blade', '獄炎剣', 'weapon', 68, 0, [
        createMod('hp_on_hit', 12, 1),
      ]),
      armor: createItem('infernal_armor', 'インファーナルアーマー', 'armor', 10, 65, [
        createMod('def_bonus', 40, 1), createMod('hp_regen', 50, 1),
      ]),
      gloves: createItem('demon_gauntlets', '魔人の篭手', 'gloves', 20, 24, [
        createMod('def_bonus', 25, 1), createMod('hp_regen', 25, 1),
      ]),
      boots: createItem('hellwalker_boots', '地獄歩きのブーツ', 'boots', 14, 35, [
        createMod('def_bonus', 25, 1), createMod('damage_reduction_pct', 12, 1),
      ]),
      accessory: createItem('infernal_ruby_ring', '煉獄のルビー指輪', 'accessory', 25, 25, [
        createMod('hp_regen', 30, 1), createMod('def_bonus', 20, 1),
      ]),
    },
    CRIT: {
      name: '地獄の門クリ型',
      weapon: createItem('balrog_whip', 'バルログの鞭', 'weapon', 75, 0, [
        createMod('atk_bonus', 35, 1), createMod('critical_chance', 30, 1),
      ]),
      armor: createItem('infernal_plate', '煉獄の鎧', 'armor', 0, 56, [
        createMod('hp_regen', 40, 1),
      ]),
      gloves: createItem('demon_gauntlets', '魔人の篭手', 'gloves', 20, 24, [
        createMod('critical_chance', 28, 1), createMod('critical_damage', 65, 1),
      ]),
      boots: createItem('hellwalker_boots', '地獄歩きのブーツ', 'boots', 14, 35, []),
      accessory: createItem('infernal_ruby_ring', '煉獄のルビー指輪', 'accessory', 25, 25, [
        createMod('critical_chance', 25, 1), createMod('critical_damage', 55, 1),
      ]),
    },
    POISON: {
      name: '地獄の門毒型',
      weapon: createItem('hellfire_blade', '獄炎剣', 'weapon', 68, 0, [
        createMod('def_bonus', 25, 1), createMod('hp_regen', 25, 1),
      ]),
      armor: createItem('infernal_plate', '煉獄の鎧', 'armor', 0, 56, [
        createMod('hp_regen', 50, 1), createMod('hp_bonus', 150, 1), createMod('hp_regen_pct', 5, 1),
      ]),
      gloves: createItem('demon_gauntlets', '魔人の篭手', 'gloves', 0, 30, [
        createMod('def_bonus', 20, 1), createMod('hp_regen', 20, 1),
      ]),
      boots: createItem('hellwalker_boots', '地獄歩きのブーツ', 'boots', 14, 35, [
        createMod('hp_bonus', 100, 1),
      ]),
      accessory: createItem('infernal_ruby_ring', '煉獄のルビー指輪', 'accessory', 0, 28, [
        createMod('poison_chance', 38, 1), createMod('hp_regen', 25, 1),
      ]),
    },
  },
};

// ========================================
// 竜の巣穴 (LV60) - Tier1, MOD 2-4
// ========================================

const DRAGON_NEST_SETS: DungeonEquipmentSets = {
  dungeonId: 'dragon_nest',
  recommendedLevel: 60,
  maxTier: 1,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '竜の巣穴ATK型',
      weapon: createItem('dragon_slayer', '竜殺しの剣', 'weapon', 90, 0, [
        createMod('atk_bonus', 45, 1), createMod('atk_increased_pct', 30, 1),
      ]),
      armor: createItem('fire_dragon_scale', '炎竜の鱗', 'armor', 15, 80, [
        createMod('def_bonus', 50, 1), createMod('atk_bonus', 30, 1),
      ]),
      gloves: createItem('dragon_claw_gauntlets', '竜爪の篭手', 'gloves', 28, 32, [
        createMod('atk_bonus', 30, 1), createMod('atk_increased_pct', 25, 1),
      ]),
      boots: createItem('dragon_hide_boots', '竜皮のブーツ', 'boots', 18, 48, [
        createMod('atk_bonus', 22, 1), createMod('hp_regen', 30, 1),
      ]),
      accessory: createItem('dragon_eye_ring', '竜眼の指輪', 'accessory', 35, 35, [
        createMod('atk_bonus', 28, 1), createMod('critical_chance', 25, 1),
      ]),
    },
    DEF: {
      name: '竜の巣穴DEF型',
      weapon: createItem('dragon_slayer', '竜殺しの剣', 'weapon', 90, 0, [
        createMod('hp_on_hit', 15, 1),
      ]),
      armor: createItem('ice_dragon_scale', '氷竜の鱗', 'armor', 10, 90, [
        createMod('def_bonus', 60, 1), createMod('hp_regen', 60, 1),
      ]),
      gloves: createItem('dragon_claw_gauntlets', '竜爪の篭手', 'gloves', 28, 32, [
        createMod('def_bonus', 35, 1), createMod('hp_regen', 35, 1),
      ]),
      boots: createItem('dragon_hide_boots', '竜皮のブーツ', 'boots', 18, 48, [
        createMod('def_bonus', 35, 1), createMod('damage_reduction_pct', 15, 1),
      ]),
      accessory: createItem('dragon_heart', '竜の心臓', 'accessory', 40, 40, [
        createMod('hp_regen', 80, 1), createMod('atk_bonus', 30, 1), createMod('def_bonus', 30, 1),
      ]),
    },
    CRIT: {
      name: '竜の巣穴クリ型',
      weapon: createItem('dragon_slayer', '竜殺しの剣', 'weapon', 90, 0, [
        createMod('critical_chance', 35, 1), createMod('critical_damage', 80, 1),
      ]),
      armor: createItem('dragon_scale_armor', '竜鱗の鎧', 'armor', 0, 75, [
        createMod('hp_regen', 50, 1),
      ]),
      gloves: createItem('dragon_claw_gauntlets', '竜爪の篭手', 'gloves', 28, 32, [
        createMod('critical_chance', 32, 1), createMod('critical_damage', 75, 1),
      ]),
      boots: createItem('dragon_hide_boots', '竜皮のブーツ', 'boots', 18, 48, []),
      accessory: createItem('dragon_eye_ring', '竜眼の指輪', 'accessory', 35, 35, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 70, 1),
      ]),
    },
    POISON: {
      name: '竜の巣穴毒型',
      weapon: createItem('dragon_slayer', '竜殺しの剣', 'weapon', 90, 0, [
        createMod('def_bonus', 35, 1), createMod('hp_regen', 35, 1),
      ]),
      armor: createItem('dragon_scale_armor', '竜鱗の鎧', 'armor', 0, 75, [
        createMod('hp_regen', 60, 1), createMod('hp_bonus', 200, 1), createMod('hp_regen_pct', 6, 1),
      ]),
      gloves: createItem('dragon_claw_gauntlets', '竜爪の篭手', 'gloves', 0, 40, [
        createMod('def_bonus', 28, 1), createMod('hp_regen', 28, 1),
      ]),
      boots: createItem('dragon_hide_boots', '竜皮のブーツ', 'boots', 18, 48, [
        createMod('hp_bonus', 130, 1),
      ]),
      accessory: createItem('dragon_eye_ring', '竜眼の指輪', 'accessory', 0, 38, [
        createMod('poison_chance', 38, 1), createMod('hp_regen', 35, 1),
      ]),
    },
  },
};

// ========================================
// 神域の神殿 (LV70) - Tier1, MOD 2-4
// ========================================

const SACRED_TEMPLE_SETS: DungeonEquipmentSets = {
  dungeonId: 'sacred_temple',
  recommendedLevel: 70,
  maxTier: 1,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '神域の神殿ATK型',
      weapon: createItem('holy_blade', '聖剣', 'weapon', 120, 0, [
        createMod('atk_bonus', 60, 1), createMod('atk_increased_pct', 40, 1),
      ]),
      armor: createItem('divine_armor', '神聖なる鎧', 'armor', 0, 100, [
        createMod('hp_regen', 60, 1), createMod('def_bonus', 50, 1),
      ]),
      gloves: createItem('seraph_gauntlets', '熾天使の篭手', 'gloves', 38, 44, [
        createMod('atk_bonus', 40, 1), createMod('atk_increased_pct', 30, 1),
      ]),
      boots: createItem('divine_boots', '神のブーツ', 'boots', 25, 65, [
        createMod('atk_bonus', 30, 1), createMod('hp_regen', 40, 1),
      ]),
      accessory: createItem('holy_diamond_ring', '聖なるダイヤ指輪', 'accessory', 48, 48, [
        createMod('atk_bonus', 38, 1), createMod('critical_chance', 30, 1),
      ]),
    },
    DEF: {
      name: '神域の神殿DEF型',
      weapon: createItem('holy_blade', '聖剣', 'weapon', 120, 0, [
        createMod('hp_on_hit', 18, 1),
      ]),
      armor: createItem('holy_dragon_scale', '聖竜の鱗', 'armor', 20, 120, [
        createMod('def_bonus', 80, 1), createMod('hp_regen', 80, 1),
      ]),
      gloves: createItem('seraph_gauntlets', '熾天使の篭手', 'gloves', 38, 44, [
        createMod('def_bonus', 45, 1), createMod('hp_regen', 45, 1),
      ]),
      boots: createItem('divine_boots', '神のブーツ', 'boots', 25, 65, [
        createMod('def_bonus', 45, 1), createMod('damage_reduction_pct', 18, 1),
      ]),
      accessory: createItem('holy_feather', '熾天使の羽', 'accessory', 50, 50, [
        createMod('hp_regen', 100, 1), createMod('critical_chance', 40, 1),
      ]),
    },
    CRIT: {
      name: '神域の神殿クリ型',
      weapon: createItem('holy_blade', '聖剣', 'weapon', 120, 0, [
        createMod('critical_chance', 40, 1), createMod('critical_damage', 100, 1),
      ]),
      armor: createItem('divine_armor', '神聖なる鎧', 'armor', 0, 100, [
        createMod('hp_regen', 60, 1),
      ]),
      gloves: createItem('seraph_gauntlets', '熾天使の篭手', 'gloves', 38, 44, [
        createMod('critical_chance', 38, 1), createMod('critical_damage', 90, 1),
      ]),
      boots: createItem('divine_boots', '神のブーツ', 'boots', 25, 65, []),
      accessory: createItem('holy_feather', '熾天使の羽', 'accessory', 50, 50, [
        createMod('hp_regen', 100, 1), createMod('critical_chance', 40, 1),
      ]),
    },
    POISON: {
      name: '神域の神殿毒型',
      weapon: createItem('holy_blade', '聖剣', 'weapon', 120, 0, [
        createMod('def_bonus', 45, 1), createMod('hp_regen', 45, 1),
      ]),
      armor: createItem('divine_armor', '神聖なる鎧', 'armor', 0, 100, [
        createMod('hp_regen', 80, 1), createMod('hp_bonus', 250, 1), createMod('hp_regen_pct', 8, 1),
      ]),
      gloves: createItem('seraph_gauntlets', '熾天使の篭手', 'gloves', 0, 55, [
        createMod('def_bonus', 35, 1), createMod('hp_regen', 35, 1),
      ]),
      boots: createItem('divine_boots', '神のブーツ', 'boots', 25, 65, [
        createMod('hp_bonus', 160, 1),
      ]),
      accessory: createItem('holy_diamond_ring', '聖なるダイヤ指輪', 'accessory', 0, 50, [
        createMod('poison_chance', 38, 1), createMod('hp_regen', 45, 1),
      ]),
    },
  },
};

// ========================================
// 混沌の領域 (LV80) - Tier1, MOD 2-4
// ========================================

const CHAOS_REALM_SETS: DungeonEquipmentSets = {
  dungeonId: 'chaos_realm',
  recommendedLevel: 80,
  maxTier: 1,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '混沌の領域ATK型',
      weapon: createItem('chaos_blade', '混沌の剣', 'weapon', 160, 0, [
        createMod('atk_bonus', 75, 1), createMod('atk_increased_pct', 45, 1),
      ]),
      armor: createItem('void_armor', '虚無の鎧', 'armor', 0, 135, [
        createMod('hp_regen', 50, 1), createMod('def_bonus', 50, 1),
      ]),
      gloves: createItem('chaos_gauntlets', '混沌の篭手', 'gloves', 52, 60, [
        createMod('atk_bonus', 50, 1), createMod('attack_speed_pct', 30, 1),
      ]),
      boots: createItem('void_boots', '虚無のブーツ', 'boots', 35, 88, [
        createMod('atk_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      accessory: createItem('chaos_crystal_ring', '混沌水晶の指輪', 'accessory', 70, 70, [
        createMod('atk_bonus', 50, 1), createMod('critical_chance', 30, 1),
      ]),
    },
    DEF: {
      name: '混沌の領域DEF型',
      weapon: createItem('chaos_blade', '混沌の剣', 'weapon', 160, 0, [
        createMod('def_bonus', 50, 1),
      ]),
      armor: createItem('void_armor', '虚無の鎧', 'armor', 0, 135, [
        createMod('def_bonus', 75, 1), createMod('hp_regen', 50, 1),
      ]),
      gloves: createItem('chaos_gauntlets', '混沌の篭手', 'gloves', 52, 60, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      boots: createItem('void_boots', '虚無のブーツ', 'boots', 35, 88, [
        createMod('def_bonus', 50, 1), createMod('damage_reduction_pct', 5, 1),
      ]),
      accessory: createItem('chaos_crystal_ring', '混沌水晶の指輪', 'accessory', 65, 65, [
        createMod('hp_regen', 50, 1), createMod('def_bonus', 50, 1),
      ]),
    },
    CRIT: {
      name: '混沌の領域クリ型',
      weapon: createItem('chaos_blade', '混沌の剣', 'weapon', 160, 0, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
      armor: createItem('void_armor', '虚無の鎧', 'armor', 0, 135, [
        createMod('hp_regen', 50, 1),
      ]),
      gloves: createItem('chaos_gauntlets', '混沌の篭手', 'gloves', 52, 60, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
      boots: createItem('void_boots', '虚無のブーツ', 'boots', 35, 88, [
        createMod('hp_regen', 50, 1),
      ]),
      accessory: createItem('chaos_crystal_ring', '混沌水晶の指輪', 'accessory', 65, 65, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
    },
    POISON: {
      name: '混沌の領域毒型',
      weapon: createItem('chaos_blade', '混沌の剣', 'weapon', 160, 0, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      armor: createItem('void_armor', '虚無の鎧', 'armor', 0, 135, [
        createMod('hp_regen', 50, 1), createMod('hp_bonus', 300, 1), createMod('hp_regen_pct', 5, 1),
      ]),
      gloves: createItem('chaos_gauntlets', '混沌の篭手', 'gloves', 0, 75, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      boots: createItem('void_boots', '虚無のブーツ', 'boots', 35, 88, [
        createMod('hp_bonus', 300, 1),
      ]),
      accessory: createItem('chaos_crystal_ring', '混沌水晶の指輪', 'accessory', 0, 68, [
        createMod('poison_chance', 50, 1), createMod('hp_regen', 50, 1),
      ]),
    },
  },
};

// ========================================
// 終焉の地 (LV99) - Tier1, MOD 2-4
// ========================================

const FINAL_LAND_SETS: DungeonEquipmentSets = {
  dungeonId: 'final_land',
  recommendedLevel: 99,
  maxTier: 1,
  maxModCount: 4,
  sets: {
    ATK: {
      name: '終焉の地ATK型',
      weapon: createItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
        createMod('atk_bonus', 75, 1), createMod('atk_increased_pct', 45, 1),
      ]),
      armor: createItem('end_armor', '終末の鎧', 'armor', 0, 180, [
        createMod('hp_regen', 50, 1), createMod('def_bonus', 50, 1),
      ]),
      gloves: createItem('titan_gauntlets', '泰坦の篭手', 'gloves', 70, 80, [
        createMod('atk_bonus', 50, 1), createMod('attack_speed_pct', 30, 1),
      ]),
      boots: createItem('end_walker_boots', '終末を歩む者のブーツ', 'boots', 48, 120, [
        createMod('atk_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      accessory: createItem('oblivion_ring', '忘却の指輪', 'accessory', 88, 88, [
        createMod('atk_bonus', 50, 1), createMod('critical_chance', 30, 1),
      ]),
    },
    DEF: {
      name: '終焉の地DEF型',
      weapon: createItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
        createMod('def_bonus', 50, 1),
      ]),
      armor: createItem('end_armor', '終末の鎧', 'armor', 0, 180, [
        createMod('def_bonus', 75, 1), createMod('hp_regen', 50, 1), createMod('damage_reduction_pct', 5, 1),
      ]),
      gloves: createItem('titan_gauntlets', '泰坦の篭手', 'gloves', 70, 80, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      boots: createItem('end_walker_boots', '終末を歩む者のブーツ', 'boots', 48, 120, [
        createMod('def_bonus', 50, 1), createMod('damage_reduction_pct', 5, 1),
      ]),
      accessory: createItem('oblivion_ring', '忘却の指輪', 'accessory', 88, 88, [
        createMod('hp_regen', 50, 1), createMod('def_bonus', 50, 1),
      ]),
    },
    CRIT: {
      name: '終焉の地クリ型',
      weapon: createItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
      armor: createItem('end_armor', '終末の鎧', 'armor', 0, 180, [
        createMod('hp_regen', 50, 1),
      ]),
      gloves: createItem('titan_gauntlets', '泰坦の篭手', 'gloves', 70, 80, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
      boots: createItem('end_walker_boots', '終末を歩む者のブーツ', 'boots', 48, 120, [
        createMod('hp_regen', 50, 1),
      ]),
      accessory: createItem('oblivion_ring', '忘却の指輪', 'accessory', 88, 88, [
        createMod('critical_chance', 30, 1), createMod('critical_damage', 100, 1),
      ]),
    },
    POISON: {
      name: '終焉の地毒型',
      weapon: createItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      armor: createItem('end_armor', '終末の鎧', 'armor', 0, 180, [
        createMod('hp_regen', 50, 1), createMod('hp_bonus', 300, 1), createMod('hp_regen_pct', 5, 1),
      ]),
      gloves: createItem('titan_gauntlets', '泰坦の篭手', 'gloves', 70, 80, [
        createMod('def_bonus', 50, 1), createMod('hp_regen', 50, 1),
      ]),
      boots: createItem('end_walker_boots', '終末を歩む者のブーツ', 'boots', 48, 120, [
        createMod('hp_bonus', 300, 1),
      ]),
      accessory: createItem('oblivion_ring', '忘却の指輪', 'accessory', 88, 88, [
        createMod('poison_chance', 50, 1), createMod('hp_regen', 50, 1),
      ]),
    },
  },
};

// ========================================
// エクスポート
// ========================================

/** 全ダンジョンの装備セット */
export const DUNGEON_EQUIPMENT_SETS: Record<string, DungeonEquipmentSets> = {
  grassland: GRASSLAND_SETS,
  cave: CAVE_SETS,
  ruins: RUINS_SETS,
  goblin_fort: GOBLIN_FORT_SETS,
  demon_castle: DEMON_CASTLE_SETS,
  ice_cave: ICE_CAVE_SETS,
  volcano: VOLCANO_SETS,
  dark_forest: DARK_FOREST_SETS,
  sky_tower: SKY_TOWER_SETS,
  hell_gate: HELL_GATE_SETS,
  dragon_nest: DRAGON_NEST_SETS,
  sacred_temple: SACRED_TEMPLE_SETS,
  chaos_realm: CHAOS_REALM_SETS,
  final_land: FINAL_LAND_SETS,
};

/** 装備セットタイプ */
export type EquipmentSetType = 'ATK' | 'DEF' | 'CRIT' | 'POISON';

/**
 * ダンジョン別装備セットを取得
 */
export function getDungeonEquipmentSet(
  dungeonId: string,
  setType: EquipmentSetType
): EquipmentSet | undefined {
  const dungeonSets = DUNGEON_EQUIPMENT_SETS[dungeonId];
  if (!dungeonSets) return undefined;
  return dungeonSets.sets[setType];
}

/**
 * レベルに応じた装備セットを取得
 * 推奨レベル以下で最も高いダンジョンの装備を返す
 */
export function getEquipmentSetForLevel(
  level: number,
  setType: EquipmentSetType
): EquipmentSet | undefined {
  const sortedDungeons = Object.values(DUNGEON_EQUIPMENT_SETS)
    .sort((a, b) => b.recommendedLevel - a.recommendedLevel);

  for (const dungeon of sortedDungeons) {
    if (dungeon.recommendedLevel <= level) {
      return dungeon.sets[setType];
    }
  }

  // レベル1未満の場合は草原の装備
  return DUNGEON_EQUIPMENT_SETS.grassland?.sets[setType];
}

/**
 * 装備セットからCombinedModEffects用のMOD配列を抽出
 */
export function extractModsFromEquipmentSet(set: EquipmentSet): ItemMod[] {
  const mods: ItemMod[] = [];
  const items = [set.weapon, set.armor, set.gloves, set.boots, set.accessory];

  for (const item of items) {
    if (item) {
      mods.push(...item.mods);
    }
  }

  return mods;
}

// ========================================
// ランダムMOD生成（シミュレーション用）
// ========================================

import modsData from '../data/json/mods.json';
import dungeonsData from '../data/json/dungeons.json';
import { ModConfig, ModTierRange, ModCountRange } from '../types';

const modConfigs: ModConfig[] = modsData.modConfigs as ModConfig[];

interface DungeonModSettings {
  modTierRange: ModTierRange;
  modCountRange: ModCountRange;
}

/**
 * ダンジョンのMOD設定を取得
 */
function getDungeonModSettings(dungeonId: string): DungeonModSettings {
  const dungeon = (dungeonsData.dungeons as Record<string, {
    modTierRange?: ModTierRange;
    modCountRange?: ModCountRange;
  }>)[dungeonId];

  return {
    modTierRange: dungeon?.modTierRange ?? { minTier: 10, maxTier: 1 },
    modCountRange: dungeon?.modCountRange ?? { min: 2, max: 4 },
  };
}

/**
 * MOD設定から利用可能なtierリストを取得（スロット考慮）
 */
function getAvailableTiersForSlot(config: ModConfig, slot?: EquipmentSlot): number[] {
  const tiers = (slot && config.slotTiers?.[slot]) || config.tiers;
  return Object.keys(tiers).map(t => parseInt(t, 10));
}

/**
 * スロットに応じたtier設定を取得
 */
function getTierConfigForSlot(config: ModConfig, slot?: EquipmentSlot): Record<string, { min: number; max: number }> {
  return (slot && config.slotTiers?.[slot]) || config.tiers;
}

/**
 * tier範囲内でランダムに値を取得
 */
function randomValueInRange(min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * シミュレーション用：ランダムMODを生成
 * @param count 生成するMOD数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param slot アイテムスロット（スロット制限MOD用）
 */
export function generateSimulationMods(
  count: number,
  dungeonId: string,
  slot: EquipmentSlot
): ItemMod[] {
  const mods: ItemMod[] = [];
  const { modTierRange } = getDungeonModSettings(dungeonId);

  // このスロットとダンジョンで出現可能なMODをフィルタリング
  const availableConfigs = modConfigs.filter(config => {
    // スロット制限チェック
    if (config.slots && !config.slots.includes(slot)) {
      return false;
    }
    // tier範囲チェック
    const modTiers = getAvailableTiersForSlot(config, slot);
    return modTiers.some(t => t <= modTierRange.minTier && t >= modTierRange.maxTier);
  });

  if (availableConfigs.length === 0) {
    return mods;
  }

  const totalWeight = availableConfigs.reduce((sum, config) => sum + config.weight, 0);
  const usedTypes = new Set<string>();

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    let random = Math.random() * totalWeight;
    let selectedConfig: ModConfig | null = null;

    for (const config of availableConfigs) {
      random -= config.weight;
      if (random <= 0) {
        selectedConfig = config;
        break;
      }
    }

    if (!selectedConfig || usedTypes.has(selectedConfig.type)) {
      continue; // 同じタイプのMODは1つまで
    }

    usedTypes.add(selectedConfig.type);

    // 有効なtierリストを取得
    const modTiers = getAvailableTiersForSlot(selectedConfig, slot);
    const validTiers = modTiers.filter(t => t <= modTierRange.minTier && t >= modTierRange.maxTier);

    if (validTiers.length === 0) continue;

    // 均等確率でtierを選択
    const tier = validTiers[Math.floor(Math.random() * validTiers.length)];

    // tierの値範囲から値を取得
    const tierConfigs = getTierConfigForSlot(selectedConfig, slot);
    const tierConfig = tierConfigs[tier.toString()];
    const value = randomValueInRange(tierConfig.min, tierConfig.max);

    mods.push({
      type: selectedConfig.type as ItemMod['type'],
      value,
      tier,
    });
  }

  return mods;
}

/**
 * シミュレーション用：ランダムMOD付きアイテムを生成
 */
function createRandomModItem(
  id: string,
  name: string,
  slot: EquipmentSlot,
  atk: number,
  def: number,
  dungeonId: string
): Item {
  const { modCountRange } = getDungeonModSettings(dungeonId);
  const modCount = randomValueInRange(modCountRange.min, modCountRange.max);
  const mods = generateSimulationMods(modCount, dungeonId, slot);

  instanceCounter++;
  return {
    id,
    instanceId: `sim_random_${id}_${instanceCounter}`,
    name,
    slot,
    atk,
    def,
    mods,
  };
}

/**
 * ランダムMOD装備セットの基本ステータス定義
 */
interface BaseEquipmentStats {
  weapon: { id: string; name: string; atk: number; def: number };
  armor: { id: string; name: string; atk: number; def: number };
  gloves: { id: string; name: string; atk: number; def: number };
  boots: { id: string; name: string; atk: number; def: number };
  accessory: { id: string; name: string; atk: number; def: number };
}

/**
 * ダンジョン別の基本装備ステータス
 */
const DUNGEON_BASE_EQUIPMENT: Record<string, BaseEquipmentStats> = {
  chaos_realm: {
    weapon: { id: 'chaos_blade', name: '混沌の剣', atk: 160, def: 0 },
    armor: { id: 'void_armor', name: '虚無の鎧', atk: 0, def: 135 },
    gloves: { id: 'chaos_gauntlets', name: '混沌の篭手', atk: 52, def: 60 },
    boots: { id: 'void_boots', name: '虚無のブーツ', atk: 35, def: 88 },
    accessory: { id: 'chaos_crystal_ring', name: '混沌水晶の指輪', atk: 65, def: 65 },
  },
  final_land: {
    weapon: { id: 'apocalypse_blade', name: '終焉の剣', atk: 220, def: 0 },
    armor: { id: 'end_armor', name: '終末の鎧', atk: 0, def: 180 },
    gloves: { id: 'titan_gauntlets', name: '泰坦の篭手', atk: 70, def: 80 },
    boots: { id: 'end_walker_boots', name: '終末を歩む者のブーツ', atk: 48, def: 120 },
    accessory: { id: 'oblivion_ring', name: '忘却の指輪', atk: 88, def: 88 },
  },
  dragon_nest: {
    weapon: { id: 'dragon_slayer', name: '竜殺しの剣', atk: 90, def: 0 },
    armor: { id: 'dragon_scale_armor', name: '竜鱗の鎧', atk: 0, def: 75 },
    gloves: { id: 'dragon_claw_gauntlets', name: '竜爪の篭手', atk: 28, def: 32 },
    boots: { id: 'dragon_hide_boots', name: '竜皮のブーツ', atk: 18, def: 48 },
    accessory: { id: 'dragon_eye_ring', name: '竜眼の指輪', atk: 35, def: 35 },
  },
  sacred_temple: {
    weapon: { id: 'holy_blade', name: '聖剣', atk: 120, def: 0 },
    armor: { id: 'divine_armor', name: '神聖なる鎧', atk: 0, def: 100 },
    gloves: { id: 'seraph_gauntlets', name: '熾天使の篭手', atk: 38, def: 44 },
    boots: { id: 'divine_boots', name: '神のブーツ', atk: 25, def: 65 },
    accessory: { id: 'holy_diamond_ring', name: '聖なるダイヤ指輪', atk: 48, def: 48 },
  },
  hell_gate: {
    weapon: { id: 'hellfire_blade', name: '獄炎剣', atk: 68, def: 0 },
    armor: { id: 'infernal_plate', name: '煉獄の鎧', atk: 0, def: 56 },
    gloves: { id: 'demon_gauntlets', name: '魔人の篭手', atk: 20, def: 24 },
    boots: { id: 'hellwalker_boots', name: '地獄歩きのブーツ', atk: 14, def: 35 },
    accessory: { id: 'infernal_ruby_ring', name: '煉獄のルビー指輪', atk: 25, def: 25 },
  },
  sky_tower: {
    weapon: { id: 'sky_blade', name: '天空剣', atk: 50, def: 0 },
    armor: { id: 'cloud_armor', name: '雲海の鎧', atk: 0, def: 42 },
    gloves: { id: 'storm_gauntlets', name: '嵐の篭手', atk: 14, def: 18 },
    boots: { id: 'wind_walker_boots', name: '風渡りのブーツ', atk: 10, def: 26 },
    accessory: { id: 'sky_sapphire_ring', name: '蒼空のサファイア指輪', atk: 25, def: 15 },
  },
};

/**
 * シミュレーション用：ランダムMOD装備セットを生成
 * @param setName セット名
 * @param equipmentDungeonId 装備のダンジョンID（基本ステータス決定用）
 * @param modDungeonId MODのダンジョンID（tier範囲決定用、省略時はequipmentDungeonIdと同じ）
 */
export function generateRandomEquipmentSet(
  setName: string,
  equipmentDungeonId: string,
  modDungeonId?: string
): EquipmentSet {
  const baseDungeon = modDungeonId ?? equipmentDungeonId;
  const baseStats = DUNGEON_BASE_EQUIPMENT[equipmentDungeonId] ?? DUNGEON_BASE_EQUIPMENT.chaos_realm;

  return {
    name: setName,
    weapon: createRandomModItem(
      baseStats.weapon.id,
      baseStats.weapon.name,
      'weapon',
      baseStats.weapon.atk,
      baseStats.weapon.def,
      baseDungeon
    ),
    armor: createRandomModItem(
      baseStats.armor.id,
      baseStats.armor.name,
      'armor',
      baseStats.armor.atk,
      baseStats.armor.def,
      baseDungeon
    ),
    gloves: createRandomModItem(
      baseStats.gloves.id,
      baseStats.gloves.name,
      'gloves',
      baseStats.gloves.atk,
      baseStats.gloves.def,
      baseDungeon
    ),
    boots: createRandomModItem(
      baseStats.boots.id,
      baseStats.boots.name,
      'boots',
      baseStats.boots.atk,
      baseStats.boots.def,
      baseDungeon
    ),
    accessory: createRandomModItem(
      baseStats.accessory.id,
      baseStats.accessory.name,
      'accessory',
      baseStats.accessory.atk,
      baseStats.accessory.def,
      baseDungeon
    ),
  };
}
