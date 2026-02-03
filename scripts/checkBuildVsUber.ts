/**
 * 固定ビルドのUberボス勝率を確認
 *
 * 使用方法:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json node --import tsx scripts/checkBuildVsUber.ts [runs] [seed]
 */

import { runGaugeSimulation } from '../core/simulation';
import { calculateBaseStatsForLevel } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects } from '../data/passiveTree';
import { EnemyConfig, DungeonConfig } from '../core/types';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

const args = process.argv.slice(2);
const runs = args[0] ? parseInt(args[0], 10) : 300;
const seed = args[1] ? parseInt(args[1], 10) : 12345;

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

const build = {
  level: 60,
  equipment: {
    weapon: {
      id: 'uber_goblin_blade',
      name: 'Uber ゴブリンの剣',
      slot: 'weapon',
      atk: 110,
      def: 0,
      instanceId: 'check_uber_goblin_blade',
      mods: [
        { type: 'time_atk_inc_pct', value: 6, tier: 0 },
        { type: 'atk_bonus', value: 40, tier: 0 },
        { type: 'attack_speed_pct', value: 15, tier: 0 },
      ],
    },
    armor: {
      id: 'end_armor',
      name: '終末の鎧',
      slot: 'armor',
      atk: 0,
      def: 180,
      instanceId: 'check_end_armor',
      mods: [
        { type: 'critical_chance', value: 26, tier: 3 },
        { type: 'hp_bonus', value: 269, tier: 2 },
        { type: 'def_bonus', value: 74, tier: 1 },
        { type: 'def_increased_pct', value: 43, tier: 1 },
      ],
    },
    gloves: {
      id: 'titan_gauntlets',
      name: '泰坦の篭手',
      slot: 'gloves',
      atk: 70,
      def: 80,
      instanceId: 'check_titan_gauntlets',
      mods: [
        { type: 'hp_bonus', value: 264, tier: 2 },
        { type: 'hp_regen_pct', value: 4, tier: 2 },
        { type: 'attack_speed_pct', value: 30, tier: 1 },
        { type: 'hp_regen', value: 36, tier: 3 },
      ],
    },
    boots: {
      id: 'uber_bandit_steps',
      name: 'Uber 盗賊王の足運び',
      slot: 'boots',
      atk: 45,
      def: 100,
      instanceId: 'check_uber_bandit_steps',
      mods: [
        { type: 'attack_speed_pct', value: 20, tier: 0 },
        { type: 'critical_chance', value: 18, tier: 0 },
        { type: 'def_increased_pct', value: 12, tier: 0 },
      ],
    },
    accessory: {
      id: 'uber_kings_crown',
      name: 'Uber ゴブリンキングの王冠',
      slot: 'accessory',
      atk: 40,
      def: 40,
      instanceId: 'check_uber_kings_crown',
      mods: [
        { type: 'atk_bonus', value: 35, tier: 0 },
        { type: 'def_bonus', value: 35, tier: 0 },
        { type: 'hp_regen', value: 80, tier: 0 },
      ],
    },
  },
  unlockedSkills: [
    'start',
    'vamp_1',
    'guard_1',
    'regen_1',
    'vamp_2',
    'vamp_3',
    'regen_2',
    'vamp_5',
    'speed_1',
    'regen_3',
    'regen_4',
    'regen_5',
    'guard_2',
    'guard_3',
    'guard_4',
    'crit_1',
    'vamp_6',
    'guard_5',
    'regen_6',
    'poison_1',
    'vamp_7',
    'vamp_4',
    'regen_7',
    'regen_key1',
    'regen_8',
    'guard_6',
    'vamp_key1',
    'speed_2',
    'vamp_8',
    'vamp_9',
    'speed_4',
    'poison_2',
    'vamp_10',
    'speed_3',
    'guard_7',
    'speed_5',
    'poison_3',
    'regen_10',
    'regen_9',
    'guard_key1',
    'poison_4',
    'poison_5',
    'vamp_11',
    'speed_6',
    'vamp_12',
    'crit_2',
    'crit_3',
    'guard_8',
    'guard_10',
    'guard_9',
  ],
};

function calculateFinalStats(level: number, equipment: any, unlockedSkills: string[]) {
  const levelBonus = calculateBaseStatsForLevel(level);
  let baseAtk = levelBonus.atk;
  let baseDef = levelBonus.def;
  let baseMaxHp = levelBonus.maxHp;

  let equipHpIncPct = 0;
  let equipAtkIncPct = 0;
  let equipDefIncPct = 0;

  const items = [equipment.weapon, equipment.armor, equipment.gloves, equipment.boots, equipment.accessory];
  for (const item of items) {
    if (!item) continue;
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
    maxHp: applyPercentageScaling(flatStats.maxHp, passiveEffects.hp_increased_pct + equipHpIncPct, passiveEffects.hp_more_pct),
    atk: applyPercentageScaling(flatStats.atk, passiveEffects.atk_increased_pct + equipAtkIncPct, passiveEffects.atk_more_pct),
    def: applyPercentageScaling(flatStats.def, passiveEffects.def_increased_pct + equipDefIncPct, passiveEffects.def_more_pct),
  };

  const modEffects = combineMods(items, passiveEffects);
  return { finalStats, modEffects };
}

const { finalStats, modEffects } = calculateFinalStats(build.level, build.equipment, build.unlockedSkills);

console.log('固定ビルド Uber勝率チェック');
console.log(`runs=${runs}, seed=${seed}`);

for (const bossId of uberBossIds) {
  const dungeon = dungeonConfigs[bossId];
  if (!dungeon) continue;
  const result = runGaugeSimulation(
    { playerStats: finalStats, modEffects, dungeonId: bossId, runs, seed },
    dungeon,
    enemyMap
  );
  console.log(`${bossId}: ${(result.stats.winRate * 100).toFixed(1)}%`);
}
