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
    },
  },
  {
    // V3 → V4: キャラクターにtypeカラムを追加
    version: 4,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      // typeカラムを追加（既存キャラはwarriorとして扱う）
      await db.execAsync(`
        ALTER TABLE characters ADD COLUMN type TEXT NOT NULL DEFAULT 'warrior';
      `);
    },
  },
  {
    // V4 → V5: バッジテーブルを追加
    version: 5,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS character_badges (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          badge_id TEXT NOT NULL,
          earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          UNIQUE(character_id, badge_id)
        );
      `);
    },
  },
  {
    // V5 → V6: Uberツリーテーブルを追加
    version: 6,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS character_uber_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          skill_id TEXT NOT NULL,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          UNIQUE(character_id, skill_id)
        );
      `);
    },
  },
  {
    // V6 → V7: ガードツリー再構成に伴う削除ノードの自動リスペック
    // 削除されたノードをDBから除去し、除去数分のリスペックトークンを付与
    version: 7,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      const removedNodeIds = [
        'guard_9', 'guard_10', 'guard_11', 'guard_12', 'guard_13',
        'guard_a1', 'guard_a2', 'guard_b1', 'guard_b2',
        'guard_14', 'guard_15', 'guard_16', 'guard_17',
        'guard_final1', 'guard_final2',
      ];

      const placeholders = removedNodeIds.map(() => '?').join(',');

      // キャラクターごとの削除対象ノード数をカウント
      const perCharacter = await db.getAllAsync<{ character_id: number; count: number }>(
        `SELECT character_id, COUNT(*) as count FROM character_skills WHERE skill_id IN (${placeholders}) GROUP BY character_id`,
        ...removedNodeIds
      );

      if (perCharacter.length === 0) return;

      // 削除されたノードをDBから除去
      await db.runAsync(
        `DELETE FROM character_skills WHERE skill_id IN (${placeholders})`,
        ...removedNodeIds
      );

      // キャラクターごとにSPを返還
      let totalRemoved = 0;
      for (const row of perCharacter) {
        await db.runAsync(
          `UPDATE characters SET skill_points = skill_points + ? WHERE id = ?`,
          row.count,
          row.character_id
        );
        totalRemoved += row.count;
      }

      // 除去数分のリスペックトークンを付与
      const currentTokens = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM game_settings WHERE key = 'respec_tokens'`
      );
      const current = currentTokens ? parseInt(currentTokens.value, 10) || 0 : 0;
      const newCount = current + totalRemoved;
      await db.runAsync(
        `INSERT OR REPLACE INTO game_settings (key, value) VALUES ('respec_tokens', ?)`,
        newCount.toString()
      );
    },
  },
  {
    // V7 → V8: SP再計算（V7でSP返還漏れがあった場合の補正）
    // 正しいSP = レベル - 1 - 取得済みノード数(start除く)
    version: 8,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      const characters = await db.getAllAsync<{ id: number; level: number; skill_points: number }>(
        `SELECT id, level, skill_points FROM characters`
      );

      for (const char of characters) {
        const skillCount = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM character_skills WHERE character_id = ? AND skill_id != 'start'`,
          char.id
        );
        const usedPoints = skillCount?.count ?? 0;
        const correctSP = (char.level - 1) - usedPoints;

        if (correctSP !== char.skill_points) {
          await db.runAsync(
            `UPDATE characters SET skill_points = ? WHERE id = ?`,
            correctSP,
            char.id
          );
        }
      }
    },
  },
  {
    // V8 → V9: ユニーク装備のdamage_reduction_pctを上限5%に修正
    // インベントリ、倉庫、装備のアイテムJSONを更新
    version: 9,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      const DR_CAP = 5;

      // アイテムJSONのdamage_reduction_pctを修正する共通関数
      function capDamageReduction(itemJson: string): string | null {
        const item = JSON.parse(itemJson);
        if (!item.mods || !Array.isArray(item.mods)) return null;

        let changed = false;
        for (const mod of item.mods) {
          if (mod.type === 'damage_reduction_pct' && mod.value > DR_CAP) {
            mod.value = DR_CAP;
            changed = true;
          }
        }
        return changed ? JSON.stringify(item) : null;
      }

      // インベントリ
      const invRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM character_inventory`
      );
      for (const row of invRows) {
        const updated = capDamageReduction(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE character_inventory SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }

      // 倉庫
      const storageRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM storage`
      );
      for (const row of storageRows) {
        const updated = capDamageReduction(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE storage SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }

      // 装備
      const equipRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM character_equipment WHERE item_data IS NOT NULL`
      );
      for (const row of equipRows) {
        const updated = capDamageReduction(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE character_equipment SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }
    },
  },
  {
    // V9 → V10: バッジにseen（既読）カラムを追加
    version: 10,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        ALTER TABLE character_badges ADD COLUMN seen INTEGER NOT NULL DEFAULT 1;
      `);
    },
  },
  {
    // V10 → V11: MOD合計上限4個に制限（既存アイテムのMOD数を調整）
    // fixedMods（tier 0）を優先し、ランダムMOD（tier > 0）を削って合計4個に
    version: 11,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      const MAX_TOTAL_MODS = 4;

      function trimMods(itemJson: string): string | null {
        const item = JSON.parse(itemJson);
        if (!item.mods || !Array.isArray(item.mods)) return null;
        if (item.mods.length <= MAX_TOTAL_MODS) return null;

        // fixedMods（tier 0）を優先、残りをランダムMODとして扱う
        const fixedMods = item.mods.filter((m: { tier?: number }) => m.tier === 0);
        const randomMods = item.mods.filter((m: { tier?: number }) => m.tier !== 0);

        // ランダムMODを先頭から残す（ドロップ時の順序を維持）
        const allowedRandomCount = Math.max(0, MAX_TOTAL_MODS - fixedMods.length);
        item.mods = [...fixedMods, ...randomMods.slice(0, allowedRandomCount)];

        return JSON.stringify(item);
      }

      // インベントリ
      const invRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM character_inventory`
      );
      for (const row of invRows) {
        const updated = trimMods(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE character_inventory SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }

      // 倉庫
      const storageRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM storage`
      );
      for (const row of storageRows) {
        const updated = trimMods(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE storage SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }

      // 装備
      const equipRows = await db.getAllAsync<{ id: number; item_data: string }>(
        `SELECT id, item_data FROM character_equipment WHERE item_data IS NOT NULL`
      );
      for (const row of equipRows) {
        const updated = trimMods(row.item_data);
        if (updated) {
          await db.runAsync(
            `UPDATE character_equipment SET item_data = ? WHERE id = ?`,
            updated, row.id
          );
        }
      }
    },
  },
  {
    // V11 → V12: ペットシステム用テーブル追加
    version: 12,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS character_pets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          character_id INTEGER NOT NULL,
          instance_id TEXT NOT NULL,
          pet_id TEXT NOT NULL,
          obtained_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
          UNIQUE(character_id, instance_id)
        );
        CREATE TABLE IF NOT EXISTS character_active_pet (
          character_id INTEGER PRIMARY KEY,
          instance_id TEXT,
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    // V12 → V13: ペット強化レベルテーブル追加
    version: 13,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS character_pet_levels (
          character_id INTEGER NOT NULL,
          pet_id TEXT NOT NULL,
          level INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (character_id, pet_id),
          FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    // V13 → V14: キャラクターに season カラムを追加
    // 既存キャラ（シーズン2以前に作成）は全員 season=2 とし、シーズン2のスキルツリー・
    // ランキングのまま継続プレイできるようにする。新規作成キャラは作成時のシーズンを記録する。
    version: 14,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        ALTER TABLE characters ADD COLUMN season INTEGER NOT NULL DEFAULT 2;
      `);
    },
  },
  {
    // V14 → V15: 倉庫と進行フラグをシーズン別に分離
    // 既存データはS2以前のプレイデータとして扱い、S2キーへ退避する。
    version: 15,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        ALTER TABLE storage ADD COLUMN season INTEGER NOT NULL DEFAULT 2;
      `);

      const settingKeys = [
        'end_content_unlocked',
        'uber_boss_unlocks',
        'uber_boss_tickets',
        'dungeon_clear_records',
      ];

      for (const key of settingKeys) {
        await db.runAsync(
          `
          INSERT INTO game_settings (key, value)
          SELECT ?, value FROM game_settings
          WHERE key = ?
            AND NOT EXISTS (SELECT 1 FROM game_settings WHERE key = ?)
          `,
          `${key}_s2`,
          key,
          `${key}_s2`
        );
      }
    },
  },
  {
    // V15 → V16: 壊れたパッシブツリーの修復
    //
    // 旧 canRefundNode は「直接の子の前提条件」しか見ておらず、S3ツリーで
    // requiredNodes に OR 条件が入ったことで、返却により
    // 「スタートから到達できない浮島ノード」が発生していた。
    // （記録済みクリアデータの約1/3が、ルール上ありえない構成になっていた）
    //
    // 判定ロジックは data/passiveTree.ts 側で修正済み。ここでは既存セーブを救済する:
    //   - 全キャラのパッシブを検証し、スタートから到達できない構成のキャラは
    //     パッシブを全リセット（ステータスもクラス基礎値+レベル分に戻す）
    //   - 失ったスキルポイントは全額返還
    //   - 影響の有無に関わらず、お詫びとしてリスペックトークンを80個付与
    version: 16,
    migrate: async (db: SQLite.SQLiteDatabase) => {
      // 動的 import: マイグレーションはアプリ起動時に走るため、
      // ツリー計算モジュールを都度読み込む（React 非依存なので安全）
      const {
        isConnectedFromStart,
        setActivePassiveClass,
        setActivePassiveSeason,
        calculatePassiveEffects,
      } = await import('@/data/passiveTree');
      const { CLASS_INITIAL_STATS } = await import('@/core/player');

      const characters = await db.getAllAsync<{
        id: number;
        type: string;
        level: number;
        season: number;
        skill_points: number;
      }>('SELECT id, type, level, season, skill_points FROM characters');

      for (const ch of characters) {
        const rows = await db.getAllAsync<{ skill_id: string }>(
          'SELECT skill_id FROM character_skills WHERE character_id = ?',
          ch.id
        );
        const unlocked = rows.map((r) => r.skill_id);
        if (unlocked.length === 0) continue;

        // そのキャラのシーズン/クラスのツリーで検証する
        setActivePassiveSeason(ch.season);
        setActivePassiveClass(ch.type as never);

        if (isConnectedFromStart(unlocked)) continue;

        // 壊れている → パッシブを全リセット
        await db.runAsync('DELETE FROM character_skills WHERE character_id = ?', ch.id);

        // ステータスをクラス基礎値+レベル分に戻す（refundSkill と同じ式）
        const classStats = CLASS_INITIAL_STATS[ch.type as keyof typeof CLASS_INITIAL_STATS];
        const empty = calculatePassiveEffects([]);
        const maxHp = classStats.maxHp + (ch.level - 1) * 5 + empty.hp;
        const atk = classStats.atk + empty.atk;
        const def = classStats.def + empty.def;

        // 消費済みのスキルポイントを全額返還
        const restoredPoints = ch.skill_points + unlocked.length;

        await db.runAsync(
          'UPDATE characters SET skill_points = ?, max_hp = ?, atk = ?, def = ? WHERE id = ?',
          restoredPoints,
          maxHp,
          atk,
          def,
          ch.id
        );
      }

      // リスペックトークンを80個付与（全プレイヤー共通・既存保有分に加算）
      const tokenRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM game_settings WHERE key = 'respec_tokens'"
      );
      const current = tokenRow ? parseInt(tokenRow.value, 10) : 0;
      const next = (Number.isFinite(current) ? current : 0) + 80;
      await db.runAsync(
        `INSERT INTO game_settings (key, value) VALUES ('respec_tokens', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        String(next)
      );
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
    return;
  }

  // 現在のバージョンより大きく、ターゲット以下のマイグレーションを実行
  const pendingMigrations = migrations.filter(
    (m) => m.version > currentVersion && m.version <= targetVersion
  );

  for (const migration of pendingMigrations) {
    try {
      await migration.migrate(db);

      // バージョンを更新
      await db.runAsync(
        'INSERT OR REPLACE INTO schema_version (version) VALUES (?)',
        migration.version
      );
    } catch (error) {
      console.error(`[Migration] Failed to migrate to version ${migration.version}:`, error);
      throw error;
    }
  }
}
