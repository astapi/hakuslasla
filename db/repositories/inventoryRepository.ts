import { getDatabase } from '../database';
import { Item } from '@/types';
import { getItemBase } from '@/data/items';

interface InventoryRow {
  instance_id: string;
  item_data: string;
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
    // マイグレーション不要な正常なItem
    return data as Item;
  }

  // マスターデータから補完
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

export const inventoryRepository = {
  /**
   * キャラクターのインベントリを全取得
   */
  async getAll(characterId: number): Promise<Item[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<InventoryRow>(
      'SELECT instance_id, item_data FROM character_inventory WHERE character_id = ?',
      characterId
    );

    const items: Item[] = [];
    const needsUpdate: Item[] = [];

    for (const row of rows) {
      const data = JSON.parse(row.item_data) as MigratedItem;
      const item = completeItemFromMaster(data);

      if (item) {
        items.push(item);
        // マイグレーション済みアイテムは更新が必要
        if (data._needsMigration) {
          needsUpdate.push(item);
        }
      }
    }

    // マイグレーション済みアイテムをDBに書き戻し（次回から補完不要に）
    for (const item of needsUpdate) {
      await db.runAsync(
        'UPDATE character_inventory SET item_data = ? WHERE character_id = ? AND instance_id = ?',
        JSON.stringify(item),
        characterId,
        item.instanceId
      );
    }

    return items;
  },

  /**
   * アイテムをインベントリに追加（MOD付きItemインスタンス）
   */
  async addItem(characterId: number, item: Item): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO character_inventory (character_id, instance_id, item_data)
       VALUES (?, ?, ?)`,
      characterId,
      item.instanceId,
      JSON.stringify(item)
    );
  },

  /**
   * アイテムをインベントリから削除（instanceIdで指定）
   */
  async removeItem(characterId: number, instanceId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'DELETE FROM character_inventory WHERE character_id = ? AND instance_id = ?',
      characterId,
      instanceId
    );
    return result.changes > 0;
  },

  /**
   * 特定のアイテムを取得
   */
  async getItem(characterId: number, instanceId: string): Promise<Item | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<InventoryRow>(
      'SELECT instance_id, item_data FROM character_inventory WHERE character_id = ? AND instance_id = ?',
      characterId,
      instanceId
    );
    if (!row) return null;
    return JSON.parse(row.item_data) as Item;
  },

  /**
   * インベントリをクリア
   */
  async clear(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM character_inventory WHERE character_id = ?',
      characterId
    );
  },
};
