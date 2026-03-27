/**
 * マイグレーション V9 テスト
 * ユニーク装備のdamage_reduction_pctを上限5%に修正
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

const migrationV9 = migrations.find((m) => m.version === 9)!;

function createMockDB() {
  const tables: Record<string, Record<string, unknown>[]> = {
    character_inventory: [],
    storage: [],
    character_equipment: [],
  };

  return {
    tables,

    async getAllAsync<T>(sql: string, ..._params: unknown[]): Promise<T[]> {
      if (sql.includes('character_inventory')) return tables.character_inventory as T[];
      if (sql.includes('storage')) return tables.storage as T[];
      if (sql.includes('character_equipment')) return tables.character_equipment as T[];
      return [];
    },

    async getFirstAsync<T>(_sql: string, ..._params: unknown[]): Promise<T | null> {
      return null;
    },

    async runAsync(sql: string, ...params: unknown[]): Promise<void> {
      if (sql.includes('UPDATE character_inventory')) {
        const row = tables.character_inventory.find((r) => r.id === params[1]);
        if (row) row.item_data = params[0];
      }
      if (sql.includes('UPDATE storage')) {
        const row = tables.storage.find((r) => r.id === params[1]);
        if (row) row.item_data = params[0];
      }
      if (sql.includes('UPDATE character_equipment')) {
        const row = tables.character_equipment.find((r) => r.id === params[1]);
        if (row) row.item_data = params[0];
      }
    },

    async execAsync(_sql: string): Promise<void> {},
  };
}

function makeItemJson(mods: { type: string; value: number }[]): string {
  return JSON.stringify({ id: 'test_item', instanceId: 'inst_1', mods });
}

function getModValue(itemJson: string, modType: string): number | undefined {
  const item = JSON.parse(itemJson as string);
  const mod = item.mods.find((m: any) => m.type === modType);
  return mod?.value;
}

describe('Migration V9: ユニーク装備DR上限5%', () => {
  it('インベントリのDR > 5%を5%に修正する', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      { id: 1, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 18 }, { type: 'hp_bonus', value: 320 }]) },
    ];

    await migrationV9.migrate(db as any);

    expect(getModValue(db.tables.character_inventory[0].item_data as string, 'damage_reduction_pct')).toBe(5);
    expect(getModValue(db.tables.character_inventory[0].item_data as string, 'hp_bonus')).toBe(320);
  });

  it('倉庫のDR > 5%を5%に修正する', async () => {
    const db = createMockDB();
    db.tables.storage = [
      { id: 1, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 12 }]) },
    ];

    await migrationV9.migrate(db as any);

    expect(getModValue(db.tables.storage[0].item_data as string, 'damage_reduction_pct')).toBe(5);
  });

  it('装備中のDR > 5%を5%に修正する', async () => {
    const db = createMockDB();
    db.tables.character_equipment = [
      { id: 1, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 15 }]) },
    ];

    await migrationV9.migrate(db as any);

    expect(getModValue(db.tables.character_equipment[0].item_data as string, 'damage_reduction_pct')).toBe(5);
  });

  it('DR 5%以下のアイテムは変更されない', async () => {
    const db = createMockDB();
    const originalJson = makeItemJson([{ type: 'damage_reduction_pct', value: 3 }, { type: 'hp_bonus', value: 100 }]);
    db.tables.character_inventory = [
      { id: 1, item_data: originalJson },
    ];

    await migrationV9.migrate(db as any);

    // JSONが変更されていないことを確認
    expect(db.tables.character_inventory[0].item_data).toBe(originalJson);
  });

  it('damage_reduction_pctがないアイテムは変更されない', async () => {
    const db = createMockDB();
    const originalJson = makeItemJson([{ type: 'atk_bonus', value: 50 }]);
    db.tables.character_inventory = [
      { id: 1, item_data: originalJson },
    ];

    await migrationV9.migrate(db as any);

    expect(db.tables.character_inventory[0].item_data).toBe(originalJson);
  });

  it('複数アイテムを同時に修正できる', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      { id: 1, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 18 }]) },
      { id: 2, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 10 }]) },
      { id: 3, item_data: makeItemJson([{ type: 'damage_reduction_pct', value: 5 }]) },
    ];

    await migrationV9.migrate(db as any);

    expect(getModValue(db.tables.character_inventory[0].item_data as string, 'damage_reduction_pct')).toBe(5);
    expect(getModValue(db.tables.character_inventory[1].item_data as string, 'damage_reduction_pct')).toBe(5);
    // 5%のものは変更なし
    expect(getModValue(db.tables.character_inventory[2].item_data as string, 'damage_reduction_pct')).toBe(5);
  });
});
