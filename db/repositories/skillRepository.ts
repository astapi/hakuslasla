import { getDatabase } from '../database';

export const skillRepository = {
  async getAll(characterId: number): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ skill_id: string }>(
      'SELECT skill_id FROM character_skills WHERE character_id = ?',
      characterId
    );
    return rows.map((row) => row.skill_id);
  },

  async unlock(characterId: number, skillId: string): Promise<boolean> {
    const db = await getDatabase();
    try {
      await db.runAsync(
        'INSERT INTO character_skills (character_id, skill_id) VALUES (?, ?)',
        characterId,
        skillId
      );
      return true;
    } catch {
      // UNIQUE制約違反（既に習得済み）
      return false;
    }
  },

  async isUnlocked(characterId: number, skillId: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ skill_id: string }>(
      'SELECT skill_id FROM character_skills WHERE character_id = ? AND skill_id = ?',
      characterId,
      skillId
    );
    return row !== null;
  },

  async clear(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM character_skills WHERE character_id = ?',
      characterId
    );
  },
};
