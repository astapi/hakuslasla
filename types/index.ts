// 装備スロットの種類
export type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';

// ========================================
// Database Types
// ========================================

// キャラクター（DB用）
export interface Character {
  id: number;
  name: string;
  level: number;
  exp: number;
  skillPoints: number;
  maxHp: number;
  atk: number;
  def: number;
  createdAt: string;
  updatedAt: string;
}

// キャラクター作成用
export interface CreateCharacterInput {
  name: string;
}

// キャラクター更新用
export interface UpdateCharacterStats {
  level?: number;
  exp?: number;
  skillPoints?: number;
  maxHp?: number;
  atk?: number;
  def?: number;
}

// インベントリアイテム（スタック対応）
export interface InventoryItem {
  itemId: string;
  quantity: number;
}

// 倉庫アイテム（スタック対応）
export interface StorageItem {
  itemId: string;
  quantity: number;
}

// DBの装備レコード
export interface EquipmentRecord {
  slot: EquipmentSlot;
  itemId: string | null;
}

// ========================================
// Game Types
// ========================================

// アイテム定義
export interface Item {
  id: string;
  name: string;
  slot: EquipmentSlot;
  atk: number;
  def: number;
}

// 装備中アイテム
export type Equipment = {
  [key in EquipmentSlot]: Item | null;
};

// スキルノード定義
export interface SkillNode {
  id: string;
  name: string;
  description: string;
  effect: {
    hp?: number;
    atk?: number;
    def?: number;
  };
  requiredSkillId: string | null; // 前提スキルのID（nullなら最初から取得可能）
}

// 敵定義
export interface Enemy {
  id: string;
  name: string;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
}

// ダンジョン定義
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  maxFloor: number;
  enemies: string[]; // 出現する敵のIDリスト
  dropTable: string[]; // ドロップするアイテムのIDリスト
}

// プレイヤーの基本ステータス
export interface PlayerStats {
  level: number;
  exp: number;
  expToNextLevel: number;
  skillPoints: number;
  maxHp: number;
  atk: number;
  def: number;
}

// プレイヤー状態（Zustandストア用）
export interface PlayerState extends PlayerStats {
  equipment: Equipment;
  inventory: Item[];
  unlockedSkills: string[];
}

// 戦闘フェーズ
export type BattlePhase = 'fighting' | 'victory' | 'defeat' | 'cleared';

// 戦闘中の敵情報
export interface BattleEnemy {
  id: string;
  name: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
}

// 戦闘ログエントリ
export interface BattleLogEntry {
  id: number;
  message: string;
  type: 'player_attack' | 'enemy_attack' | 'victory' | 'defeat' | 'floor_clear' | 'info';
}

// 戦闘状態（useReducer用）
export interface BattleState {
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;
}

// 戦闘アクション
export type BattleAction =
  | { type: 'START_BATTLE'; enemy: BattleEnemy }
  | { type: 'PLAYER_ATTACK'; damage: number }
  | { type: 'ENEMY_ATTACK'; damage: number }
  | { type: 'ENEMY_DEFEATED'; exp: number }
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'NEXT_FLOOR'; enemy: BattleEnemy }
  | { type: 'DUNGEON_CLEARED'; items: Item[] }
  | { type: 'ADD_LOG'; entry: Omit<BattleLogEntry, 'id'> };

// 結果画面用のパラメータ
export interface BattleResult {
  dungeonId: string;
  dungeonName: string;
  result: 'victory' | 'defeat' | 'cleared';
  floorsCleared: number;
  maxFloor: number;
  expGained: number;
  itemsGained: Item[];
}
