/**
 * Uberボス攻略ギャップ分析スクリプト
 *
 * 目的:
 * - 現在の仕様から理論的に強いビルドパターンを構築
 * - 各Uberボスに対する勝率を測定
 * - 勝つために必要なステータス倍率を計算
 * - ボス調整 or ビルド最適化の判断材料を提供
 *
 * 使用方法:
 *   npx tsx scripts/analyzeUberGap.ts [runs] [seed]
 */

import { runGaugeSimulation, createRng } from '../core/simulation';
import { calculateBaseStatsForLevel, INITIAL_STATS } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects } from '../data/passiveTree';
import { EnemyConfig, DungeonConfig, Stats, CombinedModEffects } from '../core/types';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// ========================================
// コマンドライン引数
// ========================================

const args = process.argv.slice(2);
const runs = args[0] ? parseInt(args[0], 10) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 12345;
const level = 60;

// ========================================
// データ準備
// ========================================

const uberBossIds = [
  'uber_goblin_king',
  'uber_bandit_leader',
  'uber_vampire',
  'uber_kraken',
  'uber_demon_lord',
  'uber_true_final_boss',
] as const;

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries((monstersData as any).monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

function toDungeonConfig(dungeon: any): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap((m: any) => Array(m.spawnRate).fill(m.monsterId)),
    dropTable: allDrops.map((d: any) => d.itemId),
  };
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = { monsterId: dungeon.boss.monsterId, floor: dungeon.boss.floor };
  }
  return config;
}

const dungeonConfigs: Record<string, DungeonConfig> = {};
for (const id of uberBossIds) {
  const dungeon = (dungeonsData as any).dungeons[id];
  if (dungeon) dungeonConfigs[id] = toDungeonConfig(dungeon);
}

// ========================================
// 型定義
// ========================================

type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';

type ItemMod = { type: string; value: number; tier: number };

type Item = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  atk: number;
  def: number;
  instanceId: string;
  mods: ItemMod[];
};

type Equipment = {
  weapon: Item | null;
  armor: Item | null;
  gloves: Item | null;
  boots: Item | null;
  accessory: Item | null;
};

type BuildPattern = {
  name: string;
  description: string;
  passiveNodes: string[];
  equipment: Equipment;
};

// ========================================
// 理論的に強いビルドパターン
// ========================================

const FINAL_LAND_BASE_STATS = {
  weapon: { id: 'apocalypse_blade', name: '終焉の剣', atk: 220, def: 0 },
  armor: { id: 'end_armor', name: '終末の鎧', atk: 0, def: 180 },
  gloves: { id: 'titan_gauntlets', name: '泰坦の篭手', atk: 70, def: 80 },
  boots: { id: 'end_walker_boots', name: '終末を歩む者のブーツ', atk: 48, def: 120 },
  accessory: { id: 'oblivion_ring', name: '忘却の指輪', atk: 88, def: 88 },
} as const;

let itemCounter = 0;

function createItem(slot: EquipmentSlot, mods: ItemMod[]): Item {
  const base = (FINAL_LAND_BASE_STATS as Record<EquipmentSlot, typeof FINAL_LAND_BASE_STATS.weapon>)[slot];
  return {
    id: base.id,
    name: base.name,
    slot,
    atk: base.atk,
    def: base.def,
    instanceId: `analyze_${base.id}_${itemCounter++}`,
    mods,
  };
}

/**
 * パターン1: 超タンク＋回復ビルド
 * 戦略: 極限まで生存力を高め、HIT時回復で長期戦を制する
 */
function createUltraTankBuild(): BuildPattern {
  // パッシブ: guard系フル、vamp系、regen系（50ノード）
  const passiveNodes = [
    'start',
    // guard系（20ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15',
    // vamp系（15ノード）
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1',
    // regen系（14ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    'regen_10', 'regen_11', 'regen_12', 'regen_13',
  ];

  // 装備MOD: DEF、HP、HP回復、ダメージ軽減（T1-T3の最高値）
  const equipment: Equipment = {
    weapon: createItem('weapon', [
      { type: 'atk_bonus', value: 75, tier: 1 },           // T1 武器ATK
      { type: 'hp_bonus', value: 50, tier: 1 },            // T1 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'lifesteal', value: 12, tier: 1 },           // T1 吸血
    ]),
    armor: createItem('armor', [
      { type: 'def_bonus', value: 75, tier: 1 },           // T1 防具DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'def_increased_pct', value: 45, tier: 1 },   // T1 DEF増加
    ]),
    gloves: createItem('gloves', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'hp_regen_pct', value: 7, tier: 1 },         // T1 HP回復%
    ]),
    boots: createItem('boots', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'hp_on_hit', value: 40, tier: 1 },           // T1 HIT時HP回復
    ]),
    accessory: createItem('accessory', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
    ]),
  };

  return {
    name: '超タンク＋回復',
    description: 'DEF・HP・回復を極限まで高め、長期戦で勝つ',
    passiveNodes,
    equipment,
  };
}

/**
 * パターン2: 速攻クリティカルビルド
 * 戦略: 高クリ率・高クリダメ・高速攻撃で短期決着
 */
function createCriticalSpeedBuild(): BuildPattern {
  const passiveNodes = [
    'start',
    // crit系（20ノード）
    'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5',
    'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9',
    'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1',
    'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15',
    // speed系（15ノード）
    'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5',
    'speed_6', 'speed_key1', 'speed_7', 'speed_8', 'speed_9',
    'speed_10', 'speed_11', 'speed_12', 'speed_13', 'speed_a1',
    // vamp系（14ノード）- 生存のため
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13',
  ];

  const equipment: Equipment = {
    weapon: createItem('weapon', [
      { type: 'atk_bonus', value: 75, tier: 1 },           // T1 武器ATK
      { type: 'critical_chance', value: 32, tier: 1 },     // T1 クリ率
      { type: 'critical_damage', value: 55, tier: 1 },     // T1 クリダメ
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
    ]),
    armor: createItem('armor', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'critical_chance', value: 32, tier: 1 },     // T1 クリ率
      { type: 'critical_damage', value: 55, tier: 1 },     // T1 クリダメ
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
    ]),
    gloves: createItem('gloves', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'critical_chance', value: 32, tier: 1 },     // T1 クリ率
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
      { type: 'atk_increased_pct', value: 48, tier: 1 },   // T1 ATK増加
    ]),
    boots: createItem('boots', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
      { type: 'critical_damage', value: 55, tier: 1 },     // T1 クリダメ
      { type: 'hp_on_hit', value: 40, tier: 1 },           // T1 HIT時HP回復
    ]),
    accessory: createItem('accessory', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'critical_chance', value: 32, tier: 1 },     // T1 クリ率
      { type: 'critical_damage', value: 55, tier: 1 },     // T1 クリダメ
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
    ]),
  };

  return {
    name: '速攻クリティカル',
    description: '高クリ率・高クリダメ・高速攻撃で短期決着',
    passiveNodes,
    equipment,
  };
}

/**
 * パターン3: 毒DoTタンクビルド
 * 戦略: 毒スタックを溜めてDoTで削り、高DEFで耐える
 */
function createPoisonTankBuild(): BuildPattern {
  const passiveNodes = [
    'start',
    // poison系（20ノード）
    'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5',
    'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9',
    'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1',
    'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15',
    // guard系（15ノード）- 生存のため
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    // regen系（14ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    'regen_10', 'regen_11', 'regen_12', 'regen_13',
  ];

  const equipment: Equipment = {
    weapon: createItem('weapon', [
      { type: 'atk_bonus', value: 75, tier: 1 },           // T1 武器ATK
      { type: 'poison_chance', value: 28, tier: 1 },       // T1 毒付与率
      { type: 'poison_damage_pct', value: 80, tier: 1 },   // T1 毒ダメージ
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
    ]),
    armor: createItem('armor', [
      { type: 'def_bonus', value: 75, tier: 1 },           // T1 防具DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'poison_damage_pct', value: 80, tier: 1 },   // T1 毒ダメージ
    ]),
    gloves: createItem('gloves', [
      { type: 'poison_chance', value: 28, tier: 1 },       // T1 毒付与率
      { type: 'poison_damage_pct', value: 80, tier: 1 },   // T1 毒ダメージ
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
    ]),
    boots: createItem('boots', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
    ]),
    accessory: createItem('accessory', [
      { type: 'poison_chance', value: 28, tier: 1 },       // T1 毒付与率
      { type: 'poison_damage_pct', value: 80, tier: 1 },   // T1 毒ダメージ
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
    ]),
  };

  return {
    name: '毒DoTタンク',
    description: '毒スタックで安全にDoTダメージ、高DEFで耐える',
    passiveNodes,
    equipment,
  };
}

/**
 * パターン4: 時間攻撃複利ビルド
 * 戦略: time_atk_inc_pctで時間経過とともに火力を上げ、タンクで耐える
 */
function createTimeAtkBuild(): BuildPattern {
  const passiveNodes = [
    'start',
    // guard系（20ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15',
    // vamp系（15ノード）
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1',
    // regen系（14ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    'regen_10', 'regen_11', 'regen_12', 'regen_13',
  ];

  const equipment: Equipment = {
    weapon: createItem('weapon', [
      { type: 'atk_bonus', value: 75, tier: 1 },           // T1 武器ATK
      { type: 'time_atk_inc_pct', value: 12, tier: 1 },    // T1 時間攻撃増加
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
    ]),
    armor: createItem('armor', [
      { type: 'def_bonus', value: 75, tier: 1 },           // T1 防具DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'time_def_inc_pct', value: 12, tier: 1 },    // T1 時間防御増加
    ]),
    gloves: createItem('gloves', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'time_hp_regen', value: 8, tier: 1 },        // T1 時間HP回復
    ]),
    boots: createItem('boots', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'hp_on_hit', value: 40, tier: 1 },           // T1 HIT時HP回復
    ]),
    accessory: createItem('accessory', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
    ]),
  };

  return {
    name: '時間攻撃複利',
    description: '時間経過で火力上昇、タンクで長期戦を制する',
    passiveNodes,
    equipment,
  };
}

/**
 * パターン5: バランスビルド
 * 戦略: 攻撃・防御・回復のバランスを取る
 */
function createBalancedBuild(): BuildPattern {
  const passiveNodes = [
    'start',
    // 各系統から均等に（各系統10ノード程度）
    // vamp系（10ノード）
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    // guard系（10ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    // regen系（10ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    // crit系（10ノード）
    'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5',
    'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9',
    // speed系（9ノード）
    'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5',
    'speed_6', 'speed_key1', 'speed_7', 'speed_8',
  ];

  const equipment: Equipment = {
    weapon: createItem('weapon', [
      { type: 'atk_bonus', value: 75, tier: 1 },           // T1 武器ATK
      { type: 'critical_chance', value: 32, tier: 1 },     // T1 クリ率
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
      { type: 'lifesteal', value: 12, tier: 1 },           // T1 吸血
    ]),
    armor: createItem('armor', [
      { type: 'def_bonus', value: 75, tier: 1 },           // T1 防具DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'damage_reduction_pct', value: 14, tier: 1 }, // T1 ダメージ軽減
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
    ]),
    gloves: createItem('gloves', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'critical_damage', value: 55, tier: 1 },     // T1 クリダメ
    ]),
    boots: createItem('boots', [
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'attack_speed_pct', value: 33, tier: 1 },    // T1 攻撃速度
      { type: 'hp_on_hit', value: 40, tier: 1 },           // T1 HIT時HP回復
    ]),
    accessory: createItem('accessory', [
      { type: 'atk_bonus', value: 50, tier: 1 },           // T1 ATK
      { type: 'def_bonus', value: 50, tier: 1 },           // T1 DEF
      { type: 'hp_bonus', value: 270, tier: 2 },           // T2 HP
      { type: 'hp_regen', value: 48, tier: 1 },            // T1 HP回復
    ]),
  };

  return {
    name: 'バランス',
    description: '攻撃・防御・回復のバランスを取る',
    passiveNodes,
    equipment,
  };
}

const BUILD_PATTERNS: BuildPattern[] = [
  createUltraTankBuild(),
  createCriticalSpeedBuild(),
  createPoisonTankBuild(),
  createTimeAtkBuild(),
  createBalancedBuild(),
];

// ========================================
// ステータス計算
// ========================================

function calculateFinalStats(
  levelValue: number,
  equipment: Equipment,
  unlockedSkills: string[]
): { finalStats: Stats; modEffects: CombinedModEffects } {
  const levelBonus = calculateBaseStatsForLevel(levelValue);
  let baseAtk = levelBonus.atk;
  let baseDef = levelBonus.def;
  let baseMaxHp = levelBonus.maxHp;

  let equipHpIncPct = 0;
  let equipAtkIncPct = 0;
  let equipDefIncPct = 0;

  const items = Object.values(equipment).filter(Boolean) as Item[];
  for (const item of items) {
    baseAtk += item.atk;
    baseDef += item.def;
    if (item.mods) {
      for (const mod of item.mods) {
        if (mod.type === 'atk_bonus') baseAtk += mod.value;
        if (mod.type === 'def_bonus') baseDef += mod.value;
        if (mod.type === 'hp_bonus') baseMaxHp += mod.value;
        if (mod.type === 'hp_increased_pct') equipHpIncPct += mod.value;
        if (mod.type === 'atk_increased_pct') equipAtkIncPct += mod.value;
        if (mod.type === 'def_increased_pct') equipDefIncPct += mod.value;
      }
    }
  }

  const passiveEffects = calculatePassiveEffects(unlockedSkills);
  const flatStats = {
    maxHp: baseMaxHp + passiveEffects.hp,
    atk: baseAtk + passiveEffects.atk,
    def: baseDef + passiveEffects.def,
  };

  const finalStats = {
    maxHp: applyPercentageScaling(
      flatStats.maxHp,
      passiveEffects.hp_increased_pct + equipHpIncPct,
      passiveEffects.hp_more_pct
    ),
    atk: applyPercentageScaling(
      flatStats.atk,
      passiveEffects.atk_increased_pct + equipAtkIncPct,
      passiveEffects.atk_more_pct
    ),
    def: applyPercentageScaling(
      flatStats.def,
      passiveEffects.def_increased_pct + equipDefIncPct,
      passiveEffects.def_more_pct
    ),
  };

  const modEffects = combineMods(items, passiveEffects);
  return { finalStats, modEffects };
}

// ========================================
// 勝率測定と倍率計算
// ========================================

function simulateWinRate(
  bossId: string,
  stats: Stats,
  mods: CombinedModEffects,
  runsCount: number,
  seedValue: number
): number {
  const dungeonConfig = dungeonConfigs[bossId];
  const result = runGaugeSimulation(
    { playerStats: stats, modEffects: mods, dungeonId: bossId, runs: runsCount, seed: seedValue },
    dungeonConfig,
    enemyMap
  );
  return result.stats.winRate;
}

function estimateRequiredMultiplier(
  bossId: string,
  baseStats: Stats,
  mods: CombinedModEffects,
  statType: 'atk' | 'def' | 'hp' | 'all',
  targetWinRate: number = 0.5
): number | null {
  let lo = 1.0;
  let hi = 20.0;

  // 上限チェック
  const hiStats = applyMultiplier(baseStats, statType, hi);
  const hiRate = simulateWinRate(bossId, hiStats, mods, Math.max(50, Math.floor(runs / 4)), seed);
  if (hiRate < targetWinRate) return null;

  // 二分探索
  for (let i = 0; i < 15; i++) {
    const mid = (lo + hi) / 2;
    const midStats = applyMultiplier(baseStats, statType, mid);
    const rate = simulateWinRate(bossId, midStats, mods, Math.max(50, Math.floor(runs / 4)), seed);
    if (rate >= targetWinRate) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return hi;
}

function applyMultiplier(stats: Stats, statType: 'atk' | 'def' | 'hp' | 'all', multiplier: number): Stats {
  switch (statType) {
    case 'atk':
      return { ...stats, atk: Math.max(1, Math.floor(stats.atk * multiplier)) };
    case 'def':
      return { ...stats, def: Math.max(0, Math.floor(stats.def * multiplier)) };
    case 'hp':
      return { ...stats, maxHp: Math.max(1, Math.floor(stats.maxHp * multiplier)) };
    case 'all':
      return {
        maxHp: Math.max(1, Math.floor(stats.maxHp * multiplier)),
        atk: Math.max(1, Math.floor(stats.atk * multiplier)),
        def: Math.max(0, Math.floor(stats.def * multiplier)),
      };
  }
}

// ========================================
// レポート出力
// ========================================

function formatStats(stats: Stats): string {
  return `HP:${stats.maxHp} ATK:${stats.atk} DEF:${stats.def}`;
}

function formatMultiplier(mult: number | null): string {
  if (mult === null) return '20.0x超';
  return `${mult.toFixed(2)}x`;
}

// ========================================
// 実行
// ========================================

console.log('='.repeat(80));
console.log('Uberボス攻略ギャップ分析');
console.log(`Level: ${level} / Runs: ${runs} / Seed: ${seed}`);
console.log('='.repeat(80));
console.log('');

// 各ボスの情報を表示
console.log('【Uberボス一覧】');
console.log('ID                      | 名前                | HP      | ATK  | DEF  | AS');
console.log('------------------------|---------------------|---------|------|------|-----');
for (const bossId of uberBossIds) {
  const enemy = enemyMap.get(bossId);
  if (!enemy) continue;
  console.log(
    `${bossId.padEnd(23)} | ${enemy.name.padEnd(19)} | ${String(enemy.maxHp).padStart(7)} | ${String(enemy.atk).padStart(4)} | ${String(enemy.def).padStart(4)} | ${(enemy.attackSpeed ?? 1).toFixed(1)}`
  );
}
console.log('');

// 各ビルドパターンの分析
for (const pattern of BUILD_PATTERNS) {
  console.log('='.repeat(80));
  console.log(`ビルドパターン: ${pattern.name}`);
  console.log(`説明: ${pattern.description}`);
  console.log('='.repeat(80));
  console.log('');

  const { finalStats, modEffects } = calculateFinalStats(level, pattern.equipment, pattern.passiveNodes);

  console.log(`【最終ステータス】 ${formatStats(finalStats)}`);
  console.log('');

  console.log('【主要MOD効果】');
  console.log(`  HIT時HP回復: +${modEffects.hpOnHit}`);
  console.log(`  ターンHP回復: +${modEffects.hpRegen} (+${modEffects.hpRegenPct}%)`);
  console.log(`  クリティカル: ${modEffects.criticalChance}% / +${modEffects.criticalDamage}%`);
  console.log(`  攻撃速度: +${modEffects.attackSpeedPct}%`);
  console.log(`  ダメージ軽減: ${modEffects.damageReductionPct}%`);
  console.log(`  毒付与: ${modEffects.poisonChance}% / +${modEffects.poisonDamagePct}%`);
  if (modEffects.timeAtkIncPct > 0) {
    console.log(`  時間攻撃増加: +${modEffects.timeAtkIncPct}%`);
  }
  if (modEffects.timeDefIncPct > 0) {
    console.log(`  時間防御増加: +${modEffects.timeDefIncPct}%`);
  }
  console.log('');

  console.log('【勝率 & 必要倍率】');
  console.log('ボス                | 勝率 | ATK倍率 | DEF倍率 | HP倍率 | 全倍率');
  console.log('--------------------|------|---------|---------|--------|--------');

  for (const bossId of uberBossIds) {
    const winRate = simulateWinRate(bossId, finalStats, modEffects, runs, seed);

    let atkMult: number | null = null;
    let defMult: number | null = null;
    let hpMult: number | null = null;
    let allMult: number | null = null;

    // 勝率が50%未満の場合のみ倍率を計算
    if (winRate < 0.5) {
      atkMult = estimateRequiredMultiplier(bossId, finalStats, modEffects, 'atk');
      defMult = estimateRequiredMultiplier(bossId, finalStats, modEffects, 'def');
      hpMult = estimateRequiredMultiplier(bossId, finalStats, modEffects, 'hp');
      allMult = estimateRequiredMultiplier(bossId, finalStats, modEffects, 'all');
    }

    const enemy = enemyMap.get(bossId);
    const bossName = enemy?.name ?? bossId;

    console.log(
      `${bossName.padEnd(19)} | ${(winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${winRate < 0.5 ? formatMultiplier(atkMult).padStart(7) : '   -   '} | ` +
      `${winRate < 0.5 ? formatMultiplier(defMult).padStart(7) : '   -   '} | ` +
      `${winRate < 0.5 ? formatMultiplier(hpMult).padStart(6) : '  -   '} | ` +
      `${winRate < 0.5 ? formatMultiplier(allMult).padStart(6) : '  -   '}`
    );
  }

  console.log('');
}

console.log('='.repeat(80));
console.log('分析完了');
console.log('');
console.log('【次のアクション判断】');
console.log('- 全倍率が1.5x未満: ビルド最適化で勝てる可能性あり');
console.log('- 全倍率が1.5-3.0x: 強力な装備追加 or ボス微調整が必要');
console.log('- 全倍率が3.0x超: ボスのステータス調整が必要');
console.log('='.repeat(80));
