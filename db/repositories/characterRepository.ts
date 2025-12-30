import { getDatabase, createCharacterWithEquipmentSlots } from '../database';
import { Character, CreateCharacterInput, UpdateCharacterStats } from '@/types';

interface CharacterRow {
  id: number;
  name: string;
  level: number;
  exp: number;
  skill_points: number;
  max_hp: number;
  atk: number;
  def: number;
  created_at: string;
  updated_at: string;
}

const rowToCharacter = (row: CharacterRow): Character => ({
  id: row.id,
  name: row.name,
  level: row.level,
  exp: row.exp,
  skillPoints: row.skill_points,
  maxHp: row.max_hp,
  atk: row.atk,
  def: row.def,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const characterRepository = {
  async create(input: CreateCharacterInput): Promise<Character> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'INSERT INTO characters (name) VALUES (?)',
      input.name
    );
    const characterId = result.lastInsertRowId;

    // 装備スロットを初期化
    await createCharacterWithEquipmentSlots(db, characterId);

    const character = await this.getById(characterId);
    if (!character) throw new Error('Failed to create character');
    return character;
  },

  async getById(id: number): Promise<Character | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<CharacterRow>(
      'SELECT * FROM characters WHERE id = ?',
      id
    );
    return row ? rowToCharacter(row) : null;
  },

  async getAll(): Promise<Character[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CharacterRow>(
      'SELECT * FROM characters ORDER BY updated_at DESC'
    );
    return rows.map(rowToCharacter);
  },

  async updateStats(id: number, stats: UpdateCharacterStats): Promise<void> {
    const db = await getDatabase();
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (stats.level !== undefined) {
      updates.push('level = ?');
      values.push(stats.level);
    }
    if (stats.exp !== undefined) {
      updates.push('exp = ?');
      values.push(stats.exp);
    }
    if (stats.skillPoints !== undefined) {
      updates.push('skill_points = ?');
      values.push(stats.skillPoints);
    }
    if (stats.maxHp !== undefined) {
      updates.push('max_hp = ?');
      values.push(stats.maxHp);
    }
    if (stats.atk !== undefined) {
      updates.push('atk = ?');
      values.push(stats.atk);
    }
    if (stats.def !== undefined) {
      updates.push('def = ?');
      values.push(stats.def);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.runAsync(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );
  },

  async delete(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM characters WHERE id = ?', id);
  },

  async updateName(id: number, name: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE characters SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      name,
      id
    );
  },
};
