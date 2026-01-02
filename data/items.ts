import { Item, ItemBase, ItemMod, ItemDrop, DungeonDropTable, ModConfig } from '@/types';
import itemsData from './json/items.json';

// アイテム基本データ（_commentキーを除外）
const itemBases: Record<string, ItemBase> = {};
for (const [id, item] of Object.entries(itemsData.items)) {
  if (!id.startsWith('_comment')) {
    itemBases[id] = item as ItemBase;
  }
}

// MOD設定
const modConfigs: ModConfig[] = itemsData.modConfigs as ModConfig[];

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
 */
export function rollDropItems(dropTable: DungeonDropTable, count: number): Item[] {
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
      // ランダムMOD付きでアイテム生成（0〜2個のMOD）
      const modCount = Math.floor(Math.random() * 3); // 0, 1, or 2
      const item = createItemInstance(selectedItemId, modCount);
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
 * ランダムなMODを生成
 * @param count 生成するMODの数
 */
export function generateRandomMods(count: number): ItemMod[] {
  const mods: ItemMod[] = [];
  const totalWeight = modConfigs.reduce((sum, config) => sum + config.weight, 0);

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    let random = Math.random() * totalWeight;
    let selectedConfig: ModConfig | null = null;

    for (const config of modConfigs) {
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

      const value = Math.floor(
        Math.random() * (selectedConfig.maxValue - selectedConfig.minValue + 1)
      ) + selectedConfig.minValue;

      mods.push({
        type: selectedConfig.type,
        value,
      });
    }
  }

  return mods;
}

/**
 * アイテムインスタンスを生成（MOD付き）
 * @param itemId アイテムID
 * @param modCount ランダムMODの数（0-2）
 */
export function createItemInstance(itemId: string, modCount: number = 0): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MOD + ランダムMOD
  const fixedMods = base.fixedMods || [];
  const randomMods = modCount > 0 ? generateRandomMods(modCount) : [];

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
 */
export const getRandomItemFromDungeon = (
  dropTable: DungeonDropTable,
  modCount: number = 1
): Item | undefined => {
  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const itemId = selectRandomItemId(allDrops);
  if (!itemId) return undefined;

  return createItemInstance(itemId, modCount);
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
  poisonChance: number;
  criticalChance: number;
}

/**
 * アイテムからMOD効果を取得
 */
export function getModEffects(item: Item): ModEffects {
  const effects: ModEffects = {
    atkBonus: 0,
    defBonus: 0,
    hpRegen: 0,
    poisonChance: 0,
    criticalChance: 0,
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
      case 'poison_chance':
        effects.poisonChance += mod.value;
        break;
      case 'critical_chance':
        effects.criticalChance += mod.value;
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
    poisonChance: 0,
    criticalChance: 0,
  };

  for (const item of items) {
    if (item) {
      const effects = getModEffects(item);
      combined.atkBonus += effects.atkBonus;
      combined.defBonus += effects.defBonus;
      combined.hpRegen += effects.hpRegen;
      combined.poisonChance += effects.poisonChance;
      combined.criticalChance += effects.criticalChance;
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

  return {
    ...base,
    instanceId: `equipped_${itemId}`,
    mods: base.fixedMods || [],
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
