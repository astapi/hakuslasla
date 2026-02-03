/**
 * 固定ビルドの戦闘ログ分析
 *
 * 使用方法:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json node --import tsx scripts/analyzeBattleLog.ts [seed]
 */

import { runGaugeBattle } from '../core/gaugeBattle';
import { calculateBaseStatsForLevel } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects } from '../data/passiveTree';
import { EnemyConfig } from '../core/types';
import { createRng } from '../core/simulation';
import monstersData from '../data/json/monsters.json';
import { DEFAULT_BATTLE_CONFIG } from '../core/types';

const args = process.argv.slice(2);
const seed = args[0] ? parseInt(args[0], 10) : 12345;

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries((monstersData as any).monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
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

const enemyId = 'uber_goblin_king';
const enemy = enemyMap.get(enemyId);
if (!enemy) {
  console.error('敵が見つかりません');
  process.exit(1);
}

const { finalStats, modEffects } = calculateFinalStats(build.level, build.equipment, build.unlockedSkills);
const rng = createRng(seed);
const result = runGaugeBattle(finalStats, finalStats.maxHp, modEffects, enemy, DEFAULT_BATTLE_CONFIG, rng, enemyId);

const ticksPerSecond = DEFAULT_BATTLE_CONFIG.ticksPerSecond;
const durationSeconds = result.totalTicks / ticksPerSecond;
const defeatTick = result.events.find((e) => e.type === 'player_defeated')?.tick ?? result.totalTicks;
const timeStacks = Math.floor(defeatTick / (ticksPerSecond * 5));
const defReduction = finalStats.def / (finalStats.def + 500);
const totalReduction = Math.min(0.99, defReduction + modEffects.damageReductionPct / 100);

let playerDirect = 0;
let playerPoison = 0;
let enemyHeal = 0;
let playerHeal = 0;
let enemyDamage = 0;
let playerPoisonDamage = 0;
let playerDamage = 0;

for (const e of result.events) {
  if (e.type === 'player_attack' || e.type === 'critical_hit') {
    playerDirect += Number(e.data.damage ?? 0);
  } else if (e.type === 'poison_damage') {
    playerPoison += Number(e.data.damage ?? 0);
  } else if (e.type === 'enemy_heal') {
    enemyHeal += Number(e.data.amount ?? 0);
  } else if (e.type === 'hp_regen' || e.type === 'lifesteal') {
    playerHeal += Number(e.data.amount ?? 0);
  } else if (e.type === 'enemy_attack') {
    enemyDamage += Number(e.data.damage ?? 0);
  } else if (e.type === 'player_poison_damage') {
    playerPoisonDamage += Number(e.data.damage ?? 0);
  } else if (e.type === 'player_damage') {
    playerDamage += Number(e.data.damage ?? 0);
  }
}

const totalPlayerDamage = playerDirect + playerPoison;
const totalEnemyDamage = enemyDamage + playerPoisonDamage + playerDamage;

console.log('戦闘ログ分析');
console.log(`seed=${seed}`);
console.log(`enemy=${enemyId}`);
console.log(`victory=${result.victory}`);
console.log(`duration=${durationSeconds.toFixed(2)}s`);
console.log(`time_atk_stacks=${timeStacks}`);
console.log(`player_def=${finalStats.def}`);
console.log(`damage_reduction_from_def=${(defReduction * 100).toFixed(1)}%`);
console.log(`damage_reduction_mod=${modEffects.damageReductionPct.toFixed(1)}%`);
console.log(`damage_reduction_total=${(totalReduction * 100).toFixed(1)}%`);
console.log('');
console.log('--- 与ダメ/回復 ---');
console.log(`player_damage_direct=${playerDirect}`);
console.log(`player_damage_poison=${playerPoison}`);
console.log(`player_damage_total=${totalPlayerDamage}`);
console.log(`enemy_heal_total=${enemyHeal}`);
console.log(`player_heal_total=${playerHeal}`);
console.log('');
console.log('--- 被ダメ ---');
console.log(`enemy_damage=${enemyDamage}`);
console.log(`player_poison_damage=${playerPoisonDamage}`);
console.log(`player_misc_damage=${playerDamage}`);
console.log(`player_damage_total=${totalEnemyDamage}`);

const lastEvents = result.events.slice(-8).map((e) => ({
  type: e.type,
  tick: e.tick,
  data: e.data,
}));
console.log('');
console.log('--- 直近イベント(最後の8件) ---');
console.log(JSON.stringify(lastEvents, null, 2));

console.log('');
console.log('--- 全イベント ---');
console.log(JSON.stringify(result.events, null, 2));
