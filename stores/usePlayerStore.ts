import { create } from 'zustand';
import { CharacterType, Equipment, EquipmentSlot, Item, PetInstance } from '@/types';
import { getPassiveNode, canUnlockNode, canRefundNode, calculatePassiveEffects, setActivePassiveSeason, LATEST_PASSIVE_SEASON } from '@/data/passiveTree';
import { canUnlockUberNode, canRefundUberNode, calculateUberTreeEffects } from '@/data/uberTree';
import { BADGES } from '@/data/badges';
import { getPet, getPetLevelFactor, getPetUpgradeCost, PET_MAX_LEVEL } from '@/data/pets';
import {
  characterRepository,
  inventoryRepository,
  equipmentRepository,
  skillRepository,
  settingsRepository,
  badgeRepository,
  uberTreeRepository,
  petRepository,
} from '@/db';
import {
  INITIAL_STATS,
  INVENTORY_MAX_SIZE,
  MAX_LEVEL,
  getExpToNextLevel,
  calculateLevelUp,
  calculateFinalStats,
} from '@/core';
import { CLASS_INITIAL_STATS, CLASS_ABILITIES } from '@/core/player';
import { EquipmentSet } from '@/core/equipmentSets';
import { INVENTORY_BASE_SIZE, INVENTORY_EXPANDED_SIZE, STORAGE_BASE_SIZE, STORAGE_EXPANDED_SIZE, PET_BASE_SIZE, PET_EXPANDED_SIZE } from '@/constants/purchases';
import { hasInventoryExpansion, hasStorageExpansion, hasPetExpansion } from '@/stores/usePurchaseStore';

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
  characterType: CharacterType;
  season: number; // ロード中キャラのシーズン（スキルツリー/ランキングの振り分けに使用）
  level: number;
  exp: number;
  expToNextLevel: number;
  levelCap: number;
  skillPoints: number;
  maxHp: number;
  atk: number;
  def: number;
  equipment: Equipment;
  inventory: Item[]; // MOD付きItemの配列
  unlockedSkills: string[];
  unlockedUberSkills: string[];
  uberPoints: number;  // 使用可能なUberポイント（Uberボスバッジ数 - 使用済み数）
  pets: PetInstance[];
  activePetInstanceId: string | null;
  petLevels: Record<string, number>; // petId -> 強化レベル（未登録はLv1）
  isLoaded: boolean;
}

interface PlayerActions {
  // キャラクターを読み込み
  loadCharacter: (characterId: number) => Promise<void>;
  // 経験値を獲得
  gainExp: (amount: number) => Promise<void>;
  // レベル上限を更新
  setLevelCap: (levelCap: number) => void;
  // スキルを取得
  unlockSkill: (skillId: string) => Promise<boolean>;
  // スキルを返却（リスペック）
  refundSkill: (skillId: string) => Promise<boolean>;
  // Uberスキルを返却（リスペック）
  refundUberSkill: (skillId: string) => Promise<boolean>;
  // 装備を変更（インベントリから、instanceIdで指定）
  equipItem: (instanceId: string) => Promise<void>;
  // 装備を解除（インベントリへ）
  unequipItem: (slot: EquipmentSlot) => Promise<void>;
  // アイテムをインベントリに追加（MOD付きItem）、制限超過時はfalse
  addToInventory: (item: Item) => Promise<boolean>;
  // アイテムをインベントリから削除（instanceIdで指定）
  removeFromInventory: (instanceId: string) => Promise<boolean>;
  // 複数アイテムをインベントリから削除
  removeItemsFromInventory: (instanceIds: string[]) => Promise<number>;
  // 計算されたステータスを取得
  getTotalStats: () => { maxHp: number; atk: number; def: number };
  // インベントリの最大容量を取得
  getInventoryMaxSize: () => number;
  // インベントリの空き数を取得
  getInventorySpace: () => number;
  // インベントリがいっぱいかどうか
  isInventoryFull: () => boolean;
  // データを再読み込み
  refresh: () => Promise<void>;
  // クリア
  clear: () => void;
  // キャラクター名を変更
  renameCharacter: (newName: string) => Promise<void>;
  // デバッグ: パッシブプリセットを適用
  applyPassivePreset: (nodeIds: string[]) => Promise<void>;
  // Uberツリーノードを解放
  unlockUberSkill: (nodeId: string) => Promise<boolean>;
  // デバッグ: レベルとSPを設定
  setDebugLevel: (level: number) => Promise<void>;
  // デバッグ: 装備プリセットを適用
  applyEquipmentPreset: (equipmentSet: EquipmentSet) => Promise<void>;
  // ペットをインベントリに追加（初取得時は自動でアクティブに設定）。満杯時はnull
  addPet: (petId: string) => Promise<PetInstance | null>;
  // アクティブペットを設定（nullで解除）
  setActivePet: (instanceId: string | null) => Promise<void>;
  // ペットの最大所持数（課金で拡張）
  getPetMaxSize: () => number;
  // ペットの空き枠数
  getPetSpace: () => number;
  // ペット枠が満杯かどうか
  isPetStorageFull: () => boolean;
  // ペット種類の強化レベルを取得（未登録はLv1）
  getPetLevel: (petId: string) => number;
  // 重複ペットを1体破棄（最後の1体は破棄不可）。成功でtrue
  discardPetDuplicate: (petId: string) => Promise<boolean>;
  // 重複ペットを消費して強化（必要数を満たせばLv+1）。成功でtrue
  upgradePet: (petId: string) => Promise<boolean>;
}

const initialState: PlayerState = {
  characterId: null,
  characterName: '',
  characterType: 'warrior',
  season: LATEST_PASSIVE_SEASON,
  level: 1,
  exp: 0,
  expToNextLevel: getExpToNextLevel(1),
  levelCap: MAX_LEVEL,
  skillPoints: 0,
  maxHp: INITIAL_STATS.maxHp,
  atk: INITIAL_STATS.atk,
  def: INITIAL_STATS.def,
  equipment: initialEquipment,
  inventory: [],
  unlockedSkills: [],
  unlockedUberSkills: [],
  uberPoints: 0,
  pets: [],
  activePetInstanceId: null,
  petLevels: {},
  isLoaded: false,
};

export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  ...initialState,

  loadCharacter: async (characterId: number) => {
    const character = await characterRepository.getById(characterId);
    if (!character) throw new Error('Character not found');

    // キャラのシーズンに応じてアクティブなパッシブツリーを切り替える
    // （以降の calculatePassiveEffects / canUnlockNode 等が正しいツリーを参照する）
    setActivePassiveSeason(character.season);

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

    const endContentUnlocked = await settingsRepository.getEndContentUnlocked();
    const levelCap = endContentUnlocked ? 60 : MAX_LEVEL;

    // Uberツリー読み込み
    const unlockedUberSkills = await uberTreeRepository.getAll(characterId);
    // Uberポイント = Uberボスバッジ数 - 使用済みノード数
    const badges = await badgeRepository.getBadges(characterId);
    const uberBossBadgeCount = badges.filter(b =>
      BADGES.some(bd => bd.id === b.badgeId && bd.condition.type === 'uber_boss_clear')
    ).length;
    const uberPoints = Math.max(0, uberBossBadgeCount - unlockedUberSkills.length);

    // ペット読み込み
    const pets = await petRepository.getAll(characterId);
    const activePetInstanceId = await petRepository.getActivePetInstanceId(characterId);
    const petLevels = await petRepository.getLevels(characterId);

    set({
      characterId: character.id,
      characterName: character.name,
      characterType: character.type,
      season: character.season,
      level: character.level,
      exp: character.exp,
      expToNextLevel: getExpToNextLevel(character.level),
      levelCap,
      skillPoints: character.skillPoints,
      maxHp: character.maxHp,
      atk: character.atk,
      def: character.def,
      equipment,
      inventory,
      unlockedSkills,
      unlockedUberSkills,
      uberPoints,
      pets,
      activePetInstanceId,
      petLevels,
      isLoaded: true,
    });
  },

  gainExp: async (amount: number) => {
    const state = get();
    if (!state.characterId) return;

    // coreのcalculateLevelUpを使用
    const levelUpResult = calculateLevelUp(state.level, state.exp, amount, state.levelCap);

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

  setLevelCap: (levelCap: number) => {
    const state = get();
    set({
      levelCap,
      expToNextLevel: state.level >= levelCap ? 0 : getExpToNextLevel(state.level),
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

  refundSkill: async (nodeId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const node = getPassiveNode(nodeId);
    if (!node) return false;

    if (!canRefundNode(nodeId, state.unlockedSkills)) return false;

    const tokenConsumed = await settingsRepository.consumeRespecTokens(1);
    if (!tokenConsumed) return false;

    await skillRepository.remove(state.characterId, nodeId);

    const newUnlocked = state.unlockedSkills.filter((id) => id !== nodeId);
    const passiveEffects = calculatePassiveEffects(newUnlocked);
    const classStats = CLASS_INITIAL_STATS[state.characterType];
    const baseStats = {
      maxHp: classStats.maxHp + (state.level - 1) * 5,
      atk: classStats.atk,
      def: classStats.def,
    };

    const newMaxHp = baseStats.maxHp + passiveEffects.hp;
    const newAtk = baseStats.atk + passiveEffects.atk;
    const newDef = baseStats.def + passiveEffects.def;
    const newSkillPoints = state.skillPoints + 1;

    await characterRepository.updateStats(state.characterId, {
      skillPoints: newSkillPoints,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    set({
      skillPoints: newSkillPoints,
      unlockedSkills: newUnlocked,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    return true;
  },

  unlockUberSkill: async (nodeId: string) => {
    const state = get();
    if (!state.characterId) return false;
    if (state.uberPoints < 1) return false;
    if (!canUnlockUberNode(nodeId, state.unlockedUberSkills)) return false;

    const success = await uberTreeRepository.unlock(state.characterId, nodeId);
    if (!success) return false;

    set({
      unlockedUberSkills: [...state.unlockedUberSkills, nodeId],
      uberPoints: state.uberPoints - 1,
    });
    return true;
  },

  refundUberSkill: async (nodeId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;
    if (!canRefundUberNode(nodeId, state.unlockedUberSkills)) return false;

    const tokenConsumed = await settingsRepository.consumeRespecTokens(1);
    if (!tokenConsumed) return false;

    const removed = await uberTreeRepository.remove(state.characterId, nodeId);
    if (!removed) return false;

    set({
      unlockedUberSkills: state.unlockedUberSkills.filter((id) => id !== nodeId),
      uberPoints: state.uberPoints + 1,
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
    if (state.inventory.length >= get().getInventoryMaxSize()) {
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

  removeItemsFromInventory: async (instanceIds: string[]): Promise<number> => {
    const state = get();
    if (!state.characterId || instanceIds.length === 0) return 0;

    const removedCount = await inventoryRepository.removeItems(state.characterId, instanceIds);
    if (removedCount <= 0) return 0;

    const targetIds = new Set(instanceIds);
    set({
      inventory: state.inventory.filter((item) => !targetIds.has(item.instanceId)),
    });

    return removedCount;
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

    // HP回復変換用
    let equipHpRegen = 0;
    let equipHpRegenPct = 0;
    let equipHpRegenToAtkPct = 0;

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
            if (mod.type === 'hp_regen') equipHpRegen += mod.value;
            if (mod.type === 'hp_regen_pct') equipHpRegenPct += mod.value;
            if (mod.type === 'hp_regen_to_atk_pct') equipHpRegenToAtkPct += mod.value;
          }
        }
      }
    });

    // 2. パッシブ効果を取得（inc%/more%含む）
    const passiveEffects = calculatePassiveEffects(state.unlockedSkills);

    // 2.5. Uberツリー効果を取得
    const uberEffects = calculateUberTreeEffects(state.unlockedUberSkills);

    // 2.6. アクティブペットの increased% バフ／maxHp フラットバフを取得
    let petAtkIncPct = 0;
    let petDefIncPct = 0;
    let petMaxHpFlat = 0;
    if (state.activePetInstanceId) {
      const activePet = state.pets.find(
        (p) => p.instanceId === state.activePetInstanceId
      );
      const petDef = activePet ? getPet(activePet.petId) : undefined;
      if (petDef && activePet) {
        // テイマーはクラス固有能力でペット効果が倍化する
        const petMult = CLASS_ABILITIES[state.characterType].petEffectMultiplier ?? 1;
        // 強化レベルによるバフ倍率
        const levelFactor = getPetLevelFactor(state.petLevels[activePet.petId] ?? 1);
        petAtkIncPct += (petDef.buff.atkIncreasedPct ?? 0) * petMult * levelFactor;
        petDefIncPct += (petDef.buff.defIncreasedPct ?? 0) * petMult * levelFactor;
        // maxHp は increased% を通さない純粋なフラット加算（ペット倍率のみ反映）
        petMaxHpFlat += (petDef.buff.maxHp ?? 0) * petMult * levelFactor;
      }
    }

    // 3. PoE式計算で最終ステータスを算出（装備+パッシブ+Uberツリー+ペットのincreased%を合算）
    const finalStats = calculateFinalStats(
      { maxHp: baseMaxHp + uberEffects.hp, atk: baseAtk + uberEffects.atk, def: baseDef + uberEffects.def },
      {
        hp_increased_pct: passiveEffects.hp_increased_pct + equipHpIncPct + uberEffects.hp_increased_pct,
        atk_increased_pct: passiveEffects.atk_increased_pct + equipAtkIncPct + uberEffects.atk_increased_pct + petAtkIncPct,
        def_increased_pct: passiveEffects.def_increased_pct + equipDefIncPct + uberEffects.def_increased_pct + petDefIncPct,
        hp_more_pct: [...passiveEffects.hp_more_pct, ...uberEffects.hp_more_pct],
        atk_more_pct: [...passiveEffects.atk_more_pct, ...uberEffects.atk_more_pct],
        def_more_pct: [...passiveEffects.def_more_pct, ...uberEffects.def_more_pct],
      }
    );

    // 3.4. ペットの maxHp フラットバフを加算（increased% を通さない純粋加算）
    if (petMaxHpFlat > 0) {
      finalStats.maxHp += Math.floor(petMaxHpFlat);
    }

    // 3.5. Uberツリー: 防御転換（DEF + maxHP/2 をATKに追加）
    if (uberEffects.def_hp_to_atk) {
      finalStats.atk += finalStats.def + Math.floor(finalStats.maxHp / 2);
    }

    // 4. HP回復変換: 毎秒HP回復量の一定%をATKに加算
    if (equipHpRegenToAtkPct > 0) {
      const totalHpRegen = equipHpRegen + passiveEffects.hp_regen;
      const totalHpRegenPct = equipHpRegenPct + passiveEffects.hp_regen_pct;
      const pctRegen = Math.floor(finalStats.maxHp * totalHpRegenPct / 100);
      const regenToAtkBonus = Math.floor((totalHpRegen + pctRegen) * equipHpRegenToAtkPct / 100);
      finalStats.atk += regenToAtkBonus;
    }

    return finalStats;
  },

  getInventoryMaxSize: () => {
    return hasInventoryExpansion() ? INVENTORY_EXPANDED_SIZE : INVENTORY_BASE_SIZE;
  },

  getInventorySpace: () => {
    const state = get();
    const maxSize = get().getInventoryMaxSize();
    return maxSize - state.inventory.length;
  },

  isInventoryFull: () => {
    const state = get();
    const maxSize = get().getInventoryMaxSize();
    return state.inventory.length >= maxSize;
  },

  getStorageMaxSize: () => {
    return hasStorageExpansion() ? STORAGE_EXPANDED_SIZE : STORAGE_BASE_SIZE;
  },

  refresh: async () => {
    const state = get();
    if (!state.characterId) return;
    await get().loadCharacter(state.characterId);
  },

  clear: () => {
    // アクティブツリーも最新シーズンに戻す（次の loadCharacter で必ず上書きされるが安全策）
    setActivePassiveSeason(LATEST_PASSIVE_SEASON);
    set(initialState);
  },

  renameCharacter: async (newName: string) => {
    const state = get();
    if (!state.characterId) return;

    await characterRepository.updateName(state.characterId, newName);
    set({ characterName: newName });
  },

  // デバッグ: パッシブプリセットを適用（既存スキルをクリアして適用）
  applyPassivePreset: async (nodeIds: string[]) => {
    const state = get();
    if (!state.characterId) return;

    // DBにプリセットを適用
    await skillRepository.applyPreset(state.characterId, nodeIds);

    // パッシブ効果を計算してステータスを更新（クラス別初期ステータスを使用）
    const passiveEffects = calculatePassiveEffects(nodeIds);
    const classStats = CLASS_INITIAL_STATS[state.characterType];
    const baseStats = {
      maxHp: classStats.maxHp + (state.level - 1) * 5, // レベルアップ分
      atk: classStats.atk,
      def: classStats.def,
    };

    // フラット加算
    const newMaxHp = baseStats.maxHp + passiveEffects.hp;
    const newAtk = baseStats.atk + passiveEffects.atk;
    const newDef = baseStats.def + passiveEffects.def;

    // DBに保存
    await characterRepository.updateStats(state.characterId, {
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });

    set({
      unlockedSkills: nodeIds,
      maxHp: newMaxHp,
      atk: newAtk,
      def: newDef,
    });
  },

  // デバッグ: レベルとSPを設定（クラス別初期ステータスを使用）
  setDebugLevel: async (level: number) => {
    const state = get();
    if (!state.characterId) return;

    const classStats = CLASS_INITIAL_STATS[state.characterType];
    const skillPoints = level - 1; // レベル-1のSP
    const maxHp = classStats.maxHp + (level - 1) * 5;
    const atk = classStats.atk;
    const def = classStats.def;

    await characterRepository.updateStats(state.characterId, {
      level,
      exp: 0,
      skillPoints,
      maxHp,
      atk,
      def,
    });

    // スキルもクリア
    await skillRepository.clear(state.characterId);

    set({
      level,
      exp: 0,
      expToNextLevel: getExpToNextLevel(level),
      skillPoints,
      maxHp,
      atk,
      def,
      unlockedSkills: [],
    });
  },

  // デバッグ: 装備プリセットを適用（既存装備をクリアして適用）
  applyEquipmentPreset: async (equipmentSet: EquipmentSet) => {
    const state = get();
    if (!state.characterId) return;

    // 既存装備をすべて解除
    for (const slot of ['weapon', 'armor', 'gloves', 'boots', 'accessory'] as const) {
      await equipmentRepository.unequip(state.characterId, slot);
    }

    // インベントリをクリア（装備プリセット用）
    await inventoryRepository.clear(state.characterId);

    // 新しい装備を適用
    const newEquipment: Equipment = {
      weapon: null,
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    };

    const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];
    for (const slot of slots) {
      const item = equipmentSet[slot];
      if (item) {
        await equipmentRepository.equip(state.characterId, slot, item);
        newEquipment[slot] = item;
      }
    }

    set({
      equipment: newEquipment,
      inventory: [],
    });
  },

  addPet: async (petId: string): Promise<PetInstance | null> => {
    const state = get();
    if (!state.characterId) return null;
    if (!getPet(petId)) return null;

    // 容量チェック（満杯ならドロップ自体を破棄）
    if (state.pets.length >= get().getPetMaxSize()) {
      return null;
    }

    const instance = await petRepository.add(state.characterId, petId);
    const newPets = [...state.pets, instance];

    // 初取得時は自動でアクティブに設定
    let nextActiveId = state.activePetInstanceId;
    if (!nextActiveId) {
      await petRepository.setActivePet(state.characterId, instance.instanceId);
      nextActiveId = instance.instanceId;
    }

    set({ pets: newPets, activePetInstanceId: nextActiveId });
    return instance;
  },

  setActivePet: async (instanceId: string | null): Promise<void> => {
    const state = get();
    if (!state.characterId) return;

    if (instanceId !== null && !state.pets.some((p) => p.instanceId === instanceId)) {
      return;
    }

    await petRepository.setActivePet(state.characterId, instanceId);
    set({ activePetInstanceId: instanceId });
  },

  getPetMaxSize: () => {
    return hasPetExpansion() ? PET_EXPANDED_SIZE : PET_BASE_SIZE;
  },

  getPetSpace: () => {
    const state = get();
    return Math.max(0, get().getPetMaxSize() - state.pets.length);
  },

  isPetStorageFull: () => {
    const state = get();
    return state.pets.length >= get().getPetMaxSize();
  },

  getPetLevel: (petId: string) => {
    return get().petLevels[petId] ?? 1;
  },

  discardPetDuplicate: async (petId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const instances = state.pets.filter((p) => p.petId === petId);
    // 最後の1体は破棄不可（重複＝2体以上のときのみ）
    if (instances.length < 2) return false;

    // アクティブ個体は残し、最も新しい個体を破棄
    const deletable = instances.filter((p) => p.instanceId !== state.activePetInstanceId);
    const target = deletable[deletable.length - 1];
    if (!target) return false;

    await petRepository.remove(state.characterId, target.instanceId);
    set({ pets: state.pets.filter((p) => p.instanceId !== target.instanceId) });
    return true;
  },

  upgradePet: async (petId: string): Promise<boolean> => {
    const state = get();
    if (!state.characterId) return false;

    const level = state.petLevels[petId] ?? 1;
    if (level >= PET_MAX_LEVEL) return false;

    const cost = getPetUpgradeCost(level);
    if (cost === null) return false;

    const instances = state.pets.filter((p) => p.petId === petId);
    // アクティブ個体（または最低1体）は残す必要がある
    if (instances.length - 1 < cost) return false;

    // アクティブ個体を避けて、新しい個体からcost体を消費
    const deletable = instances.filter((p) => p.instanceId !== state.activePetInstanceId);
    const toDelete = deletable.slice(deletable.length - cost);
    if (toDelete.length < cost) return false;

    const idsToDelete = new Set(toDelete.map((p) => p.instanceId));
    await petRepository.removeInstances(state.characterId, [...idsToDelete]);

    const newLevel = level + 1;
    await petRepository.setLevel(state.characterId, petId, newLevel);

    set({
      pets: state.pets.filter((p) => !idsToDelete.has(p.instanceId)),
      petLevels: { ...state.petLevels, [petId]: newLevel },
    });
    return true;
  },
}));
