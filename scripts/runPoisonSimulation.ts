/**
 * 毒特化ビルド シミュレーション
 * 毒装備 + 毒パッシブ の組み合わせを検証
 *
 * npx tsx scripts/runPoisonSimulation.ts
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
  LEVEL_BASED_PRESETS,
  DUNGEON_EQUIPMENT_SETS,
  EquipmentSet,
  combineMods,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// EnemyConfigのMapを作成
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

const dungeonConfigs = {
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
  dark_forest: { name: '深淵の森', recommendedLevel: 35, previousDungeon: 'volcano' },
  sky_tower: { name: '天空の塔', recommendedLevel: 40, previousDungeon: 'dark_forest' },
  hell_gate: { name: '地獄の門', recommendedLevel: 50, previousDungeon: 'sky_tower' },
  dragon_nest: { name: '竜の巣穴', recommendedLevel: 60, previousDungeon: 'hell_gate' },
  sacred_temple: { name: '神域の神殿', recommendedLevel: 70, previousDungeon: 'dragon_nest' },
  chaos_realm: { name: '混沌の領域', recommendedLevel: 80, previousDungeon: 'sacred_temple' },
  final_land: { name: '終焉の地', recommendedLevel: 99, previousDungeon: 'chaos_realm' },
};

function getPassiveLevel(level: number): 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 {
  if (level >= 50) return 50;
  if (level >= 45) return 45;
  if (level >= 40) return 40;
  if (level >= 35) return 35;
  if (level >= 30) return 30;
  if (level >= 25) return 25;
  if (level >= 20) return 20;
  if (level >= 15) return 15;
  if (level >= 10) return 10;
  return 5;
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
// シミュレーション実行
// ========================================

console.log('='.repeat(70));
console.log('毒特化ビルド シミュレーション');
console.log('毒装備（38%毒付与+防御/回復MOD）+ 毒パッシブ（62%毒付与）');
console.log('='.repeat(70));
console.log('');

const dungeonOrder = [
  'cave', 'ruins', 'goblin_fort', 'demon_castle', 'ice_cave',
  'volcano', 'dark_forest', 'sky_tower', 'hell_gate', 'dragon_nest',
  'sacred_temple', 'chaos_realm', 'final_land',
];

console.log('【毒ビルド vs 他ビルド 比較】');
console.log('');

for (const dungeonId of dungeonOrder) {
  const info = dungeonInfo[dungeonId];
  const dungeonConfig = dungeonConfigs[dungeonId as keyof typeof dungeonConfigs];
  const previousDungeonId = info.previousDungeon;

  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  console.log('='.repeat(70));
  console.log(`▼ ${info.name} (推奨Lv.${level}, ${dungeonConfig.maxFloor}階層)`);
  console.log(`  装備: ${previousEquipmentSets.dungeonId} (Tier${previousEquipmentSets.maxTier})`);
  console.log(`  パッシブLV: ${passiveLevel}`);
  console.log('='.repeat(70));
  console.log('');
  console.log('ビルド               | 勝率 | 平均時間 | 平均残HP | 平均階層 | 備考');
  console.log('---------------------|------|----------|----------|----------|------');

  // 毒装備 + 毒パッシブ
  {
    const equipSet = previousEquipmentSets.sets.POISON;
    const passivePreset = LEVEL_BASED_PRESETS.POISON?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `毒装備+毒パッシブ    | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `毒${(modEffects.poisonChance).toFixed(0)}%`
      );
    }
  }

  // 毒装備 + 毒防御パッシブ
  {
    const equipSet = previousEquipmentSets.sets.POISON;
    const passivePreset = LEVEL_BASED_PRESETS.POISON_GUARD?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `毒装備+毒防御パッシブ | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `毒${(modEffects.poisonChance).toFixed(0)}%`
      );
    }
  }

  // 毒装備 + 毒回復パッシブ
  {
    const equipSet = previousEquipmentSets.sets.POISON;
    const passivePreset = LEVEL_BASED_PRESETS.POISON_REGEN?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `毒装備+毒回復パッシブ | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `毒${(modEffects.poisonChance).toFixed(0)}%`
      );
    }
  }

  console.log('---------------------|------|----------|----------|----------|------');

  // クリ装備 + クリパッシブ（比較用）
  {
    const equipSet = previousEquipmentSets.sets.CRIT;
    const passivePreset = LEVEL_BASED_PRESETS.CRIT?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `クリ装備+クリパッシブ | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `クリ${(modEffects.criticalChance).toFixed(0)}%`
      );
    }
  }

  // ATK装備 + 速度パッシブ（比較用）
  {
    const equipSet = previousEquipmentSets.sets.ATK;
    const passivePreset = LEVEL_BASED_PRESETS.SPEED?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `ATK装備+速度パッシブ | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `攻速${(modEffects.attackSpeedPct).toFixed(0)}%`
      );
    }
  }

  // DEF装備 + 回復パッシブ（比較用）
  {
    const equipSet = previousEquipmentSets.sets.DEF;
    const passivePreset = LEVEL_BASED_PRESETS.REGEN?.[passiveLevel];
    if (passivePreset) {
      const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);
      const result = runGaugeSimulation(
        { playerStats: stats, modEffects, dungeonId, runs: 500, seed: 12345 },
        dungeonConfig, enemyMap
      );
      console.log(
        `DEF装備+回復パッシブ | ${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
        `${result.stats.avgSeconds.toFixed(1).padStart(7)}s | ` +
        `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
        `${result.stats.avgFloorsCleared.toFixed(1).padStart(8)} | ` +
        `HP回復${(modEffects.hpRegen).toFixed(0)}`
      );
    }
  }

  console.log('');
}

// ========================================
// 毒ビルド詳細
// ========================================

console.log('='.repeat(70));
console.log('【毒ビルド詳細ステータス】');
console.log('='.repeat(70));
console.log('');

const detailDungeons = ['demon_castle', 'volcano', 'sky_tower', 'hell_gate'];

for (const dungeonId of detailDungeons) {
  const info = dungeonInfo[dungeonId];
  const previousDungeonId = info.previousDungeon;
  if (!previousDungeonId) continue;

  const previousEquipmentSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
  if (!previousEquipmentSets) continue;

  const level = info.recommendedLevel;
  const passiveLevel = getPassiveLevel(level);

  const equipSet = previousEquipmentSets.sets.POISON;
  const passivePreset = LEVEL_BASED_PRESETS.POISON?.[passiveLevel];
  if (!passivePreset) continue;

  const { stats, modEffects } = createPlayerStatsWithEquipmentAndPassives(level, equipSet, passivePreset.nodes);

  console.log(`▼ ${info.name} (Lv.${level}) - 毒装備+毒パッシブLV${passiveLevel}`);
  console.log(`  MaxHP: ${stats.maxHp.toFixed(0)}, ATK: ${stats.atk.toFixed(0)}, DEF: ${stats.def.toFixed(0)}`);
  console.log(`  毒付与率: ${modEffects.poisonChance}%`);
  console.log(`  毒ダメージ: ${modEffects.poisonDamagePct}% increased`);
  console.log(`  毒ダメージmore: ${modEffects.poisonDamageMorePct.join(' × ')}%`);
  console.log(`  毒スタック上限: ${modEffects.poisonMaxStacks}`);
  console.log(`  毒状態時被ダメ軽減: ${modEffects.poisonDamageReduction}%`);
  console.log(`  通常ダメージ不可: ${modEffects.noDirectDamage}`);
  console.log(`  HP回復: ${modEffects.hpRegen}/ターン + ${modEffects.hpRegenPct}%/ターン`);
  console.log(`  ダメージ軽減: ${modEffects.damageReductionPct}%`);
  console.log('');
}

console.log('='.repeat(70));
console.log('シミュレーション完了');
console.log('='.repeat(70));
