/**
 * デバッグ用プリセット適用ユーティリティ
 * シミュレーション用プリセットをキャラクターに適用
 */

import { LEVEL_BASED_PRESETS, PassivePreset } from '@/core/player';
import {
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSetType,
  EquipmentSet,
} from '@/core/equipmentSets';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Item } from '@/types';

// プリセットタイプ
export type PresetType = keyof typeof LEVEL_BASED_PRESETS;

// プリセットレベル
export type PresetLevel = 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50;

// 利用可能なプリセット一覧
export const PRESET_TYPES: PresetType[] = [
  'POISON',
  'CRIT',
  'REGEN',
  'VAMP',
  'GUARD',
  'SPEED',
  'REGEN_GUARD',
  'SPEED_REGEN',
  'VAMP_SPEED',
  'VAMP_REGEN',
  'SPEED_GUARD',
  'POISON_GUARD',
  'POISON_REGEN',
];

// プリセット名の日本語マッピング
export const PRESET_NAMES: Record<PresetType, string> = {
  POISON: '毒特化',
  CRIT: 'クリティカル特化',
  REGEN: 'HP回復特化',
  VAMP: 'ライフスティール特化',
  GUARD: '防御特化',
  SPEED: '攻撃速度特化',
  REGEN_GUARD: '回復+防御',
  SPEED_REGEN: '速度+回復',
  VAMP_SPEED: '吸血+速度',
  VAMP_REGEN: '吸血+回復',
  SPEED_GUARD: '速度+防御',
  POISON_GUARD: '毒+防御',
  POISON_REGEN: '毒+回復',
};

/**
 * プリセットを取得
 */
export function getPreset(type: PresetType, level: PresetLevel): PassivePreset | null {
  return LEVEL_BASED_PRESETS[type]?.[level] || null;
}

/**
 * キャラクターにプリセットを適用
 * @param type プリセットタイプ
 * @param level プリセットレベル（5, 10, 15, 20, 25, 30, 35, 40, 45, 50）
 */
export async function applyPresetToCharacter(
  type: PresetType,
  level: PresetLevel
): Promise<boolean> {
  const preset = getPreset(type, level);
  if (!preset) {
    console.error(`Preset not found: ${type} LV${level}`);
    return false;
  }

  const store = usePlayerStore.getState();

  // レベルを設定（SPをプリセットに合わせる）
  await store.setDebugLevel(level);

  // プリセットを適用
  await store.applyPassivePreset(preset.nodes);

  if (__DEV__) {
    console.log(`Applied preset: ${preset.name} (${preset.nodes.length} nodes)`);
  }
  return true;
}

/**
 * 利用可能なプリセット一覧を取得
 */
export function listAvailablePresets(): { type: PresetType; name: string; levels: PresetLevel[] }[] {
  return PRESET_TYPES.map((type) => ({
    type,
    name: PRESET_NAMES[type],
    levels: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as PresetLevel[],
  }));
}

// ========================================
// 装備プリセット
// ========================================

// 装備セットタイプ
export { EquipmentSetType };

// 利用可能な装備セットタイプ
export const EQUIPMENT_SET_TYPES: EquipmentSetType[] = ['ATK', 'DEF', 'CRIT', 'POISON'];

// 装備セットタイプ名の日本語マッピング
export const EQUIPMENT_SET_NAMES: Record<EquipmentSetType, string> = {
  ATK: '攻撃型',
  DEF: '防御型',
  CRIT: 'クリティカル型',
  POISON: '毒型',
};

// ========================================
// ビルドプリセット
// ========================================

export type BuildPreset = {
  id: string;
  name: string;
  level: number;
  equipmentSet: EquipmentSet;
  unlockedSkills: string[];
};

const UBER_GOBLIN_KING_WIN_EQUIPMENT: EquipmentSet = {
  name: 'Uber Goblin King Win Equipment',
  weapon: {
    id: 'apocalypse_blade',
    name: '終焉の剣',
    slot: 'weapon',
    atk: 220,
    def: 0,
    instanceId: 'preset_apocalypse_blade',
    mods: [
      { type: 'hp_bonus', value: 287, tier: 1 },
      { type: 'atk_bonus', value: 75, tier: 1 },
      { type: 'atk_increased_pct', value: 32, tier: 4 },
      { type: 'hp_regen', value: 26, tier: 5 },
    ],
  } as Item,
  armor: {
    id: 'end_armor',
    name: '終末の鎧',
    slot: 'armor',
    atk: 0,
    def: 180,
    instanceId: 'preset_end_armor',
    mods: [
      { type: 'hp_bonus', value: 278, tier: 1 },
      { type: 'def_increased_pct', value: 44, tier: 1 },
      { type: 'def_bonus', value: 58, tier: 3 },
      { type: 'hp_regen', value: 39, tier: 3 },
    ],
  } as Item,
  gloves: {
    id: 'titan_gauntlets',
    name: '泰坦の篭手',
    slot: 'gloves',
    atk: 70,
    def: 80,
    instanceId: 'preset_titan_gauntlets',
    mods: [
      { type: 'critical_chance', value: 3, tier: 10 },
      { type: 'def_increased_pct', value: 5, tier: 8 },
      { type: 'atk_increased_pct', value: 30, tier: 1 },
      { type: 'atk_bonus', value: 42, tier: 2 },
    ],
  } as Item,
  boots: {
    id: 'end_walker_boots',
    name: '終末を歩む者のブーツ',
    slot: 'boots',
    atk: 48,
    def: 120,
    instanceId: 'preset_end_walker_boots',
    mods: [
      { type: 'critical_chance', value: 25, tier: 3 },
      { type: 'atk_bonus', value: 45, tier: 2 },
      { type: 'hp_bonus', value: 280, tier: 1 },
      { type: 'def_bonus', value: 44, tier: 2 },
    ],
  } as Item,
  accessory: {
    id: 'crown_of_end',
    name: '終焉の王冠',
    slot: 'accessory',
    atk: 120,
    def: 120,
    fixedMods: [
      { type: 'atk_bonus', value: 70, tier: 0 },
      { type: 'def_bonus', value: 70, tier: 0 },
      { type: 'hp_regen', value: 70, tier: 0 },
      { type: 'critical_chance', value: 45, tier: 0 },
    ],
    instanceId: 'preset_crown_of_end',
    mods: [
      { type: 'atk_bonus', value: 70, tier: 0 },
      { type: 'def_bonus', value: 70, tier: 0 },
      { type: 'hp_regen', value: 70, tier: 0 },
      { type: 'critical_chance', value: 45, tier: 0 },
    ],
  } as Item,
};

export const BUILD_PRESETS: BuildPreset[] = [
  {
    id: 'uber_all_bosses_win_lv60_no_t1_req_seed77777',
    name: 'Uber全ボス安定クリア(Lv60/ T1必須OFF)',
    level: 60,
    equipmentSet: {
      name: 'Uber All Bosses Win Lv60 No T1 Req',
      weapon: {
        id: 'apocalypse_blade',
        name: '終焉の剣',
        slot: 'weapon',
        atk: 220,
        def: 0,
        instanceId: 'preset_search_apocalypse_blade_3221',
        mods: [
          { type: 'atk_bonus', value: 66, tier: 2 },
          { type: 'poison_chance', value: 40, tier: 3 },
          { type: 'def_increased_pct', value: 29, tier: 1 },
          { type: 'critical_damage', value: 93, tier: 2 },
        ],
      } as Item,
      armor: {
        id: 'end_armor',
        name: '終末の鎧',
        slot: 'armor',
        atk: 0,
        def: 180,
        instanceId: 'preset_search_end_armor_3222',
        mods: [
          { type: 'atk_bonus', value: 46, tier: 1 },
          { type: 'def_increased_pct', value: 37, tier: 3 },
          { type: 'def_bonus', value: 73, tier: 1 },
          { type: 'hp_bonus', value: 279, tier: 1 },
        ],
      } as Item,
      gloves: {
        id: 'titan_gauntlets',
        name: '泰坦の篭手',
        slot: 'gloves',
        atk: 70,
        def: 80,
        instanceId: 'preset_search_titan_gauntlets_3223',
        mods: [
          { type: 'hp_bonus', value: 273, tier: 2 },
          { type: 'def_increased_pct', value: 30, tier: 1 },
          { type: 'critical_chance', value: 25, tier: 3 },
          { type: 'poison_chance', value: 44, tier: 3 },
        ],
      } as Item,
      boots: {
        id: 'end_walker_boots',
        name: '終末を歩む者のブーツ',
        slot: 'boots',
        atk: 48,
        def: 120,
        instanceId: 'preset_search_end_walker_boots_3224',
        mods: [
          { type: 'def_bonus', value: 50, tier: 1 },
          { type: 'hp_regen', value: 39, tier: 3 },
          { type: 'hp_bonus', value: 258, tier: 2 },
          { type: 'def_increased_pct', value: 29, tier: 1 },
        ],
      } as Item,
      accessory: {
        id: 'crown_of_end',
        name: '終焉の王冠',
        slot: 'accessory',
        atk: 120,
        def: 120,
        fixedMods: [
          { type: 'atk_bonus', value: 70, tier: 0 },
          { type: 'def_bonus', value: 70, tier: 0 },
          { type: 'hp_regen', value: 70, tier: 0 },
          { type: 'critical_chance', value: 45, tier: 0 },
        ],
        instanceId: 'preset_search_crown_of_end_3224',
        mods: [
          { type: 'atk_bonus', value: 70, tier: 0 },
          { type: 'def_bonus', value: 70, tier: 0 },
          { type: 'hp_regen', value: 70, tier: 0 },
          { type: 'critical_chance', value: 45, tier: 0 },
        ],
      } as Item,
    },
    unlockedSkills: [
      'start',
      'speed_1',
      'poison_1',
      'poison_2',
      'guard_1',
      'crit_1',
      'vamp_1',
      'poison_3',
      'vamp_2',
      'poison_5',
      'crit_2',
      'crit_4',
      'poison_6',
      'poison_4',
      'crit_3',
      'vamp_4',
      'speed_2',
      'speed_4',
      'speed_3',
      'regen_1',
      'vamp_5',
      'crit_5',
      'poison_7',
      'vamp_3',
      'guard_2',
      'poison_key1',
      'regen_2',
      'crit_6',
      'guard_4',
      'regen_4',
      'speed_5',
      'guard_5',
      'guard_6',
      'guard_7',
      'poison_8',
      'guard_3',
      'poison_9',
      'crit_7',
      'regen_3',
      'poison_10',
      'vamp_6',
      'poison_11',
      'poison_12',
      'regen_5',
      'guard_key1',
      'poison_13',
      'guard_8',
      'guard_10',
      'poison_a1',
      'poison_a2',
    ],
  },
  {
    id: 'uber_all_bosses_win_lv60_seed54321',
    name: 'Uber全ボス安定クリア(Lv60)',
    level: 60,
    equipmentSet: {
      name: 'Uber All Bosses Win Lv60',
      weapon: {
        id: 'apocalypse_blade',
        name: '終焉の剣',
        slot: 'weapon',
        atk: 220,
        def: 0,
        instanceId: 'preset_search_apocalypse_blade_3786',
        mods: [
          { type: 'hp_regen_pct', value: 3, tier: 3 },
          { type: 'hp_bonus', value: 238, tier: 3 },
          { type: 'poison_chance', value: 46, tier: 2 },
          { type: 'atk_bonus', value: 70, tier: 1 },
        ],
      } as Item,
      armor: {
        id: 'end_armor',
        name: '終末の鎧',
        slot: 'armor',
        atk: 0,
        def: 180,
        instanceId: 'preset_search_end_armor_3787',
        mods: [
          { type: 'atk_increased_pct', value: 26, tier: 2 },
          { type: 'hp_regen_pct', value: 4, tier: 2 },
          { type: 'atk_bonus', value: 37, tier: 3 },
          { type: 'poison_chance', value: 50, tier: 1 },
        ],
      } as Item,
      gloves: {
        id: 'titan_gauntlets',
        name: '泰坦の篭手',
        slot: 'gloves',
        atk: 70,
        def: 80,
        instanceId: 'preset_search_titan_gauntlets_3788',
        mods: [
          { type: 'critical_damage', value: 85, tier: 3 },
          { type: 'def_bonus', value: 39, tier: 3 },
          { type: 'poison_chance', value: 47, tier: 2 },
          { type: 'def_increased_pct', value: 30, tier: 1 },
        ],
      } as Item,
      boots: {
        id: 'end_walker_boots',
        name: '終末を歩む者のブーツ',
        slot: 'boots',
        atk: 48,
        def: 120,
        instanceId: 'preset_search_end_walker_boots_3789',
        mods: [
          { type: 'hp_bonus', value: 245, tier: 3 },
          { type: 'def_bonus', value: 46, tier: 1 },
          { type: 'critical_damage', value: 86, tier: 3 },
          { type: 'atk_bonus', value: 49, tier: 1 },
        ],
      } as Item,
      accessory: {
        id: 'crown_of_end',
        name: '終焉の王冠',
        slot: 'accessory',
        atk: 120,
        def: 120,
        fixedMods: [
          { type: 'atk_bonus', value: 70, tier: 0 },
          { type: 'def_bonus', value: 70, tier: 0 },
          { type: 'hp_regen', value: 70, tier: 0 },
          { type: 'critical_chance', value: 45, tier: 0 },
        ],
        instanceId: 'preset_search_crown_of_end_3789',
        mods: [
          { type: 'atk_bonus', value: 70, tier: 0 },
          { type: 'def_bonus', value: 70, tier: 0 },
          { type: 'hp_regen', value: 70, tier: 0 },
          { type: 'critical_chance', value: 45, tier: 0 },
        ],
      } as Item,
    },
    unlockedSkills: [
      'start',
      'poison_1',
      'poison_2',
      'regen_1',
      'poison_4',
      'poison_5',
      'guard_1',
      'regen_2',
      'regen_4',
      'guard_2',
      'guard_3',
      'poison_3',
      'poison_6',
      'guard_5',
      'regen_3',
      'vamp_1',
      'speed_1',
      'crit_1',
      'poison_7',
      'vamp_2',
      'vamp_4',
      'guard_6',
      'guard_7',
      'guard_key1',
      'poison_key1',
      'regen_5',
      'vamp_3',
      'guard_8',
      'poison_8',
      'guard_9',
      'crit_2',
      'speed_2',
      'poison_9',
      'guard_11',
      'guard_4',
      'poison_11',
      'crit_3',
      'regen_6',
      'vamp_5',
      'poison_12',
      'poison_10',
      'poison_13',
      'poison_b1',
      'guard_10',
      'regen_7',
      'speed_4',
      'poison_b2',
      'crit_5',
      'regen_key1',
      'poison_14',
    ],
  },
  {
    id: 'uber_goblin_king_win_lv60',
    name: 'Uberゴブリンキング勝利ビルド(Lv60)',
    level: 60,
    equipmentSet: UBER_GOBLIN_KING_WIN_EQUIPMENT,
    unlockedSkills: [
      'guard_1',
      'guard_2',
      'guard_3',
      'guard_5',
      'poison_1',
      'poison_10',
      'poison_11',
      'poison_12',
      'poison_13',
      'poison_14',
      'poison_15',
      'poison_16',
      'poison_17',
      'poison_2',
      'poison_3',
      'poison_4',
      'poison_5',
      'poison_6',
      'poison_7',
      'poison_8',
      'poison_9',
      'poison_a1',
      'poison_a2',
      'poison_b1',
      'poison_b2',
      'poison_final1',
      'poison_final2',
      'poison_key1',
      'regen_1',
      'regen_10',
      'regen_11',
      'regen_12',
      'regen_13',
      'regen_2',
      'regen_3',
      'regen_4',
      'regen_5',
      'regen_6',
      'regen_7',
      'regen_8',
      'regen_9',
      'regen_a1',
      'regen_a2',
      'regen_key1',
      'speed_1',
      'speed_2',
      'speed_4',
      'speed_5',
      'speed_6',
      'speed_7',
      'speed_key1',
      'start',
    ],
  },
];

export async function applyBuildPresetToCharacter(buildId: string): Promise<boolean> {
  const preset = BUILD_PRESETS.find((p) => p.id === buildId);
  if (!preset) {
    if (__DEV__) {
      console.error(`Build preset not found: ${buildId}`);
    }
    return false;
  }

  const store = usePlayerStore.getState();
  await store.setDebugLevel(preset.level);
  await store.applyEquipmentPreset(preset.equipmentSet);
  await store.applyPassivePreset(preset.unlockedSkills);

  if (__DEV__) {
    console.log(`Applied build preset: ${preset.name}`);
  }
  return true;
}

// ダンジョン情報（推奨レベル順）
export const DUNGEON_INFO: { id: string; name: string; level: number }[] = [
  { id: 'grassland', name: '草原', level: 1 },
  { id: 'cave', name: '洞窟', level: 5 },
  { id: 'ruins', name: '遺跡', level: 10 },
  { id: 'goblin_fort', name: 'ゴブリン砦', level: 15 },
  { id: 'demon_castle', name: '魔王城', level: 20 },
  { id: 'ice_cave', name: '氷結洞窟', level: 25 },
  { id: 'volcano', name: '火山', level: 30 },
  { id: 'dark_forest', name: '深淵の森', level: 35 },
  { id: 'sky_tower', name: '天空の塔', level: 40 },
  { id: 'hell_gate', name: '地獄の門', level: 50 },
  { id: 'dragon_nest', name: '竜の巣穴', level: 60 },
  { id: 'sacred_temple', name: '神域', level: 70 },
  { id: 'chaos_realm', name: '混沌領域', level: 80 },
  { id: 'final_land', name: '終焉の地', level: 99 },
];

/**
 * 装備セットを取得
 */
export function getEquipmentSet(
  dungeonId: string,
  setType: EquipmentSetType
): EquipmentSet | null {
  const dungeonSets = DUNGEON_EQUIPMENT_SETS[dungeonId];
  if (!dungeonSets) return null;
  return dungeonSets.sets[setType];
}

/**
 * キャラクターに装備セットを適用
 * @param dungeonId ダンジョンID
 * @param setType 装備セットタイプ (ATK/DEF/CRIT/POISON)
 */
export async function applyEquipmentPresetToCharacter(
  dungeonId: string,
  setType: EquipmentSetType
): Promise<boolean> {
  const equipmentSet = getEquipmentSet(dungeonId, setType);
  if (!equipmentSet) {
    if (__DEV__) {
      console.error(`Equipment set not found: ${dungeonId} ${setType}`);
    }
    return false;
  }

  const store = usePlayerStore.getState();

  // 装備プリセットを適用
  await store.applyEquipmentPreset(equipmentSet);

  if (__DEV__) {
    console.log(`Applied equipment preset: ${equipmentSet.name}`);
  }
  return true;
}
