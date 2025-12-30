import { getDatabase } from '../database';
import { EquipmentSlot, EquipmentRecord } from '@/types';

interface EquipmentRow {
  slot: string;
  item_id: string | null;
}

export const equipmentRepository = {
  async getAll(characterId: number): Promise<EquipmentRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<EquipmentRow>(
      'SELECT slot, item_id FROM character_equipment WHERE character_id = ?',
      characterId
    );
    return rows.map((row) => ({
      slot: row.slot as EquipmentSlot,
      itemId: row.item_id,
    }));
  },

  async getBySlot(characterId: number, slot: EquipmentSlot): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ item_id: string | null }>(
      'SELECT item_id FROM character_equipment WHERE character_id = ? AND slot = ?',
      characterId,
      slot
    );
    return row?.item_id ?? null;
  },

  async equip(characterId: number, slot: EquipmentSlot, itemId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE character_equipment SET item_id = ? WHERE character_id = ? AND slot = ?',
      itemId,
      characterId,
      slot
    );
  },

  async unequip(characterId: number, slot: EquipmentSlot): Promise<string | null> {
    const db = await getDatabase();

    // 現在装備中のアイテムを取得
    const currentItemId = await this.getBySlot(characterId, slot);

    // 装備を解除
    await db.runAsync(
      'UPDATE character_equipment SET item_id = NULL WHERE character_id = ? AND slot = ?',
      characterId,
      slot
    );

    return currentItemId;
  },

  async unequipAll(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE character_equipment SET item_id = NULL WHERE character_id = ?',
      characterId
    );
  },
};
