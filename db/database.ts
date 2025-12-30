import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, EQUIPMENT_SLOTS } from './schema';

const DATABASE_NAME = 'hakusla_dungeon.db';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return db;
};

export const initializeDatabase = async (): Promise<void> => {
  const database = await getDatabase();

  // 外部キー制約を有効化
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // テーブル作成
  await database.execAsync(CREATE_TABLES_SQL);

  // スキーマバージョンを確認・設定
  const versionResult = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version LIMIT 1'
  );

  if (!versionResult) {
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      SCHEMA_VERSION
    );
  }
};

export const createCharacterWithEquipmentSlots = async (
  database: SQLite.SQLiteDatabase,
  characterId: number
): Promise<void> => {
  // 装備スロットを初期化（全て未装備）
  for (const slot of EQUIPMENT_SLOTS) {
    await database.runAsync(
      'INSERT INTO character_equipment (character_id, slot, item_id) VALUES (?, ?, NULL)',
      characterId,
      slot
    );
  }
};

export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync(`
    DROP TABLE IF EXISTS character_skills;
    DROP TABLE IF EXISTS character_inventory;
    DROP TABLE IF EXISTS character_equipment;
    DROP TABLE IF EXISTS characters;
    DROP TABLE IF EXISTS storage;
    DROP TABLE IF EXISTS game_settings;
    DROP TABLE IF EXISTS schema_version;
  `);
  await initializeDatabase();
};
