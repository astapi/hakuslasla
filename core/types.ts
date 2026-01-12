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
  // increased% (加算で合計)
  hp_increased_pct: number;   // HP +X% increased
  atk_increased_pct: number;  // ATK +X% increased
  def_increased_pct: number;  // DEF +X% increased
  // more% (乗算、複数あれば掛け合わせ)
  hp_more_pct: number[];      // HP X% more (配列で保持)
  atk_more_pct: number[];     // ATK X% more (配列で保持)
  def_more_pct: number[];     // DEF X% more (配列で保持)
  // 戦闘特殊効果
  poison_chance: number;      // 毒付与率（%）
  critical_chance: number;    // クリティカル率（%）
  critical_damage: number;    // クリティカルダメージ+X%
  hp_regen: number;           // 毎ターンHP回復
  hp_regen_pct: number;       // 毎ターンHP X%回復
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

// ========================================
// ゲージ制戦闘用型定義
// ========================================

/**
 * MOD効果（戦闘時）
 * 装備MODとパッシブ効果を統合した戦闘用ステータス
 */
export interface CombinedModEffects {
  // HP回復
  hpRegen: number;           // フラット回復量
  hpRegenPct: number;        // %回復量

  // 毒
  poisonChance: number;      // 付与率%
  poisonDamagePct: number;   // increased%（加算）
  poisonDamageMorePct: number[];  // more%（配列）
  poisonMaxStacks: number;   // スタック上限追加
  poisonDamageReduction: number;  // 敵毒時の被ダメ軽減%
  poisonLifesteal: number;   // 毒ダメージ吸収%（毒ダメージの一定割合を回復）
  noDirectDamage: boolean;   // 通常ダメージ無効（キーストーン）

  // クリティカル
  criticalChance: number;    // 発生率%
  criticalDamage: number;    // ダメージ+%
  criticalLifesteal: number; // クリ時吸収%

  // 防御・吸収
  damageReductionPct: number;  // ダメージ軽減%
  lifesteal: number;           // ライフスティール%

  // 攻撃速度
  attackSpeedPct: number;        // increased%
  attackSpeedMorePct: number[];  // more%（配列）
}

/**
 * ゲージ制戦闘の参加者
 */
export interface GaugeCombatant {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  attackSpeed: number;  // 最終計算済みAS
  gauge: number;        // 0-100
}

/**
 * 毒スタック
 */
export interface PoisonStack {
  damagePerTick: number;   // 1ティックあたりのダメージ
  remainingTicks: number;  // 残りティック数
}

/**
 * ゲージ制戦闘状態
 */
export interface GaugeBattleState {
  player: GaugeCombatant;
  enemy: GaugeCombatant;
  enemyPoisonStacks: PoisonStack[];
  elapsedTicks: number;  // 経過ティック数
  isFinished: boolean;
  winner: 'player' | 'enemy' | null;
}

/**
 * 戦闘イベントタイプ
 */
export type BattleEventType =
  | 'player_attack'
  | 'enemy_attack'
  | 'critical_hit'
  | 'poison_applied'
  | 'poison_damage'
  | 'poison_expired'
  | 'hp_regen'
  | 'lifesteal'
  | 'player_defeated'
  | 'enemy_defeated';

/**
 * 戦闘イベント（ログ用）
 */
export interface BattleEvent {
  type: BattleEventType;
  tick: number;
  data: Record<string, unknown>;
}

/**
 * ゲージ制戦闘結果
 */
export interface GaugeBattleResult {
  victory: boolean;
  totalTicks: number;
  playerHpRemaining: number;
  expGained: number;
  events: BattleEvent[];
}

/**
 * ゲージ制ダンジョン結果
 */
export interface GaugeDungeonResult {
  dungeonId: string;
  cleared: boolean;
  floorsCleared: number;
  maxFloor: number;
  totalExp: number;
  totalTicks: number;
  playerHpRemaining: number;
  floorResults: GaugeFloorResult[];
  events: BattleEvent[];
}

/**
 * ゲージ制フロア結果
 */
export interface GaugeFloorResult {
  floor: number;
  enemyId: string;
  battle: GaugeBattleResult;
}

/**
 * 戦闘設定（定数をカスタマイズ可能）
 */
export interface BattleConfig {
  // 毒設定
  poisonDamageRatio: number;   // 基本ダメージ比率（デフォルト: 0.5）
  poisonDuration: number;       // 持続ティック数（デフォルト: 5）
  basePoisonMaxStacks: number;  // 基本スタック上限（デフォルト: 1）

  // クリティカル設定
  baseCriticalMultiplier: number;  // 基礎倍率（デフォルト: 1.5）

  // ゲージ設定
  ticksPerSecond: number;  // 1秒あたりのティック数（デフォルト: 30）
  baseGaugePerSecond: number;  // AS 1.0時の1秒あたりのゲージ増加（デフォルト: 200）
}

/**
 * デフォルト戦闘設定
 */
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  poisonDamageRatio: 1.2,
  poisonDuration: 5,
  basePoisonMaxStacks: 1,
  baseCriticalMultiplier: 1.5,
  ticksPerSecond: 30,
  baseGaugePerSecond: 200,
};
