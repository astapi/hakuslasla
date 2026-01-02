import { getDatabase } from '../database';
import { EquipmentSlot, Item } from '@/types';
import { getItemBase } from '@/data/items';

interface EquipmentRow {
  slot: string;
  item_data: string | null;
}

export interface EquipmentRecord {
  slot: EquipmentSlot;
  item: Item | null;
}

// マイグレーション済みアイテムのフラグ付き型
interface MigratedItem extends Partial<Item> {
  id: string;
  instanceId: string;
  mods: Item['mods'];
  _needsMigration?: boolean;
}

/**
 * マイグレーション済みアイテムをマスターデータから補完
 */
function completeItemFromMaster(data: MigratedItem): Item | null {
  if (!data._needsMigration) {
    return data as Item;
  }

  const base = getItemBase(data.id);
  if (!base) {
    console.warn(`[Migration] Item master not found: ${data.id}`);
    return null;
  }

  return {
    ...base,
    instanceId: data.instanceId,
    mods: data.mods || base.fixedMods || [],
  };
}

export const equipmentRepository = {
  /**
   * 全装備を取得
   */
  async getAll(characterId: number): Promise<EquipmentRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<EquipmentRow>(
      'SELECT slot, item_data FROM character_equipment WHERE character_id = ?',
      characterId
    );

    const records: EquipmentRecord[] = [];
    const needsUpdate: { slot: EquipmentSlot; item: Item }[] = [];

    for (const row of rows) {
      const slot = row.slot as EquipmentSlot;
      let item: Item | null = null;

      if (row.item_data) {
        const data = JSON.parse(row.item_data) as MigratedItem;
        item = completeItemFromMaster(data);

        if (item && data._needsMigration) {
          needsUpdate.push({ slot, item });
        }
      }

      records.push({ slot, item });
    }

    // マイグレーション済みアイテムをDBに書き戻し
    for (const { slot, item } of needsUpdate) {
      await db.runAsync(
        'UPDATE character_equipment SET item_data = ? WHERE character_id = ? AND slot = ?',
        JSON.stringify(item),
        characterId,
        slot
      );
    }

    return records;
  },

  /**
   * 特定スロットの装備を取得
   */
  async getBySlot(characterId: number, slot: EquipmentSlot): Promise<Item | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ item_data: string | null }>(
      'SELECT item_data FROM character_equipment WHERE character_id = ? AND slot = ?',
      characterId,
      slot
    );
    if (!row?.item_data) return null;
    return JSON.parse(row.item_data) as Item;
  },

  /**
   * アイテムを装備
   */
  async equip(characterId: number, slot: EquipmentSlot, item: Item): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE character_equipment SET item_data = ? WHERE character_id = ? AND slot = ?',
      JSON.stringify(item),
      characterId,
      slot
    );
  },

  /**
   * 装備を解除（解除したアイテムを返す）
   */
  async unequip(characterId: number, slot: EquipmentSlot): Promise<Item | null> {
    const db = await getDatabase();

    // 現在装備中のアイテムを取得
    const currentItem = await this.getBySlot(characterId, slot);

    // 装備を解除
    await db.runAsync(
      'UPDATE character_equipment SET item_data = NULL WHERE character_id = ? AND slot = ?',
      characterId,
      slot
    );

    return currentItem;
  },

  /**
   * 全装備を解除
   */
  async unequipAll(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE character_equipment SET item_data = NULL WHERE character_id = ?',
      characterId
    );
  },
};
