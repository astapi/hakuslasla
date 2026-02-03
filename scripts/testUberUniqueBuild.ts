/**
 * Uberユニーク装備を使った最適ビルドテスト
 * uber_krakenまでのドロップ装備で、uber_demon_lord & uber_true_final_bossに挑む
 */

import { runGaugeSimulation } from '../core/simulation';
import { calculateBaseStatsForLevel } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects } from '../data/passiveTree';
import { EnemyConfig, DungeonConfig, Stats, CombinedModEffects } from '../core/types';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

const args = process.argv.slice(2);
const runs = args[0] ? parseInt(args[0], 10) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 12345;
const level = 60;

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

let itemCounter = 0;
function createUberItem(
  id: string,
  name: string,
  slot: EquipmentSlot,
  atk: number,
  def: number,
  mods: ItemMod[]
): Item {
  return {
    id,
    name,
    slot,
    atk,
    def,
    instanceId: `uber_test_${id}_${itemCounter++}`,
    mods,
  };
}

// ========================================
// ビルドパターン
// ========================================

/**
 * パターン1: Uber Vampire特化（HIT時HP回復最大）
 */
function createVampireBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
  const passiveNodes = [
    'start',
    // poison系（20ノード）
    'poison_1', 'poison_2', 'poison_3', 'poison_4', 'poison_5',
    'poison_6', 'poison_7', 'poison_key1', 'poison_8', 'poison_9',
    'poison_10', 'poison_11', 'poison_12', 'poison_13', 'poison_a1',
    'poison_a2', 'poison_b1', 'poison_b2', 'poison_14', 'poison_15',
    // guard系（15ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    // regen系（14ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    'regen_10', 'regen_11', 'regen_12', 'regen_13',
  ];

  const equipment: Equipment = {
    weapon: createUberItem('uber_vampire_fang', 'Uber ヴァンパイアの牙', 'weapon', 80, 0, [
      { type: 'hp_on_hit', value: 120, tier: 0 },
      { type: 'critical_chance', value: 30, tier: 0 },
    ]),
    armor: createUberItem('uber_vampire_plate', 'Uber ヴァンパイアの甲冑', 'armor', 0, 240, [
      { type: 'hp_regen_pct', value: 2, tier: 0 },
      { type: 'hp_on_hit', value: 60, tier: 0 },
      { type: 'damage_reduction_pct', value: 10, tier: 0 },
    ]),
    gloves: createUberItem('uber_vampire_grip', 'Uber ヴァンパイアの篭手', 'gloves', 65, 80, [
      { type: 'critical_chance', value: 20, tier: 0 },
      { type: 'hp_on_hit', value: 40, tier: 0 },
      { type: 'atk_increased_pct', value: 22, tier: 0 },
    ]),
    boots: createUberItem('uber_vampire_stride', 'Uber ヴァンパイアの歩み', 'boots', 45, 105, [
      { type: 'attack_speed_pct', value: 18, tier: 0 },
      { type: 'hp_regen', value: 80, tier: 0 },
      { type: 'poison_chance', value: 20, tier: 0 },
    ]),
    accessory: createUberItem('uber_kraken_eye', 'Uber クラーケンの眼', 'accessory', 85, 85, [
      { type: 'poison_chance', value: 25, tier: 0 },
      { type: 'damage_reduction_pct', value: 8, tier: 0 },
      { type: 'hp_bonus', value: 220, tier: 0 },
    ]),
  };

  return {
    name: 'Uber Vampire特化',
    description: 'HIT時HP回復220 + 毒45% + ダメ軽減18%',
    equipment,
    passiveNodes,
  };
}

/**
 * パターン2: 極限タンク（Kraken防具 + HP回復特化）
 */
function createUltraTankBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
  const passiveNodes = [
    'start',
    // guard系（20ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15',
    // regen系（15ノード）
    'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
    'regen_6', 'regen_7', 'regen_key1', 'regen_8', 'regen_9',
    'regen_10', 'regen_11', 'regen_12', 'regen_13', 'regen_a1',
    // vamp系（14ノード）
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13',
  ];

  const equipment: Equipment = {
    weapon: createUberItem('uber_vampire_fang', 'Uber ヴァンパイアの牙', 'weapon', 80, 0, [
      { type: 'hp_on_hit', value: 120, tier: 0 },
      { type: 'critical_chance', value: 30, tier: 0 },
    ]),
    armor: createUberItem('uber_kraken_shell', 'Uber クラーケンの甲殻', 'armor', 0, 260, [
      { type: 'damage_reduction_pct', value: 12, tier: 0 },
      { type: 'hp_regen', value: 90, tier: 0 },
      { type: 'def_increased_pct', value: 20, tier: 0 },
    ]),
    gloves: createUberItem('uber_vampire_grip', 'Uber ヴァンパイアの篭手', 'gloves', 65, 80, [
      { type: 'critical_chance', value: 20, tier: 0 },
      { type: 'hp_on_hit', value: 40, tier: 0 },
      { type: 'atk_increased_pct', value: 22, tier: 0 },
    ]),
    boots: createUberItem('uber_kraken_fin', 'Uber クラーケンの遊泳', 'boots', 50, 120, [
      { type: 'attack_speed_pct', value: 15, tier: 0 },
      { type: 'hp_regen_pct', value: 2, tier: 0 },
      { type: 'def_bonus', value: 60, tier: 0 },
    ]),
    accessory: createUberItem('uber_vampire_heart', 'Uber ヴァンパイアの心臓', 'accessory', 80, 80, [
      { type: 'hp_regen', value: 120, tier: 0 },
      { type: 'critical_chance', value: 25, tier: 0 },
      { type: 'def_bonus', value: 50, tier: 0 },
    ]),
  };

  return {
    name: '極限タンク',
    description: 'HIT時HP回復160 + HP回復210 + ダメ軽減12%',
    equipment,
    passiveNodes,
  };
}

/**
 * パターン3: 時間攻撃ビルド（Goblin装備）
 */
function createTimeAtkBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
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
    weapon: createUberItem('uber_goblin_blade', 'Uber ゴブリンの剣', 'weapon', 110, 0, [
      { type: 'time_atk_inc_pct', value: 6, tier: 0 },
      { type: 'atk_bonus', value: 40, tier: 0 },
      { type: 'attack_speed_pct', value: 15, tier: 0 },
    ]),
    armor: createUberItem('uber_goblin_plate', 'Uber ゴブリンの鎧', 'armor', 0, 220, [
      { type: 'time_def_inc_pct', value: 6, tier: 0 },
      { type: 'hp_bonus', value: 200, tier: 0 },
      { type: 'def_bonus', value: 50, tier: 0 },
    ]),
    gloves: createUberItem('uber_vampire_grip', 'Uber ヴァンパイアの篭手', 'gloves', 65, 80, [
      { type: 'critical_chance', value: 20, tier: 0 },
      { type: 'hp_on_hit', value: 40, tier: 0 },
      { type: 'atk_increased_pct', value: 22, tier: 0 },
    ]),
    boots: createUberItem('uber_goblin_stomp', 'Uber ゴブリンの踏みつけ', 'boots', 40, 110, [
      { type: 'attack_speed_pct', value: 20, tier: 0 },
      { type: 'hp_regen', value: 60, tier: 0 },
      { type: 'time_hp_regen', value: 20, tier: 0 },
    ]),
    accessory: createUberItem('uber_kings_crown', 'Uber ゴブリンキングの王冠', 'accessory', 40, 40, [
      { type: 'atk_bonus', value: 35, tier: 0 },
      { type: 'def_bonus', value: 35, tier: 0 },
      { type: 'hp_regen', value: 80, tier: 0 },
    ]),
  };

  return {
    name: '時間攻撃複利',
    description: '時間攻撃+6% / 時間防御+6% / 時間HP回復+20',
    equipment,
    passiveNodes,
  };
}

const BUILD_PATTERNS = [
  createVampireBuild(),
  createUltraTankBuild(),
  createTimeAtkBuild(),
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

function formatStats(stats: Stats): string {
  return `HP:${stats.maxHp} ATK:${stats.atk} DEF:${stats.def}`;
}

// ========================================
// 実行
// ========================================

console.log('='.repeat(80));
console.log('Uberユニーク装備ビルドテスト');
console.log(`Level: ${level} / Runs: ${runs} / Seed: ${seed}`);
console.log('='.repeat(80));
console.log('');

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
  if (modEffects.timeHpRegen > 0) {
    console.log(`  時間HP回復: +${modEffects.timeHpRegen}`);
  }
  console.log('');

  console.log('【勝率】');
  console.log('ボス                | 勝率');
  console.log('--------------------|------');

  for (const bossId of uberBossIds) {
    const winRate = simulateWinRate(bossId, finalStats, modEffects, runs, seed);
    const enemy = enemyMap.get(bossId);
    const bossName = enemy?.name ?? bossId;

    console.log(`${bossName.padEnd(19)} | ${(winRate * 100).toFixed(0).padStart(3)}%`);
  }

  console.log('');
}

console.log('='.repeat(80));
console.log('分析完了');
console.log('='.repeat(80));
