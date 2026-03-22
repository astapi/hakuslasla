import { getDatabase } from '../database';

export const uberTreeRepository = {
  /**
   * キャラクターの解放済みUberツリーノード一覧を取得
   */
  async getAll(characterId: number): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ skill_id: string }>(
      'SELECT skill_id FROM character_uber_skills WHERE character_id = ?',
      characterId
    );
    return rows.map(r => r.skill_id);
  },

  /**
   * Uberツリーノードを解放
   */
  async unlock(characterId: number, skillId: string): Promise<boolean> {
    const db = await getDatabase();
    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO character_uber_skills (character_id, skill_id) VALUES (?, ?)',
        characterId,
        skillId
      );
      const result = await db.getFirstAsync<{ changes: number }>(
        'SELECT changes() as changes'
      );
      return (result?.changes ?? 0) > 0;
    } catch {
      return false;
    }
  },

  /**
   * Uberツリーノードを個別削除
   */
  async remove(characterId: number, skillId: string): Promise<boolean> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM character_uber_skills WHERE character_id = ? AND skill_id = ?',
      characterId,
      skillId
    );
    const result = await db.getFirstAsync<{ changes: number }>(
      'SELECT changes() as changes'
    );
    return (result?.changes ?? 0) > 0;
  },

  /**
   * Uberツリーノードをリセット（全削除）
   */
  async clear(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM character_uber_skills WHERE character_id = ?',
      characterId
    );
  },
};
