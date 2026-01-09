import { Item, ItemBase, ItemMod, ItemDrop, DungeonDropTable, ModConfig, ModTierRange, ModCountRange, EquipmentSlot } from '@/types';
import itemsData from './json/items.json';
import dungeonsData from './json/dungeons.json';
import modsData from './json/mods.json';

// アイテム基本データ（_commentキーを除外）
const itemBases: Record<string, ItemBase> = {};
for (const [id, item] of Object.entries(itemsData.items)) {
  if (!id.startsWith('_comment')) {
    itemBases[id] = item as ItemBase;
  }
}

// MOD設定
const modConfigs: ModConfig[] = modsData.modConfigs as ModConfig[];

// ダンジョンデータからmodTierRangeを取得するヘルパー
function getDungeonModTierRange(dungeonId: string): ModTierRange | undefined {
  const dungeon = (dungeonsData.dungeons as Record<string, { modTierRange?: ModTierRange }>)[dungeonId];
  return dungeon?.modTierRange;
}

// ダンジョンデータからmodCountRangeを取得するヘルパー
function getDungeonModCountRange(dungeonId: string): ModCountRange | undefined {
  const dungeon = (dungeonsData.dungeons as Record<string, { modCountRange?: ModCountRange }>)[dungeonId];
  return dungeon?.modCountRange;
}

/**
 * 指定されたtierの値範囲からランダムに値を取得
 */
function calculateValueFromTierRange(min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * MOD設定から利用可能なtierリストを取得
 */
function getAvailableTiers(config: ModConfig): number[] {
  return Object.keys(config.tiers).map(t => parseInt(t, 10));
}

/**
 * 指定されたtier範囲内でランダムにtierを選択（均等確率）
 * @param minTier 最低tier（数値が大きい方、例: 10）
 * @param maxTier 最高tier（数値が小さい方、例: 7）
 */
function rollTier(minTier: number, maxTier: number): number {
  // minTier >= maxTier (数値的に)
  // 例: minTier=10, maxTier=7 → 7, 8, 9, 10から均等確率で選択
  const tierRange = minTier - maxTier + 1;
  return maxTier + Math.floor(Math.random() * tierRange);
}

/**
 * tierの表示名を取得
 */
export function getTierDisplayName(tier: number): string {
  return `T${tier}`;
}

/**
 * tierに応じた色を取得
 */
export function getTierColor(tier: number): string {
  if (tier <= 2) return '#FFD700';      // 金色（T1-T2）
  if (tier <= 4) return '#9370DB';      // 紫（T3-T4）
  if (tier <= 6) return '#4169E1';      // 青（T5-T6）
  if (tier <= 8) return '#32CD32';      // 緑（T7-T8）
  return '#AAAAAA';                      // 灰色（T9-T10）
}

/**
 * 1戦闘あたりのドロップ設定
 */
export const DROP_CONFIG = {
  // ドロップ数ごとの確率（%）- 上から順に判定
  dropChances: [
    { count: 3, chance: 2 },   // 3個ドロップ: 2%
    { count: 2, chance: 8 },   // 2個ドロップ: 8%
    { count: 1, chance: 20 },  // 1個ドロップ: 20%
    // 残り70%はドロップなし
  ],
};

/**
 * ドロップ数を決定（0〜3個）
 */
export function rollDropCount(): number {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const { count, chance } of DROP_CONFIG.dropChances) {
    cumulative += chance;
    if (roll < cumulative) {
      return count;
    }
  }

  return 0; // ドロップなし
}

/**
 * ドロップテーブルから指定数のアイテムをランダム選択
 * @param dropTable ダンジョンドロップテーブル
 * @param count ドロップ数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 */
export function rollDropItems(dropTable: DungeonDropTable, count: number, dungeonId?: string): Item[] {
  if (count <= 0) return [];

  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const totalWeight = allDrops.reduce((sum, drop) => sum + drop.dropRate, 0);
  const items: Item[] = [];

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    let roll = Math.random() * totalWeight;
    let selectedItemId: string | null = null;

    for (const drop of allDrops) {
      roll -= drop.dropRate;
      if (roll <= 0) {
        selectedItemId = drop.itemId;
        break;
      }
    }

    if (selectedItemId) {
      // ダンジョンのMOD数範囲を取得（なければデフォルト: 0-2）
      const countRange = dungeonId
        ? getDungeonModCountRange(dungeonId) ?? { min: 0, max: 2 }
        : { min: 0, max: 2 };
      // 範囲内でランダムにMOD数を決定
      const modCount = countRange.min + Math.floor(Math.random() * (countRange.max - countRange.min + 1));
      const item = createItemInstance(selectedItemId, modCount, dungeonId);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

// インスタンスIDカウンター
let instanceIdCounter = 0;

/**
 * ユニークなインスタンスIDを生成
 */
function generateInstanceId(): string {
  return `item_${Date.now()}_${instanceIdCounter++}`;
}

/**
 * アイテム基本データを取得
 */
export const getItemBase = (id: string): ItemBase | undefined => {
  return itemBases[id];
};

/**
 * ランダムなMODを生成（ダンジョンのtier範囲とアイテムスロットを考慮）
 * @param count 生成するMODの数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param itemSlot アイテムのスロット（スロット制限MOD用）
 */
export function generateRandomMods(count: number, dungeonId?: string, itemSlot?: EquipmentSlot): ItemMod[] {
  const mods: ItemMod[] = [];

  // ダンジョンのtier範囲を取得（なければデフォルト: 10-1）
  const tierRange = dungeonId
    ? getDungeonModTierRange(dungeonId) ?? { minTier: 10, maxTier: 1 }
    : { minTier: 10, maxTier: 1 };

  // このダンジョンで出現可能なMODをフィルタリング
  // MODが持つtierとダンジョンのtier範囲が重複するかチェック
  // また、スロット制限がある場合はアイテムのスロットもチェック
  const availableConfigs = modConfigs.filter(config => {
    // スロット制限チェック
    if (config.slots && itemSlot && !config.slots.includes(itemSlot)) {
      return false;
    }
    const modTiers = getAvailableTiers(config);
    // ダンジョンで出現可能なtier範囲内にMODのtierが1つでもあるか
    return modTiers.some(t => t <= tierRange.minTier && t >= tierRange.maxTier);
  });

  if (availableConfigs.length === 0) {
    return mods;
  }

  const totalWeight = availableConfigs.reduce((sum, config) => sum + config.weight, 0);

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

    if (selectedConfig) {
      // 同じタイプのMODが既にあればスキップ
      if (mods.some(m => m.type === selectedConfig!.type)) {
        continue;
      }

      // ダンジョン範囲内で利用可能なtierを取得
      const modTiers = getAvailableTiers(selectedConfig);
      const validTiers = modTiers.filter(t => t <= tierRange.minTier && t >= tierRange.maxTier);

      if (validTiers.length === 0) continue;

      // 有効なtierから均等抽選
      const tier = validTiers[Math.floor(Math.random() * validTiers.length)];

      // tierの値範囲から値を取得
      const tierConfig = selectedConfig.tiers[tier.toString()];
      const value = calculateValueFromTierRange(tierConfig.min, tierConfig.max);

      mods.push({
        type: selectedConfig.type,
        value,
        tier,
      });
    }
  }

  return mods;
}

/**
 * アイテムインスタンスを生成（MOD付き）
 * @param itemId アイテムID
 * @param modCount ランダムMODの数（0-2）
 * @param dungeonId ダンジョンID（tier範囲取得用）
 */
export function createItemInstance(itemId: string, modCount: number = 0, dungeonId?: string): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MOD（tierを追加: 固有MODは常にtier 1）
  const fixedMods: ItemMod[] = (base.fixedMods || []).map(mod => ({
    ...mod,
    tier: mod.tier ?? 1,  // 固有MODはデフォルトtier 1
  }));

  // ランダムMOD（ダンジョンのtier範囲とスロットを考慮）
  const randomMods = modCount > 0 ? generateRandomMods(modCount, dungeonId, base.slot) : [];

  // 重複するタイプのMODを除外（固有MOD優先）
  const fixedTypes = new Set(fixedMods.map(m => m.type));
  const filteredRandomMods = randomMods.filter(m => !fixedTypes.has(m.type));

  return {
    ...base,
    instanceId: generateInstanceId(),
    mods: [...fixedMods, ...filteredRandomMods],
  };
}

/**
 * ドロップテーブルからランダムなアイテムを選択してインスタンス生成
 * @param dropTable ダンジョンドロップテーブル
 * @param modCount ランダムMODの数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 */
export const getRandomItemFromDungeon = (
  dropTable: DungeonDropTable,
  modCount: number = 1,
  dungeonId?: string
): Item | undefined => {
  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const itemId = selectRandomItemId(allDrops);
  if (!itemId) return undefined;

  return createItemInstance(itemId, modCount, dungeonId);
};

/**
 * ドロップ確率に基づいてランダムなアイテムIDを選択
 */
function selectRandomItemId(drops: ItemDrop[]): string | undefined {
  if (drops.length === 0) return undefined;

  const totalRate = drops.reduce((sum, drop) => sum + drop.dropRate, 0);
  let random = Math.random() * totalRate;

  for (const drop of drops) {
    random -= drop.dropRate;
    if (random <= 0) {
      return drop.itemId;
    }
  }

  return drops[drops.length - 1].itemId;
}

/**
 * モンスターユニークドロップを判定
 * @param itemId アイテムID
 * @param dropRate ドロップ確率（%）
 */
export const tryUniqueDrop = (itemId: string, dropRate: number): Item | undefined => {
  const random = Math.random() * 100;
  if (random < dropRate) {
    // ユニークアイテムはランダムMODなし（固有MODのみ）
    return createItemInstance(itemId, 0);
  }
  return undefined;
};

/**
 * MODの効果を日本語で取得
 */
export function getModDescription(mod: ItemMod): string {
  switch (mod.type) {
    case 'atk_bonus':
      return `ATK+${mod.value}`;
    case 'def_bonus':
      return `DEF+${mod.value}`;
    case 'hp_regen':
      return `毎ターンHP${mod.value}回復`;
    case 'poison_chance':
      return `毒付与+${mod.value}%`;
    case 'critical_chance':
      return `クリティカル+${mod.value}%`;
    default:
      return '';
  }
}

/**
 * アイテムの全MOD効果をまとめて取得
 */
export function getItemModsDescription(item: Item): string[] {
  return item.mods.map(mod => getModDescription(mod));
}

/**
 * 装備品のMOD効果を集計
 */
export interface ModEffects {
  atkBonus: number;
  defBonus: number;
  hpRegen: number;
  hpRegenPct: number;
  poisonChance: number;
  criticalChance: number;
  damageReductionPct: number;
}

/**
 * アイテムからMOD効果を取得
 */
export function getModEffects(item: Item): ModEffects {
  const effects: ModEffects = {
    atkBonus: 0,
    defBonus: 0,
    hpRegen: 0,
    hpRegenPct: 0,
    poisonChance: 0,
    criticalChance: 0,
    damageReductionPct: 0,
  };

  for (const mod of item.mods) {
    switch (mod.type) {
      case 'atk_bonus':
        effects.atkBonus += mod.value;
        break;
      case 'def_bonus':
        effects.defBonus += mod.value;
        break;
      case 'hp_regen':
        effects.hpRegen += mod.value;
        break;
      case 'hp_regen_pct':
        effects.hpRegenPct += mod.value;
        break;
      case 'poison_chance':
        effects.poisonChance += mod.value;
        break;
      case 'critical_chance':
        effects.criticalChance += mod.value;
        break;
      case 'damage_reduction_pct':
        effects.damageReductionPct += mod.value;
        break;
    }
  }

  return effects;
}

/**
 * 複数のアイテムからMOD効果を合計
 */
export function combineModEffects(items: (Item | null)[]): ModEffects {
  const combined: ModEffects = {
    atkBonus: 0,
    defBonus: 0,
    hpRegen: 0,
    hpRegenPct: 0,
    poisonChance: 0,
    criticalChance: 0,
    damageReductionPct: 0,
  };

  for (const item of items) {
    if (item) {
      const effects = getModEffects(item);
      combined.atkBonus += effects.atkBonus;
      combined.defBonus += effects.defBonus;
      combined.hpRegen += effects.hpRegen;
      combined.hpRegenPct += effects.hpRegenPct;
      combined.poisonChance += effects.poisonChance;
      combined.criticalChance += effects.criticalChance;
      combined.damageReductionPct += effects.damageReductionPct;
    }
  }

  return combined;
}

/**
 * ItemBaseをItemインスタンスに変換（固有MODのみ）
 * 装備時にDBから読み込む際に使用
 */
export function createItemFromBase(itemId: string): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MODにtierを追加（デフォルトtier 1）
  const modsWithTier: ItemMod[] = (base.fixedMods || []).map(mod => ({
    ...mod,
    tier: mod.tier ?? 1,
  }));

  return {
    ...base,
    instanceId: `equipped_${itemId}`,
    mods: modsWithTier,
  };
}

/**
 * 既存アイテムのMODにtierを補完する
 * DBから読み込んだアイテムに対して使用
 */
export function ensureModTiers(item: Item): Item {
  return {
    ...item,
    mods: item.mods.map(mod => ({
      ...mod,
      tier: mod.tier ?? 10,  // 既存アイテムはデフォルトtier 10（最低）
    })),
  };
}

// 後方互換性のためのエクスポート
export const items = itemBases;

/**
 * アイテムを取得（Item形式で返す）
 * @deprecated 今後はcreateItemFromBaseを使用してください
 */
export function getItem(itemId: string): Item | undefined {
  return createItemFromBase(itemId);
}
