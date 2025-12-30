import { create } from 'zustand';
import { Equipment, EquipmentSlot, Item, InventoryItem } from '@/types';
import { getSkillNode } from '@/data/skills';
import { getItem } from '@/data/items';
import {
  characterRepository,
  inventoryRepository,
  equipmentRepository,
  skillRepository,
} from '@/db';

// 経験値テーブル（レベルアップに必要な経験値）
const getExpToNextLevel = (level: number): number => {
  return level * 50;
};

// 初期装備
const initialEquipment: Equipment = {
  weapon: null,
  armor: null,
  gloves: null,
  boots: null,
  accessory: null,
};

interface PlayerState {
  // キャラクター情報
  characterId: number | null;
  characterName: string;
  level: number;
  exp: number;
  expToNextLevel: number;
  skillPoints: number;
  maxHp: number;
  atk: number;
  def: number;
  equipment: Equipment;
  inventory: InventoryItem[];
  unlockedSkills: string[];
  isLoaded: boolean;
}

interface PlayerActions {
  // キャラクターを読み込み
  loadCharacter: (characterId: number) => Promise<void>;
  // 経験値を獲得
  gainExp: (amount: number) => Promise<void>;
  // スキルを取得
  unlockSkill: (skillId: string) => Promise<boolean>;
  // 装備を変更（インベントリから）
  equipItem: (itemId: string) => Promise<void>;
  // 装備を解除（インベントリへ）
  unequipItem: (slot: EquipmentSlot) => Promise<void>;
  // アイテムをインベントリに追加
  addToInventory: (itemId: string, quantity?: number) => Promise<void>;
  // アイテムをインベントリから削除
  removeFromInventory: (itemId: string, quantity?: number) => Promise<boolean>;
  // 計算されたステータスを取得
  getTotalStats: () => { maxHp: number; atk: number; def: number };
  // データを再読み込み
  refresh: () => Promise<void>;
  // クリア
  clear: () => void;
}

const initialState: PlayerState = {
  characterId: null,
  characterName: '',
  level: 1,
  exp: 0,
  expToNextLevel: getExpToNextLevel(1),
  skillPoints: 0,
  maxHp: 100,
  atk: 10,
  def: 5,
  equipment: initialEquipment,
  inventory: [],
  unlockedSkills: [],
  isLoaded: false,
};

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  ...initialState,

  loadCharacter: async (characterId: number) => {
    const character = await characterRepository.getById(characterId);
    if (!character) throw new Error('Character not found');

    // 装備を読み込み
    const equipmentRecords = await equipmentRepository.getAll(characterId);
    const equipment: Equipment = { ...initialEquipment };
    for (const record of equipmentRecords) {
      if (record.itemId) {
        const item = getItem(record.itemId);
        if (item) {
          equipment[record.slot] = item;
        }
      }
    }

    // インベントリを読み込み
    const inventory = await inventoryRepository.getAll(characterId);

    // スキルを読み込み
    const unlockedSkills = await skillRepository.getAll(characterId);

    set({
      characterId: character.id,
      characterName: character.name,
      level: character.level,
      exp: character.exp,
      expToNextLevel: getExpToNextLevel(character.level),
      skillPoints: character.skillPoints,
      maxHp: character.maxHp,
      atk: character.atk,
      def: character.def,
      equipment,
      inventory,
      unlockedSkills,
      isLoaded: true,
    });
  },

  gainExp: async (amount: number) => {
    const state = get();
    if (!state.characterId) return;

    let newExp = state.exp + amount;
    let newLevel = state.level;
    let newExpToNext = state.expToNextLevel;
    let newSkillPoints = state.skillPoints;
    let newMaxHp = state.maxHp;
    let newAtk = state.atk;
    let newDef = state.def;

    // レベルアップ処理
    while (newExp >= newExpToNext) {
      newExp -= newExpToNext;
      newLevel += 1;
      newExpToNext = getExpToNextLevel(newLevel);
      newSkillPoints += 1;
      newMaxHp += 10;
      newAtk += 2;
      newDef += 1;
    }

    // DBに保存
    await characterRepository.updateStats(state.characterId, {
      level: newLevel,
      exp: newExp,
      skillPoints: newSkillPoints,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    set({
      exp: newExp,
      level: newLevel,
      expToNextLevel: newExpToNext,
      skillPoints: newSkillPoints,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });
  },

  unlockSkill: async (skillId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const skill = getSkillNode(skillId);
    if (!skill) return false;
    if (state.skillPoints < 1) return false;
    if (state.unlockedSkills.includes(skillId)) return false;
    if (skill.requiredSkillId && !state.unlockedSkills.includes(skill.requiredSkillId)) {
      return false;
    }

    // DBに保存
    const success = await skillRepository.unlock(state.characterId, skillId);
    if (!success) return false;

    const newMaxHp = state.maxHp + (skill.effect.hp || 0);
    const newAtk = state.atk + (skill.effect.atk || 0);
    const newDef = state.def + (skill.effect.def || 0);
    const newSkillPoints = state.skillPoints - 1;

    await characterRepository.updateStats(state.characterId, {
      skillPoints: newSkillPoints,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    set({
      skillPoints: newSkillPoints,
      unlockedSkills: [...state.unlockedSkills, skillId],
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    return true;
  },

  equipItem: async (itemId: string) => {
    const state = get();
    if (!state.characterId) return;

    const item = getItem(itemId);
    if (!item) return;

    // インベントリにアイテムがあるか確認
    const inventoryItem = state.inventory.find((i) => i.itemId === itemId);
    if (!inventoryItem || inventoryItem.quantity < 1) return;

    // 現在の装備を取得
    const oldItem = state.equipment[item.slot];

    // インベントリからアイテムを削除
    await inventoryRepository.removeItem(state.characterId, itemId, 1);

    // 古い装備があればインベントリに戻す
    if (oldItem) {
      await inventoryRepository.addItem(state.characterId, oldItem.id, 1);
    }

    // 新しい装備をセット
    await equipmentRepository.equip(state.characterId, item.slot, itemId);

    // メモリの状態を更新
    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex((i) => i.itemId === itemId);
    if (idx !== -1) {
      if (newInventory[idx].quantity === 1) {
        newInventory.splice(idx, 1);
      } else {
        newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity - 1 };
      }
    }
    if (oldItem) {
      const oldIdx = newInventory.findIndex((i) => i.itemId === oldItem.id);
      if (oldIdx !== -1) {
        newInventory[oldIdx] = { ...newInventory[oldIdx], quantity: newInventory[oldIdx].quantity + 1 };
      } else {
        newInventory.push({ itemId: oldItem.id, quantity: 1 });
      }
    }

    set({
      equipment: {
        ...state.equipment,
        [item.slot]: item,
      },
      inventory: newInventory,
    });
  },

  unequipItem: async (slot: EquipmentSlot) => {
    const state = get();
    if (!state.characterId) return;

    const item = state.equipment[slot];
    if (!item) return;

    // 装備を解除
    await equipmentRepository.unequip(state.characterId, slot);

    // インベントリに追加
    await inventoryRepository.addItem(state.characterId, item.id, 1);

    // メモリの状態を更新
    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex((i) => i.itemId === item.id);
    if (idx !== -1) {
      newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity + 1 };
    } else {
      newInventory.push({ itemId: item.id, quantity: 1 });
    }

    set({
      equipment: {
        ...state.equipment,
        [slot]: null,
      },
      inventory: newInventory,
    });
  },

  addToInventory: async (itemId: string, quantity: number = 1) => {
    const state = get();
    if (!state.characterId) return;

    await inventoryRepository.addItem(state.characterId, itemId, quantity);

    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex((i) => i.itemId === itemId);
    if (idx !== -1) {
      newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity + quantity };
    } else {
      newInventory.push({ itemId, quantity });
    }

    set({ inventory: newInventory });
  },

  removeFromInventory: async (itemId: string, quantity: number = 1): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const success = await inventoryRepository.removeItem(state.characterId, itemId, quantity);
    if (!success) return false;

    const newInventory = [...state.inventory];
    const idx = newInventory.findIndex((i) => i.itemId === itemId);
    if (idx !== -1) {
      if (newInventory[idx].quantity <= quantity) {
        newInventory.splice(idx, 1);
      } else {
        newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity - quantity };
      }
    }

    set({ inventory: newInventory });
    return true;
  },

  getTotalStats: () => {
    const state = get();
    let totalAtk = state.atk;
    let totalDef = state.def;
    let totalMaxHp = state.maxHp;

    Object.values(state.equipment).forEach((item) => {
      if (item) {
        totalAtk += item.atk;
        totalDef += item.def;
      }
    });

    return {
      maxHp: totalMaxHp,
      atk: totalAtk,
      def: totalDef,
    };
  },

  refresh: async () => {
    const state = get();
    if (!state.characterId) return;
    await get().loadCharacter(state.characterId);
  },

  clear: () => {
    set(initialState);
  },
}));
