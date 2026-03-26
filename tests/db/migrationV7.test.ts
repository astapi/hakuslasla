/**
 * マイグレーション V7 テスト
 * ガードツリー再構成に伴う削除ノードの自動リスペック
 */
import { describe, it, expect } from 'vitest';
import { migrations } from '../../db/migrations';

// V7マイグレーション関数を取得
const migrationV7 = migrations.find((m) => m.version === 7)!;

// インメモリDBの簡易実装（expo-sqliteのインターフェースをシミュレート）
function createMockDB() {
  const tables: Record<string, Record<string, unknown>[]> = {
    character_skills: [],
    characters: [],
    settings: [],
  };

  return {
    tables,

    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      if (sql.includes('character_skills') && sql.includes('GROUP BY character_id')) {
        // キャラクターごとの削除対象ノード数
        const counts = new Map<number, number>();
        for (const row of tables.character_skills) {
          if (params.includes(row.skill_id)) {
            const charId = row.character_id as number;
            counts.set(charId, (counts.get(charId) ?? 0) + 1);
          }
        }
        return Array.from(counts.entries()).map(
          ([character_id, count]) => ({ character_id, count }) as T
        );
      }
      return [];
    },

    async getFirstAsync<T>(sql: string, ..._params: unknown[]): Promise<T | null> {
      if (sql.includes('respec_tokens')) {
        const row = tables.settings.find(
          (r) => r.key === 'respec_tokens'
        );
        return row ? ({ value: row.value } as T) : null;
      }
      return null;
    },

    async runAsync(sql: string, ...params: unknown[]): Promise<void> {
      if (sql.includes('DELETE FROM character_skills')) {
        tables.character_skills = tables.character_skills.filter(
          (row) => !params.includes(row.skill_id)
        );
      }
      if (sql.includes('UPDATE characters SET skill_points')) {
        const addCount = params[0] as number;
        const charId = params[1] as number;
        const char = tables.characters.find((c) => c.id === charId);
        if (char) {
          (char as any).skill_points = ((char as any).skill_points ?? 0) + addCount;
        }
      }
      if (sql.includes('INSERT OR REPLACE INTO settings')) {
        const key = 'respec_tokens';
        const value = params[0];
        const existing = tables.settings.findIndex((r) => r.key === key);
        if (existing >= 0) {
          tables.settings[existing] = { key, value };
        } else {
          tables.settings.push({ key, value });
        }
      }
    },

    async execAsync(_sql: string): Promise<void> {},
  };
}

// 削除されたノードID一覧
const REMOVED_NODE_IDS = [
  'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13',
  'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2',
  'guard_14', 'guard_15', 'guard_16', 'guard_17',
  'guard_final1', 'guard_final2',
];

describe('Migration V7: ガードツリー再構成', () => {
  it('削除対象ノードがDBから除去される', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, skill_points: 0 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'start' },
      { character_id: 1, skill_id: 'guard_1' },
      { character_id: 1, skill_id: 'guard_9' },
      { character_id: 1, skill_id: 'guard_10' },
      { character_id: 1, skill_id: 'guard_11' },
      { character_id: 1, skill_id: 'guard_12' },
      { character_id: 1, skill_id: 'guard_13' },
    ];

    await migrationV7.migrate(db as any);

    const remainingIds = db.tables.character_skills.map((r) => r.skill_id);
    expect(remainingIds).toEqual(['start', 'guard_1']);
  });

  it('除去数分のリスペックトークンが付与される', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, skill_points: 0 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'guard_9' },
      { character_id: 1, skill_id: 'guard_10' },
      { character_id: 1, skill_id: 'guard_11' },
    ];

    await migrationV7.migrate(db as any);

    const tokenRow = db.tables.settings.find((r) => r.key === 'respec_tokens');
    expect(tokenRow).toBeDefined();
    expect(tokenRow!.value).toBe('3');
  });

  it('既存のリスペックトークンに加算される', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, skill_points: 10 }];
    db.tables.settings = [{ key: 'respec_tokens', value: '5' }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'guard_final1' },
      { character_id: 1, skill_id: 'guard_final2' },
    ];

    await migrationV7.migrate(db as any);

    const tokenRow = db.tables.settings.find((r) => r.key === 'respec_tokens');
    expect(tokenRow!.value).toBe('7'); // 5 + 2
  });

  it('複数キャラクター間で正しくカウントされる', async () => {
    const db = createMockDB();
    db.tables.characters = [
      { id: 1, skill_points: 5 },
      { id: 2, skill_points: 10 },
    ];
    db.tables.character_skills = [
      // キャラ1: 3ノード
      { character_id: 1, skill_id: 'guard_9' },
      { character_id: 1, skill_id: 'guard_10' },
      { character_id: 1, skill_id: 'guard_11' },
      // キャラ2: 2ノード
      { character_id: 2, skill_id: 'guard_a1' },
      { character_id: 2, skill_id: 'guard_a2' },
      // 残るべきノード
      { character_id: 1, skill_id: 'guard_1' },
      { character_id: 2, skill_id: 'guard_1' },
    ];

    await migrationV7.migrate(db as any);

    // 全キャラ合計5ノード分のトークン
    const tokenRow = db.tables.settings.find((r) => r.key === 'respec_tokens');
    expect(tokenRow!.value).toBe('5');
    // 残るべきノードは保持
    expect(db.tables.character_skills).toHaveLength(2);
  });

  it('削除対象ノードがない場合は何もしない', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, skill_points: 20 }];
    db.tables.character_skills = [
      { character_id: 1, skill_id: 'start' },
      { character_id: 1, skill_id: 'guard_1' },
      { character_id: 1, skill_id: 'guard_8' },
    ];

    await migrationV7.migrate(db as any);

    // スキルはそのまま
    expect(db.tables.character_skills).toHaveLength(3);
    // トークンは付与されない
    expect(db.tables.settings).toHaveLength(0);
    // SPも変化なし
    expect(db.tables.characters[0].skill_points).toBe(20);
  });

  it('全削除対象ノード（15個）が正しく処理される', async () => {
    const db = createMockDB();
    db.tables.characters = [{ id: 1, skill_points: 0 }];
    db.tables.character_skills = REMOVED_NODE_IDS.map((id) => ({
      character_id: 1,
      skill_id: id,
    }));

    await migrationV7.migrate(db as any);

    expect(db.tables.character_skills).toHaveLength(0);
    const tokenRow = db.tables.settings.find((r) => r.key === 'respec_tokens');
    expect(tokenRow!.value).toBe('15');
  });

  it('削除ノード数分のSPがキャラクターに返還される', async () => {
    const db = createMockDB();
    // Lv30キャラ: SP29のうち14使用済み → 残りSP15
    db.tables.characters = [{ id: 1, skill_points: 15 }];
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
      // ↓ 削除対象 5ノード
      { character_id: 1, skill_id: 'guard_9' },
      { character_id: 1, skill_id: 'guard_10' },
      { character_id: 1, skill_id: 'guard_11' },
      { character_id: 1, skill_id: 'guard_12' },
      { character_id: 1, skill_id: 'guard_13' },
    ];

    await migrationV7.migrate(db as any);

    // SP: 15 + 5 = 20
    expect(db.tables.characters[0].skill_points).toBe(20);
    // 残りノード: start + guard_1〜guard_8 = 9
    expect(db.tables.character_skills).toHaveLength(9);
  });

  it('複数キャラクターそれぞれに正しいSPが返還される', async () => {
    const db = createMockDB();
    db.tables.characters = [
      { id: 1, skill_points: 5 },
      { id: 2, skill_points: 10 },
    ];
    db.tables.character_skills = [
      // キャラ1: 削除対象3ノード
      { character_id: 1, skill_id: 'guard_9' },
      { character_id: 1, skill_id: 'guard_10' },
      { character_id: 1, skill_id: 'guard_11' },
      // キャラ2: 削除対象2ノード
      { character_id: 2, skill_id: 'guard_a1' },
      { character_id: 2, skill_id: 'guard_a2' },
    ];

    await migrationV7.migrate(db as any);

    // キャラ1: 5 + 3 = 8
    expect(db.tables.characters[0].skill_points).toBe(8);
    // キャラ2: 10 + 2 = 12
    expect(db.tables.characters[1].skill_points).toBe(12);
  });

  it('削除対象がないキャラクターのSPは変化しない', async () => {
    const db = createMockDB();
    db.tables.characters = [
      { id: 1, skill_points: 5 },
      { id: 2, skill_points: 20 },
    ];
    db.tables.character_skills = [
      // キャラ1のみ削除対象あり
      { character_id: 1, skill_id: 'guard_9' },
      // キャラ2は削除対象なし
      { character_id: 2, skill_id: 'guard_1' },
      { character_id: 2, skill_id: 'guard_8' },
    ];

    await migrationV7.migrate(db as any);

    // キャラ1: 5 + 1 = 6
    expect(db.tables.characters[0].skill_points).toBe(6);
    // キャラ2: 変化なし
    expect(db.tables.characters[1].skill_points).toBe(20);
  });
});
