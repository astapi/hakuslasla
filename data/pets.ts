import { PetDefinition } from '@/types';
import petsData from './json/pets.json';
import { getEnemy } from './enemies';

const pets: Record<string, PetDefinition> = {};
for (const [id, def] of Object.entries(petsData.pets)) {
  pets[id] = def as PetDefinition;
}

export const getPet = (id: string): PetDefinition | undefined => pets[id];

export const getAllPets = (): PetDefinition[] => Object.values(pets);

// ========================================
// ペット強化（重複消費）システム
// ========================================
// 段階式: Lv1=基礎、Lvが上がるごとにバフ基礎値が +20% される。
// 次のLvへ上げるのに必要な重複消費数はLvとともに増加（Lv1→2:1体, Lv2→3:2体, ...）。
// 最大Lv6で基礎値の2倍（+100%）になる。

export const PET_MIN_LEVEL = 1;
export const PET_MAX_LEVEL = 6;
const PET_LEVEL_STEP = 0.2; // 1Lvあたり +20%

/**
 * 強化レベルに応じたバフ倍率（基礎値に掛ける係数）。
 * Lv1 = 1.0、Lv6 = 2.0。
 */
export const getPetLevelFactor = (level: number): number => {
  const lv = Math.max(PET_MIN_LEVEL, Math.min(PET_MAX_LEVEL, level));
  return 1 + (lv - PET_MIN_LEVEL) * PET_LEVEL_STEP;
};

/**
 * 現在のレベルから次のレベルへ上げるのに必要な重複消費数。
 * Lv1→2:1体, Lv2→3:2体, Lv3→4:3体 ...（= 現在のレベル）。
 * 最大レベルに達している場合は null。
 */
export const getPetUpgradeCost = (level: number): number | null => {
  if (level >= PET_MAX_LEVEL) return null;
  return level;
};

/**
 * ペットの画像キーを取得（monsterImages のキー）。
 * sourceMonsterId が実モンスターIDで、画像キーと異なる場合（bee→killer_bee 等）に
 * monsters.json の image フィールドを引いてくる。
 */
export const getPetImageKey = (def: PetDefinition): string => {
  const enemy = getEnemy(def.sourceMonsterId);
  return enemy?.image ?? def.sourceMonsterId;
};

// モンスターID → ペットID マッピング
// 撃破モンスターのIDで引き、対応するペットがあればドロップ判定対象になる
export const MONSTER_PET_DROPS: Record<string, string> = {
  slime: 'pet_slime',
  wolf: 'pet_wolf',
  bee: 'pet_killer_bee',
  gargoyle: 'pet_gargoyle',
  goblin_shaman: 'pet_goblin_shaman',
  ice_witch: 'pet_ice_witch',
  goblin_king: 'pet_goblin_king',
};

const NORMAL_DROP_RATE = 0.5; // %
const BOSS_DROP_RATE = 3; // %

/**
 * モンスターIDからペットドロップ判定を試みる
 * @param monsterId 撃破したモンスターのID
 * @param bonusRatePct 加算するドロップ率ボーナス（%）。テイマーのクラス固有能力など
 * @returns ドロップしたペットID、ドロップなしならnull
 */
export const tryPetDrop = (monsterId: string, bonusRatePct = 0): string | null => {
  const petId = MONSTER_PET_DROPS[monsterId];
  if (!petId) return null;
  const def = getPet(petId);
  if (!def) return null;
  const baseRate = def.rarity === 'boss' ? BOSS_DROP_RATE : NORMAL_DROP_RATE;
  const rate = baseRate + bonusRatePct;
  return Math.random() * 100 < rate ? petId : null;
};
