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

// インベントリアイテムはItem[]として保存（各アイテムが独自のMODを持つ）

// 倉庫アイテム（スタック対応）
export interface StorageItem {
  itemId: string;
  quantity: number;
}

// DBの装備レコードはequipmentRepositoryで定義

// ========================================
// Game Types
// ========================================

// MODタイプ
export type ModType =
  | 'atk_bonus'      // ATK+X
  | 'def_bonus'      // DEF+X
  | 'hp_regen'       // 毎ターンHP X回復
  | 'poison_chance'  // 毒付与確率+X%
  | 'critical_chance'; // クリティカル確率+X%

// MOD定義
export interface ItemMod {
  type: ModType;
  value: number;
}

// MOD設定（ランダム生成用）
export interface ModConfig {
  type: ModType;
  minValue: number;
  maxValue: number;
  weight: number; // 出現確率の重み
}

// アイテム基本定義（マスターデータ）
export interface ItemBase {
  id: string;
  name: string;
  slot: EquipmentSlot;
  atk: number;
  def: number;
  fixedMods?: ItemMod[]; // ユニークアイテムの固有MOD
}

// アイテムインスタンス（MOD付き）
export interface Item extends ItemBase {
  instanceId: string;  // ユニークなインスタンスID
  mods: ItemMod[];     // 付与されたMOD（固有MOD + ランダムMOD）
}

// 毒状態
export interface PoisonState {
  damagePerTurn: number;
  remainingTurns: number;
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

// ユニークドロップ設定
export interface UniqueDrop {
  itemId: string;
  dropRate: number; // ドロップ確率（%）
}

// 敵定義（モンスター）
export interface Enemy {
  id: string;
  name: string;
  image: string; // 画像ID
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  uniqueDrop: UniqueDrop | null; // モンスター固有ドロップ
}

// モンスター出現設定
export interface MonsterSpawn {
  monsterId: string;
  spawnRate: number; // 出現確率（%）
}

// アイテムドロップ設定
export interface ItemDrop {
  itemId: string;
  dropRate: number; // ドロップ確率（%）
}

// ダンジョンドロップテーブル
export interface DungeonDropTable {
  common: ItemDrop[];  // 共通ドロップ
  dungeon: ItemDrop[]; // ダンジョン固有ドロップ
}

// ダンジョン定義（詳細）
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  maxFloor: number;
  recommendedLevel: number;
  monsters: MonsterSpawn[];
  dropTable: DungeonDropTable;
}

// ダンジョンリスト用（選択画面用）
export interface DungeonListItem {
  id: string;
  name: string;
  description: string;
  recommendedLevel: number;
  maxFloor: number;
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
  image: string;
  currentHp: number;
  maxHp: number;
  uniqueDrop: UniqueDrop | null;
  atk: number;
  def: number;
  exp: number;
}

// 戦闘ログエントリ
export interface BattleLogEntry {
  id: number;
  message: string;
  type: 'player_attack' | 'enemy_attack' | 'victory' | 'defeat' | 'floor_clear' | 'info' | 'poison' | 'critical' | 'heal';
}

// 戦闘状態（useReducer用）
export interface BattleState {
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;
  enemyPoison: PoisonState | null; // 敵の毒状態
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;
}

// 戦闘アクション
export type BattleAction =
  | { type: 'START_BATTLE'; enemy: BattleEnemy }
  | { type: 'PLAYER_ATTACK'; damage: number; isCritical?: boolean }
  | { type: 'ENEMY_ATTACK'; damage: number }
  | { type: 'ENEMY_DEFEATED'; exp: number; droppedItems: Item[] } // 複数アイテム対応
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'NEXT_FLOOR'; enemy: BattleEnemy }
  | { type: 'DUNGEON_CLEARED' }
  | { type: 'ADD_LOG'; entry: Omit<BattleLogEntry, 'id'> }
  | { type: 'APPLY_POISON'; damagePerTurn: number; turns: number }
  | { type: 'POISON_DAMAGE'; damage: number }
  | { type: 'HP_REGEN'; amount: number };

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
