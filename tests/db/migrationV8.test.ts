/**
 * マイグレーション V8 テスト
 * V7でSP返還漏れがあった場合の補正（SP再計算）
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

const migrationV8 = migrations.find((m) => m.version === 8)!;

function createMockDB() {
  const tables: Record<string, Record<string, unknown>[]> = {
    characters: [],
    character_skills: [],
  };

  return {
    tables,

    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      if (sql.includes('SELECT id, level, skill_points FROM characters')) {
        return tables.characters as T[];
      }
      return [];
    },

    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      if (sql.includes('COUNT(*)') && sql.includes('character_skills')) {
        const charId = params[0] as number;
        const count = tables.character_skills.filter(
          (r) => r.character_id === charId && r.skill_id !== 'start'
        ).length;
        return { count } as T;
      }
      return null;
    },

    async runAsync(sql: string, ...params: unknown[]): Promise<void> {
      if (sql.includes('UPDATE characters SET skill_points')) {
        const newSP = params[0] as number;
        const charId = params[1] as number;
        const char = tables.characters.find((c) => c.id === charId);
        if (char) char.skill_points = newSP;
      }
    },

    async execAsync(_sql: string): Promise<void> {},
  };
}

describe('Migration V8: SP再計算', () => {
  it('V7でSPが返還されなかったキャラのSPを修正する', async () => {
    const db = createMockDB();
    // Lv30キャラ: 本来SP29のうち8ノード使用 → SP21であるべき
    // V7バグでSP15のまま（5ノード分戻ってない + guard_9〜13削除済み）
    db.tables.characters = [{ id: 1, level: 30, skill_points: 15 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'start' },
      { character_id: 1, skill_id: 'guard_1' },
      { character_id: 1, skill_id: 'guard_2' },
      { character_id: 1, skill_id: 'guard_3' },
      { character_id: 1, skill_id: 'guard_5' },
      { character_id: 1, skill_id: 'guard_6' },
      { character_id: 1, skill_id: 'guard_7' },
      { character_id: 1, skill_id: 'guard_key1' },
      { character_id: 1, skill_id: 'guard_8' },
      // guard_9〜guard_13はV7で既に削除済み
    ];

    await migrationV8.migrate(db as any);

    // SP = (30 - 1) - 8 = 21
    expect(db.tables.characters[0].skill_points).toBe(21);
  });

  it('SPが正しいキャラクターは変更されない', async () => {
    const db = createMockDB();
    // Lv50キャラ: 10ノード使用、SP = 49 - 10 = 39（正しい）
    db.tables.characters = [{ id: 1, level: 50, skill_points: 39 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'start' },
      ...Array.from({ length: 10 }, (_, i) => ({
        character_id: 1,
        skill_id: `node_${i}`,
      })),
    ];

    await migrationV8.migrate(db as any);

    expect(db.tables.characters[0].skill_points).toBe(39);
  });

  it('複数キャラクターそれぞれ正しく再計算される', async () => {
    const db = createMockDB();
    db.tables.characters = [
      { id: 1, level: 30, skill_points: 10 }, // 本来 29 - 5 = 24
      { id: 2, level: 50, skill_points: 40 }, // 本来 49 - 8 = 41
    ];
    db.tables.character_skills = [
      // キャラ1: start + 5ノード
      { character_id: 1, skill_id: 'start' },
      { character_id: 1, skill_id: 'guard_1' },
      { character_id: 1, skill_id: 'guard_2' },
      { character_id: 1, skill_id: 'guard_3' },
      { character_id: 1, skill_id: 'guard_5' },
      { character_id: 1, skill_id: 'guard_6' },
      // キャラ2: start + 8ノード
      { character_id: 2, skill_id: 'start' },
      { character_id: 2, skill_id: 'guard_1' },
      { character_id: 2, skill_id: 'guard_2' },
      { character_id: 2, skill_id: 'guard_3' },
      { character_id: 2, skill_id: 'guard_5' },
      { character_id: 2, skill_id: 'guard_6' },
      { character_id: 2, skill_id: 'guard_7' },
      { character_id: 2, skill_id: 'guard_key1' },
      { character_id: 2, skill_id: 'guard_8' },
    ];

    await migrationV8.migrate(db as any);

    expect(db.tables.characters[0].skill_points).toBe(24);
    expect(db.tables.characters[1].skill_points).toBe(41);
  });

  it('ノードを1つも取得していないキャラのSPはレベル-1になる', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, level: 20, skill_points: 0 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'start' },
    ];

    await migrationV8.migrate(db as any);

    // SP = (20 - 1) - 0 = 19
    expect(db.tables.characters[0].skill_points).toBe(19);
  });
});
