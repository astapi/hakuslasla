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
  hp_regen: number;           // 毎秒HP回復
  hp_regen_pct: number;       // 毎秒HP X%回復
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
  attackSpeed?: number;
  accuracy?: number;
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
  resolveEnemyForFloor?: (floor: number, rng: () => number) => EnemyConfig | undefined;
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

  // 発火
  igniteChance: number;          // 付与率%（クラス固有能力 + MOD）
  igniteDamagePct: number;       // ダメージ+%（increased）
  igniteDamageMorePct: number[]; // ダメージ more%（配列）
  igniteDurationPct: number;     // 時間+%
  igniteTickSpeedPct: number;    // ダメージ速度+%（間隔短縮）
  igniteLifesteal: number;       // 発火ダメージ吸収%（発火ダメージの一定割合を回復）
  igniteDamageReduction: number;  // 敵発火時の被ダメ軽減%
  igniteSpread: boolean;         // イグナイト伝染（敵死亡時、次の敵に発火継承）
  igniteStackingDamage: boolean; // 緩慢なる炎キーストーン: 発火付与5回ごとに+10% inc発火ダメージ（最大200%）

  // クリティカル
  criticalChance: number;    // 発生率%
  criticalDamage: number;    // ダメージ+%
  hpOnCrit: number;          // クリティカル時HP回復（固定値）
  critLifestealPct: number;  // クリティカル時ダメージ吸収%
  criticalFollowUpAttack: boolean;  // クリティカル時追撃（ATK×0.5の追加ダメージ + HIT時効果再発動）
  followUpAttackPct: number;        // 毎攻撃時にATKのvalueパーセントで追撃（UberUber双撃の指輪）
  kingSlam: boolean;                // 5回攻撃ごとにATK×3の追撃
  royalRoar: boolean;               // 3回攻撃ごとに自身の毒・発火・チル状態を解除

  // 防御・吸収
  damageDeferPct: number;  // ダメージ遅延%（ダメージのX%を4秒かけて受ける）
  damageReductionPct: number;  // ダメージ軽減%（防具MOD専用）
  evasion: number;             // 敵命中率を下げるEVAレーティング
  evasionIncreasedPct: number; // EVA increased%
  evasionMorePct: number[];    // EVA more%
  shieldOnEvadeStreakHitPct: number; // 連続回避後の被弾時、回避1回ごとに最大シールドのX%回復
  hpOnTakenHit: number;         // 被弾時HP回復（固定値）
  hpOnHit: number;             // HIT時HP回復（固定値）
  lifestealPct: number;        // 与ダメージの X% をHP回復（全ヒット、ペットバフ由来）
  retaliateDefPct: number;     // 被ダメ時DEFのX%を反撃ダメージ

  // シールド
  shield: number;                  // 最大シールドのフラット加算
  shieldIncreasedPct: number;      // シールド increased%
  shieldMorePct: number[];         // シールド more%
  hpToShield: boolean;             // 最大HPをシールドに変換し、戦闘時HPを圧縮
  shieldOn10AttacksPct: number;    // 10回攻撃ごとに最大シールドのX%回復
  shieldRechargeDelayMs: number;   // 被弾後Xmsで再構築開始
  shieldRechargePct: number;       // 再構築中、毎秒最大シールドのX%回復
  shieldBlocksDot: boolean;        // 毒などの継続ダメージもシールドで受ける

  // ペット
  petEffectPct: number;            // ペット効果 increased%
  petDropRatePct: number;          // ペットドロップ率 +%

  // ブロック・状態異常耐性・ボス対策
  blockChance: number;             // ブロック率%
  chillResistPct: number;          // チル付与率軽減%
  freezeResistPct: number;         // フリーズ付与率軽減%
  poisonResistPct: number;         // 毒ダメージ軽減%
  repeatHitDamageReductionPct: number; // 短時間の連続被弾軽減%
  lowHpDamageReductionPct: number;     // HP30%以下の被ダメージ軽減%
  autoCleanseIntervalMs: number;       // 自動浄化間隔

  // HP回復変換
  hpRegenToAtkPct: number;  // 毎秒HP回復量の一定%をATKに追加

  // 攻撃速度
  attackSpeedPct: number;        // increased%
  attackSpeedMorePct: number[];  // more%（配列）

  // チル
  chillChance: number;           // 付与率%
  chillEffectPct: number;        // チル効果強化%（0.8倍をさらに低下、最低0.5まで）
  chillDurationPct: number;      // チル持続時間+%

  // フリーズ
  freezeChance: number;          // 付与率%（上限10%のハードキャップ）
  freezeDurationPct: number;     // フリーズ持続時間+%
  freezeChanceCapPct: number;    // フリーズ発生率の上限+%（ペットバフ由来、既定キャップ10%に加算）

  // Uberツリー最終ノード固有能力
  heavyStrike: boolean;              // 重撃: 攻撃速度-20%, 与ダメ100%吸収, 重傷スタック
  defHpToAtk: boolean;               // 防御転換: DEF + maxHP/2 をATKに追加
  uberCriticalFollowUp: boolean;     // クリティカル追撃+1 (ATK100%)
  poisonMultiStack: number;          // 毒マルチスタック倍率（デフォルト1、猛毒覚醒で1.5）
  igniteIntensify: boolean;          // 灼熱加速: 発火継続時間半分+間隔半分
  chillFreezeDamageMult: number;     // チル/フリーズ中の敵へのダメージ倍率（デフォルト1）
  igniteResistPct: number;           // 発火ダメージ軽減%（プレイヤーが受ける発火ダメージ削減、UberUberクラーケン由来）

  // 戦闘経過で増える効果
  timeAtkIncPct: number;   // 5秒ごとにATK increased%加算
  timeDefIncPct: number;   // 5秒ごとにDEF increased%加算
  timeHpRegen: number;     // 5秒ごとにHP回復量加算

  // 乱軍の王（HP30%以下で1度発動: 攻撃速度+20%, 攻撃時HP回復+300）
  warlordEnrage: boolean;
}

/**
 * ゲージ制戦闘の参加者
 */
export interface GaugeCombatant {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  accuracy?: number;
  attackSpeed: number;  // 最終計算済みAS
  gauge: number;        // 0-100
}

/**
 * 遅延ダメージ（ダメージのX%を4秒かけて受ける）
 */
export interface DeferredDamage {
  damagePerTick: number;   // 1秒あたりのダメージ
  remainingTicks: number;  // 残りティック数（4秒 = 4ティック）
}

/**
 * 毒スタック
 */
export interface PoisonStack {
  damagePerTick: number;   // 1ティックあたりのダメージ
  remainingTicks: number;  // 残りティック数
}

/**
 * 発火状態（上書き式）
 */
export interface IgniteState {
  damage: number;           // 1ティックあたりのダメージ
  remainingMs: number;      // 残り時間（ミリ秒）
  tickIntervalMs: number;   // ダメージ間隔（ミリ秒）- デフォルト1000ms
  lastTickMs: number;       // 最後にダメージを与えた経過時間
}

/**
 * チル状態（攻撃速度低下）
 */
export interface ChillState {
  speedMultiplier: number;  // 攻撃速度倍率（デフォルト0.8、低いほど強い）
  remainingMs: number;      // 残り時間（ミリ秒）
}

/**
 * フリーズ状態（行動不能、HP regenは継続）
 */
export interface FreezeState {
  remainingMs: number;      // 残り時間（ミリ秒）
}

/**
 * ゲージ制戦闘状態
 */
export interface GaugeBattleState {
  player: GaugeCombatant;
  enemy: GaugeCombatant;
  playerShield: number;
  playerMaxShield: number;
  playerLastShieldDamageTick: number | null;
  playerLastHitDamageTick: number | null;
  playerLastAutoCleanseTick: number | null;
  enemyPoisonStacks: PoisonStack[];
  playerPoisonStacks: PoisonStack[];
  enemyIgniteState: IgniteState | null;  // 発火状態（上書き式）
  enemyChillState: ChillState | null;    // チル状態（攻撃速度低下）
  enemyFreezeState: FreezeState | null;  // フリーズ状態（行動不能）
  playerChillState: ChillState | null;   // プレイヤーのチル状態
  playerFreezeState: FreezeState | null; // プレイヤーのフリーズ状態
  igniteApplyCount: number;  // 発火付与回数（敵撃破時リセット）
  warlordEnrageActivated: boolean;  // 乱軍の王が発動済みか
  enemyWoundStacks: number;  // 重傷スタック数（重撃用、上限5）
  enemyWoundActionCounter: number;  // 敵行動カウンター（4回で重傷-1）
  deferredDamages: DeferredDamage[];  // 遅延ダメージキュー
  poisonStackAccumulator: number;  // 毒スタック端数アキュムレータ（猛毒の覚醒用）
  playerAttackCount: number;  // プレイヤー通常攻撃回数（キングスラム・王の咆哮用）
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
  | 'enemy_attack_evaded'
  | 'critical_hit'
  | 'poison_applied'
  | 'poison_damage'
  | 'poison_expired'
  | 'ignite_applied'
  | 'ignite_damage'
  | 'ignite_expired'
  | 'ignite_spread'
  | 'chill_applied'
  | 'chill_expired'
  | 'freeze_applied'
  | 'freeze_expired'
  | 'hp_regen'
  | 'player_heal'
  | 'lifesteal'
  | 'enemy_heal'
  | 'player_damage'
  | 'player_poison_applied'
  | 'player_poison_damage'
  | 'reset_player_gauge'
  | 'boss_skill'
  | 'boss_intro'
  | 'player_defeated'
  | 'enemy_defeated'
  | 'warlord_enrage'
  | 'wound_applied'
  | 'wound_decayed'
  | 'retaliate'
  | 'deferred_damage';

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
  poisonDamageRatio: number;   // 基本ダメージ比率（デフォルト: 1.2）
  poisonDuration: number;       // 持続ティック数（デフォルト: 5）
  basePoisonMaxStacks: number;  // 基本スタック上限（デフォルト: 1）

  // 発火設定
  igniteDamageRatio: number;    // 基本ダメージ比率（デフォルト: 1.0、毒より弱い）
  igniteDurationMs: number;     // 持続時間ミリ秒（デフォルト: 5000）
  igniteTickIntervalMs: number; // ダメージ間隔ミリ秒（デフォルト: 1000 = AS1.0相当）

  // チル設定
  chillDurationMs: number;         // チル持続時間ミリ秒（デフォルト: 3000）
  chillBaseSpeedMultiplier: number; // チル基本速度倍率（デフォルト: 0.8）
  chillMinSpeedMultiplier: number;  // チル最低速度倍率（デフォルト: 0.5）

  // フリーズ設定
  freezeDurationMs: number;        // フリーズ持続時間ミリ秒（デフォルト: 1500）
  freezeChanceCap: number;         // フリーズ発生率上限%（デフォルト: 10）

  // クリティカル設定
  baseCriticalMultiplier: number;  // 基礎倍率（デフォルト: 3.0）

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
  igniteDamageRatio: 0.5,      // 通常攻撃の50%ダメージ
  igniteDurationMs: 3000,      // 3秒
  igniteTickIntervalMs: 300,   // 0.3秒ごと（10回ダメージ = 通常攻撃の5倍）
  chillDurationMs: 3000,       // 3秒
  chillBaseSpeedMultiplier: 0.8, // 攻撃速度×0.8
  chillMinSpeedMultiplier: 0.5,  // 最低×0.5
  freezeDurationMs: 1500,      // 1.5秒
  freezeChanceCap: 10,         // 最大10%
  baseCriticalMultiplier: 3.0,
  ticksPerSecond: 30,
  baseGaugePerSecond: 200,
};
