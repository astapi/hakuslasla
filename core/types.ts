/**
 * コアロジック用の型定義
 * React/DB依存なし、純粋なゲームロジック用
 */

// ========================================
// 基本ステータス
// ========================================

export interface Stats {
  maxHp: number;
  atk: number;
  def: number;
}

// パッシブ効果（戦闘特殊効果含む）
export interface PassiveStats extends Stats {
  poison_chance: number;    // 毒付与率（%）
  critical_chance: number;  // クリティカル率（%）
  hp_regen: number;         // 毎ターンHP回復
}

export interface CombatStats extends Stats {
  currentHp: number;
}

// ========================================
// プレイヤー関連
// ========================================

export interface PlayerConfig {
  level: number;
  baseStats: Stats;
  equipment: EquipmentConfig;
  unlockedSkills: string[];
}

export interface EquipmentConfig {
  weapon: ItemConfig | null;
  armor: ItemConfig | null;
  gloves: ItemConfig | null;
  boots: ItemConfig | null;
  accessory: ItemConfig | null;
}

export interface ItemConfig {
  id: string;
  atk: number;
  def: number;
}

// ========================================
// 敵関連
// ========================================

export interface EnemyConfig {
  id: string;
  name: string;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
}

// ========================================
// ダンジョン関連
// ========================================

export interface BossConfig {
  monsterId: string;
  floor: number;
}

export interface DungeonConfig {
  id: string;
  name: string;
  maxFloor: number;
  enemies: string[];
  dropTable: string[];
  boss?: BossConfig;
}

// ========================================
// 戦闘関連
// ========================================

export interface BattleState {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  turn: number;
}

export interface TurnResult {
  playerDamageDealt: number;
  enemyDamageDealt: number;
  playerHpAfter: number;
  enemyHpAfter: number;
  enemyDefeated: boolean;
  playerDefeated: boolean;
}

export interface BattleResult {
  victory: boolean;
  turns: number;
  expGained: number;
  playerHpRemaining: number;
}

// ========================================
// ダンジョン探索関連
// ========================================

export interface FloorResult {
  floor: number;
  enemyId: string;
  battle: BattleResult;
}

export interface DungeonResult {
  dungeonId: string;
  cleared: boolean;
  floorsCleared: number;
  maxFloor: number;
  totalExp: number;
  totalTurns: number;
  playerHpRemaining: number;
  floorResults: FloorResult[];
  droppedItems: string[];
}

// ========================================
// シミュレーション関連
// ========================================

export interface SimulationConfig {
  playerConfig: PlayerConfig;
  dungeonId: string;
  runs: number;
  seed?: number; // 再現性のため
}

export interface SimulationStats {
  winRate: number;
  avgTurns: number;
  avgExpGained: number;
  avgFloorsCleared: number;
  avgPlayerHpRemaining: number;
  minTurns: number;
  maxTurns: number;
  totalRuns: number;
  wins: number;
  losses: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  stats: SimulationStats;
  results: DungeonResult[];
}

// ========================================
// レベルアップ関連
// ========================================

export interface LevelUpResult {
  newLevel: number;
  newExp: number;
  expToNextLevel: number;
  skillPointsGained: number;
  statsGained: {
    maxHp: number;
    atk: number;
    def: number;
  };
}
