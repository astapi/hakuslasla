import { Item, ItemBase, ItemMod, ItemDrop, DungeonDropTable, ModConfig, ModTierRange, ModCountRange, EquipmentSlot, WeaponType, ModType } from '@/types';
import itemsData from './json/items.json';
import dungeonsData from './json/dungeons.json';
import modsData from './json/mods.json';
import { TIER_FILTER_SETTINGS } from '@/constants/purchases';
import { hasTierFilter } from '@/stores/usePurchaseStore';

// アイテム基本データ（_commentキーを除外）
// 武器にはデフォルトでweaponType: "sword"を設定
const itemBases: Record<string, ItemBase> = {};
for (const [id, item] of Object.entries(itemsData.items)) {
  if (!id.startsWith('_comment')) {
    const base = item as ItemBase;
    // 武器でweaponTypeがない場合はデフォルトで"sword"
    if (base.slot === 'weapon' && !base.weaponType) {
      base.weaponType = 'sword';
    }
    itemBases[id] = base;
  }
}

// MOD設定
const modConfigs: ModConfig[] = modsData.modConfigs as ModConfig[];

// ダンジョンデータからmodTierRangeを取得するヘルパー
function getDungeonModTierRange(dungeonId: string): ModTierRange | undefined {
  const dungeon = (dungeonsData.dungeons as Record<string, { modTierRange?: ModTierRange }>)[dungeonId];
  return dungeon?.modTierRange;
}

// ダンジョンデータからmodCountRangeを取得するヘルパー
function getDungeonModCountRange(dungeonId: string): ModCountRange | undefined {
  const dungeon = (dungeonsData.dungeons as Record<string, { modCountRange?: ModCountRange }>)[dungeonId];
  return dungeon?.modCountRange;
}

/**
 * 指定されたtierの値範囲からランダムに値を取得
 */
function calculateValueFromTierRange(min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * MOD設定から利用可能なtierリストを取得
 * @param config MOD設定
 * @param slot アイテムスロット（スロット別tier設定がある場合に使用）
 */
function getAvailableTiers(config: ModConfig, slot?: EquipmentSlot): number[] {
  // スロット別tier設定があればそちらを使用
  const tiers = (slot && config.slotTiers?.[slot]) || config.tiers;
  return Object.keys(tiers).map(t => parseInt(t, 10));
}

/**
 * スロットに応じたtier設定を取得
 */
function getTiersForSlot(config: ModConfig, slot?: EquipmentSlot): Record<string, { min: number; max: number }> {
  return (slot && config.slotTiers?.[slot]) || config.tiers;
}

/**
 * Tierのウェイトを取得
 * @param tier Tier値（1-10、小さいほど高品質）
 * @param boosted ブースト状態かどうか
 * @returns ウェイト値（大きいほど出やすい）
 */
function getTierWeight(tier: number, boosted: boolean = false): number {
  if (boosted) {
    // ブースト時：1段階シフト方式（通常時の1つ上のTierのウェイトを適用）
    // T1は約2倍程度の控えめなブースト
    switch (tier) {
      case 1: return 4;   // =通常T2（約2倍）
      case 2: return 8;   // =通常T3（約2倍）
      case 3: return 20;  // =通常T4（約2.5倍）
      case 4: return 20;  // =通常T5（変化なし）
      case 5: return 18;  // =通常T6（やや減少）
      case 6: return 15;  // =通常T7
      case 7: return 12;  // =通常T8
      case 8: return 8;   // =通常T9
      case 9: return 5;   // =通常T10
      case 10: return 1;  // 最低
      default: return 12;
    }
  } else {
    // 通常時：T4,5がやや出やすいが、緩やかな分布
    switch (tier) {
      case 1: return 2;   // 最も出にくい
      case 2: return 4;
      case 3: return 8;
      case 4: return 20;  // やや出やすい
      case 5: return 20;  // やや出やすい
      case 6: return 18;
      case 7: return 15;
      case 8: return 12;
      case 9: return 8;
      case 10: return 5;
      default: return 12;
    }
  }
}

/**
 * 指定されたtier範囲内でランダムにtierを選択（ウェイト付き確率）
 * @param minTier 最低tier（数値が大きい方、例: 10）
 * @param maxTier 最高tier（数値が小さい方、例: 7）
 * @param boosted ブースト状態かどうか
 */
function rollTier(minTier: number, maxTier: number, boosted: boolean = false): number {
  // minTier >= maxTier (数値的に)
  // 例: minTier=10, maxTier=7 → 7, 8, 9, 10からウェイト付き確率で選択
  const tiers: number[] = [];
  for (let t = maxTier; t <= minTier; t++) {
    tiers.push(t);
  }

  // 各Tierのウェイトを計算
  const weights = tiers.map(t => getTierWeight(t, boosted));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // ウェイト付きランダム選択
  let random = Math.random() * totalWeight;
  for (let i = 0; i < tiers.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return tiers[i];
    }
  }

  // フォールバック
  return tiers[0];
}

/**
 * tierの表示名を取得
 */
export function getTierDisplayName(tier: number): string {
  return `T${tier}`;
}

/**
 * MODの値からTierを逆算
 * @param modType MODタイプ
 * @param value 値
 * @returns 該当するTier（見つからない場合は10）
 */
export function calculateTierFromValue(modType: string, value: number): number {
  const config = modConfigs.find(c => c.type === modType);
  if (!config) return 10;

  // 各tierの範囲をチェックして該当するものを返す
  for (const [tierStr, range] of Object.entries(config.tiers)) {
    const tier = parseInt(tierStr, 10);
    if (value >= range.min && value <= range.max) {
      return tier;
    }
  }

  // 見つからない場合は最も近いtierを返す
  const tiers = Object.entries(config.tiers).map(([t, r]) => ({
    tier: parseInt(t, 10),
    min: r.min,
    max: r.max,
  }));

  // 値より小さい最大のmax、または値より大きい最小のminを持つtierを探す
  for (const t of tiers.sort((a, b) => a.tier - b.tier)) {
    if (value <= t.max) return t.tier;
  }

  return 10; // デフォルト
}

/**
 * tierに応じた色を取得
 */
export function getTierColor(tier: number): string {
  if (tier <= 2) return '#FFD700';      // 金色（T1-T2）
  if (tier <= 4) return '#9370DB';      // 紫（T3-T4）
  if (tier <= 6) return '#4169E1';      // 青（T5-T6）
  if (tier <= 8) return '#32CD32';      // 緑（T7-T8）
  return '#AAAAAA';                      // 灰色（T9-T10）
}

/**
 * 1戦闘あたりのドロップ設定
 */
export const DROP_CONFIG = {
  // ドロップ数ごとの確率（%）- 上から順に判定
  dropChances: [
    { count: 3, chance: 2 },   // 3個ドロップ: 2%
    { count: 2, chance: 8 },   // 2個ドロップ: 8%
    { count: 1, chance: 20 },  // 1個ドロップ: 20%
    // 残り70%はドロップなし
  ],
};

/**
 * ドロップ数を決定（0〜3個）
 * @param dropRateMultiplier ドロップ率の倍率（広告ブースト用、デフォルト1.0）
 */
export function rollDropCount(dropRateMultiplier: number = 1.0): number {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const { count, chance } of DROP_CONFIG.dropChances) {
    // ブースト適用: 確率を倍率で増加
    const adjustedChance = chance * dropRateMultiplier;
    cumulative += adjustedChance;
    if (roll < cumulative) {
      return count;
    }
  }

  return 0; // ドロップなし
}

/**
 * ドロップテーブルから指定数のアイテムをランダム選択
 * @param dropTable ダンジョンドロップテーブル
 * @param count ドロップ数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param boosted Tierブースト状態（広告ブースト用、デフォルトfalse）
 */
export function rollDropItems(dropTable: DungeonDropTable, count: number, dungeonId?: string, boosted: boolean = false): Item[] {
  if (count <= 0) return [];

  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const totalWeight = allDrops.reduce((sum, drop) => sum + drop.dropRate, 0);
  const items: Item[] = [];

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    let roll = Math.random() * totalWeight;
    let selectedItemId: string | null = null;

    for (const drop of allDrops) {
      roll -= drop.dropRate;
      if (roll <= 0) {
        selectedItemId = drop.itemId;
        break;
      }
    }

    if (selectedItemId) {
      // ダンジョンのMOD数範囲を取得（なければデフォルト: 0-2）
      const countRange = dungeonId
        ? getDungeonModCountRange(dungeonId) ?? { min: 0, max: 2 }
        : { min: 0, max: 2 };
      // 範囲内でランダムにMOD数を決定
      const modCount = countRange.min + Math.floor(Math.random() * (countRange.max - countRange.min + 1));
      const item = createItemInstance(selectedItemId, modCount, dungeonId, boosted);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

// インスタンスIDカウンター
let instanceIdCounter = 0;

/**
 * ユニークなインスタンスIDを生成
 */
function generateInstanceId(): string {
  return `item_${Date.now()}_${instanceIdCounter++}`;
}

/**
 * アイテム基本データを取得
 */
export const getItemBase = (id: string): ItemBase | undefined => {
  return itemBases[id];
};

/**
 * ランダムなMODを生成（ダンジョンのtier範囲とアイテムスロットを考慮）
 * @param count 生成するMODの数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param itemSlot アイテムのスロット（スロット制限MOD用）
 * @param boosted Tierブースト状態（広告ブースト用、デフォルトfalse）
 * @param weaponType 武器種別（武器のMOD制限用）
 */
export function generateRandomMods(count: number, dungeonId?: string, itemSlot?: EquipmentSlot, boosted: boolean = false, weaponType?: WeaponType): ItemMod[] {
  const mods: ItemMod[] = [];

  // ダンジョンのtier範囲を取得（なければデフォルト: 10-1）
  let tierRange = dungeonId
    ? getDungeonModTierRange(dungeonId) ?? { minTier: 10, maxTier: 1 }
    : { minTier: 10, maxTier: 1 };

  // 課金: Tierフィルター（T8-T10除外）
  // maxTierがフィルター範囲内（T7以上）の場合のみ適用
  // 序盤ダンジョン（maxTier > 7）では元々低品質MODしか出ないため適用不要
  if (hasTierFilter() &&
      tierRange.minTier > TIER_FILTER_SETTINGS.PREMIUM_MIN_TIER &&
      tierRange.maxTier <= TIER_FILTER_SETTINGS.PREMIUM_MIN_TIER) {
    tierRange = {
      ...tierRange,
      minTier: TIER_FILTER_SETTINGS.PREMIUM_MIN_TIER,
    };
  }

  // このダンジョンで出現可能なMODをフィルタリング
  // MODが持つtierとダンジョンのtier範囲が重複するかチェック
  // また、スロット制限がある場合はアイテムのスロットもチェック
  const availableConfigs = modConfigs.filter(config => {
    // スロット制限チェック
    if (config.slots && itemSlot && !config.slots.includes(itemSlot)) {
      return false;
    }
    // 武器種別制限チェック（MODにweaponTypesが設定されている場合）
    const modConfig = config as ModConfig & { weaponTypes?: WeaponType[] };
    if (modConfig.weaponTypes && itemSlot === 'weapon') {
      // 武器種別が指定されているMODは、対応する武器種別でのみ出現
      if (!weaponType || !modConfig.weaponTypes.includes(weaponType)) {
        return false;
      }
    }
    // 毒MODは杖には付与しない
    if (config.type === 'poison_chance' && weaponType === 'staff') {
      return false;
    }
    // スロット別tier設定を考慮してtierリストを取得
    const modTiers = getAvailableTiers(config, itemSlot);
    // ダンジョンで出現可能なtier範囲内にMODのtierが1つでもあるか
    return modTiers.some(t => t <= tierRange.minTier && t >= tierRange.maxTier);
  });

  if (availableConfigs.length === 0) {
    return mods;
  }

  const totalWeight = availableConfigs.reduce((sum, config) => sum + config.weight, 0);

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    let random = Math.random() * totalWeight;
    let selectedConfig: ModConfig | null = null;

    for (const config of availableConfigs) {
      random -= config.weight;
      if (random <= 0) {
        selectedConfig = config;
        break;
      }
    }

    if (selectedConfig) {
      // 同じタイプのMODが既にあればスキップ
      if (mods.some(m => m.type === selectedConfig!.type)) {
        continue;
      }

      // ダンジョン範囲内で利用可能なtierを取得（スロット別tier設定を考慮）
      const modTiers = getAvailableTiers(selectedConfig, itemSlot);
      const validTiers = modTiers.filter(t => t <= tierRange.minTier && t >= tierRange.maxTier);

      if (validTiers.length === 0) continue;

      // 有効なtierからウェイト付き抽選
      const minTier = Math.max(...validTiers); // tier値は大きい方が低品質
      const maxTier = Math.min(...validTiers); // tier値は小さい方が高品質
      const tier = rollTier(minTier, maxTier, boosted);

      // tierの値範囲から値を取得（スロット別tier設定を考慮）
      const slotTiers = getTiersForSlot(selectedConfig, itemSlot);
      const tierConfig = slotTiers[tier.toString()];
      const value = calculateValueFromTierRange(tierConfig.min, tierConfig.max);

      mods.push({
        type: selectedConfig.type,
        value,
        tier,
      });
    }
  }

  return mods;
}

/**
 * アイテムインスタンスを生成（MOD付き）
 * @param itemId アイテムID
 * @param modCount ランダムMODの数（0-2）
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param boosted Tierブースト状態（広告ブースト用、デフォルトfalse）
 */
export function createItemInstance(itemId: string, modCount: number = 0, dungeonId?: string, boosted: boolean = false): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MODは常にT0で表示（min/maxがある場合はランダム化）
  const fixedMods: ItemMod[] = (base.fixedMods || []).map(mod => {
    const raw = mod as unknown as Record<string, unknown>;
    const value = (typeof raw.min === 'number' && typeof raw.max === 'number')
      ? raw.min + Math.floor(Math.random() * (raw.max - raw.min + 1))
      : mod.value;
    return { type: mod.type, value, tier: 0 };
  });

  // MOD上限4: fixedModsがある場合、ランダムMOD数を制限
  const MAX_TOTAL_MODS = 4;
  const adjustedModCount = Math.max(0, Math.min(modCount, MAX_TOTAL_MODS - fixedMods.length));

  // ランダムMOD（ダンジョンのtier範囲とスロット、武器種別を考慮）
  const randomMods = adjustedModCount > 0
    ? generateRandomMods(adjustedModCount, dungeonId, base.slot, boosted, base.weaponType)
    : [];

  // 重複するタイプのMODを除外（固有MOD優先）
  const fixedTypes = new Set(fixedMods.map(m => m.type));
  const filteredRandomMods = randomMods.filter(m => !fixedTypes.has(m.type));

  return {
    ...base,
    instanceId: generateInstanceId(),
    mods: [...fixedMods, ...filteredRandomMods],
  };
}

/**
 * ドロップテーブルからランダムなアイテムを選択してインスタンス生成
 * @param dropTable ダンジョンドロップテーブル
 * @param modCount ランダムMODの数
 * @param dungeonId ダンジョンID（tier範囲取得用）
 * @param boosted Tierブースト状態（広告ブースト用、デフォルトfalse）
 */
export const getRandomItemFromDungeon = (
  dropTable: DungeonDropTable,
  modCount: number = 1,
  dungeonId?: string,
  boosted: boolean = false
): Item | undefined => {
  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const itemId = selectRandomItemId(allDrops);
  if (!itemId) return undefined;

  return createItemInstance(itemId, modCount, dungeonId, boosted);
};

/**
 * ドロップ確率に基づいてランダムなアイテムIDを選択
 */
function selectRandomItemId(drops: ItemDrop[]): string | undefined {
  if (drops.length === 0) return undefined;

  const totalRate = drops.reduce((sum, drop) => sum + drop.dropRate, 0);
  let random = Math.random() * totalRate;

  for (const drop of drops) {
    random -= drop.dropRate;
    if (random <= 0) {
      return drop.itemId;
    }
  }

  return drops[drops.length - 1].itemId;
}

/**
 * モンスターユニークドロップを判定
 * @param itemId アイテムID
 * @param dropRate ドロップ確率（%）
 * @param uniqueBonus ユニークドロップ率ボーナス（広告ブースト用、デフォルト0%）
 */
export const tryUniqueDrop = (itemId: string, dropRate: number, uniqueBonus: number = 0): Item | undefined => {
  const adjustedDropRate = dropRate + uniqueBonus;
  const random = Math.random() * 100;
  if (random < adjustedDropRate) {
    // ユニークアイテムはランダムMODなし（固有MODのみ）
    return createItemInstance(itemId, 0);
  }
  return undefined;
};

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * MODの効果説明を取得
 */
export function getModDescription(
  mod: ItemMod | { type: ModType; min: number; max: number },
  t?: TranslationFn
): string {
  // min/maxを持つ範囲指定MOD（図鑑のマスターデータ用）
  const raw = mod as Record<string, unknown>;
  const val = (typeof raw.min === 'number' && typeof raw.max === 'number')
    ? `${raw.min}~${raw.max}`
    : String((mod as ItemMod).value);
  const tr = (key: string, fallback: string, options: Record<string, unknown> = {}) =>
    t ? t(key, { defaultValue: fallback, ...options }) : fallback;

  switch (mod.type) {
    case 'atk_bonus':
      return `ATK+${val}`;
    case 'def_bonus':
      return `DEF+${val}`;
    case 'hp_bonus':
      return `HP+${val}`;
    case 'hp_regen':
      return tr('mods.everyTurnHpRegen', `毎秒HP${val}回復`, { value: val });
    case 'hp_regen_pct':
      return tr('mods.everyTurnHpRegenPct', `毎秒HP${val}%回復`, { value: val });
    case 'poison_chance':
      return tr('modDescriptions.poisonChance', `毒付与+${val}%`, { value: val });
    case 'ignite_chance':
      return tr('modDescriptions.igniteChance', `発火付与+${val}%`, { value: val });
    case 'ignite_duration_pct':
      return tr('modDescriptions.igniteDuration', `発火時間+${val}%`, { value: val });
    case 'ignite_tick_speed_pct':
      return tr('modDescriptions.igniteTickSpeed', `発火速度+${val}%`, { value: val });
    case 'ignite_damage_pct':
      return tr('modDescriptions.igniteDamage', `発火ダメージ+${val}%`, { value: val });
    case 'ignite_lifesteal':
      return tr('modDescriptions.igniteLifesteal', `発火ダメージ吸収${val}%`, { value: val });
    case 'critical_chance':
      return tr('modDescriptions.criticalChance', `クリティカル+${val}%`, { value: val });
    case 'critical_damage':
      return tr('modDescriptions.criticalDamage', `クリダメ+${val}%`, { value: val });
    case 'hp_on_hit':
      return tr('modDescriptions.hpOnHit', `HIT時HP+${val}回復`, { value: val });
    case 'hp_on_taken_hit':
      return tr('modDescriptions.hpOnTakenHit', `被弾時HP+${val}回復`, { value: val });
    case 'damage_defer_pct':
      return tr('modDescriptions.damageDefer', `ダメージ遅延${val}%`, { value: val });
    case 'damage_reduction_pct':
      return tr('modDescriptions.damageReduction', `被ダメ-${val}%`, { value: val });
    case 'evasion':
      return tr('modDescriptions.evasion', `EVA+${val}`, { value: val });
    case 'evasion_increased_pct':
      return tr('modDescriptions.evasionIncreased', `EVA+${val}%`, { value: val });
    case 'evasion_more_pct':
      return tr('modDescriptions.evasionMore', `EVA ${val}% more`, { value: val });
    case 'attack_speed_pct': {
      const sign = typeof raw.min === 'number' ? '' : ((mod as ItemMod).value >= 0 ? '+' : '');
      return tr('modDescriptions.attackSpeed', `攻撃速度${sign}${val}%`, { value: `${sign}${val}` });
    }
    case 'attack_speed_more_pct': {
      const sign = typeof raw.min === 'number' ? '' : ((mod as ItemMod).value >= 0 ? '+' : '');
      return tr('modDescriptions.attackSpeedMore', `攻撃速度${sign}${val}% more`, { value: `${sign}${val}` });
    }
    case 'hp_increased_pct':
      return `HP+${val}%`;
    case 'atk_increased_pct':
    case 'atk_inc_pct':
      return `ATK+${val}%`;
    case 'def_increased_pct':
      return `DEF+${val}%`;
    case 'time_atk_inc_pct':
      return tr('modDescriptions.timeAtkInc', `5秒毎にATK+${val}%`, { value: val });
    case 'time_def_inc_pct':
      return tr('modDescriptions.timeDefInc', `5秒毎にDEF+${val}%`, { value: val });
    case 'time_hp_regen':
      return tr('modDescriptions.timeHpRegen', `5秒毎に毎秒HP+${val}回復`, { value: val });
    case 'hp_regen_to_atk_pct':
      return tr('modDescriptions.hpRegenToAtk', `HP回復量の${val}%をATKに変換`, { value: val });
    case 'warlord_enrage':
      return tr('modDescriptions.warlordEnrage', '乱軍の王（HP30%以下で1度だけ発動。攻撃速度+20%, 攻撃時HP回復+300）');
    case 'chill_chance':
      return tr('modDescriptions.chillChance', `チル付与+${val}%`, { value: val });
    case 'chill_effect_pct':
      return tr('modDescriptions.chillEffect', `チル効果+${val}%`, { value: val });
    case 'chill_duration_pct':
      return tr('modDescriptions.chillDuration', `チル時間+${val}%`, { value: val });
    case 'freeze_chance':
      return tr('modDescriptions.freezeChance', `フリーズ付与+${val}%`, { value: val });
    case 'freeze_duration_pct':
      return tr('modDescriptions.freezeDuration', `フリーズ時間+${val}%`, { value: val });
    case 'poison_damage_pct':
      return tr('modDescriptions.poisonDamagePct', `毒ダメージ+${val}%`, { value: val });
    case 'poison_damage_more_pct':
      return tr('modDescriptions.poisonDamageMore', `毒ダメージ${val}% more`, { value: val });
    case 'poison_damage_reduction':
      return tr('modDescriptions.poisonDamageReduction', `毒状態の敵からの被ダメ-${val}%`, { value: val });
    case 'hp_on_crit':
      return tr('modDescriptions.hpOnCrit', `クリティカル時HP+${val}回復`, { value: val });
    case 'critical_follow_up_attack':
      return tr('modDescriptions.criticalFollowUpAttack', `クリティカル時追撃+${val}`, { value: val });
    case 'follow_up_attack_pct':
      return tr('mods.follow_up_attack_pct', `双撃の刃（毎攻撃時、ATKの${val}%で追撃）`, { value: val });
    case 'king_slam':
      return tr('mods.king_slam', 'キングスラム（5回攻撃ごとにATK×3の追撃）');
    case 'royal_roar':
      return tr('mods.royal_roar', '王の咆哮（3回攻撃ごとに自身の毒・発火・チルを解除）');
    case 'ignite_resist_pct':
      return tr('modDescriptions.igniteResist', `灼熱耐性（受ける発火ダメージ-${val}%）`, { value: val });
    case 'lifesteal':
      return tr('modDescriptions.lifesteal', `ライフスティール${val}%`, { value: val });
    case 'shield_on_evade_streak_hit_pct':
      return tr('modDescriptions.shieldOnEvadeStreakHit', `連続回避後の被弾時、回避1回ごとに最大シールドの${val}%回復`, { value: val });
    case 'atk_more_pct':
      return `ATK ${val}% more`;
    case 'def_more_pct':
      return `DEF ${val}% more`;
    case 'hp_more_pct':
      return `HP ${val}% more`;
    default:
      return '';
  }
}

/**
 * アイテムの全MOD効果をまとめて取得
 */
export function getItemModsDescription(item: Item): string[] {
  return item.mods.map(mod => getModDescription(mod));
}

/**
 * 装備品のMOD効果を集計
 */
export interface ModEffects {
  atkBonus: number;
  defBonus: number;
  hpRegen: number;
  hpRegenPct: number;
  poisonChance: number;
  criticalChance: number;
  damageDeferPct: number;
  damageReductionPct: number;
  hpOnHit: number;
  attackSpeedPct: number;
}

/**
 * アイテムからMOD効果を取得
 */
export function getModEffects(item: Item): ModEffects {
  const effects: ModEffects = {
    atkBonus: 0,
    defBonus: 0,
    hpRegen: 0,
    hpRegenPct: 0,
    poisonChance: 0,
    criticalChance: 0,
    damageDeferPct: 0,
    damageReductionPct: 0,
    hpOnHit: 0,
    attackSpeedPct: 0,
  };

  for (const mod of item.mods) {
    switch (mod.type) {
      case 'atk_bonus':
        effects.atkBonus += mod.value;
        break;
      case 'def_bonus':
        effects.defBonus += mod.value;
        break;
      case 'hp_regen':
        effects.hpRegen += mod.value;
        break;
      case 'hp_regen_pct':
        effects.hpRegenPct += mod.value;
        break;
      case 'poison_chance':
        effects.poisonChance += mod.value;
        break;
      case 'critical_chance':
        effects.criticalChance += mod.value;
        break;
      case 'damage_defer_pct':
        effects.damageDeferPct += mod.value;
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
    }
  }

  return effects;
}

/**
 * 複数のアイテムからMOD効果を合計
 */
export function combineModEffects(items: (Item | null)[]): ModEffects {
  const combined: ModEffects = {
    atkBonus: 0,
    defBonus: 0,
    hpRegen: 0,
    hpRegenPct: 0,
    poisonChance: 0,
    criticalChance: 0,
    damageDeferPct: 0,
    damageReductionPct: 0,
    hpOnHit: 0,
    attackSpeedPct: 0,
  };

  for (const item of items) {
    if (item) {
      const effects = getModEffects(item);
      combined.atkBonus += effects.atkBonus;
      combined.defBonus += effects.defBonus;
      combined.hpRegen += effects.hpRegen;
      combined.hpRegenPct += effects.hpRegenPct;
      combined.poisonChance += effects.poisonChance;
      combined.criticalChance += effects.criticalChance;
      combined.damageDeferPct += effects.damageDeferPct;
      combined.damageReductionPct += effects.damageReductionPct;
      combined.hpOnHit += effects.hpOnHit;
      combined.attackSpeedPct += effects.attackSpeedPct;
    }
  }

  return combined;
}

/**
 * ItemBaseをItemインスタンスに変換（固有MODのみ）
 * 装備時にDBから読み込む際に使用
 */
export function createItemFromBase(itemId: string): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MODは常にT0で表示
  const modsWithTier: ItemMod[] = (base.fixedMods || []).map(mod => ({
    ...mod,
    tier: 0,
  }));

  return {
    ...base,
    instanceId: `equipped_${itemId}`,
    mods: modsWithTier,
  };
}

/**
 * 既存アイテムのMODにtierを補完する
 * DBから読み込んだアイテムに対して使用
 */
export function ensureModTiers(item: Item): Item {
  const base = getItemBase(item.id);
  const fixedMods = base?.fixedMods ?? [];

  const isFixedMod = (mod: ItemMod): boolean =>
    fixedMods.some(fixed => fixed.type === mod.type && fixed.value === mod.value);

  return {
    ...item,
    mods: item.mods.map(mod => ({
      ...mod,
      tier: mod.tier ?? (isFixedMod(mod) ? 0 : calculateTierFromValue(mod.type, mod.value)),
    })),
  };
}

// 後方互換性のためのエクスポート
export const items = itemBases;

/**
 * アイテムを取得（Item形式で返す）
 * @deprecated 今後はcreateItemFromBaseを使用してください
 */
export function getItem(itemId: string): Item | undefined {
  return createItemFromBase(itemId);
}
