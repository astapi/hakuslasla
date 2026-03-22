import { getDatabase, createCharacterWithEquipmentSlots } from '../database';
import { Character, CharacterType, CreateCharacterInput, UpdateCharacterStats } from '@/types';

interface CharacterRow {
  id: number;
  name: string;
  type: CharacterType;
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
  type: row.type,
  level: row.level,
  exp: row.exp,
  skillPoints: row.skill_points,
  maxHp: row.max_hp,
  atk: row.atk,
  def: row.def,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// クラス別初期ステータス
const CLASS_BASE_STATS: Record<CharacterType, { maxHp: number; atk: number; def: number }> = {
  warrior: { maxHp: 120, atk: 10, def: 5 },
  elementalist: { maxHp: 85, atk: 10, def: 4 },
  ranger: { maxHp: 100, atk: 10, def: 5 },
  frostmage: { maxHp: 80, atk: 10, def: 3 },
};

export const characterRepository = {
  async create(input: CreateCharacterInput): Promise<Character> {
    const db = await getDatabase();
    const baseStats = CLASS_BASE_STATS[input.type];
    const result = await db.runAsync(
      'INSERT INTO characters (name, type, max_hp, atk, def) VALUES (?, ?, ?, ?, ?)',
      input.name,
      input.type,
      baseStats.maxHp,
      baseStats.atk,
      baseStats.def
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
