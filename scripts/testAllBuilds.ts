/**
 * 全ビルド総合テスト
 *
 * 毒特化、クリティカル、タンク、シンプルバランスの4ビルドを比較テスト
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
    instanceId: `alltest_${id}_${itemCounter++}`,
    mods,
  };
}

/**
 * 1. 毒特化ビルド（修正版）
 */
function createCorrectedPoisonBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
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
    weapon: createUberItem('uber_venom_fang', 'Uber 毒蛇の牙（修正版）', 'weapon', 160, 0, [
      { type: 'poison_chance', value: 30, tier: 0 },
      { type: 'atk_bonus', value: 60, tier: 0 },
      { type: 'attack_speed_pct', value: 25, tier: 0 },
    ]),
    armor: createUberItem('uber_venom_plate', 'Uber 毒蛇の鱗甲（修正版）', 'armor', 0, 300, [
      { type: 'poison_damage_pct', value: 80, tier: 0 },
      { type: 'damage_defer_pct', value: 15, tier: 0 },
      { type: 'hp_bonus', value: 280, tier: 0 },
    ]),
    gloves: createUberItem('uber_venom_grip', 'Uber 猛毒の篭手（修正版）', 'gloves', 75, 90, [
      { type: 'atk_increased_pct', value: 30, tier: 0 },
      { type: 'poison_damage_pct', value: 60, tier: 0 },
      { type: 'poison_damage_more_pct', value: 20, tier: 0 },
    ]),
    boots: createUberItem('uber_venom_stride', 'Uber 毒蛇の足跡（修正版）', 'boots', 55, 120, [
      { type: 'atk_bonus', value: 50, tier: 0 },
      { type: 'attack_speed_pct', value: 20, tier: 0 },
      { type: 'hp_regen', value: 85, tier: 0 },
    ]),
    accessory: createUberItem('uber_venom_heart', 'Uber 毒蛇の心臓（修正版）', 'accessory', 90, 85, [
      { type: 'poison_chance', value: 25, tier: 0 },
      { type: 'poison_damage_pct', value: 70, tier: 0 },
      { type: 'poison_damage_more_pct', value: 25, tier: 0 },
    ]),
  };

  return {
    name: '毒特化ビルド',
    description: 'ATK重視 + 毒付与100% + 毒more45%',
    equipment,
    passiveNodes,
  };
}

/**
 * 2. クリティカル特化ビルド（修正版）
 */
function createCriticalBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
  const passiveNodes = [
    'start',
    // crit系（20ノード）
    'crit_1', 'crit_2', 'crit_3', 'crit_4', 'crit_5',
    'crit_6', 'crit_7', 'crit_key1', 'crit_8', 'crit_9',
    'crit_10', 'crit_11', 'crit_12', 'crit_13', 'crit_a1',
    'crit_a2', 'crit_b1', 'crit_b2', 'crit_14', 'crit_15',
    // guard系（15ノード）- 防御強化
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    // vamp系（14ノード）
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13',
  ];

  const equipment: Equipment = {
    weapon: createUberItem('uber_assassin_blade', 'Uber 暗殺者の刃', 'weapon', 145, 0, [
      { type: 'critical_chance', value: 40, tier: 0 },
      { type: 'critical_damage', value: 80, tier: 0 },
      { type: 'attack_speed_pct', value: 30, tier: 0 },
    ]),
    armor: createUberItem('uber_assassin_coat', 'Uber 暗殺者の外套', 'armor', 0, 260, [
      { type: 'critical_chance', value: 30, tier: 0 },
      { type: 'damage_defer_pct', value: 12, tier: 0 },
      { type: 'hp_bonus', value: 240, tier: 0 },
    ]),
    gloves: createUberItem('uber_assassin_grip', 'Uber 暗殺者の手甲', 'gloves', 75, 85, [
      { type: 'critical_chance', value: 35, tier: 0 },
      { type: 'critical_damage', value: 90, tier: 0 },
      { type: 'atk_increased_pct', value: 30, tier: 0 },
    ]),
    boots: createUberItem('uber_assassin_steps', 'Uber 暗殺者の足運び', 'boots', 55, 110, [
      { type: 'critical_chance', value: 28, tier: 0 },
      { type: 'attack_speed_pct', value: 25, tier: 0 },
      { type: 'hp_on_crit', value: 100, tier: 0 },
    ]),
    accessory: createUberItem('uber_assassin_pendant', 'Uber 暗殺者のペンダント', 'accessory', 90, 70, [
      { type: 'critical_chance', value: 35, tier: 0 },
      { type: 'critical_damage', value: 100, tier: 0 },
      { type: 'hp_on_hit', value: 50, tier: 0 },
    ]),
  };

  return {
    name: 'クリティカル特化',
    description: 'クリ率210% + クリダメ450% + 防御強化',
    equipment,
    passiveNodes,
  };
}

/**
 * 3. 極限タンクビルド
 */
function createFortressBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
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
    weapon: createUberItem('uber_fortress_blade', 'Uber 要塞の剣', 'weapon', 135, 50, [
      { type: 'atk_bonus', value: 60, tier: 0 },
      { type: 'def_bonus', value: 40, tier: 0 },
      { type: 'hp_on_hit', value: 80, tier: 0 },
    ]),
    armor: createUberItem('uber_fortress_plate', 'Uber 要塞の鎧', 'armor', 0, 340, [
      { type: 'def_bonus', value: 90, tier: 0 },
      { type: 'damage_defer_pct', value: 18, tier: 0 },
      { type: 'def_increased_pct', value: 30, tier: 0 },
    ]),
    gloves: createUberItem('uber_fortress_grip', 'Uber 要塞の篭手', 'gloves', 70, 100, [
      { type: 'def_bonus', value: 70, tier: 0 },
      { type: 'hp_bonus', value: 250, tier: 0 },
      { type: 'damage_defer_pct', value: 10, tier: 0 },
    ]),
    boots: createUberItem('uber_fortress_stomp', 'Uber 要塞の足止め', 'boots', 50, 140, [
      { type: 'def_bonus', value: 80, tier: 0 },
      { type: 'hp_regen', value: 90, tier: 0 },
      { type: 'hp_regen_pct', value: 3, tier: 0 },
    ]),
    accessory: createUberItem('uber_fortress_bulwark', 'Uber 要塞の護壁', 'accessory', 75, 100, [
      { type: 'def_bonus', value: 80, tier: 0 },
      { type: 'hp_bonus', value: 280, tier: 0 },
      { type: 'damage_defer_pct', value: 12, tier: 0 },
    ]),
  };

  return {
    name: '極限タンク',
    description: 'DEF+360 / HP+530 / ダメ軽減64%',
    equipment,
    passiveNodes,
  };
}

/**
 * 4. シンプルバランスビルド（ユーザー提案）
 * ATK、DEF、HIT時回復、攻撃速度を重視
 */
function createSimpleBalanceBuild(): { name: string; description: string; equipment: Equipment; passiveNodes: string[] } {
  const passiveNodes = [
    'start',
    // vamp系（20ノード）- HIT時回復
    'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
    'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
    'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1',
    'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15',
    // guard系（15ノード）
    'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
    'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
    'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
    // speed系（14ノード）
    'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5',
    'speed_6', 'speed_key1', 'speed_7', 'speed_8', 'speed_9',
    'speed_10', 'speed_11', 'speed_12', 'speed_13',
  ];

  const equipment: Equipment = {
    weapon: createUberItem('uber_vampire_fang', 'Uber ヴァンパイアの牙', 'weapon', 140, 0, [
      { type: 'hp_on_hit', value: 120, tier: 0 },
      { type: 'critical_chance', value: 30, tier: 0 },
      { type: 'attack_speed_pct', value: 20, tier: 0 },
    ]),
    armor: createUberItem('uber_fortress_plate', 'Uber 要塞の鎧', 'armor', 0, 340, [
      { type: 'def_bonus', value: 90, tier: 0 },
      { type: 'damage_defer_pct', value: 18, tier: 0 },
      { type: 'def_increased_pct', value: 30, tier: 0 },
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
      { type: 'poison_damage_pct', value: 40, tier: 0 },
    ]),
    accessory: createUberItem('uber_kraken_eye', 'Uber クラーケンの眼', 'accessory', 85, 85, [
      { type: 'poison_chance', value: 25, tier: 0 },
      { type: 'poison_damage_pct', value: 50, tier: 0 },
      { type: 'damage_defer_pct', value: 8, tier: 0 },
      { type: 'hp_bonus', value: 220, tier: 0 },
    ]),
  };

  return {
    name: 'シンプルバランス',
    description: 'ATK + DEF + HIT時HP回復 + 攻撃速度',
    equipment,
    passiveNodes,
  };
}

const BUILD_PATTERNS = [
  createCorrectedPoisonBuild(),
  createCriticalBuild(),
  createFortressBuild(),
  createSimpleBalanceBuild(),
];

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

console.log('='.repeat(80));
console.log('全ビルド総合テスト');
console.log(`Level: ${level} / Runs: ${runs} / Seed: ${seed}`);
console.log('='.repeat(80));
console.log('');

// 結果サマリー用
const summaryResults: { name: string; winRates: number[] }[] = [];

for (const pattern of BUILD_PATTERNS) {
  console.log('='.repeat(80));
  console.log(`ビルド: ${pattern.name}`);
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
  console.log(`  ダメージ軽減: ${modEffects.damageDeferPct}%`);
  if (modEffects.poisonChance > 0) {
    console.log(`  毒付与: ${modEffects.poisonChance}% / +${modEffects.poisonDamagePct}%`);
  }
  if (modEffects.poisonDamageMorePct.length > 0) {
    const poisonMore = modEffects.poisonDamageMorePct.reduce((sum, v) => sum + v, 0);
    console.log(`  毒more: +${poisonMore}%`);
  }
  if (modEffects.hpOnCrit > 0) {
    console.log(`  クリ時HP回復: +${modEffects.hpOnCrit}`);
  }
  console.log('');

  console.log('【勝率】');
  console.log('ボス                | 勝率');
  console.log('--------------------|------');

  const winRates: number[] = [];
  for (const bossId of uberBossIds) {
    const winRate = simulateWinRate(bossId, finalStats, modEffects, runs, seed);
    winRates.push(winRate);
    const enemy = enemyMap.get(bossId);
    const bossName = enemy?.name ?? bossId;

    const icon = winRate >= 0.8 ? '✅' : winRate >= 0.5 ? '⚠️ ' : '❌';
    console.log(`${bossName.padEnd(19)} | ${icon} ${(winRate * 100).toFixed(0).padStart(3)}%`);
  }

  summaryResults.push({ name: pattern.name, winRates });
  console.log('');
}

console.log('='.repeat(80));
console.log('結果サマリー');
console.log('='.repeat(80));
console.log('');
console.log('ビルド               | 勝率6/6 | 平均勝率');
console.log('---------------------|---------|----------');
for (const result of summaryResults) {
  const clearCount = result.winRates.filter(wr => wr >= 0.8).length;
  const avgWinRate = result.winRates.reduce((sum, wr) => sum + wr, 0) / result.winRates.length;
  console.log(`${result.name.padEnd(20)} | ${clearCount}/6     | ${(avgWinRate * 100).toFixed(1)}%`);
}
console.log('');
console.log('='.repeat(80));
console.log('テスト完了');
console.log('='.repeat(80));
