/**
 * MOD効果統合ロジック
 * 装備MODとパッシブ効果を統合して戦闘用ステータスを生成
 */

import { CombinedModEffects } from './types';

// ========================================
// 型定義（外部データ用）
// ========================================

/**
 * アイテムMOD（簡易版、types/index.tsのItemModと互換）
 */
export interface ItemModData {
  type: string;
  value: number;
}

/**
 * 装備アイテム（簡易版）
 */
export interface EquipmentItemData {
  mods?: ItemModData[];
}

/**
 * パッシブ効果計算結果（data/passiveTree.tsのcalculatePassiveEffectsの戻り値と互換）
 */
export interface PassiveEffectsData {
  hp: number;
  atk: number;
  def: number;
  hp_increased_pct: number;
  atk_increased_pct: number;
  def_increased_pct: number;
  hp_more_pct: number[];
  atk_more_pct: number[];
  def_more_pct: number[];
  poison_chance: number;
  poison_damage_pct: number;
  poison_damage_more_pct: number[];
  poison_max_stacks: number;
  poison_damage_reduction: number;
  poison_lifesteal: number;
  no_direct_damage: boolean;
  // 発火系
  ignite_chance: number;
  ignite_damage_pct: number;
  ignite_damage_more_pct: number[];
  ignite_duration_pct: number;
  ignite_lifesteal: number;
  ignite_spread: boolean;
  ignite_stacking_damage: boolean; // 緩慢なる炎キーストーン
  // その他
  critical_chance: number;
  critical_damage: number;
  hp_on_crit: number;
  critical_lifesteal_pct: number;
  hp_regen: number;
  hp_regen_pct: number;
  damage_reduction_pct: number;
  hp_on_hit: number;
  retaliate_def_pct: number;
  attack_speed_pct: number;
  attack_speed_more_pct: number[];
  // チル系
  chill_chance: number;
  chill_effect_pct: number;
  chill_duration_pct: number;
  // フリーズ系
  freeze_chance: number;
  freeze_duration_pct: number;
}

// ========================================
// 空のMOD効果
// ========================================

/**
 * 空のCombinedModEffectsを作成
 */
export function createEmptyModEffects(): CombinedModEffects {
  return {
    hpRegen: 0,
    hpRegenPct: 0,
    poisonChance: 0,
    poisonDamagePct: 0,
    poisonDamageMorePct: [],
    poisonMaxStacks: 0,
    poisonDamageReduction: 0,
    poisonLifesteal: 0,
    noDirectDamage: false,
    igniteChance: 0,
    igniteDamagePct: 0,
    igniteDamageMorePct: [],
    igniteDurationPct: 0,
    igniteTickSpeedPct: 0,
    igniteLifesteal: 0,
    igniteSpread: false,
    igniteStackingDamage: false,
    criticalChance: 0,
    criticalDamage: 0,
    hpOnCrit: 0,
    critLifestealPct: 0,
    criticalFollowUpAttack: false,
    damageReductionPct: 0,
    hpOnHit: 0,
    retaliateDefPct: 0,
    hpRegenToAtkPct: 0,
    attackSpeedPct: 0,
    attackSpeedMorePct: [],
    chillChance: 0,
    chillEffectPct: 0,
    chillDurationPct: 0,
    freezeChance: 0,
    freezeDurationPct: 0,
    timeAtkIncPct: 0,
    timeDefIncPct: 0,
    timeHpRegen: 0,
    warlordEnrage: false,
    heavyStrike: false,
    defHpToAtk: false,
    uberCriticalFollowUp: false,
    poisonMultiStack: 1,
    igniteIntensify: false,
    chillFreezeDamageMult: 1,
  };
}

// ========================================
// MOD効果統合
// ========================================

/**
 * 装備MODをCombinedModEffectsに加算
 */
function applyEquipmentMod(effects: CombinedModEffects, mod: ItemModData): void {
  switch (mod.type) {
    case 'hp_regen':
      effects.hpRegen += mod.value;
      break;
    case 'hp_regen_pct':
      effects.hpRegenPct += mod.value;
      break;
    case 'poison_chance':
      effects.poisonChance += mod.value;
      break;
    case 'poison_damage_pct':
      effects.poisonDamagePct += mod.value;
      break;
    case 'poison_damage_more_pct':
      effects.poisonDamageMorePct.push(mod.value);
      break;
    case 'poison_max_stacks':
      effects.poisonMaxStacks += mod.value;
      break;
    case 'poison_damage_reduction':
      effects.poisonDamageReduction += mod.value;
      break;
    case 'poison_lifesteal':
      effects.poisonLifesteal += mod.value;
      break;
    case 'ignite_chance':
      effects.igniteChance += mod.value;
      break;
    case 'ignite_damage_pct':
      effects.igniteDamagePct += mod.value;
      break;
    case 'ignite_duration_pct':
      effects.igniteDurationPct += mod.value;
      break;
    case 'ignite_tick_speed_pct':
      effects.igniteTickSpeedPct += mod.value;
      break;
    case 'ignite_lifesteal':
      effects.igniteLifesteal += mod.value;
      break;
    case 'critical_chance':
      effects.criticalChance += mod.value;
      break;
    case 'critical_damage':
      effects.criticalDamage += mod.value;
      break;
    case 'hp_on_crit':
      effects.hpOnCrit += mod.value;
      break;
    case 'critical_follow_up_attack':
      effects.criticalFollowUpAttack = true;
      break;
    case 'damage_reduction_pct':
      effects.damageReductionPct += mod.value;
      break;
    case 'hp_on_hit':
      effects.hpOnHit += mod.value;
      break;
    case 'attack_speed_pct':
      effects.attackSpeedPct += mod.value;
      break;
    case 'attack_speed_more_pct':
      effects.attackSpeedMorePct.push(mod.value);
      break;
    case 'time_atk_inc_pct':
      effects.timeAtkIncPct += mod.value;
      break;
    case 'time_def_inc_pct':
      effects.timeDefIncPct += mod.value;
      break;
    case 'time_hp_regen':
      effects.timeHpRegen += mod.value;
      break;
    case 'hp_regen_to_atk_pct':
      effects.hpRegenToAtkPct += mod.value;
      break;
    case 'warlord_enrage':
      effects.warlordEnrage = true;
      break;
    case 'chill_chance':
      effects.chillChance += mod.value;
      break;
    case 'chill_effect_pct':
      effects.chillEffectPct += mod.value;
      break;
    case 'chill_duration_pct':
      effects.chillDurationPct += mod.value;
      break;
    case 'freeze_chance':
      effects.freezeChance += mod.value;
      break;
    case 'freeze_duration_pct':
      effects.freezeDurationPct += mod.value;
      break;
  }
}

/**
 * 装備 + パッシブからMOD効果を統合
 * @param equipment 装備アイテム配列（nullを含む可能性あり）
 * @param passiveEffects パッシブツリー効果（calculatePassiveEffectsの戻り値）
 * @returns 統合されたMOD効果
 */
export function combineMods(
  equipment: (EquipmentItemData | null)[],
  passiveEffects: PassiveEffectsData
): CombinedModEffects {
  const combined = createEmptyModEffects();

  // 装備MODからの効果
  for (const item of equipment) {
    if (item && item.mods) {
      for (const mod of item.mods) {
        applyEquipmentMod(combined, mod);
      }
    }
  }

  // パッシブツリーからの効果を加算
  combined.hpRegen += passiveEffects.hp_regen;
  combined.hpRegenPct += passiveEffects.hp_regen_pct;
  combined.poisonChance += passiveEffects.poison_chance;
  combined.poisonDamagePct += passiveEffects.poison_damage_pct;
  combined.poisonDamageMorePct.push(...passiveEffects.poison_damage_more_pct);
  combined.poisonMaxStacks += passiveEffects.poison_max_stacks;
  combined.poisonDamageReduction += passiveEffects.poison_damage_reduction;
  combined.poisonLifesteal += passiveEffects.poison_lifesteal;
  combined.noDirectDamage = passiveEffects.no_direct_damage;
  // 発火系
  combined.igniteChance += passiveEffects.ignite_chance;
  combined.igniteDamagePct += passiveEffects.ignite_damage_pct;
  combined.igniteDamageMorePct.push(...passiveEffects.ignite_damage_more_pct);
  combined.igniteDurationPct += passiveEffects.ignite_duration_pct;
  combined.igniteLifesteal += passiveEffects.ignite_lifesteal;
  if (passiveEffects.ignite_spread) combined.igniteSpread = true;
  if (passiveEffects.ignite_stacking_damage) combined.igniteStackingDamage = true;
  // その他
  combined.criticalChance += passiveEffects.critical_chance;
  combined.criticalDamage += passiveEffects.critical_damage;
  combined.hpOnCrit += passiveEffects.hp_on_crit;
  combined.critLifestealPct += passiveEffects.critical_lifesteal_pct;
  combined.damageReductionPct += passiveEffects.damage_reduction_pct;
  combined.hpOnHit += passiveEffects.hp_on_hit;
  combined.retaliateDefPct += passiveEffects.retaliate_def_pct;
  combined.attackSpeedPct += passiveEffects.attack_speed_pct;
  combined.attackSpeedMorePct.push(...passiveEffects.attack_speed_more_pct);
  // チル系
  combined.chillChance += passiveEffects.chill_chance;
  combined.chillEffectPct += passiveEffects.chill_effect_pct;
  combined.chillDurationPct += passiveEffects.chill_duration_pct;
  // フリーズ系
  combined.freezeChance += passiveEffects.freeze_chance;
  combined.freezeDurationPct += passiveEffects.freeze_duration_pct;

  return combined;
}

// ========================================
// 攻撃速度計算
// ========================================

/**
 * 攻撃速度を計算（PoE式）
 * base × (1 + total_increased%) × (1 + total_more%)
 * ※more%は加算して合計
 *
 * @param baseAS 基本攻撃速度（通常1.0）
 * @param increasedPct increased%の合計
 * @param moreMultipliers more%の配列
 * @returns 最終攻撃速度
 */
export function calculateAttackSpeed(
  baseAS: number,
  increasedPct: number,
  moreMultipliers: number[]
): number {
  // Step 1: base × (1 + total_increased%)
  let result = baseAS * (1 + increasedPct / 100);

  // Step 2: × (1 + total_more%) ※more%も加算
  const totalMore = moreMultipliers.reduce((sum, more) => sum + more, 0);
  result = result * (1 + totalMore / 100);

  // 攻撃速度の最低値を保証（0以下にならないように）
  return Math.max(0.1, result);
}

/**
 * CombinedModEffectsから攻撃速度を計算
 */
export function getAttackSpeedFromMods(mods: CombinedModEffects, baseAS: number = 1.0): number {
  return calculateAttackSpeed(baseAS, mods.attackSpeedPct, mods.attackSpeedMorePct);
}

// ========================================
// 毒ダメージ計算
// ========================================

/**
 * 毒ダメージを計算（PoE式）
 * base × (1 + total_increased%) × (1 + total_more%)
 *
 * @param baseDamage 基本毒ダメージ
 * @param increasedPct increased%の合計
 * @param moreMultipliers more%の配列
 * @returns 最終毒ダメージ
 */
export function calculatePoisonDamage(
  baseDamage: number,
  increasedPct: number,
  moreMultipliers: number[]
): number {
  // Step 1: base × (1 + total_increased%)
  let damage = baseDamage * (1 + increasedPct / 100);

  // Step 2: × (1 + total_more%)
  const totalMore = moreMultipliers.reduce((sum, more) => sum + more, 0);
  damage = damage * (1 + totalMore / 100);

  return Math.floor(damage);
}

/**
 * CombinedModEffectsから毒ダメージを計算
 */
export function getPoisonDamageFromMods(baseDamage: number, mods: CombinedModEffects): number {
  return calculatePoisonDamage(baseDamage, mods.poisonDamagePct, mods.poisonDamageMorePct);
}

// ========================================
// 発火ダメージ計算
// ========================================

/**
 * 発火ダメージを計算（PoE式）
 * base × (1 + total_increased%) × (1 + total_more%)
 *
 * @param baseDamage 基本発火ダメージ
 * @param increasedPct increased%の合計
 * @param moreMultipliers more%の配列
 * @returns 最終発火ダメージ
 */
export function calculateIgniteDamage(
  baseDamage: number,
  increasedPct: number,
  moreMultipliers: number[] = []
): number {
  // Step 1: base × (1 + total_increased%)
  let damage = baseDamage * (1 + increasedPct / 100);

  // Step 2: × (1 + total_more%)
  const totalMore = moreMultipliers.reduce((sum, more) => sum + more, 0);
  damage = damage * (1 + totalMore / 100);

  return Math.floor(damage);
}

/**
 * CombinedModEffectsから発火ダメージを計算
 * @param baseDamage 基本発火ダメージ
 * @param mods MOD効果
 * @param igniteApplyCount 発火付与回数（緩慢なる炎キーストーン用）
 */
export function getIgniteDamageFromMods(
  baseDamage: number,
  mods: CombinedModEffects,
  igniteApplyCount: number = 0
): number {
  // 緩慢なる炎: 発火付与5回ごとに+10% inc発火ダメージ（最大200%）
  let stackingBonus = 0;
  if (mods.igniteStackingDamage) {
    const stacks = Math.floor(igniteApplyCount / 5);
    stackingBonus = Math.min(stacks * 10, 200);
  }

  const totalIncreasedPct = mods.igniteDamagePct + stackingBonus;
  return calculateIgniteDamage(baseDamage, totalIncreasedPct, mods.igniteDamageMorePct);
}
