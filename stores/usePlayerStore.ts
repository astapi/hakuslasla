import { create } from 'zustand';
import { Equipment, EquipmentSlot, Item } from '@/types';
import { getPassiveNode, canUnlockNode, calculatePassiveEffects } from '@/data/passiveTree';
import {
  characterRepository,
  inventoryRepository,
  equipmentRepository,
  skillRepository,
} from '@/db';
import {
  INITIAL_STATS,
  INVENTORY_MAX_SIZE,
  getExpToNextLevel,
  calculateLevelUp,
  calculateFinalStats,
} from '@/core';

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
  inventory: Item[]; // MOD付きItemの配列
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
  // 装備を変更（インベントリから、instanceIdで指定）
  equipItem: (instanceId: string) => Promise<void>;
  // 装備を解除（インベントリへ）
  unequipItem: (slot: EquipmentSlot) => Promise<void>;
  // アイテムをインベントリに追加（MOD付きItem）、制限超過時はfalse
  addToInventory: (item: Item) => Promise<boolean>;
  // アイテムをインベントリから削除（instanceIdで指定）
  removeFromInventory: (instanceId: string) => Promise<boolean>;
  // 計算されたステータスを取得
  getTotalStats: () => { maxHp: number; atk: number; def: number };
  // インベントリの空き数を取得
  getInventorySpace: () => number;
  // インベントリがいっぱいかどうか
  isInventoryFull: () => boolean;
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
  maxHp: INITIAL_STATS.maxHp,
  atk: INITIAL_STATS.atk,
  def: INITIAL_STATS.def,
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

    // 装備を読み込み（Item JSONを直接取得）
    const equipmentRecords = await equipmentRepository.getAll(characterId);
    const equipment: Equipment = { ...initialEquipment };
    for (const record of equipmentRecords) {
      if (record.item) {
        equipment[record.slot] = record.item;
      }
    }

    // インベントリを読み込み（Item[]を直接取得）
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

    // coreのcalculateLevelUpを使用
    const levelUpResult = calculateLevelUp(state.level, state.exp, amount);

    const newLevel = levelUpResult.newLevel;
    const newExp = levelUpResult.newExp;
    const newExpToNext = levelUpResult.expToNextLevel;
    const newSkillPoints = state.skillPoints + levelUpResult.skillPointsGained;
    const newMaxHp = state.maxHp + levelUpResult.statsGained.maxHp;
    const newAtk = state.atk + levelUpResult.statsGained.atk;
    const newDef = state.def + levelUpResult.statsGained.def;

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

  unlockSkill: async (nodeId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    // パッシブノードを取得
    const node = getPassiveNode(nodeId);
    if (!node) return false;

    // SPチェック
    if (state.skillPoints < 1) return false;

    // 取得可能かチェック（分岐・合流対応）
    if (!canUnlockNode(nodeId, state.unlockedSkills)) return false;

    // DBに保存
    const success = await skillRepository.unlock(state.characterId, nodeId);
    if (!success) return false;

    const newMaxHp = state.maxHp + (node.effect.hp || 0);
    const newAtk = state.atk + (node.effect.atk || 0);
    const newDef = state.def + (node.effect.def || 0);
    const newSkillPoints = state.skillPoints - 1;

    await characterRepository.updateStats(state.characterId, {
      skillPoints: newSkillPoints,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    set({
      skillPoints: newSkillPoints,
      unlockedSkills: [...state.unlockedSkills, nodeId],
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    return true;
  },

  equipItem: async (instanceId: string) => {
    const state = get();
    if (!state.characterId) return;

    // インベントリからアイテムを探す
    const item = state.inventory.find((i) => i.instanceId === instanceId);
    if (!item) return;

    // 現在の装備を取得
    const oldItem = state.equipment[item.slot];

    // インベントリからアイテムを削除
    await inventoryRepository.removeItem(state.characterId, instanceId);

    // 古い装備があればインベントリに戻す
    if (oldItem) {
      await inventoryRepository.addItem(state.characterId, oldItem);
    }

    // 新しい装備をセット
    await equipmentRepository.equip(state.characterId, item.slot, item);

    // メモリの状態を更新
    const newInventory = state.inventory.filter((i) => i.instanceId !== instanceId);
    if (oldItem) {
      newInventory.push(oldItem);
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
    await inventoryRepository.addItem(state.characterId, item);

    // メモリの状態を更新
    set({
      equipment: {
        ...state.equipment,
        [slot]: null,
      },
      inventory: [...state.inventory, item],
    });
  },

  addToInventory: async (item: Item): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    // インベントリ制限チェック
    if (state.inventory.length >= INVENTORY_MAX_SIZE) {
      return false;
    }

    await inventoryRepository.addItem(state.characterId, item);

    set({ inventory: [...state.inventory, item] });
    return true;
  },

  removeFromInventory: async (instanceId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const success = await inventoryRepository.removeItem(state.characterId, instanceId);
    if (!success) return false;

    set({
      inventory: state.inventory.filter((i) => i.instanceId !== instanceId),
    });
    return true;
  },

  // PoE式計算: base × (1 + total_increased%) × more1 × more2 × ...
  // パッシブのinc%/more%も反映した最終ステータスを返す
  getTotalStats: () => {
    const state = get();

    // 1. 基礎ステータス（レベルアップ分+装備+フラットMOD+フラットパッシブ）
    let baseAtk = state.atk;
    let baseDef = state.def;
    let baseMaxHp = state.maxHp;

    // 装備MODからのincreased%
    let equipHpIncPct = 0;
    let equipAtkIncPct = 0;
    let equipDefIncPct = 0;

    // 装備ステータス加算
    Object.values(state.equipment).forEach((item) => {
      if (item) {
        baseAtk += item.atk;
        baseDef += item.def;
        // MODからステータスボーナスを加算
        if (item.mods) {
          for (const mod of item.mods) {
            if (mod.type === 'atk_bonus') baseAtk += mod.value;
            if (mod.type === 'def_bonus') baseDef += mod.value;
            if (mod.type === 'hp_bonus') baseMaxHp += mod.value;
            if (mod.type === 'hp_increased_pct') equipHpIncPct += mod.value;
            if (mod.type === 'atk_increased_pct') equipAtkIncPct += mod.value;
            if (mod.type === 'def_increased_pct') equipDefIncPct += mod.value;
          }
        }
      }
    });

    // 2. パッシブ効果を取得（inc%/more%含む）
    const passiveEffects = calculatePassiveEffects(state.unlockedSkills);

    // 3. PoE式計算で最終ステータスを算出（装備+パッシブのincreased%を合算）
    const finalStats = calculateFinalStats(
      { maxHp: baseMaxHp, atk: baseAtk, def: baseDef },
      {
        hp_increased_pct: passiveEffects.hp_increased_pct + equipHpIncPct,
        atk_increased_pct: passiveEffects.atk_increased_pct + equipAtkIncPct,
        def_increased_pct: passiveEffects.def_increased_pct + equipDefIncPct,
        hp_more_pct: passiveEffects.hp_more_pct,
        atk_more_pct: passiveEffects.atk_more_pct,
        def_more_pct: passiveEffects.def_more_pct,
      }
    );

    return finalStats;
  },

  getInventorySpace: () => {
    const state = get();
    return INVENTORY_MAX_SIZE - state.inventory.length;
  },

  isInventoryFull: () => {
    const state = get();
    return state.inventory.length >= INVENTORY_MAX_SIZE;
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
