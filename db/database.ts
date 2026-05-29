import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, SCHEMA_VERSION, EQUIPMENT_SLOTS } from './schema';
import { getCurrentVersion, runMigrations } from './migrations';

const DATABASE_NAME = 'loot_dive.db';

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

  // 現在のバージョンを確認
  const currentVersion = await getCurrentVersion(database);

  if (currentVersion === 0) {
    // 新規インストール: テーブル作成して最新バージョンを設定
    await database.execAsync(CREATE_TABLES_SQL);
    await database.runAsync(
      'INSERT INTO schema_version (version) VALUES (?)',
      SCHEMA_VERSION
    );
  } else if (currentVersion < SCHEMA_VERSION) {
    // アップグレード: マイグレーション実行
    await runMigrations(database, SCHEMA_VERSION);
  }
};

export const createCharacterWithEquipmentSlots = async (
  database: SQLite.SQLiteDatabase,
  characterId: number
): Promise<void> => {
  // 装備スロットを初期化（全て未装備）
  for (const slot of EQUIPMENT_SLOTS) {
    await database.runAsync(
      'INSERT INTO character_equipment (character_id, slot, item_data) VALUES (?, ?, NULL)',
      characterId,
      slot
    );
  }
};

export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync(`
    DROP TABLE IF EXISTS character_active_pet;
    DROP TABLE IF EXISTS character_pets;
    DROP TABLE IF EXISTS character_uber_skills;
    DROP TABLE IF EXISTS character_badges;
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
