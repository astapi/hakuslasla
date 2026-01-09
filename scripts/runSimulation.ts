/**
 * シミュレーション実行スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/runSimulation.ts
 */

import {
  runBalanceTest,
  generateBalanceReport,
  createDefaultPlayerConfig,
  EnemyConfig,
  DungeonConfig,
  PlayerConfig,
  EquipmentConfig,
  ItemConfig,
  PASSIVE_PRESETS,
  PassivePresetKey,
  INITIAL_STATS,
  runSimulation,
  applyPercentageScaling,
  Stats,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';
import itemsData from '../data/json/items.json';

// JSONファイルを直接読み込み
import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// EnemyConfigのMapを作成
const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

// DungeonConfigに変換（core用の形式に）
function toDungeonConfig(dungeon: typeof dungeonsData.dungeons.grassland): DungeonConfig {
  const allDrops = [...dungeon.dropTable.common, ...dungeon.dropTable.dungeon];
  const config: DungeonConfig = {
    id: dungeon.id,
    name: dungeon.name,
    maxFloor: dungeon.maxFloor,
    enemies: dungeon.monsters.flatMap(m =>
      Array(m.spawnRate).fill(m.monsterId)
    ),
    dropTable: allDrops.map(d => d.itemId),
  };

  // ボス情報があれば追加
  if ('boss' in dungeon && dungeon.boss) {
    config.boss = {
      monsterId: (dungeon.boss as { monsterId: string; floor: number }).monsterId,
      floor: (dungeon.boss as { monsterId: string; floor: number }).floor,
    };
  }

  return config;
}

/**
 * PoE式: base × (1 + total_increased%) × more1 × more2 × ...
 * パッシブ効果を反映した最終ステータスを計算
 */
function calculateFinalStatsWithPassives(
  baseStats: Stats,
  passiveEffects: ReturnType<typeof calculatePassiveEffects>
): Stats {
  return {
    maxHp: applyPercentageScaling(
      baseStats.maxHp,
      passiveEffects.hp_increased_pct,
      passiveEffects.hp_more_pct
    ),
    atk: applyPercentageScaling(
      baseStats.atk,
      passiveEffects.atk_increased_pct,
      passiveEffects.atk_more_pct
    ),
    def: applyPercentageScaling(
      baseStats.def,
      passiveEffects.def_increased_pct,
      passiveEffects.def_more_pct
    ),
  };
}

/**
 * パッシブ効果を反映したPlayerConfigを作成
 * PoE式: base (flat) × (1 + total_increased%) × more1 × more2 × ...
 */
function createPlayerConfigWithPassives(
  level: number,
  passiveNodeIds: string[]
): PlayerConfig {
  const baseConfig = createDefaultPlayerConfig(level);
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);

  // Step 1: フラット加算で基礎ステータスを計算
  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp,
    atk: INITIAL_STATS.atk + passiveEffects.atk,
    def: INITIAL_STATS.def + passiveEffects.def,
  };

  // Step 2: PoE式で%効果を適用
  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);

  return {
    ...baseConfig,
    baseStats: finalStats,
    unlockedSkills: passiveNodeIds,
  };
}

// ダンジョン設定
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

// ダンジョン情報（推奨レベル付き）
const dungeonInfo = {
  grassland: { name: '始まりの草原', recommendedLevel: 1 },
  cave: { name: '地底洞窟', recommendedLevel: 5 },
  ruins: { name: '忘却の遺跡', recommendedLevel: 10 },
  goblin_fort: { name: 'ゴブリンの砦', recommendedLevel: 15 },
  demon_castle: { name: '魔王城', recommendedLevel: 20 },
  ice_cave: { name: '氷結の洞窟', recommendedLevel: 25 },
  volcano: { name: '灼熱の火山', recommendedLevel: 30 },
  dark_forest: { name: '深淵の森', recommendedLevel: 35 },
  sky_tower: { name: '天空の塔', recommendedLevel: 40 },
  hell_gate: { name: '地獄の門', recommendedLevel: 50 },
  dragon_nest: { name: '竜の巣穴', recommendedLevel: 60 },
  sacred_temple: { name: '神域の神殿', recommendedLevel: 70 },
  chaos_realm: { name: '混沌の領域', recommendedLevel: 80 },
  final_land: { name: '終焉の地', recommendedLevel: 99 },
};

// ========================================
// 装備セット定義
// ========================================

/**
 * アイテムIDからItemConfigを取得
 */
function getItemConfig(itemId: string): ItemConfig | null {
  const item = (itemsData.items as Record<string, { id: string; atk: number; def: number }>)[itemId];
  if (!item) return null;
  return {
    id: item.id,
    atk: item.atk,
    def: item.def,
  };
}

/**
 * 装備セット定義
 * MODなしの基本装備
 */
const EQUIPMENT_SETS: Record<string, { name: string; equipment: EquipmentConfig }> = {
  NONE: {
    name: '装備なし',
    equipment: {
      weapon: null,
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    },
  },
  GRASSLAND: {
    name: '草原装備',
    equipment: {
      weapon: getItemConfig('grassland_sword'),   // ATK+5
      armor: getItemConfig('light_leather'),       // DEF+4
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('rabbit_boots'),        // ATK+1, DEF+3
      accessory: getItemConfig('copper_ring'),     // ATK+1, DEF+1
    },
  },
  CAVE: {
    name: '洞窟装備',
    equipment: {
      weapon: getItemConfig('cave_iron_sword'),    // ATK+8
      armor: getItemConfig('bat_mantle'),          // ATK+1, DEF+5
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('leather_boots'),       // DEF+2
      accessory: getItemConfig('warrior_ring'),    // ATK+3, DEF+1
    },
  },
  RUINS: {
    name: '遺跡装備',
    equipment: {
      weapon: getItemConfig('ruins_magic_sword'),  // ATK+12
      armor: getItemConfig('cursed_robe'),         // ATK+3, DEF+8
      gloves: getItemConfig('leather_gloves'),     // ATK+1, DEF+1
      boots: getItemConfig('gargoyle_boots'),      // ATK+2, DEF+6
      accessory: getItemConfig('ancient_ring'),    // ATK+4, DEF+4
    },
  },
  // MOD付き装備を想定（固定MOD装備一式）
  RUINS_WITH_MODS: {
    name: '遺跡装備+MOD',
    equipment: {
      weapon: { id: 'ruins_magic_sword', atk: 12 + 5, def: 0 },      // +ATK MOD
      armor: { id: 'cursed_robe', atk: 3, def: 8 + 5 },              // +DEF MOD
      gloves: { id: 'curse_bandage', atk: 5, def: 4 },               // ユニーク
      boots: { id: 'stone_wing_boots', atk: 3, def: 8 + 5 },         // ユニーク+MOD
      accessory: { id: 'lost_grimoire', atk: 8, def: 0 },            // ユニーク
    },
  },
  // ゴブリンの砦装備+フルMOD（魔王城挑戦用）
  GOBLIN_FORT_FULL: {
    name: 'ゴブリン砦装備+MOD',
    equipment: {
      weapon: { id: 'goblin_blade', atk: 14 + 5, def: 0 },
      armor: { id: 'goblin_mail', atk: 0, def: 10 + 5 },
      gloves: { id: 'spiked_gauntlets', atk: 3 + 5, def: 4 + 5 },
      boots: { id: 'raider_boots', atk: 2 + 5, def: 7 + 5 },
      accessory: { id: 'kings_crown', atk: 10, def: 10 },            // ボスドロップ
    },
  },
  // 魔王城装備+フルMOD（氷結の洞窟挑戦用）
  DEMON_CASTLE_FULL: {
    name: '魔王城装備+MOD',
    equipment: {
      weapon: { id: 'demon_blade', atk: 18 + 5, def: 0 },
      armor: { id: 'dark_plate', atk: 0, def: 14 + 5 },
      gloves: { id: 'dragon_gauntlets', atk: 4 + 5, def: 6 + 5 },
      boots: { id: 'inferno_boots', atk: 3 + 5, def: 10 + 5 },
      accessory: { id: 'demon_crown', atk: 12, def: 12 },            // ボスドロップ
    },
  },
  // 氷結の洞窟装備+フルMOD（灼熱の火山挑戦用）
  ICE_CAVE_FULL: {
    name: '氷結洞窟装備+MOD',
    equipment: {
      weapon: { id: 'frost_blade', atk: 22 + 5, def: 0 },
      armor: { id: 'yeti_fur', atk: 0, def: 22 + 5 },                // ユニーク
      gloves: { id: 'frozen_gauntlets', atk: 5 + 5, def: 8 + 5 },
      boots: { id: 'blizzard_boots', atk: 4 + 5, def: 12 + 5 },
      accessory: { id: 'ice_crystal_ring', atk: 8 + 5, def: 8 + 5 },
    },
  },
  // 灼熱の火山装備+フルMOD（深淵の森挑戦用）
  VOLCANO_FULL: {
    name: '火山装備+MOD',
    equipment: {
      weapon: { id: 'flame_sword', atk: 32 + 5, def: 0 },            // ユニーク
      armor: { id: 'volcano_armor', atk: 0, def: 24 + 5 },
      gloves: { id: 'flame_gauntlets', atk: 7 + 5, def: 10 + 5 },
      boots: { id: 'ember_boots', atk: 5 + 5, def: 15 + 5 },
      accessory: { id: 'magma_core', atk: 15, def: 5 },              // ユニーク
    },
  },
  // 深淵の森装備+フルMOD（天空の塔挑戦用）
  DARK_FOREST_FULL: {
    name: '深淵森装備+MOD',
    equipment: {
      weapon: { id: 'shadow_blade', atk: 38 + 5, def: 0 },
      armor: { id: 'dark_bark_armor', atk: 0, def: 32 + 5 },
      gloves: { id: 'nightmare_gauntlets', atk: 10 + 5, def: 14 + 5 },
      boots: { id: 'forest_walker_boots', atk: 7 + 5, def: 20 + 5 },
      accessory: { id: 'chimera_fang', atk: 20, def: 10 },           // ユニーク
    },
  },
  // 天空の塔装備+フルMOD（地獄の門挑戦用）
  SKY_TOWER_FULL: {
    name: '天空塔装備+MOD',
    equipment: {
      weapon: { id: 'sky_blade', atk: 50 + 5, def: 0 },
      armor: { id: 'cloud_armor', atk: 0, def: 42 + 5 },
      gloves: { id: 'storm_gauntlets', atk: 14 + 5, def: 18 + 5 },
      boots: { id: 'wind_walker_boots', atk: 10 + 5, def: 26 + 5 },
      accessory: { id: 'thunder_feather', atk: 25, def: 15 },        // ユニーク
    },
  },
  // 地獄の門装備+フルMOD（竜の巣穴挑戦用）
  HELL_GATE_FULL: {
    name: '地獄門装備+MOD',
    equipment: {
      weapon: { id: 'balrog_whip', atk: 75 + 5, def: 0 },            // ユニーク
      armor: { id: 'infernal_armor', atk: 10, def: 65 + 5 },         // ユニーク
      gloves: { id: 'demon_gauntlets', atk: 20 + 5, def: 24 + 5 },
      boots: { id: 'hellwalker_boots', atk: 14 + 5, def: 35 + 5 },
      accessory: { id: 'infernal_ruby_ring', atk: 25 + 5, def: 25 + 5 },
    },
  },
  // 竜の巣穴装備+フルMOD（神域の神殿挑戦用）
  DRAGON_NEST_FULL: {
    name: '竜巣穴装備+MOD',
    equipment: {
      weapon: { id: 'dragon_slayer', atk: 90 + 5, def: 0 },
      armor: { id: 'fire_dragon_scale', atk: 15, def: 80 + 5 },      // ユニーク
      gloves: { id: 'dragon_claw_gauntlets', atk: 28 + 5, def: 32 + 5 },
      boots: { id: 'dragon_hide_boots', atk: 18 + 5, def: 48 + 5 },
      accessory: { id: 'dragon_heart', atk: 40, def: 40 },           // ユニーク
    },
  },
  // 神域の神殿装備+フルMOD（混沌の領域挑戦用）
  SACRED_TEMPLE_FULL: {
    name: '神殿装備+MOD',
    equipment: {
      weapon: { id: 'holy_blade', atk: 120 + 5, def: 0 },
      armor: { id: 'holy_dragon_scale', atk: 20, def: 120 + 5 },     // ユニーク
      gloves: { id: 'seraph_gauntlets', atk: 38 + 5, def: 44 + 5 },
      boots: { id: 'divine_boots', atk: 25 + 5, def: 65 + 5 },
      accessory: { id: 'holy_feather', atk: 50, def: 50 },           // ユニーク
    },
  },
  // 混沌の領域装備+フルMOD（終焉の地挑戦用）
  CHAOS_REALM_FULL: {
    name: '混沌装備+MOD',
    equipment: {
      weapon: { id: 'chaos_blade', atk: 160 + 5, def: 0 },
      armor: { id: 'chaos_scale', atk: 30, def: 150 + 5 },           // ユニーク
      gloves: { id: 'chaos_gauntlets', atk: 52 + 5, def: 60 + 5 },
      boots: { id: 'void_boots', atk: 35 + 5, def: 88 + 5 },
      accessory: { id: 'void_essence', atk: 70, def: 70 },           // ユニーク
    },
  },
};

// 基本スキルノードID（旧バージョン互換）
const BASIC_SKILL_NODES = [
  'start',
  'atk_1', 'atk_2', 'atk_3',
  'hp_1', 'hp_2', 'hp_3',
  'def_1', 'def_2', 'def_3',
  'merge',
  'poison_1', 'poison_2', 'poison_3',
  'crit_1', 'crit_2', 'crit_3',
  'regen_1', 'regen_2', 'regen_3',
  'atk_pct_1', 'atk_pct_2', 'atk_pct_3',
];

// Tier2スキルノード（ATK% more まで）
const TIER2_SKILL_NODES = [
  ...BASIC_SKILL_NODES,
  'merge_2',
  'hp_pct_1', 'hp_pct_2', 'hp_pct_3', 'notable_hp_more',
  'def_pct_1', 'def_pct_2', 'def_pct_3', 'notable_def_more',
  'atk_pct_4', 'atk_pct_5', 'atk_pct_6', 'notable_atk_more',
  'crit_dmg_1', 'crit_dmg_2', 'crit_dmg_3', 'notable_crit',
];

// Tier3スキルノード（2回目のmore まで）
const TIER3_SKILL_NODES = [
  ...TIER2_SKILL_NODES,
  'merge_3',
  'atk_pct_7', 'atk_pct_8', 'notable_atk_more_2',
  'hp_pct_4', 'hp_pct_5', 'notable_hp_more_2',
  'def_pct_4', 'def_pct_5', 'notable_def_more_2',
];

// フルスキルノード（伝説ノードまで）
const ALL_SKILL_NODES = [
  ...TIER3_SKILL_NODES,
  'final_merge',
  'legendary_node',
];

type EquipmentSetKey = keyof typeof EQUIPMENT_SETS;

/**
 * 装備の合計ステータスを計算
 */
function calculateEquipmentStats(equipment: EquipmentConfig): { atk: number; def: number } {
  let atk = 0;
  let def = 0;
  const slots = ['weapon', 'armor', 'gloves', 'boots', 'accessory'] as const;
  for (const slot of slots) {
    const item = equipment[slot];
    if (item) {
      atk += item.atk;
      def += item.def;
    }
  }
  return { atk, def };
}

/**
 * 装備＋パッシブ付きのPlayerConfigを作成
 * PoE式: base (flat + equipment) × (1 + total_increased%) × more1 × more2 × ...
 */
function createPlayerConfigWithEquipmentAndPassives(
  level: number,
  equipmentSet: EquipmentConfig,
  passiveNodeIds: string[]
): PlayerConfig {
  const passiveEffects = calculatePassiveEffects(passiveNodeIds);
  const equipStats = calculateEquipmentStats(equipmentSet);

  // Step 1: フラット加算で基礎ステータスを計算（初期値 + パッシブフラット + 装備）
  const flatStats: Stats = {
    maxHp: INITIAL_STATS.maxHp + passiveEffects.hp,
    atk: INITIAL_STATS.atk + passiveEffects.atk + equipStats.atk,
    def: INITIAL_STATS.def + passiveEffects.def + equipStats.def,
  };

  // Step 2: PoE式で%効果を適用
  const finalStats = calculateFinalStatsWithPassives(flatStats, passiveEffects);

  return {
    level,
    baseStats: finalStats,
    equipment: {
      weapon: null,
      armor: null,
      gloves: null,
      boots: null,
      accessory: null,
    }, // 装備はすでにbaseStatsに含まれている
    unlockedSkills: passiveNodeIds,
  };
}

// ========================================
// シミュレーション実行
// ========================================

console.log('='.repeat(60));
console.log('ハクスラダンジョン シミュレーション');
console.log('='.repeat(60));
console.log('');

// ========================================
// 1. 基本バランステスト（パッシブなし）
// ========================================

console.log('【基本バランステスト（パッシブなし）】');
console.log('');

console.log('▼ 始まりの草原');
const balanceResult1 = runBalanceTest(
  {
    playerLevels: [1, 2, 3, 5, 7],
    dungeonId: 'grassland',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.grassland,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult1));
console.log('');

console.log('▼ 地底洞窟');
const balanceResult2 = runBalanceTest(
  {
    playerLevels: [3, 5, 7, 10, 12],
    dungeonId: 'cave',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.cave,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult2));
console.log('');

console.log('▼ 忘却の遺跡');
const balanceResult3 = runBalanceTest(
  {
    playerLevels: [8, 10, 12, 15, 20],
    dungeonId: 'ruins',
    runsPerLevel: 500,
    seed: 12345,
  },
  dungeonConfigs.ruins,
  enemyMap,
  createDefaultPlayerConfig
);
console.log(generateBalanceReport(balanceResult3));
console.log('');

// ========================================
// 2. パッシブルート別シミュレーション
// ========================================

console.log('='.repeat(60));
console.log('【パッシブルート別シミュレーション】');
console.log('='.repeat(60));
console.log('');

// 各ダンジョンの推奨レベルでパッシブルート別のシミュレーションを実行
const presetKeys: PassivePresetKey[] = [
  'NONE',
  'ATK_POISON', 'ATK_CRIT', 'ATK_REGEN', 'ATK_ATK_PCT',
  'HP_POISON', 'HP_CRIT', 'HP_REGEN',
  'TIER2_ATK_MORE', 'TIER2_HP_MORE',
  'TIER3_ATK_FULL', 'FULL_LEGENDARY',
];

for (const [dungeonKey, config] of Object.entries(dungeonConfigs)) {
  const info = dungeonInfo[dungeonKey as keyof typeof dungeonInfo];
  const level = info.recommendedLevel;

  console.log(`▼ ${info.name} (推奨Lv.${level})`);
  console.log('');
  console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
  console.log('-----------------|------|------------|----------|------');

  for (const presetKey of presetKeys) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithPassives(level, preset.nodes);
    const passiveEffects = calculatePassiveEffects(preset.nodes);

    const result = runSimulation(
      {
        playerConfig,
        dungeonId: dungeonKey,
        runs: 500,
        seed: 12345,
      },
      config,
      enemyMap
    );

    // 効果サマリー
    const effects: string[] = [];
    if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
    if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
    if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
    if (passiveEffects.atk_increased_pct > 0) effects.push(`ATK+${passiveEffects.atk_increased_pct}%`);
    if (passiveEffects.hp_increased_pct > 0) effects.push(`HP+${passiveEffects.hp_increased_pct}%`);
    if (passiveEffects.def_increased_pct > 0) effects.push(`DEF+${passiveEffects.def_increased_pct}%`);
    if (passiveEffects.atk_more_pct.length > 0) effects.push(`ATK more×${passiveEffects.atk_more_pct.length}`);
    if (passiveEffects.hp_more_pct.length > 0) effects.push(`HP more×${passiveEffects.hp_more_pct.length}`);
    if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
    if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
    if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);

    const effectStr = effects.length > 0 ? effects.join(', ') : '-';

    console.log(
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
      effectStr
    );
  }

  console.log('');
}

// ========================================
// 3. 高レベル帯でのパッシブ効果検証
// ========================================

console.log('='.repeat(60));
console.log('【高レベル帯パッシブ効果検証】');
console.log('='.repeat(60));
console.log('');

const highLevelTests = [
  { dungeon: 'cave', level: 10 },
  { dungeon: 'ruins', level: 15 },
  { dungeon: 'ruins', level: 20 },
];

for (const test of highLevelTests) {
  const config = dungeonConfigs[test.dungeon as keyof typeof dungeonConfigs];
  const info = dungeonInfo[test.dungeon as keyof typeof dungeonInfo];

  console.log(`▼ ${info.name} Lv.${test.level}`);
  console.log('');
  console.log('ルート           | 勝率 | 平均ターン | 平均残HP');
  console.log('-----------------|------|------------|--------');

  for (const presetKey of presetKeys) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithPassives(test.level, preset.nodes);

    const result = runSimulation(
      {
        playerConfig,
        dungeonId: test.dungeon,
        runs: 500,
        seed: 12345,
      },
      config,
      enemyMap
    );

    console.log(
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  console.log('');
}

// ========================================
// 4. 装備＋パッシブ組み合わせシミュレーション
// ========================================

console.log('='.repeat(60));
console.log('【装備＋パッシブ組み合わせシミュレーション】');
console.log('='.repeat(60));
console.log('');

// 地底洞窟: 草原装備（ATK+8, DEF+9）× パッシブ各パターン
console.log('▼ 地底洞窟（草原装備一式）');
const grasslandEquip = EQUIPMENT_SETS.GRASSLAND;
const grasslandStats = calculateEquipmentStats(grasslandEquip.equipment);
console.log(`  装備効果: ATK+${grasslandStats.atk}, DEF+${grasslandStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
console.log('-----------------|------|------------|----------|------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    5, // 推奨レベル
    grasslandEquip.equipment,
    preset.nodes
  );
  const passiveEffects = calculatePassiveEffects(preset.nodes);

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'cave',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.cave,
    enemyMap
  );

  // 効果サマリー
  const effects: string[] = [];
  if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
  if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
  if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
  if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
  if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
  if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);
  const effectStr = effects.length > 0 ? effects.join(', ') : '-';

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    effectStr
  );
}

console.log('');

// 忘却の遺跡: 洞窟装備（ATK+13, DEF+9）× パッシブ各パターン
console.log('▼ 忘却の遺跡（洞窟装備一式）');
const caveEquip = EQUIPMENT_SETS.CAVE;
const caveStats = calculateEquipmentStats(caveEquip.equipment);
console.log(`  装備効果: ATK+${caveStats.atk}, DEF+${caveStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 効果');
console.log('-----------------|------|------------|----------|------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    10, // 推奨レベル
    caveEquip.equipment,
    preset.nodes
  );
  const passiveEffects = calculatePassiveEffects(preset.nodes);

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'ruins',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.ruins,
    enemyMap
  );

  // 効果サマリー
  const effects: string[] = [];
  if (passiveEffects.hp > 0) effects.push(`HP+${passiveEffects.hp}`);
  if (passiveEffects.atk > 0) effects.push(`ATK+${passiveEffects.atk}`);
  if (passiveEffects.def > 0) effects.push(`DEF+${passiveEffects.def}`);
  if (passiveEffects.poison_chance > 0) effects.push(`毒${passiveEffects.poison_chance}%`);
  if (passiveEffects.critical_chance > 0) effects.push(`クリ${passiveEffects.critical_chance}%`);
  if (passiveEffects.hp_regen > 0) effects.push(`回復${passiveEffects.hp_regen}`);
  const effectStr = effects.length > 0 ? effects.join(', ') : '-';

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    effectStr
  );
}

console.log('');

// ========================================
// 5. 装備あり/なし比較（推奨レベル）
// ========================================

console.log('='.repeat(60));
console.log('【装備あり/なし比較】');
console.log('='.repeat(60));
console.log('');

const comparisonTests = [
  { dungeon: 'cave', level: 5, equipKey: 'GRASSLAND' as EquipmentSetKey },
  { dungeon: 'ruins', level: 10, equipKey: 'CAVE' as EquipmentSetKey },
];

for (const test of comparisonTests) {
  const dungeonConfig = dungeonConfigs[test.dungeon as keyof typeof dungeonConfigs];
  const info = dungeonInfo[test.dungeon as keyof typeof dungeonInfo];
  const equipSet = EQUIPMENT_SETS[test.equipKey];
  const equipStats = calculateEquipmentStats(equipSet.equipment);

  console.log(`▼ ${info.name} Lv.${test.level}`);
  console.log(`  ${equipSet.name}: ATK+${equipStats.atk}, DEF+${equipStats.def}`);
  console.log('');
  console.log('装備       | パッシブ         | 勝率 | 平均ターン | 平均残HP');
  console.log('-----------|------------------|------|------------|--------');

  // 装備なし × 各パッシブ
  for (const presetKey of ['NONE', 'ATK_CRIT', 'HP_REGEN'] as PassivePresetKey[]) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithEquipmentAndPassives(
      test.level,
      EQUIPMENT_SETS.NONE.equipment,
      preset.nodes
    );

    const result = runSimulation(
      { playerConfig, dungeonId: test.dungeon, runs: 500, seed: 12345 },
      dungeonConfig,
      enemyMap
    );

    console.log(
      `${'なし'.padEnd(9)} | ` +
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  // 装備あり × 各パッシブ
  for (const presetKey of ['NONE', 'ATK_CRIT', 'HP_REGEN'] as PassivePresetKey[]) {
    const preset = PASSIVE_PRESETS[presetKey];
    const playerConfig = createPlayerConfigWithEquipmentAndPassives(
      test.level,
      equipSet.equipment,
      preset.nodes
    );

    const result = runSimulation(
      { playerConfig, dungeonId: test.dungeon, runs: 500, seed: 12345 },
      dungeonConfig,
      enemyMap
    );

    console.log(
      `${equipSet.name.slice(0, 9).padEnd(9)} | ` +
      `${preset.name.padEnd(15)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(6)}`
    );
  }

  console.log('');
}

// ========================================
// 6. ゴブリンの砦 難易度検証（20階層目にゴブリンキング）
// ========================================

console.log('='.repeat(60));
console.log('【ゴブリンの砦 難易度検証】');
console.log('  ※20階層目にボス「ゴブリンキング」(HP300, ATK32, DEF18)');
console.log('='.repeat(60));
console.log('');

// 遺跡装備（MODなし）でゴブリンの砦に挑戦
console.log('▼ ゴブリンの砦（遺跡装備一式・MODなし）');
const ruinsEquip = EQUIPMENT_SETS.RUINS;
const ruinsStats = calculateEquipmentStats(ruinsEquip.equipment);
console.log(`  装備効果: ATK+${ruinsStats.atk}, DEF+${ruinsStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 平均階層');
console.log('-----------------|------|------------|----------|--------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    15, // 推奨レベル
    ruinsEquip.equipment,
    preset.nodes
  );

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'goblin_fort',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.goblin_fort,
    enemyMap
  );

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
  );
}

console.log('');

// 遺跡装備（MOD付き）でゴブリンの砦に挑戦
console.log('▼ ゴブリンの砦（遺跡装備一式・MOD付き + ユニーク装備）');
const ruinsModEquip = EQUIPMENT_SETS.RUINS_WITH_MODS;
const ruinsModStats = calculateEquipmentStats(ruinsModEquip.equipment);
console.log(`  装備効果: ATK+${ruinsModStats.atk}, DEF+${ruinsModStats.def}`);
console.log('');
console.log('ルート           | 勝率 | 平均ターン | 平均残HP | 平均階層');
console.log('-----------------|------|------------|----------|--------');

for (const presetKey of presetKeys) {
  const preset = PASSIVE_PRESETS[presetKey];
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    15, // 推奨レベル
    ruinsModEquip.equipment,
    preset.nodes
  );

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: 'goblin_fort',
      runs: 500,
      seed: 12345,
    },
    dungeonConfigs.goblin_fort,
    enemyMap
  );

  console.log(
    `${preset.name.padEnd(15)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
  );
}

console.log('');

// ========================================
// 7. 新規ダンジョン難易度検証（1つ前の最強装備+フルMOD+全スキル）
// ========================================

console.log('='.repeat(60));
console.log('【新規ダンジョン難易度検証】');
console.log('  ※1つ前のダンジョンの最強装備+フルMOD+全スキル取得');
console.log('  ※全スキル効果: HP+130, ATK+30, DEF+2, 毒15%, クリ15%, 回復30');
console.log('='.repeat(60));
console.log('');

// 新規ダンジョン用のシミュレーション設定
const newDungeonTests: {
  dungeon: keyof typeof dungeonConfigs;
  level: number;
  equipSet: EquipmentSetKey;
}[] = [
  { dungeon: 'demon_castle', level: 20, equipSet: 'GOBLIN_FORT_FULL' },
  { dungeon: 'ice_cave', level: 25, equipSet: 'DEMON_CASTLE_FULL' },
  { dungeon: 'volcano', level: 30, equipSet: 'ICE_CAVE_FULL' },
  { dungeon: 'dark_forest', level: 35, equipSet: 'VOLCANO_FULL' },
  { dungeon: 'sky_tower', level: 40, equipSet: 'DARK_FOREST_FULL' },
  { dungeon: 'hell_gate', level: 50, equipSet: 'SKY_TOWER_FULL' },
  { dungeon: 'dragon_nest', level: 60, equipSet: 'HELL_GATE_FULL' },
  { dungeon: 'sacred_temple', level: 70, equipSet: 'DRAGON_NEST_FULL' },
  { dungeon: 'chaos_realm', level: 80, equipSet: 'SACRED_TEMPLE_FULL' },
  { dungeon: 'final_land', level: 99, equipSet: 'CHAOS_REALM_FULL' },
];

console.log('ダンジョン         | 推奨Lv | 装備           | 勝率 | 平均ターン | 平均残HP | 平均階層');
console.log('-------------------|--------|----------------|------|------------|----------|--------');

for (const test of newDungeonTests) {
  const dungeonConfig = dungeonConfigs[test.dungeon];
  const info = dungeonInfo[test.dungeon];
  const equipSet = EQUIPMENT_SETS[test.equipSet];
  const equipStats = calculateEquipmentStats(equipSet.equipment);

  // 全スキル取得でプレイヤー設定を作成
  const playerConfig = createPlayerConfigWithEquipmentAndPassives(
    test.level,
    equipSet.equipment,
    ALL_SKILL_NODES
  );

  const result = runSimulation(
    {
      playerConfig,
      dungeonId: test.dungeon,
      runs: 500,
      seed: 12345,
    },
    dungeonConfig,
    enemyMap
  );

  const dungeonName = info.name.padEnd(16);
  console.log(
    `${dungeonName} | ` +
    `${test.level.toString().padStart(6)} | ` +
    `${equipSet.name.slice(0, 14).padEnd(14)} | ` +
    `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
    `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
    `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
    `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
  );
}

console.log('');

// ========================================
// 8. 詳細シミュレーション（各ダンジョン別）
// ========================================

console.log('='.repeat(60));
console.log('【新規ダンジョン詳細シミュレーション】');
console.log('='.repeat(60));
console.log('');

for (const test of newDungeonTests) {
  const dungeonConfig = dungeonConfigs[test.dungeon];
  const info = dungeonInfo[test.dungeon];
  const equipSet = EQUIPMENT_SETS[test.equipSet];
  const equipStats = calculateEquipmentStats(equipSet.equipment);
  const passiveEffects = calculatePassiveEffects(ALL_SKILL_NODES);

  console.log(`▼ ${info.name} (推奨Lv.${info.recommendedLevel}, ${dungeonConfig.maxFloor}階層)`);
  console.log(`  装備: ${equipSet.name} (ATK+${equipStats.atk}, DEF+${equipStats.def})`);
  console.log(`  パッシブ: HP+${passiveEffects.hp}, ATK+${passiveEffects.atk}, DEF+${passiveEffects.def}, 毒${passiveEffects.poison_chance}%, クリ${passiveEffects.critical_chance}%, 回復${passiveEffects.hp_regen}`);
  console.log('');

  // 推奨レベル、推奨+10、推奨+20でテスト
  const testLevels = [test.level, test.level + 10, test.level + 20];
  console.log('  レベル | 勝率 | 平均ターン | 平均残HP | 平均階層');
  console.log('  -------|------|------------|----------|--------');

  for (const level of testLevels) {
    const playerConfig = createPlayerConfigWithEquipmentAndPassives(
      level,
      equipSet.equipment,
      ALL_SKILL_NODES
    );

    const result = runSimulation(
      {
        playerConfig,
        dungeonId: test.dungeon,
        runs: 500,
        seed: 12345,
      },
      dungeonConfig,
      enemyMap
    );

    console.log(
      `  Lv${level.toString().padStart(3)} | ` +
      `${(result.stats.winRate * 100).toFixed(0).padStart(3)}% | ` +
      `${result.stats.avgTurns.toFixed(1).padStart(10)} | ` +
      `${result.stats.avgPlayerHpRemaining.toFixed(0).padStart(8)} | ` +
      `${result.stats.avgFloorsCleared.toFixed(1).padStart(6)}`
    );
  }

  console.log('');
}

console.log('='.repeat(60));
console.log('シミュレーション完了');
console.log('='.repeat(60));
