/**
 * ランダムビルド探索スクリプト
 * 意図しない強ビルドを発見するための探索ツール
 *
 * 使用方法:
 *   npx tsx scripts/exploreBuilds.ts
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
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  EquipmentSetType,
  combineMods,
  createRng,
} from '../core';
import {
  calculatePassiveEffects,
  getAllPassiveNodes,
  canUnlockNode,
  getUnlockableNodes,
} from '../data/passiveTree';
import { PassiveNode } from '../types';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// ========================================
// 設定
// ========================================

/** 探索設定 */
const EXPLORATION_CONFIG = {
  buildsPerDungeon: 500,    // 各ダンジョンで生成するランダムビルド数
  runsPerBuild: 100,        // 各ビルドのシミュレーション回数
  winRateThreshold: 0.95,   // OPビルドとみなす勝率閾値
  lowWinRateThreshold: 0.3, // 弱すぎるビルドの閾値
  seed: 54321,              // 再現性のためのシード
};

/** レベルごとのノード数目安（既存プリセットから推測） */
const NODES_BY_LEVEL: Record<number, number> = {
  5: 4,
  10: 9,
  15: 13,
  20: 18,
  25: 23,
  30: 28,
  35: 33,
  40: 39,
  45: 45,
  50: 50,
};

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

const dungeonConfigs: Record<string, DungeonConfig> = {
  grassland: toDungeonConfig(dungeonsData.dungeons.grassland),
  cave: toDungeonConfig(dungeonsData.dungeons.cave),
  ruins: toDungeonConfig(dungeonsData.dungeons.ruins),
  goblin_fort: toDungeonConfig(dungeonsData.dungeons.goblin_fort),
  demon_castle: toDungeonConfig(dungeonsData.dungeons.demon_castle),
  ice_cave: toDungeonConfig(dungeonsData.dungeons.ice_cave),
  volcano: toDungeonConfig(dungeonsData.dungeons.volcano),
  dark_forest: toDungeonConfig(dungeonsData.dungeons.dark_forest),
  sky_tower: toDungeonConfig(dungeonsData.dungeons.sky_tower),
  hell_gate: toDungeonConfig(dungeonsData.dungeons.hell_gate),
  dragon_nest: toDungeonConfig(dungeonsData.dungeons.dragon_nest),
  sacred_temple: toDungeonConfig(dungeonsData.dungeons.sacred_temple),
  chaos_realm: toDungeonConfig(dungeonsData.dungeons.chaos_realm),
  final_land: toDungeonConfig(dungeonsData.dungeons.final_land),
};

const dungeonInfo: Record<string, { name: string; recommendedLevel: number; previousDungeon: string | null }> = {
  grassland: { name: '始まりの草原', recommendedLevel: 1, previousDungeon: null },
  cave: { name: '地底洞窟', recommendedLevel: 5, previousDungeon: 'grassland' },
  ruins: { name: '忘却の遺跡', recommendedLevel: 10, previousDungeon: 'cave' },
  goblin_fort: { name: 'ゴブリンの砦', recommendedLevel: 15, previousDungeon: 'ruins' },
  demon_castle: { name: '魔王城', recommendedLevel: 20, previousDungeon: 'goblin_fort' },
  ice_cave: { name: '氷結の洞窟', recommendedLevel: 25, previousDungeon: 'demon_castle' },
  volcano: { name: '灼熱の火山', recommendedLevel: 30, previousDungeon: 'ice_cave' },
  dark_forest: { name: '深淵の森', recommendedLevel: 33, previousDungeon: 'volcano' },
  sky_tower: { name: '天空の塔', recommendedLevel: 35, previousDungeon: 'dark_forest' },
  hell_gate: { name: '地獄の門', recommendedLevel: 40, previousDungeon: 'sky_tower' },
  dragon_nest: { name: '竜の巣穴', recommendedLevel: 45, previousDungeon: 'hell_gate' },
  sacred_temple: { name: '神域の神殿', recommendedLevel: 50, previousDungeon: 'dragon_nest' },
  chaos_realm: { name: '混沌の領域', recommendedLevel: 50, previousDungeon: 'sacred_temple' },
  final_land: { name: '終焉の地', recommendedLevel: 50, previousDungeon: 'chaos_realm' },
};

// ========================================
// ランダムビルド生成
// ========================================

/**
 * 有効なランダムビルドを生成
 * requiredNodesを尊重して、実際に取得可能な組み合わせのみ生成
 */
function generateRandomBuild(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];

  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;

    // ランダムに1つ選択
    const index = Math.floor(rng() * unlockable.length);
    const nextNode = unlockable[index];
    unlocked.push(nextNode.id);
  }

  return unlocked;
}

/**
 * レベルに応じたノード数を取得
 */
function getNodeCountForLevel(level: number): number {
  // 最も近い下限のレベルを探す
  const levels = Object.keys(NODES_BY_LEVEL).map(Number).sort((a, b) => b - a);
  for (const lvl of levels) {
    if (level >= lvl) {
      return NODES_BY_LEVEL[lvl];
    }
  }
  return 4; // デフォルト
}

// ========================================
// ステータス計算
// ========================================

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

function createPlayerStatsWithEquipmentAndPassives(
  level: number,
  equipmentSet: EquipmentSet,
  passiveNodeIds: string[]
): { stats: Stats; modEffects: CombinedModEffects } {
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);
  const equipBaseStats = calculateEquipmentBaseStats(equipmentSet);
  const levelBonus = calculateBaseStatsForLevel(level);

  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp + (levelBonus.maxHp - INITIAL_STATS.maxHp),
    atk: INITIAL_STATS.atk + passiveEffects.atk + equipBaseStats.atk + (levelBonus.atk - INITIAL_STATS.atk),
    def: INITIAL_STATS.def + passiveEffects.def + equipBaseStats.def + (levelBonus.def - INITIAL_STATS.def),
  };

  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);
  const equipmentItems = [equipmentSet.weapon, equipmentSet.armor, equipmentSet.gloves, equipmentSet.boots, equipmentSet.accessory];
  const combinedModEffects = combineMods(equipmentItems, passiveEffects);

  return { stats: finalStats, modEffects: combinedModEffects };
}

// ========================================
// ビルド分析
// ========================================

interface BuildResult {
  nodes: string[];
  equipType: EquipmentSetType;
  winRate: number;
  avgSeconds: number;
  avgHpRemaining: number;
}

interface NodeFrequency {
  nodeId: string;
  nodeName: string;
  count: number;
  avgWinRate: number;
}

/**
 * ノードの出現頻度と勝率への寄与を分析
 */
function analyzeNodeFrequency(builds: BuildResult[], threshold: number): NodeFrequency[] {
  const nodeStats = new Map<string, { count: number; totalWinRate: number }>();
  const allNodes = getAllPassiveNodes();
  const nodeNameMap = new Map(allNodes.map(n => [n.id, n.name]));

  // 高勝率ビルドのみを対象
  const highWinBuilds = builds.filter(b => b.winRate >= threshold);

  for (const build of highWinBuilds) {
    for (const nodeId of build.nodes) {
      const existing = nodeStats.get(nodeId) || { count: 0, totalWinRate: 0 };
      existing.count++;
      existing.totalWinRate += build.winRate;
      nodeStats.set(nodeId, existing);
    }
  }

  const result: NodeFrequency[] = [];
  for (const [nodeId, stats] of nodeStats) {
    result.push({
      nodeId,
      nodeName: nodeNameMap.get(nodeId) || nodeId,
      count: stats.count,
      avgWinRate: stats.totalWinRate / stats.count,
    });
  }

  // 出現回数でソート
  return result.sort((a, b) => b.count - a.count);
}

// ========================================
// メイン探索
// ========================================

console.log('='.repeat(70));
console.log('ランダムビルド探索');
console.log('意図しない強ビルドの発見');
console.log('='.repeat(70));
console.log('');
console.log(`設定: ${EXPLORATION_CONFIG.buildsPerDungeon}ビルド × ${EXPLORATION_CONFIG.runsPerBuild}回シミュレーション`);
console.log(`OPビルド閾値: 勝率${EXPLORATION_CONFIG.winRateThreshold * 100}%以上`);
console.log('');

const dungeonOrder = [
  'cave', 'ruins', 'goblin_fort', 'demon_castle', 'ice_cave',
  'volcano', 'dark_forest', 'sky_tower', 'hell_gate',
  'dragon_nest', 'sacred_temple', 'chaos_realm', 'final_land',
];

const EQUIPMENT_TYPES: EquipmentSetType[] = ['ATK', 'DEF', 'CRIT', 'POISON'];

// 全ダンジョンの結果を格納
const allOpBuilds: { dungeonId: string; build: BuildResult }[] = [];

for (const dungeonId of dungeonOrder) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const nodeCount = getNodeCountForLevel(level);

  console.log('='.repeat(70));
  console.log(`▼ ${info.name} (推奨Lv.${level}, ノード数${nodeCount})`);
  console.log('='.repeat(70));

  const rng = createRng(EXPLORATION_CONFIG.seed + level);
  const buildResults: BuildResult[] = [];

  // ランダムビルド生成とシミュレーション
  for (let i = 0; i < EXPLORATION_CONFIG.buildsPerDungeon; i++) {
    const nodes = generateRandomBuild(nodeCount, rng);

    // 各装備タイプでテスト
    for (const equipType of EQUIPMENT_TYPES) {
      const equipSet = previousEquipmentSets.sets[equipType];
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, nodes);

      const result = runGaugeSimulation(
        {
          playerStats: stats,
          modEffects,
          dungeonId,
          runs: EXPLORATION_CONFIG.runsPerBuild,
          seed: EXPLORATION_CONFIG.seed + i,
        },
        dungeonConfig,
        enemyMap
      );

      buildResults.push({
        nodes,
        equipType,
        winRate: result.stats.winRate,
        avgSeconds: result.stats.avgSeconds,
        avgHpRemaining: result.stats.avgPlayerHpRemaining,
      });
    }
  }

  // 勝率でソート
  buildResults.sort((a, b) => b.winRate - a.winRate);

  // OPビルドを抽出
  const opBuilds = buildResults.filter(b => b.winRate >= EXPLORATION_CONFIG.winRateThreshold);
  const weakBuilds = buildResults.filter(b => b.winRate <= EXPLORATION_CONFIG.lowWinRateThreshold);

  console.log('');
  console.log(`【統計】`);
  console.log(`  総ビルド数: ${buildResults.length}`);
  console.log(`  最高勝率: ${(buildResults[0].winRate * 100).toFixed(1)}%`);
  console.log(`  最低勝率: ${(buildResults[buildResults.length - 1].winRate * 100).toFixed(1)}%`);
  console.log(`  平均勝率: ${(buildResults.reduce((sum, b) => sum + b.winRate, 0) / buildResults.length * 100).toFixed(1)}%`);
  console.log(`  OPビルド数: ${opBuilds.length} (${(opBuilds.length / buildResults.length * 100).toFixed(1)}%)`);
  console.log(`  弱ビルド数: ${weakBuilds.length} (${(weakBuilds.length / buildResults.length * 100).toFixed(1)}%)`);

  // 上位5ビルドを表示
  console.log('');
  console.log('【上位5ビルド】');
  for (let i = 0; i < Math.min(5, buildResults.length); i++) {
    const build = buildResults[i];
    console.log(`  ${i + 1}. [${build.equipType}] 勝率${(build.winRate * 100).toFixed(0)}% | ${build.avgSeconds.toFixed(1)}s | 残HP${build.avgHpRemaining.toFixed(0)}`);
    console.log(`     ノード: ${build.nodes.slice(0, 10).join(', ')}${build.nodes.length > 10 ? '...' : ''}`);
  }

  // OPビルドがあれば頻出ノードを分析
  if (opBuilds.length > 0) {
    console.log('');
    console.log('【OPビルドの頻出ノード TOP10】');
    const nodeFreq = analyzeNodeFrequency(opBuilds, EXPLORATION_CONFIG.winRateThreshold);
    for (let i = 0; i < Math.min(10, nodeFreq.length); i++) {
      const nf = nodeFreq[i];
      console.log(`  ${nf.nodeName} (${nf.nodeId}): ${nf.count}回 (${(nf.count / opBuilds.length * 100).toFixed(0)}%)`);
    }

    // 全体結果に追加
    for (const build of opBuilds) {
      allOpBuilds.push({ dungeonId, build });
    }
  }

  console.log('');
}

// ========================================
// 全体サマリー
// ========================================

console.log('');
console.log('='.repeat(70));
console.log('【全体サマリー】');
console.log('='.repeat(70));
console.log('');

if (allOpBuilds.length === 0) {
  console.log('OPビルドは発見されませんでした。');
} else {
  console.log(`発見されたOPビルド総数: ${allOpBuilds.length}`);
  console.log('');

  // ダンジョン別集計
  const byDungeon = new Map<string, number>();
  for (const { dungeonId } of allOpBuilds) {
    byDungeon.set(dungeonId, (byDungeon.get(dungeonId) || 0) + 1);
  }

  console.log('【ダンジョン別OPビルド数】');
  for (const [dungeonId, count] of byDungeon) {
    console.log(`  ${dungeonInfo[dungeonId].name}: ${count}`);
  }

  // 装備タイプ別集計
  const byEquip = new Map<EquipmentSetType, number>();
  for (const { build } of allOpBuilds) {
    byEquip.set(build.equipType, (byEquip.get(build.equipType) || 0) + 1);
  }

  console.log('');
  console.log('【装備タイプ別OPビルド数】');
  for (const [equipType, count] of byEquip) {
    console.log(`  ${equipType}: ${count} (${(count / allOpBuilds.length * 100).toFixed(1)}%)`);
  }

  // 全OPビルドから頻出ノードを分析
  console.log('');
  console.log('【全OPビルドの頻出ノード TOP15】');
  const allOpBuildResults = allOpBuilds.map(b => b.build);
  const globalNodeFreq = analyzeNodeFrequency(allOpBuildResults, 0); // 既にOPのみなので閾値0
  for (let i = 0; i < Math.min(15, globalNodeFreq.length); i++) {
    const nf = globalNodeFreq[i];
    console.log(`  ${nf.nodeName} (${nf.nodeId}): ${nf.count}回 (${(nf.count / allOpBuilds.length * 100).toFixed(0)}%)`);
  }
}

console.log('');
console.log('='.repeat(70));
console.log('探索完了');
console.log('='.repeat(70));
