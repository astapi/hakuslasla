export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
-- キャラクター基本情報
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  skill_points INTEGER NOT NULL DEFAULT 0,
  max_hp INTEGER NOT NULL DEFAULT 100,
  atk INTEGER NOT NULL DEFAULT 10,
  def INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 装備（キャラクターごと、スロットごとに1レコード）
-- item_data: Item全体をJSON形式で保存（MOD含む）
CREATE TABLE IF NOT EXISTS character_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  item_data TEXT,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, slot)
);

-- インベントリ（キャラクターごと、MOD付きItem個別保存）
-- instance_id: 各アイテムのユニークID
-- item_data: Item全体をJSON形式で保存（MOD含む）
CREATE TABLE IF NOT EXISTS character_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  item_data TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, instance_id)
);

-- 習得済みスキル
CREATE TABLE IF NOT EXISTS character_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(character_id, skill_id)
);

-- 倉庫（全キャラクター共有、スタック対応）
CREATE TABLE IF NOT EXISTS storage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1
);

-- ゲーム設定
CREATE TABLE IF NOT EXISTS game_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- スキーマバージョン管理
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
`;

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'gloves', 'boots', 'accessory'] as const;
