import * as SQLite from 'expo-sqlite';

/**
 * マイグレーション定義
 * - version: マイグレーション後のバージョン番号
 * - migrate: マイグレーション処理（async関数）
 */
interface Migration {
  version: number;
  migrate: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

/**
 * マイグレーション一覧（バージョン順）
 * 新しいマイグレーションは配列の最後に追加してください
 */
export const migrations: Migration[] = [
  {
    // V1 → V2: インベントリ・装備をItemインスタンス形式に変更
    version: 2,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      // 1. 新しい形式のテーブルを作成（一時テーブル）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS character_inventory_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          instance_id TEXT NOT NULL,
          item_data TEXT NOT NULL,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          UNIQUE(character_id, instance_id)
        );
      `);

      // 2. 既存データを移行（item_idからItem JSONに変換）
      // 注意: 古いデータはMODなしで移行される
      const oldInventory = await db.getAllAsync<{
        character_id: number;
        item_id: string;
        quantity: number;
      }>(`
        SELECT character_id, item_id, quantity
        FROM character_inventory
        WHERE item_id IS NOT NULL
      `);

      let instanceCounter = 0;
      for (const row of oldInventory) {
        // 個数分だけItemインスタンスを作成
        for (let i = 0; i < row.quantity; i++) {
          const instanceId = `migrated_${Date.now()}_${instanceCounter++}`;
          // 注意: ここではitem_idのみ保存し、実際のItemデータは後でマスターから取得される
          // 簡易的にitem_idを含むJSONを作成（アプリ起動時に補完される想定）
          const itemData = JSON.stringify({
            id: row.item_id,
            instanceId,
            mods: [],
            // name, slot, atk, defは起動時にマスターから補完する必要あり
            _needsMigration: true,
          });

          await db.runAsync(
            `INSERT INTO character_inventory_new (character_id, instance_id, item_data) VALUES (?, ?, ?)`,
            row.character_id,
            instanceId,
            itemData
          );
        }
      }

      // 3. 古いテーブルを削除して新しいテーブルにリネーム
      await db.execAsync(`
        DROP TABLE character_inventory;
        ALTER TABLE character_inventory_new RENAME TO character_inventory;
      `);

      // 4. character_equipmentテーブルを更新
      // item_idカラムがあればitem_dataに変換
      const hasItemIdColumn = await db.getFirstAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM pragma_table_info('character_equipment') WHERE name = 'item_id'
      `);

      if (hasItemIdColumn && hasItemIdColumn.count > 0) {
        // 一時テーブルを作成
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS character_equipment_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL,
            slot TEXT NOT NULL,
            item_data TEXT,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
            UNIQUE(character_id, slot)
          );
        `);

        // 既存データを移行
        const oldEquipment = await db.getAllAsync<{
          character_id: number;
          slot: string;
          item_id: string | null;
        }>(`SELECT character_id, slot, item_id FROM character_equipment`);

        for (const row of oldEquipment) {
          let itemData: string | null = null;
          if (row.item_id) {
            const instanceId = `equipped_${row.item_id}`;
            itemData = JSON.stringify({
              id: row.item_id,
              instanceId,
              mods: [],
              _needsMigration: true,
            });
          }

          await db.runAsync(
            `INSERT INTO character_equipment_new (character_id, slot, item_data) VALUES (?, ?, ?)`,
            row.character_id,
            row.slot,
            itemData
          );
        }

        // 古いテーブルを削除して新しいテーブルにリネーム
        await db.execAsync(`
          DROP TABLE character_equipment;
          ALTER TABLE character_equipment_new RENAME TO character_equipment;
        `);
      }

      console.log('[Migration] V1 → V2 completed');
    },
  },
  {
    // V2 → V3: 倉庫をスタック形式からItem個別管理形式に変更
    version: 3,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      // 1. 新しい形式のテーブルを作成
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS storage_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          instance_id TEXT NOT NULL UNIQUE,
          item_data TEXT NOT NULL
        );
      `);

      // 2. 既存データを移行（item_id + quantityからItem JSONに変換）
      const oldStorage = await db.getAllAsync<{
        item_id: string;
        quantity: number;
      }>(`SELECT item_id, quantity FROM storage`);

      let instanceCounter = 0;
      for (const row of oldStorage) {
        // 個数分だけItemインスタンスを作成
        for (let i = 0; i < row.quantity; i++) {
          const instanceId = `storage_migrated_${Date.now()}_${instanceCounter++}`;
          const itemData = JSON.stringify({
            id: row.item_id,
            instanceId,
            mods: [],
            _needsMigration: true,
          });

          await db.runAsync(
            `INSERT INTO storage_new (instance_id, item_data) VALUES (?, ?)`,
            instanceId,
            itemData
          );
        }
      }

      // 3. 古いテーブルを削除して新しいテーブルにリネーム
      await db.execAsync(`
        DROP TABLE storage;
        ALTER TABLE storage_new RENAME TO storage;
      `);

      console.log('[Migration] V2 → V3 completed');
    },
  },
];

/**
 * 現在のDBバージョンを取得
 */
export async function getCurrentVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  try {
    // schema_versionテーブルが存在するか確認
    const tableExists = await db.getFirstAsync<{ count: number }>(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_version'
    `);

    if (!tableExists || tableExists.count === 0) {
      return 0; // テーブルがない = 初期状態
    }

    const result = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );

    return result?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * マイグレーションを実行
 */
export async function runMigrations(
  db: SQLite.SQLiteDatabase,
  targetVersion: number
): Promise<void> {
  const currentVersion = await getCurrentVersion(db);

  if (currentVersion >= targetVersion) {
    console.log(`[Migration] Already at version ${currentVersion}, no migration needed`);
    return;
  }

  console.log(`[Migration] Migrating from version ${currentVersion} to ${targetVersion}`);

  // 現在のバージョンより大きく、ターゲット以下のマイグレーションを実行
  const pendingMigrations = migrations.filter(
    (m) => m.version > currentVersion && m.version <= targetVersion
  );

  for (const migration of pendingMigrations) {
    console.log(`[Migration] Running migration to version ${migration.version}...`);

    try {
      await migration.migrate(db);

      // バージョンを更新
      await db.runAsync(
        'INSERT OR REPLACE INTO schema_version (version) VALUES (?)',
        migration.version
      );

      console.log(`[Migration] Migration to version ${migration.version} completed`);
    } catch (error) {
      console.error(`[Migration] Failed to migrate to version ${migration.version}:`, error);
      throw error;
    }
  }

  console.log(`[Migration] All migrations completed. Current version: ${targetVersion}`);
}
