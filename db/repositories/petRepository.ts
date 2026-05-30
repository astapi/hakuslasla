import { getDatabase } from '../database';
import { PetInstance } from '@/types';

interface PetRow {
  instance_id: string;
  pet_id: string;
  obtained_at: string;
}

const generateInstanceId = (): string =>
  `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const petRepository = {
  async getAll(characterId: number): Promise<PetInstance[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PetRow>(
      'SELECT instance_id, pet_id, obtained_at FROM character_pets WHERE character_id = ? ORDER BY obtained_at ASC',
      characterId
    );
    return rows.map((row) => ({
      instanceId: row.instance_id,
      petId: row.pet_id,
      obtainedAt: row.obtained_at,
    }));
  },

  async add(characterId: number, petId: string): Promise<PetInstance> {
    const db = await getDatabase();
    const instanceId = generateInstanceId();
    const obtainedAt = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO character_pets (character_id, instance_id, pet_id, obtained_at) VALUES (?, ?, ?, ?)',
      characterId,
      instanceId,
      petId,
      obtainedAt
    );
    return { instanceId, petId, obtainedAt };
  },

  async remove(characterId: number, instanceId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.runAsync(
      'DELETE FROM character_pets WHERE character_id = ? AND instance_id = ?',
      characterId,
      instanceId
    );
    return result.changes > 0;
  },

  async removeInstances(characterId: number, instanceIds: string[]): Promise<number> {
    if (instanceIds.length === 0) return 0;
    const db = await getDatabase();
    const placeholders = instanceIds.map(() => '?').join(',');
    const result = await db.runAsync(
      `DELETE FROM character_pets WHERE character_id = ? AND instance_id IN (${placeholders})`,
      characterId,
      ...instanceIds
    );
    return result.changes;
  },

  async getLevels(characterId: number): Promise<Record<string, number>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ pet_id: string; level: number }>(
      'SELECT pet_id, level FROM character_pet_levels WHERE character_id = ?',
      characterId
    );
    const levels: Record<string, number> = {};
    for (const row of rows) {
      levels[row.pet_id] = row.level;
    }
    return levels;
  },

  async setLevel(characterId: number, petId: string, level: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO character_pet_levels (character_id, pet_id, level) VALUES (?, ?, ?)',
      characterId,
      petId,
      level
    );
  },

  async getActivePetInstanceId(characterId: number): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ instance_id: string | null }>(
      'SELECT instance_id FROM character_active_pet WHERE character_id = ?',
      characterId
    );
    return row?.instance_id ?? null;
  },

  async setActivePet(characterId: number, instanceId: string | null): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO character_active_pet (character_id, instance_id) VALUES (?, ?)',
      characterId,
      instanceId
    );
  },
};
