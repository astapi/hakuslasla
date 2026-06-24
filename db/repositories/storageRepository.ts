import { getDatabase } from '../database';
import { Item } from '@/types';
import { getItemBase, ensureModTiers } from '@/data/items';
import { STORAGE_BASE_SIZE, STORAGE_EXPANDED_SIZE } from '@/constants/purchases';
import { hasStorageExpansion } from '@/stores/usePurchaseStore';
import { getCurrentSeason } from '@/lib/rankingSeason';

interface StorageRow {
  instance_id: string;
  item_data: string;
}

interface MigratedItem {
  id: string;
  instanceId: string;
  mods: Item['mods'];
  _needsMigration?: boolean;
  name?: string;
  slot?: string;
  atk?: number;
  def?: number;
}

/**
 * マイグレーションで作成されたアイテムをマスターデータで補完
 * また、MODにtierがない場合はデフォルト値（10）を補完
 */
function completeItemFromMaster(data: MigratedItem): Item | null {
  if (!data._needsMigration && data.slot) {
    // マイグレーション不要な正常なItem（tierの補完は必要）
    return ensureModTiers(data as Item);
  }

  const base = getItemBase(data.id);
  if (!base) {
    return null;
  }

  const item: Item = {
    id: base.id,
    name: base.name,
    slot: base.slot,
    atk: base.atk,
    def: base.def,
    instanceId: data.instanceId,
    mods: data.mods || [],
  };

  // MODのtierを補完
  return ensureModTiers(item);
}

export const storageRepository = {
  /**
   * 全アイテムを取得
   */
  async getAll(season: number = getCurrentSeason()): Promise<Item[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<StorageRow>(
      'SELECT instance_id, item_data FROM storage WHERE season = ?',
      season
    );
    const items: Item[] = [];
    for (const row of rows) {
      const data = JSON.parse(row.item_data) as MigratedItem;
      const item = completeItemFromMaster(data);
      if (item) {
        items.push(item);
      }
    }
    return items;
  },

  /**
   * 現在の倉庫最大容量を取得
   */
  getMaxSize(): number {
    return hasStorageExpansion() ? STORAGE_EXPANDED_SIZE : STORAGE_BASE_SIZE;
  },

  /**
   * 倉庫の空き容量を取得
   */
  async getAvailableSpace(season: number = getCurrentSeason()): Promise<number> {
    const currentCount = await this.getCount(season);
    const maxSize = this.getMaxSize();
    return Math.max(0, maxSize - currentCount);
  },

  /**
   * 倉庫がいっぱいかどうか
   */
  async isFull(season: number = getCurrentSeason()): Promise<boolean> {
    const currentCount = await this.getCount(season);
    const maxSize = this.getMaxSize();
    return currentCount >= maxSize;
  },

  /**
   * アイテムを倉庫に追加（MOD保持）
   * 容量チェック付き
   */
  async addItem(item: Item, season: number = getCurrentSeason()): Promise<{ success: boolean; reason?: 'full' }> {
    const isFull = await this.isFull(season);
    if (isFull) {
      return { success: false, reason: 'full' };
    }

    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO storage (season, instance_id, item_data) VALUES (?, ?, ?)',
      season,
      item.instanceId,
      JSON.stringify(item)
    );
    return { success: true };
  },

  /**
   * アイテムを倉庫から削除
   */
  async removeItem(instanceId: string, season: number = getCurrentSeason()): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'DELETE FROM storage WHERE instance_id = ? AND season = ?',
      instanceId,
      season
    );
    return result.changes > 0;
  },

  /**
   * 個別アイテムを取得
   */
  async getItem(instanceId: string, season: number = getCurrentSeason()): Promise<Item | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<StorageRow>(
      'SELECT instance_id, item_data FROM storage WHERE instance_id = ? AND season = ?',
      instanceId,
      season
    );
    if (!row) return null;
    return JSON.parse(row.item_data) as Item;
  },

  /**
   * アイテム数を取得
   */
  async getCount(season: number = getCurrentSeason()): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM storage WHERE season = ?',
      season
    );
    return row?.count ?? 0;
  },

  /**
   * 倉庫をクリア
   */
  async clear(season: number = getCurrentSeason()): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM storage WHERE season = ?', season);
  },
};
