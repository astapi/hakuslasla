// 装備スロットの種類
export type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';

// 武器種別
export type WeaponType = 'sword' | 'staff';

// キャラクタークラス
export type CharacterType = 'warrior' | 'elementalist' | 'ranger' | 'frostmage';

// クラス別固有能力
export interface ClassAbility {
  igniteChance?: number;      // 発火確率%（エレメンタリスト）
  criticalChance?: number;    // クリティカル率%（ウォリアー）
  attackSpeedPct?: number;    // 攻撃速度+%（ウォリアー）
  poisonChance?: number;      // 毒付与率%（レンジャー）
  chillChance?: number;       // チル付与率%（フロストメイジ）
}

// ドロップフィルター設定
export interface DropFilterSettings {
  // カテゴリフィルター（trueで取得、falseで除外）
  categories: {
    weapon: boolean;
    armor: boolean;
    gloves: boolean;
    boots: boolean;
    accessory: boolean;
  };
  // 最小MOD数（この数以上のMODを持つアイテムのみ取得）
  minModCount: number;
  // 最高Tier（1が最高品質）（このTier以下のMODを少なくとも1つ持つアイテムのみ取得）
  // 0の場合はフィルタリングしない
  maxTier: number;
}

// デフォルトのフィルター設定
export const DEFAULT_DROP_FILTER: DropFilterSettings = {
  categories: {
    weapon: true,
    armor: true,
    gloves: true,
    boots: true,
    accessory: true,
  },
  minModCount: 0,
  maxTier: 0,
};

// ========================================
// Database Types
// ========================================

// キャラクター（DB用）
export interface Character {
  id: number;
  name: string;
  type: CharacterType;
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
  type: CharacterType;
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
  | 'atk_bonus'          // ATK+X (フラット)
  | 'def_bonus'          // DEF+X (フラット)
  | 'hp_bonus'           // HP+X (フラット)
  | 'atk_increased_pct'  // ATK +X% (increased、加算)
  | 'def_increased_pct'  // DEF +X% (increased、加算)
  | 'hp_increased_pct'   // HP +X% (increased、加算)
  | 'atk_more_pct'       // ATK X% more (乗算、非常に強力)
  | 'def_more_pct'       // DEF X% more (乗算、非常に強力)
  | 'hp_more_pct'        // HP X% more (乗算、非常に強力)
  | 'hp_regen'           // 毎秒HP X回復
  | 'hp_regen_pct'       // 毎秒HP X%回復
  | 'poison_chance'      // 毒付与確率+X%
  | 'ignite_chance'      // 発火付与確率+X%（杖専用）
  | 'ignite_duration_pct'    // 発火時間+X%（杖専用）
  | 'ignite_tick_speed_pct'  // 発火ダメージ速度+X%（杖専用）
  | 'ignite_damage_pct'      // 発火ダメージ+X%（杖専用）
  | 'ignite_lifesteal'       // 発火ダメージ吸収+X%
  | 'critical_chance'    // クリティカル確率+X%
  | 'critical_damage'    // クリティカルダメージ+X%
  | 'damage_defer_pct'  // ダメージ遅延+X%（鎧専用）：ダメージのX%を4秒かけて受ける
  | 'damage_reduction_pct'  // ダメージ軽減+X%（鎧専用）
  | 'hp_on_hit'          // HIT時HP回復（武器専用）
  | 'lifesteal'          // ライフスティール（与ダメージの一部を回復）
  | 'attack_speed_pct'   // AS +X% (increased、加算)
  | 'attack_speed_more_pct' // AS X% more (乗算)
  | 'time_atk_inc_pct'    // 5秒毎にATK increased%加算
  | 'time_def_inc_pct'    // 5秒毎にDEF increased%加算
  | 'time_hp_regen'       // 5秒毎にHP回復量加算
  | 'hp_regen_to_atk_pct' // 毎秒HP回復量のX%をATKに変換
  | 'warlord_enrage'      // 乱軍の王（HP30%以下で1度発動: 攻撃速度+20%, 攻撃時HP回復300）
  | 'chill_chance'         // チル付与確率+X%
  | 'chill_effect_pct'     // チル効果強化+X%（速度低下をさらに強化）
  | 'chill_duration_pct'   // チル持続時間+X%
  | 'freeze_chance'        // フリーズ付与確率+X%（上限10%）
  | 'freeze_duration_pct'  // フリーズ持続時間+X%
  | 'critical_follow_up_attack' // クリティカル時追撃
  | 'follow_up_attack_pct'      // 毎攻撃時、valueパーセントのATKで追撃（UberUber双撃の指輪）
  | 'king_slam'                 // 5回攻撃ごとにATK×3の追撃（UberUberゴブリンの踏みつけ）
  | 'royal_roar'                // 3回攻撃ごとに自身の毒・発火・チル状態を解除
  | 'poison_damage_pct'       // 毒ダメージ+X%
  | 'poison_damage_more_pct'  // 毒ダメージ X% more
  | 'poison_damage_reduction' // 敵が毒状態時のダメージ軽減+X%
  | 'hp_on_crit'              // クリティカル時HP回復
  | 'atk_inc_pct';            // ATK +X% (increased、加算) ※atk_increased_pctのエイリアス

// MOD定義
export interface ItemMod {
  type: ModType;
  value: number;
  tier: number;  // 1〜10（1が最高、10が最低）
}

// Tier別の値範囲
export interface TierValueRange {
  min: number;
  max: number;
}

// MOD設定（ランダム生成用）
export interface ModConfig {
  type: ModType;
  weight: number; // 出現確率の重み
  tiers: Record<string, TierValueRange>;  // tier番号 → 値範囲（デフォルト）
  slots?: EquipmentSlot[];  // 出現可能なスロット（未指定は全スロット）
  slotTiers?: Partial<Record<EquipmentSlot, Record<string, TierValueRange>>>;  // スロット別tier設定（指定スロットはこちらを優先）
}

// アイテム基本定義（マスターデータ）
export interface ItemBase {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponType?: WeaponType;  // 武器種別（slot='weapon'の場合のみ）
  atk: number;
  def: number;
  fixedMods?: ItemMod[]; // ユニークアイテムの固有MOD
}

// アイテムインスタンス（MOD付き）
export interface Item extends ItemBase {
  instanceId: string;  // ユニークなインスタンスID
  mods: ItemMod[];     // 付与されたMOD（固有MOD + ランダムMOD）
}

// 毒状態（後方互換性のため残す、新規コードはPoisonStackを使用）
// @deprecated core/types.ts の PoisonStack を使用してください
export interface PoisonState {
  damagePerTurn: number;
  remainingTurns: number;
}

// 装備中アイテム
export type Equipment = {
  [key in EquipmentSlot]: Item | null;
};

// パッシブノード効果
export interface PassiveEffect {
  // フラット加算
  hp?: number;
  atk?: number;
  def?: number;
  // increased% (加算で合計)
  hp_increased_pct?: number;   // HP +X% increased
  atk_increased_pct?: number;  // ATK +X% increased
  def_increased_pct?: number;  // DEF +X% increased
  // more% (乗算、非常に強力)
  hp_more_pct?: number;        // HP X% more
  atk_more_pct?: number;       // ATK X% more
  def_more_pct?: number;       // DEF X% more
  // 毒系
  poison_chance?: number;      // 毒付与率（%）
  poison_damage_pct?: number;  // 毒ダメージ倍率 +X%（increased）
  poison_damage_more_pct?: number; // 毒ダメージ倍率 X% more
  poison_max_stacks?: number;  // 毒スタック上限増加
  poison_damage_reduction?: number; // 敵が毒状態時のダメージ軽減 +X%
  poison_lifesteal?: number;   // 毒ダメージ吸収 +X%
  no_direct_damage?: boolean;  // 通常ダメージを与えられなくなる（キーストーン）
  // 発火系
  ignite_chance?: number;          // 発火付与率（%）
  ignite_duration_pct?: number;    // 発火時間+X%
  ignite_tick_speed_pct?: number;  // 発火ダメージ速度+X%
  ignite_damage_pct?: number;      // 発火ダメージ+X%
  ignite_damage_more_pct?: number; // 発火ダメージ X% more（乗算）
  ignite_lifesteal?: number;       // 発火ダメージ吸収 +X%
  ignite_spread?: boolean;         // イグナイト伝染（発火中の敵死亡時、次の敵に発火継承）
  ignite_stacking_damage?: boolean; // 緩慢なる炎: 発火付与5回ごとに+10% inc発火ダメージ（最大200%）
  // クリティカル系
  critical_chance?: number;    // クリティカル率（%）
  critical_damage?: number;    // クリティカルダメージ+X%
  hp_on_crit?: number;         // クリティカル時HP回復（固定値）
  critical_lifesteal_pct?: number; // クリティカル時ダメージ吸収%
  // 回復・防御系
  hp_regen?: number;           // 毎秒HP回復
  hp_regen_pct?: number;       // 毎秒HP X%回復
  damage_defer_pct?: number; // ダメージ遅延+X%（ダメージのX%を4秒かけて受ける）
  hp_on_hit?: number;          // HIT時HP回復（固定値）
  retaliate_def_pct?: number;  // 被ダメ時DEFのX%を反撃ダメージ
  // 攻撃速度系
  attack_speed_pct?: number;       // AS +X% increased
  attack_speed_more_pct?: number;  // AS X% more
  // チル系
  chill_chance?: number;           // チル付与率（%）
  chill_effect_pct?: number;       // チル効果強化+X%
  chill_duration_pct?: number;     // チル持続時間+X%
  // フリーズ系
  freeze_chance?: number;          // フリーズ付与率（%、上限10%）
  freeze_duration_pct?: number;    // フリーズ持続時間+X%
  // Uberツリー最終ノード固有能力
  heavy_strike?: boolean;              // 重撃
  def_hp_to_atk?: boolean;            // 防御転換
  uber_critical_follow_up?: boolean;   // クリティカル追撃+1
  poison_multi_stack?: number;         // 毒マルチスタック倍率
  ignite_intensify?: boolean;          // 灼熱加速
  chill_freeze_damage_mult?: number;   // チル/フリーズダメージ倍率
}

// パッシブノード位置（UI表示用）
export interface PassiveNodePosition {
  x: number;
  y: number;
}

// 前提ノード条件の型
// - string: 単一ノード（AND条件の一部）
// - string[]: OR条件（配列内のいずれか1つでOK）
// 例: ["a", ["b", "c"]] → a AND (b OR c)
export type NodeRequirement = string | string[];

// パッシブノード定義（JSON用）
export interface PassiveNodeData {
  id: string;
  name: string;
  description: string;
  effect: PassiveEffect;
  requiredNodes: NodeRequirement[];  // 前提ノード条件
  position: PassiveNodePosition;
}

// パッシブツリー定義（JSON用）
export interface PassiveTreeData {
  startNodeId: string;
  nodes: PassiveNodeData[];
}

// パッシブノード（ランタイム用、接続情報付き）
export interface PassiveNode extends PassiveNodeData {
  childNodes: string[];  // このノードを前提とするノードのID配列
}

// パッシブツリー（ランタイム用）
export interface PassiveTree {
  startNodeId: string;
  nodes: Map<string, PassiveNode>;
}

// 後方互換性のため残す（非推奨）
/** @deprecated PassiveNodeDataを使用してください */
export interface SkillNode {
  id: string;
  name: string;
  description: string;
  effect: {
    hp?: number;
    atk?: number;
    def?: number;
  };
  requiredSkillId: string | null;
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
  attackSpeed?: number; // 攻撃速度（デフォルト1.0）
  uniqueDrop: UniqueDrop | null; // モンスター固有ドロップ
  uniqueDrops?: UniqueDrop[]; // 複数ユニークドロップ（Uber用）
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

// MOD tier範囲設定
export interface ModTierRange {
  minTier: number;  // 出現する最低tier（数値が大きい方、例: 10）
  maxTier: number;  // 出現する最高tier（数値が小さい方、例: 7）
}

// MOD数範囲設定
export interface ModCountRange {
  min: number;  // 最小MOD数
  max: number;  // 最大MOD数（最大4）
}

// ボス設定
export interface DungeonBoss {
  monsterId: string;
  floor: number;
}

// ダンジョン定義（詳細）
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  maxFloor: number;
  monsters: MonsterSpawn[];
  dropTable: DungeonDropTable;
  boss?: DungeonBoss;           // ボス設定
  modTierRange?: ModTierRange;  // ダンジョンのMOD tier範囲
  modCountRange?: ModCountRange; // ダンジョンのMOD数範囲
}

// ダンジョンリスト用（選択画面用）
export interface DungeonListItem {
  id: string;
  name: string;
  description: string;
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
export type BattlePhase = 'fighting' | 'victory' | 'defeat' | 'cleared' | 'retreat';

// 敵の表示情報（UI用）
export interface EnemyDisplayInfo {
  id: string;
  name: string;
  image: string;
  exp: number;
  uniqueDrop: UniqueDrop | null;
  uniqueDrops?: UniqueDrop[];
}

// 戦闘中の敵情報（後方互換性のため残す）
// @deprecated 新規コードではEnemyDisplayInfo + GaugeCombatantを使用
export interface BattleEnemy {
  id: string;
  name: string;
  image: string;
  currentHp: number;
  maxHp: number;
  uniqueDrop: UniqueDrop | null;
  uniqueDrops?: UniqueDrop[];
  atk: number;
  def: number;
  exp: number;
  attackSpeed: number; // 攻撃速度
}

// 戦闘ログエントリ
export interface BattleLogEntry {
  id: number;
  message: string;
  type: 'player_attack' | 'enemy_attack' | 'victory' | 'defeat' | 'floor_clear' | 'info' | 'poison' | 'ignite' | 'critical' | 'heal' | 'chill' | 'freeze';
}

// 発火状態
export interface IgniteState {
  damage: number;           // 1ティックあたりのダメージ
  remainingMs: number;      // 残り時間（ミリ秒）
  tickIntervalMs: number;   // ダメージ間隔（ミリ秒）
}

// 戦闘状態（useReducer用）- 後方互換性のため残す
// @deprecated 新規コードでは DungeonBattleState を使用
export interface BattleState {
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;
  playerCurrentHp: number;
  playerMaxHp: number;
  enemy: BattleEnemy | null;
  enemyPoison: PoisonState[]; // 敵の毒状態（複数スタック対応）
  playerPoison: PoisonState[]; // プレイヤーの毒状態（複数スタック対応）
  enemyIgnite: IgniteState | null; // 敵の発火状態
  enemyChill: { speedMultiplier: number; remainingMs: number } | null; // 敵のチル状態
  enemyFreeze: { remainingMs: number } | null; // 敵のフリーズ状態
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  lastDroppedItems: Item[]; // 直近の撃破でドロップしたアイテム
  totalExpGained: number;
  playerGauge: number; // プレイヤーの行動ゲージ (0-100)
  enemyGauge: number;  // 敵の行動ゲージ (0-100)
}

// ダンジョン戦闘状態（Core型を内包する新しい型）
// GaugeBattleState は core/types.ts からインポートして使用
export interface DungeonBattleState {
  // ダンジョン進行
  dungeonId: string;
  currentFloor: number;
  maxFloor: number;

  // 敵の表示情報
  enemyInfo: EnemyDisplayInfo | null;

  // UI状態
  phase: BattlePhase;
  battleLog: BattleLogEntry[];
  droppedItems: Item[];
  totalExpGained: number;

  // Core戦闘状態のプロパティ（フラットに展開）
  // player, enemy はGaugeCombatantだが、UI用にプロパティを展開
  playerCurrentHp: number;
  playerMaxHp: number;
  playerAtk: number;
  playerDef: number;
  playerAttackSpeed: number;
  playerGauge: number;

  enemyCurrentHp: number;
  enemyMaxHp: number;
  enemyAtk: number;
  enemyDef: number;
  enemyAttackSpeed: number;
  enemyGauge: number;

  // 毒スタック（PoisonStack[]）
  enemyPoisonStacks: Array<{
    damagePerTick: number;
    remainingTicks: number;
  }>;

  // 発火状態
  enemyIgniteState: {
    damage: number;           // 1ティックあたりのダメージ
    remainingMs: number;      // 残り時間（ミリ秒）
    tickIntervalMs: number;   // ダメージ間隔（ミリ秒）
    lastTickMs: number;       // 最後にダメージを与えた時間
  } | null;

  // チル状態
  enemyChillState: {
    speedMultiplier: number;
    remainingMs: number;
  } | null;

  // フリーズ状態
  enemyFreezeState: {
    remainingMs: number;
  } | null;

  elapsedTicks: number;
}

// 戦闘アクション - 後方互換性のため残す
// @deprecated 新規コードでは DungeonBattleAction を使用
export type BattleAction =
  | { type: 'START_BATTLE'; enemy: BattleEnemy }
  | { type: 'PLAYER_ATTACK'; damage: number; isCritical?: boolean }
  | { type: 'ENEMY_ATTACK'; damage: number }
  | { type: 'PLAYER_DAMAGE'; damage: number; message: string; logType?: BattleLogEntry['type'] }
  | { type: 'ENEMY_HEAL'; amount: number; source?: 'regen' | 'on_hit' }
  | { type: 'ENEMY_DEFEATED'; exp: number; droppedItems: Item[] } // 複数アイテム対応
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'RETREAT' }
  | { type: 'NEXT_FLOOR'; enemy: BattleEnemy }
  | { type: 'DUNGEON_CLEARED' }
  | { type: 'ADD_LOG'; entry: Omit<BattleLogEntry, 'id'> }
  | { type: 'APPLY_POISON'; damagePerTurn: number; turns: number }
  | { type: 'POISON_DAMAGE'; damage: number }
  | { type: 'APPLY_PLAYER_POISON'; damagePerTurn: number; turns: number }
  | { type: 'PLAYER_POISON_DAMAGE'; damage: number }
  | { type: 'HP_REGEN'; amount: number }
  | { type: 'APPLY_IGNITE'; damage: number; durationMs: number; tickIntervalMs: number }
  | { type: 'APPLY_IGNITE_SPREAD'; damage: number; durationMs: number; tickIntervalMs: number }
  | { type: 'IGNITE_DAMAGE'; damage: number; remainingMs: number }
  | { type: 'UPDATE_GAUGES'; playerGauge: number; enemyGauge: number; enemyChill?: { speedMultiplier: number; remainingMs: number } | null; enemyFreeze?: { remainingMs: number } | null }
  | { type: 'RESET_PLAYER_GAUGE' }
  | { type: 'RESET_ENEMY_GAUGE' };

// ダンジョン戦闘アクション（Core関数の結果を適用）
export type DungeonBattleAction =
  | { type: 'START_BATTLE'; enemyInfo: EnemyDisplayInfo; enemyStats: { maxHp: number; atk: number; def: number; attackSpeed: number } }
  | { type: 'APPLY_PLAYER_ATTACK'; damage: number; isCritical: boolean; newEnemyHp: number }
  | { type: 'APPLY_ENEMY_ATTACK'; damage: number; newPlayerHp: number }
  | { type: 'APPLY_POISON'; damagePerTick: number; remainingTicks: number }
  | { type: 'APPLY_POISON_DAMAGE'; damage: number; healAmount: number; updatedStacks: Array<{ damagePerTick: number; remainingTicks: number }> }
  | { type: 'APPLY_IGNITE'; damage: number; durationMs: number; tickIntervalMs: number }
  | { type: 'APPLY_IGNITE_DAMAGE'; damage: number; updatedState: { damage: number; remainingMs: number; tickIntervalMs: number; lastTickMs: number } | null }
  | { type: 'APPLY_HP_REGEN'; amount: number }
  | { type: 'APPLY_LIFESTEAL'; amount: number }
  | { type: 'ENEMY_DEFEATED'; exp: number; droppedItems: Item[] }
  | { type: 'PLAYER_DEFEATED' }
  | { type: 'NEXT_FLOOR'; enemyInfo: EnemyDisplayInfo; enemyStats: { maxHp: number; atk: number; def: number; attackSpeed: number } }
  | { type: 'DUNGEON_CLEARED' }
  | { type: 'ADD_LOG'; entry: Omit<BattleLogEntry, 'id'> }
  | { type: 'UPDATE_GAUGES'; playerGauge: number; enemyGauge: number; enemyChill?: { speedMultiplier: number; remainingMs: number } | null; enemyFreeze?: { remainingMs: number } | null }
  | { type: 'RESET_DUNGEON'; playerMaxHp: number; playerAtk: number; playerDef: number; playerAttackSpeed: number };

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
