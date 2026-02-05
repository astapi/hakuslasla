/**
 * uber_true_final_boss戦闘ログ分析
 *
 * 双撃の指輪ビルドで何が起きているのか詳細分析
 */

import { runGaugeSimulation } from '../core/simulation';
import { calculateBaseStatsForLevel } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects } from '../data/passiveTree';
import { EnemyConfig, DungeonConfig, Stats, CombinedModEffects } from '../core/types';

import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

const level = 60;
const bossId = 'uber_true_final_boss';

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

const dungeon = (dungeonsData as any).dungeons[bossId];
const dungeonConfig = toDungeonConfig(dungeon);

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
    instanceId: `analyze_${id}_${itemCounter++}`,
    mods,
  };
}

const passiveNodes = [
  'start',
  'vamp_1', 'vamp_2', 'vamp_3', 'vamp_4', 'vamp_5',
  'vamp_6', 'vamp_7', 'vamp_key1', 'vamp_8', 'vamp_9',
  'vamp_10', 'vamp_11', 'vamp_12', 'vamp_13', 'vamp_a1',
  'vamp_a2', 'vamp_b1', 'vamp_b2', 'vamp_14', 'vamp_15',
  'guard_1', 'guard_2', 'guard_3', 'guard_4', 'guard_5',
  'guard_6', 'guard_7', 'guard_key1', 'guard_8', 'guard_9',
  'guard_10', 'guard_11', 'guard_12', 'guard_13', 'guard_a1',
  'guard_a2', 'guard_b1', 'guard_b2', 'guard_14', 'guard_15',
  'speed_1', 'speed_2', 'speed_3', 'speed_4', 'speed_5',
  'speed_6', 'speed_key1', 'speed_7', 'speed_8', 'speed_9',
  'speed_10', 'speed_11', 'speed_12', 'speed_13',
  'regen_1', 'regen_2', 'regen_3', 'regen_4', 'regen_5',
];

const equipment: Equipment = {
  weapon: createUberItem('uber_vampire_fang', 'Uber ヴァンパイアの牙', 'weapon', 140, 0, [
    { type: 'hp_on_hit', value: 120, tier: 0 },
    { type: 'critical_chance', value: 30, tier: 0 },
    { type: 'attack_speed_pct', value: 20, tier: 0 },
  ]),
  armor: createUberItem('uber_fortress_plate', 'Uber 要塞の鎧', 'armor', 0, 340, [
    { type: 'def_bonus', value: 90, tier: 0 },
    { type: 'damage_reduction_pct', value: 18, tier: 0 },
    { type: 'def_increased_pct', value: 30, tier: 0 },
    { type: 'hp_bonus', value: 300, tier: 0 },
  ]),
  gloves: createUberItem('uber_vampire_grip', 'Uber ヴァンパイアの篭手', 'gloves', 65, 80, [
    { type: 'critical_chance', value: 20, tier: 0 },
    { type: 'hp_on_hit', value: 40, tier: 0 },
    { type: 'atk_increased_pct', value: 22, tier: 0 },
    { type: 'hp_bonus', value: 200, tier: 0 },
  ]),
  boots: createUberItem('uber_bandit_steps', 'Uber 盗賊王の足運び', 'boots', 45, 100, [
    { type: 'attack_speed_pct', value: 20, tier: 0 },
    { type: 'critical_chance', value: 18, tier: 0 },
    { type: 'def_increased_pct', value: 12, tier: 0 },
  ]),
  accessory: createUberItem('uber_double_strike_ring', 'Uber 双撃の指輪', 'accessory', 95, 70, [
    { type: 'critical_chance', value: 30, tier: 0 },
    { type: 'critical_follow_up_attack', value: 1, tier: 0 },
    { type: 'hp_on_hit', value: 80, tier: 0 },
    { type: 'attack_speed_pct', value: 15, tier: 0 },
  ]),
};

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

console.log('='.repeat(80));
console.log('uber_true_final_boss 戦闘ログ分析');
console.log('='.repeat(80));
console.log('');

const { finalStats, modEffects } = calculateFinalStats(level, equipment, passiveNodes);

console.log('【プレイヤーステータス】');
console.log(`  HP: ${finalStats.maxHp}`);
console.log(`  ATK: ${finalStats.atk}`);
console.log(`  DEF: ${finalStats.def}`);
console.log(`  HIT時HP回復: ${modEffects.hpOnHit} (クリ時: ${modEffects.hpOnHit * 2})`);
console.log(`  クリティカル率: ${modEffects.criticalChance}%`);
console.log(`  攻撃速度: +${modEffects.attackSpeedPct}%`);
console.log(`  ダメージ軽減: ${modEffects.damageReductionPct}%`);
console.log('');

const boss = enemyMap.get(bossId);
if (boss) {
  console.log('【ボスステータス】');
  console.log(`  HP: ${boss.maxHp}`);
  console.log(`  ATK: ${boss.atk}`);
  console.log(`  DEF: ${boss.def}`);
  console.log(`  攻撃速度: ${boss.attackSpeed}`);
  console.log('');

  // ダメージ計算
  const defReduction = boss.def / (boss.def + 500);
  const playerBaseDmg = Math.floor(finalStats.atk * (1 - defReduction));
  const playerCritDmg = Math.floor(playerBaseDmg * 3.0);
  const playerFollowUpDmg = Math.floor((finalStats.atk * 0.5) * (1 - defReduction));
  const playerTotalCritDmg = playerCritDmg + playerFollowUpDmg;

  const enemyDefReduction = finalStats.def / (finalStats.def + 500);
  const enemyBaseDmg = Math.floor(boss.atk * (1 - enemyDefReduction));
  const enemyFinalDmg = Math.floor(enemyBaseDmg * (1 - modEffects.damageReductionPct / 100));

  console.log('【ダメージ計算】');
  console.log(`プレイヤー → ボス:`);
  console.log(`  通常攻撃: ${playerBaseDmg}`);
  console.log(`  クリティカル: ${playerCritDmg} + 追撃 ${playerFollowUpDmg} = ${playerTotalCritDmg}`);
  console.log(`  クリ率${modEffects.criticalChance}%での期待値: ${Math.floor(playerTotalCritDmg * 0.98 + playerBaseDmg * 0.02)}`);
  console.log('');
  console.log(`ボス → プレイヤー:`);
  console.log(`  DEF軽減前: ${boss.atk} → ${enemyBaseDmg} (DEF軽減 ${(enemyDefReduction * 100).toFixed(1)}%)`);
  console.log(`  最終ダメージ: ${enemyFinalDmg} (ダメ軽減${modEffects.damageReductionPct}%)`);
  console.log(`  致死攻撃回数: ${Math.ceil(finalStats.maxHp / enemyFinalDmg)}回`);
  console.log('');
}

console.log('【シミュレーション実行（10回）】');
console.log('');

for (let i = 0; i < 10; i++) {
  const result = runGaugeSimulation(
    {
      playerStats: finalStats,
      modEffects,
      dungeonId: bossId,
      runs: 1,
      seed: 12345 + i
    },
    dungeonConfig,
    enemyMap
  );

  if (!result.results || result.results.length === 0) {
    console.log(`戦闘 ${i + 1}: データなし`);
    continue;
  }

  const dungeonResult = result.results[0];
  // ボス戦は最後のフロア
  const bossFloor = dungeonResult.floorResults[dungeonResult.floorResults.length - 1];
  if (!bossFloor || !bossFloor.battle) {
    console.log(`戦闘 ${i + 1}: ボス戦データなし`);
    continue;
  }
  const battle = bossFloor.battle;
  console.log(`--- 戦闘 ${i + 1} ---`);
  console.log(`結果: ${battle.victory ? '勝利' : '敗北'}`);
  console.log(`経過時間: ${(battle.totalTicks / 30).toFixed(2)}秒 (${battle.totalTicks} ticks)`);
  console.log(`プレイヤー最終HP: ${battle.playerHpRemaining} / ${finalStats.maxHp}`);
  console.log(`ボス最終HP: ${battle.victory ? 0 : '生存'} / ${boss?.maxHp}`);

  // イベントログから重要な情報を抽出
  const playerAttacks = battle.events.filter(e => e.type === 'player_attack' || e.type === 'critical_hit');
  const enemyAttacks = battle.events.filter(e => e.type === 'enemy_attack');
  const playerHeals = battle.events.filter(e => e.type === 'player_heal');

  let totalPlayerDamage = 0;
  let totalEnemyDamage = 0;
  let totalHeal = 0;

  for (const evt of battle.events) {
    if (evt.type === 'player_attack' || evt.type === 'critical_hit') {
      totalPlayerDamage += (evt.data as any).damage || 0;
    }
    if (evt.type === 'enemy_attack') {
      totalEnemyDamage += (evt.data as any).damage || 0;
    }
    if (evt.type === 'player_heal') {
      totalHeal += (evt.data as any).amount || 0;
    }
  }

  console.log(`プレイヤー攻撃回数: ${playerAttacks.length}`);
  console.log(`ボス攻撃回数: ${enemyAttacks.length}`);
  console.log(`プレイヤー総ダメージ: ${totalPlayerDamage}`);
  console.log(`ボス総ダメージ: ${totalEnemyDamage}`);
  console.log(`プレイヤー総回復: ${totalHeal}`);
  console.log(`実質被ダメージ: ${totalEnemyDamage - totalHeal}`);

  if (!battle.victory && battle.totalTicks > 0) {
    // 敗北時の詳細分析
    const firstFewSeconds = battle.events.filter(e => e.tick <= 90); // 最初の3秒
    const playerDmgFirst3s = firstFewSeconds.filter(e => e.type === 'player_attack' || e.type === 'critical_hit').length;
    const enemyDmgFirst3s = firstFewSeconds.filter(e => e.type === 'enemy_attack').length;
    console.log(`最初の3秒: プレイヤー攻撃${playerDmgFirst3s}回 / ボス攻撃${enemyDmgFirst3s}回`);
  }

  console.log('');
}

console.log('='.repeat(80));
console.log('分析完了');
console.log('='.repeat(80));
