/**
 * 異次元ラッシュクリアビルド詳細分析
 * パッシブ効果、装備ステータス、MOD効果の内訳を出力
 *
 * 使用方法:
 *   npx tsx scripts/analyzeDimensionalRushBuilds.ts [level]
 *
 * 例:
 *   npx tsx scripts/analyzeDimensionalRushBuilds.ts 55
 *   npx tsx scripts/analyzeDimensionalRushBuilds.ts 60
 *   npx tsx scripts/analyzeDimensionalRushBuilds.ts
 */

import {
  runGaugeSimulation,
  EnemyConfig,
  DungeonConfig,
  Stats,
  CombinedModEffects,
  INITIAL_STATS,
  calculateBaseStatsForLevel,
  applyPercentageScaling,
  EquipmentSet,
  combineMods,
  createRng,
  generateRandomEquipmentSet,
} from '../core';
import {
  calculatePassiveEffects,
  getUnlockableNodes,
} from '../data/passiveTree';
import { DIMENSIONAL_RUSH_IDS, getDimensionalRushEnemy } from '../data/endContents';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// ========================================
// コマンドライン引数処理
// ========================================

const args = process.argv.slice(2);
const inputLevel = args[0] ? parseInt(args[0], 10) : 60;

if (isNaN(inputLevel) || inputLevel < 1 || inputLevel > 60) {
  console.error('エラー: レベルは1〜60の整数で指定してください');
  console.error('使用方法: npx tsx scripts/analyzeDimensionalRushBuilds.ts [level]');
  process.exit(1);
}

// レベルに応じたパッシブノード数を計算（レベルアップごとに1ポイント + 初期1）
function calculateNodeCount(level: number): number {
  return Math.min(level, 50); // 最大50ノード
}

// ダンジョン名を取得
function getDungeonName(dungeonId: string): string {
  const names: Record<string, string> = {
    grassland: '始まりの草原',
    cave: '地底洞窟',
    ruins: '忘却の遺跡',
    goblin_fort: 'ゴブリンの砦',
    demon_castle: '魔王城',
    ice_cave: '氷結の洞窟',
    volcano: '灼熱の火山',
    dark_forest: '深淵の森',
    sky_tower: '天空の塔',
    hell_gate: '地獄の門',
    dragon_nest: '竜の巣穴',
    sacred_temple: '神域の神殿',
    chaos_realm: '混沌の領域',
    final_land: '終焉の地',
    dimensional_rush: '異次元ラッシュ',
  };
  return names[dungeonId] || dungeonId;
}

// ========================================
// データ準備
// ========================================

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

function toDungeonConfig(dungeon: typeof dungeonsData.dungeons.grassland): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap(m => Array(m.spawnRate).fill(m.monsterId)),
    dropTable: allDrops.map(d => d.itemId),
  };
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = {
      monsterId: (dungeon.boss as { monsterId: string; floor: number }).monsterId,
      floor: (dungeon.boss as { monsterId: string; floor: number }).floor,
    };
  }
  return config;
}

// シミュレーション用：全200階を通した異次元ラッシュ設定
const dimensionalRushConfig: DungeonConfig = {
  id: 'dimensional_rush_full',
  name: '異次元ラッシュ全域',
  maxFloor: 200,
  enemies: [],
  dropTable: [],
  boss: { monsterId: 'true_final_boss', floor: 200 },
};

const bossFloors = [50, 70, 90, 110, 120, 200] as const;
const bossFloorLabels: Record<number, string> = {
  50: 'ゴブリンキング',
  70: '盗賊の頭',
  90: 'ヴァンパイア',
  110: 'クラーケン',
  120: '魔王',
  200: '終焉の王',
};

// ========================================
// ヘルパー関数
// ========================================

function generateRandomBuild(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];
  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;
    const index = Math.floor(rng() * unlockable.length);
    unlocked.push(unlockable[index].id);
  }
  return unlocked;
}

function calculateEquipmentBaseStats(set: EquipmentSet): { atk: number; def: number } {
  let atk = 0;
  let def = 0;
  const items = [set.weapon, set.armor, set.gloves, set.boots, set.accessory];
  for (const item of items) {
    if (item) {
      atk += item.atk;
      def += item.def;
    }
  }
  return { atk, def };
}

function calculateEquipmentMods(set: EquipmentSet): Record<string, number> {
  const mods: Record<string, number> = {};
  const items = [set.weapon, set.armor, set.gloves, set.boots, set.accessory];
  for (const item of items) {
    if (item) {
      for (const mod of item.mods) {
        mods[mod.type] = (mods[mod.type] || 0) + mod.value;
      }
    }
  }
  return mods;
}

function calculateFinalStatsWithPassives(
  baseStats: Stats,
  passiveEffects: ReturnType<typeof calculatePassiveEffects>
): Stats {
  return {
    maxHp: applyPercentageScaling(baseStats.maxHp, passiveEffects.hp_increased_pct, passiveEffects.hp_more_pct),
    atk: applyPercentageScaling(baseStats.atk, passiveEffects.atk_increased_pct, passiveEffects.atk_more_pct),
    def: applyPercentageScaling(baseStats.def, passiveEffects.def_increased_pct, passiveEffects.def_more_pct),
  };
}

// ========================================
// パラメータ設定
// ========================================

const level = inputLevel;
const nodeCount = calculateNodeCount(level);
const equipmentDungeonId = 'final_land';
const modDungeonId = 'final_land';

console.log('スクリプト開始: 異次元ラッシュ解析');
console.log(`開始時刻: ${new Date().toISOString()}`);

console.log('='.repeat(70));
console.log(`異次元ラッシュ クリアビルド 詳細分析 (Lv${level}) - ランダムMOD装備版`);
console.log('='.repeat(70));
console.log('');
console.log(`【シミュレーション設定】`);
console.log(`  プレイヤーレベル: ${level}`);
console.log(`  パッシブノード数: ${nodeCount}`);
console.log(`  装備ソース: ${getDungeonName(equipmentDungeonId)} (${equipmentDungeonId})`);
console.log(`  対象ダンジョン: 異次元ラッシュ全域 (200階)`);
console.log('');

const rng = createRng(65432 + level);
const clearedBuilds: {
  nodes: string[];
  equipSet: EquipmentSet;
  maxBossFloor: number;
  passiveEffects: ReturnType<typeof calculatePassiveEffects>;
  equipBaseStats: { atk: number; def: number };
  equipMods: Record<string, number>;
  finalStats: Stats;
  combinedMods: CombinedModEffects;
}[] = [];

const buildsByBossFloor = new Map<number, number>();

console.log('ビルド探索中（ランダムMOD装備使用）...');
console.log(`装備ソース: ${equipmentDungeonId}, MODソース: ${modDungeonId}`);
console.log('');

const searchStart = Date.now();
const logEvery = 20;

for (let i = 0; i < 600 && clearedBuilds.length < 10; i++) {
  if (i % logEvery === 0) {
    const elapsedSeconds = ((Date.now() - searchStart) / 1000).toFixed(1);
    console.log(`探索中: ${i}/600, クリアビルド: ${clearedBuilds.length}, 経過: ${elapsedSeconds}s`);
  }
  const nodes = generateRandomBuild(nodeCount, rng);

  const equipSet = generateRandomEquipmentSet(`ランダム装備#${i}`, equipmentDungeonId, modDungeonId);
  const passiveEffects = calculatePassiveEffects(nodes);
  const equipBaseStats = calculateEquipmentBaseStats(equipSet);
  const equipMods = calculateEquipmentMods(equipSet);
  const levelBonus = calculateBaseStatsForLevel(level);

  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp + (levelBonus.maxHp - INITIAL_STATS.maxHp),
    atk: INITIAL_STATS.atk + passiveEffects.atk + equipBaseStats.atk + (levelBonus.atk - INITIAL_STATS.atk),
    def: INITIAL_STATS.def + passiveEffects.def + equipBaseStats.def + (levelBonus.def - INITIAL_STATS.def),
  };

  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);
  const equipmentItems = [equipSet.weapon, equipSet.armor, equipSet.gloves, equipSet.boots, equipSet.accessory];
  const combinedMods = combineMods(equipmentItems, passiveEffects);

  const result = runGaugeSimulation(
    {
      playerStats: finalStats,
      modEffects: combinedMods,
      dungeonId: 'dimensional_rush_full',
      runs: 10,
      seed: 65432 + i,
      resolveEnemyForFloor: (floor, floorRng) =>
        getDimensionalRushEnemy(floor, floorRng) as EnemyConfig,
    },
    dimensionalRushConfig,
    enemyMap
  );

  const maxFloorReached = Math.max(
    0,
    ...result.results.map((r) => r.floorsCleared)
  );
  const reachedBosses = bossFloors.filter((floor) => maxFloorReached >= floor);

  let recorded = false;
  for (const floor of reachedBosses) {
    if (buildsByBossFloor.has(floor)) continue;
    clearedBuilds.push({
      nodes,
      equipSet,
      maxBossFloor: floor,
      passiveEffects,
      equipBaseStats,
      equipMods,
      finalStats,
      combinedMods,
    });
    buildsByBossFloor.set(floor, clearedBuilds.length - 1);
    recorded = true;
  }

  if (recorded && buildsByBossFloor.size === bossFloors.length) {
    break;
  }
}

console.log(`クリアビルド数: ${clearedBuilds.length}`);
console.log('');

// 各ビルドの詳細を出力
for (let i = 0; i < clearedBuilds.length; i++) {
  const build = clearedBuilds[i];

  console.log('='.repeat(70));
  console.log(`【ビルド ${i + 1}】 ${build.equipSet.name} | 到達ボス: ${bossFloorLabels[build.maxBossFloor]} (${build.maxBossFloor}F)`);
  console.log('='.repeat(70));

  console.log('');
  console.log('【装備MOD詳細】');
  const items = [
    { slot: 'weapon', item: build.equipSet.weapon },
    { slot: 'armor', item: build.equipSet.armor },
    { slot: 'gloves', item: build.equipSet.gloves },
    { slot: 'boots', item: build.equipSet.boots },
    { slot: 'accessory', item: build.equipSet.accessory },
  ];
  for (const { slot, item } of items) {
    if (item) {
      const modsStr = item.mods.length > 0
        ? item.mods.map(m => `[T${m.tier}]${m.type}:${m.value}`).join(', ')
        : 'MODなし';
      console.log(`  ${slot}: ${item.name} (ATK:${item.atk}, DEF:${item.def}) - ${modsStr}`);
    }
  }

  console.log('');
  console.log('【取得パッシブノード】');
  console.log(`  ${build.nodes.join(', ')}`);

  console.log('');
  console.log('【パッシブ効果合計】');
  console.log(`  ステータス:`);
  console.log(`    HP: +${build.passiveEffects.hp}`);
  console.log(`    ATK: +${build.passiveEffects.atk}`);
  console.log(`    DEF: +${build.passiveEffects.def}`);
  console.log(`  Increased%:`);
  console.log(`    HP: +${build.passiveEffects.hp_increased_pct}%`);
  console.log(`    ATK: +${build.passiveEffects.atk_increased_pct}%`);
  console.log(`    DEF: +${build.passiveEffects.def_increased_pct}%`);
  console.log(`  More%:`);
  console.log(`    HP: ${build.passiveEffects.hp_more_pct.length > 0 ? build.passiveEffects.hp_more_pct.map(v => `${v}%`).join(' × ') : 'なし'}`);
  console.log(`    ATK: ${build.passiveEffects.atk_more_pct.length > 0 ? build.passiveEffects.atk_more_pct.map(v => `${v}%`).join(' × ') : 'なし'}`);
  console.log(`    DEF: ${build.passiveEffects.def_more_pct.length > 0 ? build.passiveEffects.def_more_pct.map(v => `${v}%`).join(' × ') : 'なし'}`);
  console.log(`  戦闘効果:`);
  console.log(`    毒付与率: +${build.passiveEffects.poison_chance}%`);
  console.log(`    毒ダメージ: +${build.passiveEffects.poison_damage_pct}% increased`);
  console.log(`    毒ダメージmore: ${build.passiveEffects.poison_damage_more_pct.length > 0 ? build.passiveEffects.poison_damage_more_pct.map(v => `${v}%`).join(' × ') : 'なし'}`);
  console.log(`    毒スタック上限: +${build.passiveEffects.poison_max_stacks}`);
  console.log(`    毒状態時被ダメ軽減: +${build.passiveEffects.poison_damage_reduction}%`);
  console.log(`    毒吸収: +${build.passiveEffects.poison_lifesteal}%`);
  console.log(`    通常ダメージ無効: ${build.passiveEffects.no_direct_damage}`);
  console.log(`    クリティカル率: +${build.passiveEffects.critical_chance}%`);
  console.log(`    クリティカルダメージ: +${build.passiveEffects.critical_damage}%`);
  console.log(`    クリティカル時HP回復: +${build.passiveEffects.hp_on_crit}`);
  console.log(`    HP回復/ターン: +${build.passiveEffects.hp_regen}`);
  console.log(`    HP回復%/ターン: +${build.passiveEffects.hp_regen_pct}%`);
  console.log(`    ダメージ軽減: +${build.passiveEffects.damage_reduction_pct}%`);
  console.log(`    HIT時HP回復: +${build.passiveEffects.hp_on_hit}`);
  console.log(`    攻撃速度: +${build.passiveEffects.attack_speed_pct}% increased`);
  console.log(`    攻撃速度more: ${build.passiveEffects.attack_speed_more_pct.length > 0 ? build.passiveEffects.attack_speed_more_pct.map(v => `${v}%`).join(' × ') : 'なし'}`);

  console.log('');
  console.log('【装備ステータス合計】');
  console.log(`  ATK: +${build.equipBaseStats.atk}`);
  console.log(`  DEF: +${build.equipBaseStats.def}`);

  console.log('');
  console.log('【装備MOD合計】');
  for (const [modType, value] of Object.entries(build.equipMods)) {
    console.log(`  ${modType}: +${value}`);
  }

  console.log('');
  console.log(`【最終ステータス (Lv${level} + パッシブ + 装備)】`);
  console.log(`  MaxHP: ${build.finalStats.maxHp.toFixed(0)}`);
  console.log(`  ATK: ${build.finalStats.atk.toFixed(0)}`);
  console.log(`  DEF: ${build.finalStats.def.toFixed(0)}`);

  console.log('');
  console.log('【最終MOD効果 (パッシブ + 装備MOD)】');
  console.log(`  毒付与率: ${build.combinedMods.poisonChance}%`);
  console.log(`  毒ダメージ倍率: ${build.combinedMods.poisonDamagePct}%`);
  console.log(`  毒ダメージmore: ${build.combinedMods.poisonDamageMorePct.length > 0 ? build.combinedMods.poisonDamageMorePct.map(v => `${v}%`).join(' × ') : 'なし'}`);
  console.log(`  毒スタック上限: ${build.combinedMods.poisonMaxStacks}`);
  console.log(`  毒状態時被ダメ軽減: ${build.combinedMods.poisonDamageReduction}%`);
  console.log(`  毒吸収: ${build.combinedMods.poisonLifesteal}%`);
  console.log(`  通常ダメージ無効: ${build.combinedMods.noDirectDamage}`);
  console.log(`  クリティカル率: ${build.combinedMods.criticalChance}%`);
  console.log(`  クリティカルダメージ: ${build.combinedMods.criticalDamage}%`);
  console.log(`  クリティカル時HP回復: ${build.combinedMods.hpOnCrit}`);
  console.log(`  HP回復/ターン: ${build.combinedMods.hpRegen}`);
  console.log(`  HP回復%/ターン: ${build.combinedMods.hpRegenPct}%`);
  console.log(`  ダメージ軽減: ${build.combinedMods.damageReductionPct}%`);
  console.log(`  HIT時HP回復: ${build.combinedMods.hpOnHit}`);
  console.log(`  攻撃速度: ${build.combinedMods.attackSpeedPct}%`);

  console.log('');
}

console.log('='.repeat(70));
console.log('【クリアビルド サマリー】');
console.log('='.repeat(70));

console.log('');
console.log('【ボス到達ビルド一覧】');
for (const floor of bossFloors) {
  const buildIndex = buildsByBossFloor.get(floor);
  const label = bossFloorLabels[floor];
  if (buildIndex === undefined) {
    console.log(`  ${label} (${floor}F): 未達`);
    continue;
  }
  const build = clearedBuilds[buildIndex];
  console.log(`  ${label} (${floor}F): ビルド${buildIndex + 1} (${build.equipSet.name})`);
}

if (clearedBuilds.length === 0) {
  console.log('');
  console.log('到達ビルドが見つかりませんでした。');
  console.log('');
  console.log('='.repeat(70));
  console.log('分析完了');
  console.log('='.repeat(70));
  process.exit(0);
}

const avgFinalStats = {
  maxHp: clearedBuilds.reduce((sum, b) => sum + b.finalStats.maxHp, 0) / clearedBuilds.length,
  atk: clearedBuilds.reduce((sum, b) => sum + b.finalStats.atk, 0) / clearedBuilds.length,
  def: clearedBuilds.reduce((sum, b) => sum + b.finalStats.def, 0) / clearedBuilds.length,
};

const avgPassiveEffects = {
  hp_on_hit: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.hp_on_hit, 0) / clearedBuilds.length,
  hp_regen: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.hp_regen, 0) / clearedBuilds.length,
  hp_regen_pct: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.hp_regen_pct, 0) / clearedBuilds.length,
  damage_reduction_pct: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.damage_reduction_pct, 0) / clearedBuilds.length,
  critical_chance: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.critical_chance, 0) / clearedBuilds.length,
  attack_speed_pct: clearedBuilds.reduce((sum, b) => sum + b.passiveEffects.attack_speed_pct, 0) / clearedBuilds.length,
};

console.log('');
console.log('【平均最終ステータス】');
console.log(`  MaxHP: ${avgFinalStats.maxHp.toFixed(0)}`);
console.log(`  ATK: ${avgFinalStats.atk.toFixed(0)}`);
console.log(`  DEF: ${avgFinalStats.def.toFixed(0)}`);

console.log('');
console.log('【平均パッシブ効果（主要）】');
console.log(`  HIT時HP回復: ${avgPassiveEffects.hp_on_hit.toFixed(1)}`);
console.log(`  HP回復/ターン: ${avgPassiveEffects.hp_regen.toFixed(1)}`);
console.log(`  HP回復%/ターン: ${avgPassiveEffects.hp_regen_pct.toFixed(2)}%`);
console.log(`  ダメージ軽減: ${avgPassiveEffects.damage_reduction_pct.toFixed(1)}%`);
console.log(`  クリティカル率: ${avgPassiveEffects.critical_chance.toFixed(1)}%`);
console.log(`  攻撃速度: ${avgPassiveEffects.attack_speed_pct.toFixed(1)}%`);

console.log('');
console.log('='.repeat(70));
console.log('分析完了');
console.log('='.repeat(70));
