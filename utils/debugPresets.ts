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

  console.log(`Applied preset: ${preset.name} (${preset.nodes.length} nodes)`);
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
    console.error(`Equipment set not found: ${dungeonId} ${setType}`);
    return false;
  }

  const store = usePlayerStore.getState();

  // 装備プリセットを適用
  await store.applyEquipmentPreset(equipmentSet);

  console.log(`Applied equipment preset: ${equipmentSet.name}`);
  return true;
}
