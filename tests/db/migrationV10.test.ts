/**
 * マイグレーション V10 テスト
 * バッジテーブルにseenカラムを追加
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

const migrationV10 = migrations.find((m) => m.version === 10)!;

function createMockDB() {
  const executedSql: string[] = [];

  return {
    executedSql,

    async execAsync(sql: string): Promise<void> {
      executedSql.push(sql);
    },

    async runAsync(_sql: string, ..._params: unknown[]): Promise<void> {},
    async getAllAsync<T>(_sql: string, ..._params: unknown[]): Promise<T[]> { return []; },
    async getFirstAsync<T>(_sql: string, ..._params: unknown[]): Promise<T | null> { return null; },
  };
}

describe('Migration V10: バッジにseenカラム追加', () => {
  it('マイグレーションが存在する', () => {
    expect(migrationV10).toBeDefined();
    expect(migrationV10.version).toBe(10);
  });

  it('ALTER TABLE で seen カラムを追加する', async () => {
    const db = createMockDB();
    await migrationV10.migrate(db as any);

    const alterSql = db.executedSql.find(sql =>
      sql.includes('ALTER TABLE') && sql.includes('character_badges') && sql.includes('seen')
    );
    expect(alterSql).toBeDefined();
  });

  it('既存バッジのデフォルト値は 1（既読）', async () => {
    const db = createMockDB();
    await migrationV10.migrate(db as any);

    const alterSql = db.executedSql.find(sql => sql.includes('seen'))!;
    expect(alterSql).toContain('DEFAULT 1');
  });
});
