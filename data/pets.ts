import { PetDefinition } from '@/types';
import petsData from './json/pets.json';
import { getEnemy } from './enemies';

const pets: Record<string, PetDefinition> = {};
for (const [id, def] of Object.entries(petsData.pets)) {
  pets[id] = def as PetDefinition;
}

export const getPet = (id: string): PetDefinition | undefined => pets[id];

export const getAllPets = (): PetDefinition[] => Object.values(pets);

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
 * @returns ドロップしたペットID、ドロップなしならnull
 */
export const tryPetDrop = (monsterId: string): string | null => {
  const petId = MONSTER_PET_DROPS[monsterId];
  if (!petId) return null;
  const def = getPet(petId);
  if (!def) return null;
  const rate = def.rarity === 'boss' ? BOSS_DROP_RATE : NORMAL_DROP_RATE;
  return Math.random() * 100 < rate ? petId : null;
};
