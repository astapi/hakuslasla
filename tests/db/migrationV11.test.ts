/**
 * マイグレーション V11 テスト
 * MOD合計上限4個に制限（fixedMods優先、ランダムMODを削減）
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

const migrationV11 = migrations.find((m) => m.version === 11)!;

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

function makeItemJson(mods: { type: string; value: number; tier: number }[]): string {
  return JSON.stringify({ id: 'test_item', instanceId: 'inst_1', mods });
}

function getMods(itemJson: string): { type: string; value: number; tier: number }[] {
  return JSON.parse(itemJson).mods;
}

describe('Migration V11: MOD合計上限4個', () => {
  it('5個以上のランダムMODを4個に制限する', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'atk_bonus', value: 50, tier: 3 },
          { type: 'hp_bonus', value: 100, tier: 2 },
          { type: 'def_bonus', value: 30, tier: 4 },
          { type: 'crit_chance', value: 5, tier: 1 },
          { type: 'attack_speed_pct', value: 10, tier: 5 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.character_inventory[0].item_data as string);
    expect(mods).toHaveLength(4);
    expect(mods.map((m) => m.type)).toEqual(['atk_bonus', 'hp_bonus', 'def_bonus', 'crit_chance']);
  });

  it('fixedMods（tier 0）を優先して残す', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'damage_reduction_pct', value: 5, tier: 0 },
          { type: 'hp_bonus', value: 320, tier: 0 },
          { type: 'atk_bonus', value: 50, tier: 3 },
          { type: 'def_bonus', value: 30, tier: 4 },
          { type: 'crit_chance', value: 5, tier: 1 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.character_inventory[0].item_data as string);
    expect(mods).toHaveLength(4);
    // fixedMods 2個 + ランダムMOD 2個
    expect(mods[0]).toEqual({ type: 'damage_reduction_pct', value: 5, tier: 0 });
    expect(mods[1]).toEqual({ type: 'hp_bonus', value: 320, tier: 0 });
    expect(mods[2]).toEqual({ type: 'atk_bonus', value: 50, tier: 3 });
    expect(mods[3]).toEqual({ type: 'def_bonus', value: 30, tier: 4 });
  });

  it('fixedModsが4個以上ある場合はランダムMODをすべて削除する', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'damage_reduction_pct', value: 5, tier: 0 },
          { type: 'hp_bonus', value: 320, tier: 0 },
          { type: 'warlord_enrage', value: 1, tier: 0 },
          { type: 'hp_regen', value: 50, tier: 0 },
          { type: 'atk_bonus', value: 30, tier: 3 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.character_inventory[0].item_data as string);
    expect(mods).toHaveLength(4);
    expect(mods.every((m) => m.tier === 0)).toBe(true);
  });

  it('4個以下のMODは変更されない', async () => {
    const db = createMockDB();
    const originalJson = makeItemJson([
      { type: 'atk_bonus', value: 50, tier: 3 },
      { type: 'hp_bonus', value: 100, tier: 2 },
      { type: 'def_bonus', value: 30, tier: 4 },
      { type: 'crit_chance', value: 5, tier: 1 },
    ]);
    db.tables.character_inventory = [{ id: 1, item_data: originalJson }];

    await migrationV11.migrate(db as any);

    expect(db.tables.character_inventory[0].item_data).toBe(originalJson);
  });

  it('MODなしのアイテムは変更されない', async () => {
    const db = createMockDB();
    const originalJson = JSON.stringify({ id: 'test_item', instanceId: 'inst_1', mods: [] });
    db.tables.character_inventory = [{ id: 1, item_data: originalJson }];

    await migrationV11.migrate(db as any);

    expect(db.tables.character_inventory[0].item_data).toBe(originalJson);
  });

  it('倉庫のアイテムも制限される', async () => {
    const db = createMockDB();
    db.tables.storage = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'atk_bonus', value: 50, tier: 3 },
          { type: 'hp_bonus', value: 100, tier: 2 },
          { type: 'def_bonus', value: 30, tier: 4 },
          { type: 'crit_chance', value: 5, tier: 1 },
          { type: 'attack_speed_pct', value: 10, tier: 5 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.storage[0].item_data as string);
    expect(mods).toHaveLength(4);
  });

  it('装備中のアイテムも制限される', async () => {
    const db = createMockDB();
    db.tables.character_equipment = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'damage_reduction_pct', value: 5, tier: 0 },
          { type: 'atk_bonus', value: 50, tier: 3 },
          { type: 'hp_bonus', value: 100, tier: 2 },
          { type: 'def_bonus', value: 30, tier: 4 },
          { type: 'crit_chance', value: 5, tier: 1 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.character_equipment[0].item_data as string);
    expect(mods).toHaveLength(4);
    // fixedMod（tier 0）が残っている
    expect(mods[0]).toEqual({ type: 'damage_reduction_pct', value: 5, tier: 0 });
  });

  it('複数テーブルのアイテムを同時に処理できる', async () => {
    const db = createMockDB();
    const fiveModsJson = makeItemJson([
      { type: 'atk_bonus', value: 50, tier: 3 },
      { type: 'hp_bonus', value: 100, tier: 2 },
      { type: 'def_bonus', value: 30, tier: 4 },
      { type: 'crit_chance', value: 5, tier: 1 },
      { type: 'attack_speed_pct', value: 10, tier: 5 },
    ]);
    db.tables.character_inventory = [{ id: 1, item_data: fiveModsJson }];
    db.tables.storage = [{ id: 1, item_data: fiveModsJson }];
    db.tables.character_equipment = [{ id: 1, item_data: fiveModsJson }];

    await migrationV11.migrate(db as any);

    expect(getMods(db.tables.character_inventory[0].item_data as string)).toHaveLength(4);
    expect(getMods(db.tables.storage[0].item_data as string)).toHaveLength(4);
    expect(getMods(db.tables.character_equipment[0].item_data as string)).toHaveLength(4);
  });

  it('6個のMODも4個に制限される', async () => {
    const db = createMockDB();
    db.tables.character_inventory = [
      {
        id: 1,
        item_data: makeItemJson([
          { type: 'atk_bonus', value: 50, tier: 3 },
          { type: 'hp_bonus', value: 100, tier: 2 },
          { type: 'def_bonus', value: 30, tier: 4 },
          { type: 'crit_chance', value: 5, tier: 1 },
          { type: 'attack_speed_pct', value: 10, tier: 5 },
          { type: 'poison_chance', value: 8, tier: 2 },
        ]),
      },
    ];

    await migrationV11.migrate(db as any);

    const mods = getMods(db.tables.character_inventory[0].item_data as string);
    expect(mods).toHaveLength(4);
    expect(mods.map((m) => m.type)).toEqual(['atk_bonus', 'hp_bonus', 'def_bonus', 'crit_chance']);
  });
});
