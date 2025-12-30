import { getDatabase } from '../database';
import { StorageItem } from '@/types';

interface StorageRow {
  item_id: string;
  quantity: number;
}

export const storageRepository = {
  async getAll(): Promise<StorageItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<StorageRow>(
      'SELECT item_id, quantity FROM storage'
    );
    return rows.map((row) => ({
      itemId: row.item_id,
      quantity: row.quantity,
    }));
  },

  async deposit(itemId: string, quantity: number = 1): Promise<void> {
    const db = await getDatabase();
    // UPSERT: 既存なら数量追加、なければ新規作成
    await db.runAsync(
      `INSERT INTO storage (item_id, quantity)
       VALUES (?, ?)
       ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
      itemId,
      quantity
    );
  },

  async withdraw(itemId: string, quantity: number = 1): Promise<boolean> {
    const db = await getDatabase();

    // 現在の数量を確認
    const current = await db.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM storage WHERE item_id = ?',
      itemId
    );

    if (!current || current.quantity < quantity) {
      return false; // 足りない
    }

    if (current.quantity === quantity) {
      // 全部削除
      await db.runAsync(
        'DELETE FROM storage WHERE item_id = ?',
        itemId
      );
    } else {
      // 数量を減らす
      await db.runAsync(
        'UPDATE storage SET quantity = quantity - ? WHERE item_id = ?',
        quantity,
        itemId
      );
    }

    return true;
  },

  async getItemQuantity(itemId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM storage WHERE item_id = ?',
      itemId
    );
    return row?.quantity ?? 0;
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM storage');
  },
};
