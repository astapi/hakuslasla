import { getDatabase } from '../database';
import { DropFilterSettings, DEFAULT_DROP_FILTER } from '@/types';

const DROP_FILTER_KEY = 'drop_filter_settings';

export const settingsRepository = {
  async get(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM game_settings WHERE key = ?',
      key
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO game_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value
    );
  },

  async delete(key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM game_settings WHERE key = ?',
      key
    );
  },

  // 便利なヘルパー
  async getLastCharacterId(): Promise<number | null> {
    const value = await this.get('last_character_id');
    return value ? parseInt(value, 10) : null;
  },

  async setLastCharacterId(characterId: number): Promise<void> {
    await this.set('last_character_id', characterId.toString());
  },

  // ドロップフィルター設定
  async getDropFilter(): Promise<DropFilterSettings> {
    const value = await this.get(DROP_FILTER_KEY);
    if (!value) {
      return DEFAULT_DROP_FILTER;
    }
    try {
      return JSON.parse(value) as DropFilterSettings;
    } catch {
      return DEFAULT_DROP_FILTER;
    }
  },

  async setDropFilter(settings: DropFilterSettings): Promise<void> {
    await this.set(DROP_FILTER_KEY, JSON.stringify(settings));
  },
};
