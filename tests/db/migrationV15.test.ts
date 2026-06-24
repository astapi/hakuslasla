/**
 * マイグレーション V15 テスト
 * 倉庫と進行フラグをシーズン別に分離
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

const migrationV15 = migrations.find((m) => m.version === 15)!;

function createMockDB() {
  const executedSql: string[] = [];
  const runCalls: { sql: string; params: unknown[] }[] = [];

  return {
    executedSql,
    runCalls,

    async execAsync(sql: string): Promise<void> {
      executedSql.push(sql);
    },

    async runAsync(sql: string, ...params: unknown[]): Promise<void> {
      runCalls.push({ sql, params });
    },
  };
}

describe('Migration V15: シーズン別倉庫・進行フラグ', () => {
  it('マイグレーションが存在する', () => {
    expect(migrationV15).toBeDefined();
    expect(migrationV15.version).toBe(15);
  });

  it('倉庫に season カラムをS2デフォルトで追加する', async () => {
    const db = createMockDB();
    await migrationV15.migrate(db as any);

    const alterSql = db.executedSql.find((sql) =>
      sql.includes('ALTER TABLE storage ADD COLUMN season INTEGER NOT NULL DEFAULT 2')
    );
    expect(alterSql).toBeDefined();
  });

  it('既存の進行フラグをS2キーへコピーする', async () => {
    const db = createMockDB();
    await migrationV15.migrate(db as any);

    const copiedKeys = db.runCalls.map((call) => call.params[0]);
    expect(copiedKeys).toEqual([
      'end_content_unlocked_s2',
      'uber_boss_unlocks_s2',
      'uber_boss_tickets_s2',
      'dungeon_clear_records_s2',
    ]);

    for (const call of db.runCalls) {
      expect(call.sql).toContain('INSERT INTO game_settings');
      expect(call.sql).toContain('NOT EXISTS');
      expect(call.params[0]).toBe(call.params[2]);
    }
  });
});
