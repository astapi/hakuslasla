import { getDatabase } from '../database';
import { InventoryItem } from '@/types';

interface InventoryRow {
  item_id: string;
  quantity: number;
}

export const inventoryRepository = {
  async getAll(characterId: number): Promise<InventoryItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<InventoryRow>(
      'SELECT item_id, quantity FROM character_inventory WHERE character_id = ?',
      characterId
    );
    return rows.map((row) => ({
      itemId: row.item_id,
      quantity: row.quantity,
    }));
  },

  async addItem(characterId: number, itemId: string, quantity: number = 1): Promise<void> {
    const db = await getDatabase();
    // UPSERT: 既存なら数量追加、なければ新規作成
    await db.runAsync(
      `INSERT INTO character_inventory (character_id, item_id, quantity)
       VALUES (?, ?, ?)
       ON CONFLICT(character_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
      characterId,
      itemId,
      quantity
    );
  },

  async removeItem(characterId: number, itemId: string, quantity: number = 1): Promise<boolean> {
    const db = await getDatabase();

    // 現在の数量を確認
    const current = await db.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM character_inventory WHERE character_id = ? AND item_id = ?',
      characterId,
      itemId
    );

    if (!current || current.quantity < quantity) {
      return false; // 足りない
    }

    if (current.quantity === quantity) {
      // 全部削除
      await db.runAsync(
        'DELETE FROM character_inventory WHERE character_id = ? AND item_id = ?',
        characterId,
        itemId
      );
    } else {
      // 数量を減らす
      await db.runAsync(
        'UPDATE character_inventory SET quantity = quantity - ? WHERE character_id = ? AND item_id = ?',
        quantity,
        characterId,
        itemId
      );
    }

    return true;
  },

  async getItemQuantity(characterId: number, itemId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM character_inventory WHERE character_id = ? AND item_id = ?',
      characterId,
      itemId
    );
    return row?.quantity ?? 0;
  },

  async clear(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM character_inventory WHERE character_id = ?',
      characterId
    );
  },
};
