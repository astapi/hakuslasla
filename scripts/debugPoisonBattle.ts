/**
 * 毒ビルドの戦闘詳細をデバッグ出力
 */

import {
  EnemyConfig,
  DungeonConfig,
  LEVEL_BASED_PRESETS,
  DUNGEON_EQUIPMENT_SETS,
  combineMods,
  calculateBaseStatsForLevel,
  DEFAULT_BATTLE_CONFIG,
  EquipmentSet,
} from '../core';
import { calculatePassiveEffects } from '../data/passiveTree';
import { calculateDamage } from '../core/battle';

// JSONファイルを直接読み込み
import monstersData from '../data/json/monsters.json';
import dungeonsData from '../data/json/dungeons.json';

// EnemyConfigのMapを作成
const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

// 装備からMOD情報を抽出
function extractEquipmentMods(equipSet: EquipmentSet) {
  const items = [equipSet.weapon, equipSet.armor, equipSet.gloves, equipSet.boots, equipSet.accessory];
  let totalAtk = 0;
  let totalDef = 0;

  for (const item of items) {
    if (item) {
      totalAtk += item.atk;
      totalDef += item.def;
    }
  }

  return { totalAtk, totalDef };
}

// プレイヤーステータスを計算
function createPlayerStats(level: number, equipSet: EquipmentSet, passiveNodes: string[]) {
  // 基本ステータス（レベル由来）
  const baseStats = calculateBaseStatsForLevel(level);

  // 装備ステータス
  const equipData = extractEquipmentMods(equipSet);

  // パッシブ効果
  const passiveEffects = calculatePassiveEffects(passiveNodes);

  // 合計（%増加を適用）
  let totalAtk = baseStats.atk + equipData.totalAtk + passiveEffects.atk;
  let totalDef = baseStats.def + equipData.totalDef + passiveEffects.def;
  let totalMaxHp = baseStats.maxHp + passiveEffects.hp;

  // increased%を適用
  totalAtk = Math.floor(totalAtk * (1 + passiveEffects.atk_increased_pct / 100));
  totalDef = Math.floor(totalDef * (1 + passiveEffects.def_increased_pct / 100));
  totalMaxHp = Math.floor(totalMaxHp * (1 + passiveEffects.hp_increased_pct / 100));

  // more%を適用
  for (const more of passiveEffects.atk_more_pct) {
    totalAtk = Math.floor(totalAtk * (1 + more / 100));
  }
  for (const more of passiveEffects.def_more_pct) {
    totalDef = Math.floor(totalDef * (1 + more / 100));
  }
  for (const more of passiveEffects.hp_more_pct) {
    totalMaxHp = Math.floor(totalMaxHp * (1 + more / 100));
  }

  // MOD効果を統合
  const equipmentItems = [equipSet.weapon, equipSet.armor, equipSet.gloves, equipSet.boots, equipSet.accessory]
    .map(item => item ? { mods: item.mods } : null);
  const modEffects = combineMods(equipmentItems, passiveEffects);

  return {
    stats: { maxHp: totalMaxHp, atk: totalAtk, def: totalDef },
    modEffects,
    passiveEffects,
  };
}

console.log('='.repeat(70));
console.log('毒ビルド戦闘詳細デバッグ');
console.log('='.repeat(70));
console.log('');

// 設定
const targetDungeonId = 'ruins'; // 忘却の遺跡（Lv.10）
const dungeon = (dungeonsData.dungeons as any)[targetDungeonId];
const previousDungeonId = 'cave';
const equipSets = DUNGEON_EQUIPMENT_SETS[previousDungeonId];
const level = 10;
const passiveLevel = 10;

console.log(`対象ダンジョン: ${dungeon.name} (推奨Lv.${dungeon.recommendedLevel})`);
console.log(`使用装備: ${previousDungeonId}の装備`);
console.log(`プレイヤーレベル: ${level}`);
console.log(`パッシブレベル: ${passiveLevel}`);
console.log(`毒ダメージ倍率: ${DEFAULT_BATTLE_CONFIG.poisonDamageRatio} (${DEFAULT_BATTLE_CONFIG.poisonDamageRatio * 100}%)`);
console.log('');

// 毒特化
const poisonPreset = LEVEL_BASED_PRESETS.POISON[passiveLevel];
const poisonPlayer = createPlayerStats(level, equipSets.sets.POISON, poisonPreset.nodes);

// 毒回復
const poisonRegenPreset = LEVEL_BASED_PRESETS.POISON_REGEN[passiveLevel];
const poisonRegenPlayer = createPlayerStats(level, equipSets.sets.POISON, poisonRegenPreset.nodes);

// 回復特化（比較用）
const regenPreset = LEVEL_BASED_PRESETS.REGEN[passiveLevel];
const regenPlayer = createPlayerStats(level, equipSets.sets.DEF, regenPreset.nodes);

// 敵情報（最初のモンスター）
const firstMonsterEntry = dungeon.monsters[0];
const firstMonster = enemyMap.get(firstMonsterEntry.monsterId)!;
const enemyHp = firstMonster.maxHp;
const enemyAtk = firstMonster.atk;
const enemyDef = firstMonster.def;

console.log('='.repeat(70));
console.log('【敵ステータス（最初のモンスター: ' + firstMonsterEntry.monsterId + '）】');
console.log('='.repeat(70));
console.log(`HP: ${enemyHp}`);
console.log(`ATK: ${enemyAtk}`);
console.log(`DEF: ${enemyDef}`);
console.log('');

// 各ビルドの詳細を出力
const builds = [
  { name: '毒特化', player: poisonPlayer, preset: poisonPreset },
  { name: '毒回復', player: poisonRegenPlayer, preset: poisonRegenPreset },
  { name: '回復特化', player: regenPlayer, preset: regenPreset },
];

for (const build of builds) {
  console.log('='.repeat(70));
  console.log(`【${build.name}】`);
  console.log('='.repeat(70));

  const { stats, modEffects, passiveEffects } = build.player;

  console.log('');
  console.log('▼ プレイヤーステータス');
  console.log(`  MaxHP: ${stats.maxHp}`);
  console.log(`  ATK: ${stats.atk}`);
  console.log(`  DEF: ${stats.def}`);

  console.log('');
  console.log('▼ MOD効果');
  console.log(`  毒付与率: ${modEffects.poisonChance}%`);
  console.log(`  毒ダメージ増加: ${modEffects.poisonDamagePct}%`);
  console.log(`  毒ダメージmore: ${modEffects.poisonDamageMorePct.join(', ') || 'なし'}`);
  console.log(`  毒スタック上限: ${DEFAULT_BATTLE_CONFIG.basePoisonMaxStacks + modEffects.poisonMaxStacks}`);
  console.log(`  通常ダメージ無効: ${modEffects.noDirectDamage}`);
  console.log(`  毒ダメージ吸収: ${modEffects.poisonLifesteal}%`);
  console.log(`  HP回復（固定）: ${modEffects.hpRegen}/秒`);
  console.log(`  HP回復（%）: ${modEffects.hpRegenPct}%/秒`);
  console.log(`  HIT時HP回復: ${modEffects.hpOnHit}`);
  console.log(`  ダメージ軽減: ${modEffects.damageReductionPct}%`);
  console.log(`  敵毒時の被ダメ軽減: ${modEffects.poisonDamageReduction}%`);

  console.log('');
  console.log('▼ 与ダメージ計算');
  const baseDamage = calculateDamage(stats.atk, enemyDef);
  const actualDamage = modEffects.noDirectDamage ? 0 : baseDamage;
  console.log(`  通常ダメージ: ${stats.atk} ATK vs ${enemyDef} DEF = ${baseDamage}ダメージ`);
  console.log(`  実際のダメージ: ${actualDamage}（noDirectDamage: ${modEffects.noDirectDamage}）`);

  console.log('');
  console.log('▼ 毒ダメージ計算');
  const rawPoisonDmg = Math.max(1, Math.floor(baseDamage * DEFAULT_BATTLE_CONFIG.poisonDamageRatio));
  const increasedPoisonDmg = rawPoisonDmg * (1 + modEffects.poisonDamagePct / 100);
  const totalMore = modEffects.poisonDamageMorePct.reduce((sum, m) => sum + m, 0);
  const finalPoisonDmg = Math.floor(increasedPoisonDmg * (1 + totalMore / 100));
  console.log(`  基礎毒ダメージ: ${baseDamage} × ${DEFAULT_BATTLE_CONFIG.poisonDamageRatio} = ${rawPoisonDmg}`);
  console.log(`  increased適用後: ${rawPoisonDmg} × (1 + ${modEffects.poisonDamagePct}%) = ${Math.floor(increasedPoisonDmg)}`);
  console.log(`  more適用後: ${Math.floor(increasedPoisonDmg)} × (1 + ${totalMore}%) = ${finalPoisonDmg}`);
  console.log(`  毒持続: ${DEFAULT_BATTLE_CONFIG.poisonDuration}ティック`);
  console.log(`  1スタック合計: ${finalPoisonDmg * DEFAULT_BATTLE_CONFIG.poisonDuration}ダメージ`);

  const maxStacks = DEFAULT_BATTLE_CONFIG.basePoisonMaxStacks + modEffects.poisonMaxStacks;
  console.log(`  最大スタック時: ${finalPoisonDmg * maxStacks}/ティック`);

  console.log('');
  console.log('▼ 被ダメージ計算');
  const playerDamageReduction = modEffects.damageReductionPct;
  const enemyDamageToPlayer = calculateDamage(enemyAtk, stats.def, playerDamageReduction);
  const enemyDamageWithPoisonReduction = calculateDamage(enemyAtk, stats.def, playerDamageReduction + modEffects.poisonDamageReduction);
  console.log(`  敵ATK ${enemyAtk} vs プレイヤーDEF ${stats.def} + 軽減${playerDamageReduction}% = ${enemyDamageToPlayer}ダメージ/攻撃`);
  console.log(`  敵が毒状態時: ${enemyDamageWithPoisonReduction}ダメージ/攻撃（軽減${playerDamageReduction + modEffects.poisonDamageReduction}%）`);

  console.log('');
  console.log('▼ 回復量');
  const hpRegenPerSec = modEffects.hpRegen + Math.floor(stats.maxHp * modEffects.hpRegenPct / 100);
  const hpOnHitAmount = modEffects.hpOnHit;  // 固定値
  const poisonLifestealPerTick = Math.floor(finalPoisonDmg * modEffects.poisonLifesteal / 100);
  console.log(`  HP回復/秒: ${modEffects.hpRegen} + ${stats.maxHp} × ${modEffects.hpRegenPct}% = ${hpRegenPerSec}`);
  console.log(`  HIT時HP回復/攻撃: ${hpOnHitAmount}（固定値）`);
  console.log(`  毒ダメージ吸収/ティック: ${finalPoisonDmg} × ${modEffects.poisonLifesteal}% = ${poisonLifestealPerTick}`);

  console.log('');
  console.log('▼ 敵を倒すのに必要な時間');
  const attacksNeeded = actualDamage > 0 ? Math.ceil(enemyHp / actualDamage) : Infinity;
  const poisonTotalDamagePerStack = finalPoisonDmg * DEFAULT_BATTLE_CONFIG.poisonDuration;
  const poisonOnlyStacks = Math.ceil(enemyHp / poisonTotalDamagePerStack);
  console.log(`  通常攻撃のみ: ${attacksNeeded === Infinity ? '不可能' : attacksNeeded + '回'}`);
  console.log(`  敵HP ${enemyHp} / 毒1スタック合計 ${poisonTotalDamagePerStack} = ${poisonOnlyStacks}スタック必要`);
  console.log(`  最大${maxStacks}スタック時: ${finalPoisonDmg * maxStacks}/ティック → ${Math.ceil(enemyHp / (finalPoisonDmg * maxStacks))}ティックで撃破`);

  console.log('');
  console.log('▼ 生存時間');
  const hitsToKillPlayer = Math.ceil(stats.maxHp / enemyDamageToPlayer);
  const netDamagePerSec = enemyDamageToPlayer - hpRegenPerSec;
  const survivalTime = netDamagePerSec > 0 ? Math.ceil(stats.maxHp / netDamagePerSec) : Infinity;
  console.log(`  被ダメ ${enemyDamageToPlayer}/秒 - 回復 ${hpRegenPerSec}/秒 = 実質 ${netDamagePerSec}/秒`);
  console.log(`  回復なし: ${hitsToKillPlayer}秒で死亡`);
  console.log(`  回復あり: ${survivalTime === Infinity ? '無限（回復 >= 被ダメ）' : survivalTime + '秒で死亡'}`);

  console.log('');
}

// 総評
console.log('='.repeat(70));
console.log('【総評】');
console.log('='.repeat(70));
console.log('');
console.log('毒特化の問題点:');
console.log('1. noDirectDamage=trueで通常ダメージが0になる');
console.log('2. ライフスティールも0ダメージなので発動しない');
console.log('3. HP回復手段がパッシブのHP回復のみ');
console.log('4. 毒を付与している間に受けるダメージを回復できない');
console.log('');
console.log('毒回復の改善点:');
console.log('1. HP回復パッシブで継続的に回復');
console.log('2. 毒付与率は確保（poison_key1まで）');
console.log('3. noDirectDamage=falseなので通常ダメージも出る');
