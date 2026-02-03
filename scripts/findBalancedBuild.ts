/**
 * ATK/DEF/HPをバランス良く伸ばすビルド探索
 *
 * 実行:
 *   npx tsx scripts/findBalancedBuild.ts [iterations] [seed]
 */

import { calculateBaseStatsForLevel } from '../core/player';
import { applyPercentageScaling } from '../core/battle';
import { combineMods } from '../core/modEffects';
import { calculatePassiveEffects, getUnlockableNodes } from '../data/passiveTree';
import modsData from '../data/json/mods.json';
import itemsData from '../data/json/items.json';
import dungeonsData from '../data/json/dungeons.json';

type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';

type ModTierConfig = Record<string, { min: number; max: number }>;
type ModConfig = {
  type: string;
  weight: number;
  tiers: ModTierConfig;
  slotTiers?: Record<EquipmentSlot, ModTierConfig>;
  slots?: EquipmentSlot[];
};

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

const args = process.argv.slice(2);
const iterations = args[0] ? parseInt(args[0], 10) : 5000;
const seed = args[1] ? parseInt(args[1], 10) : 12345;
const level = 60;

const modConfigs: ModConfig[] = (modsData as { modConfigs: ModConfig[] }).modConfigs;
const ALLOWED_TIERS = new Set([1, 2, 3]);
const REQUIRE_T1 = false;

const MOD_WEIGHT_MULTIPLIER: Record<string, number> = {
  atk_bonus: 2.0,
  atk_increased_pct: 2.0,
  def_bonus: 1.8,
  def_increased_pct: 1.8,
  hp_bonus: 1.6,
  hp_increased_pct: 1.6,
};

const FINAL_LAND_BASE_STATS = {
  weapon: { id: 'apocalypse_blade', name: '終焉の剣', atk: 220, def: 0 },
  armor: { id: 'end_armor', name: '終末の鎧', atk: 0, def: 180 },
  gloves: { id: 'titan_gauntlets', name: '泰坦の篭手', atk: 70, def: 80 },
  boots: { id: 'end_walker_boots', name: '終末を歩む者のブーツ', atk: 48, def: 120 },
  accessory: { id: 'oblivion_ring', name: '忘却の指輪', atk: 88, def: 88 },
} as const;

const FINAL_LAND_ACCESSORY_IDS = new Set(
  [
    ...(dungeonsData as any).dungeons.final_land.dropTable.common,
    ...(dungeonsData as any).dungeons.final_land.dropTable.dungeon,
  ].map((entry: any) => entry.itemId)
);

const ALL_ACCESSORIES = Object.values((itemsData as any).items).filter(
  (item: any) => item.slot === 'accessory' && FINAL_LAND_ACCESSORY_IDS.has(item.id)
) as Array<{ id: string; name: string; atk: number; def: number; fixedMods?: ItemMod[] }>;

function createRng(seedValue: number): () => number {
  let state = seedValue;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function pickRandom<T>(array: T[], rng: () => number): T {
  const index = Math.floor(rng() * array.length);
  return array[index];
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  if (min === max) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function getTierConfigForSlot(config: ModConfig, slot: EquipmentSlot): ModTierConfig {
  return (config.slotTiers && config.slotTiers[slot]) || config.tiers;
}

function getAvailableTiers(config: ModConfig, slot: EquipmentSlot): number[] {
  const tiers = Object.keys(getTierConfigForSlot(config, slot)).map((t) => parseInt(t, 10));
  return tiers.filter((t) => ALLOWED_TIERS.has(t));
}

function generateRandomModsForSlot(
  rng: () => number,
  count: number,
  slot: EquipmentSlot
): ItemMod[] {
  const mods: ItemMod[] = [];
  const availableConfigs = modConfigs.filter((config) => {
    if (config.slots && !config.slots.includes(slot)) return false;
    return getAvailableTiers(config, slot).length > 0;
  });
  if (availableConfigs.length === 0) return mods;

  const totalWeight = availableConfigs.reduce((sum, config) => {
    const mult = MOD_WEIGHT_MULTIPLIER[config.type] ?? 1;
    return sum + config.weight * mult;
  }, 0);
  const usedTypes = new Set<string>();

  let t1Added = false;
  for (let i = 0; i < count; i++) {
    let selected: ModConfig | null = null;
    for (let tries = 0; tries < 20; tries++) {
      let random = rng() * totalWeight;
      for (const config of availableConfigs) {
        const mult = MOD_WEIGHT_MULTIPLIER[config.type] ?? 1;
        random -= config.weight * mult;
        if (random <= 0) {
          selected = config;
          break;
        }
      }
      if (!selected || usedTypes.has(selected.type)) {
        selected = null;
        continue;
      }
      break;
    }
    if (!selected || usedTypes.has(selected.type)) continue;
    usedTypes.add(selected.type);

    const validTiers = getAvailableTiers(selected, slot);
    if (validTiers.length === 0) continue;

    let tier = validTiers[Math.floor(rng() * validTiers.length)];
    if (REQUIRE_T1 && !t1Added && i === count - 1 && validTiers.includes(1)) {
      tier = 1;
    }
    if (tier === 1) t1Added = true;

    const tierConfigs = getTierConfigForSlot(selected, slot);
    const tierConfig = tierConfigs[tier.toString()];
    if (!tierConfig) continue;

    const value = randomIntInclusive(rng, tierConfig.min, tierConfig.max);
    mods.push({ type: selected.type, value, tier });
  }

  if (REQUIRE_T1 && !t1Added) {
    const candidateConfigs = availableConfigs.filter((config) => getAvailableTiers(config, slot).includes(1));
    if (candidateConfigs.length > 0) {
      const selected = pickRandom(candidateConfigs, rng);
      const tierConfigs = getTierConfigForSlot(selected, slot);
      const tierConfig = tierConfigs['1'];
      if (tierConfig) {
        const value = randomIntInclusive(rng, tierConfig.min, tierConfig.max);
        mods.pop();
        mods.push({ type: selected.type, value, tier: 1 });
      }
    }
  }

  return mods;
}

let instanceCounter = 0;
function createRandomModItem(
  rng: () => number,
  slot: EquipmentSlot,
  base: { id: string; name: string; atk: number; def: number },
  modCount: number
): Item {
  instanceCounter += 1;
  return {
    id: base.id,
    name: base.name,
    slot,
    atk: base.atk,
    def: base.def,
    instanceId: `search_${base.id}_${instanceCounter}`,
    mods: generateRandomModsForSlot(rng, modCount, slot),
  };
}

function generateEquipment(rng: () => number): Equipment {
  const accessoryBase = pickRandom(ALL_ACCESSORIES, rng);
  const fixedMods = (accessoryBase?.fixedMods ?? []) as ItemMod[];
  const accessoryMods = fixedMods.length >= 4
    ? fixedMods.slice(0, 4)
    : [...fixedMods, ...generateRandomModsForSlot(rng, 4 - fixedMods.length, 'accessory')];

  return {
    weapon: createRandomModItem(rng, 'weapon', FINAL_LAND_BASE_STATS.weapon, 4),
    armor: createRandomModItem(rng, 'armor', FINAL_LAND_BASE_STATS.armor, 4),
    gloves: createRandomModItem(rng, 'gloves', FINAL_LAND_BASE_STATS.gloves, 4),
    boots: createRandomModItem(rng, 'boots', FINAL_LAND_BASE_STATS.boots, 4),
    accessory: {
      id: accessoryBase.id,
      name: accessoryBase.name,
      slot: 'accessory',
      atk: accessoryBase.atk ?? 0,
      def: accessoryBase.def ?? 0,
      instanceId: `search_${accessoryBase.id}_${instanceCounter++}`,
      mods: accessoryMods,
    },
  };
}

function generateBiasedPassiveNodes(maxNodes: number, rng: () => number): string[] {
  const unlocked = ['start'];
  const priority = ['guard_', 'regen_', 'crit_', 'speed_', 'poison_', 'vamp_'];
  while (unlocked.length < maxNodes) {
    const unlockable = getUnlockableNodes(unlocked);
    if (unlockable.length === 0) break;
    const weighted = unlockable.map((node) => {
      const weight = priority.some((p) => node.id.startsWith(p)) ? 3 : 1;
      return { node, weight };
    });
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    let selected = weighted[0].node;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) {
        selected = entry.node;
        break;
      }
    }
    unlocked.push(selected.id);
  }
  return unlocked;
}

function calculateFinalStats(levelValue: number, equipment: Equipment, unlockedSkills: string[]) {
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
    maxHp: applyPercentageScaling(flatStats.maxHp, passiveEffects.hp_increased_pct + equipHpIncPct, passiveEffects.hp_more_pct),
    atk: applyPercentageScaling(flatStats.atk, passiveEffects.atk_increased_pct + equipAtkIncPct, passiveEffects.atk_more_pct),
    def: applyPercentageScaling(flatStats.def, passiveEffects.def_increased_pct + equipDefIncPct, passiveEffects.def_more_pct),
  };

  const modEffects = combineMods(items, passiveEffects);
  return { finalStats, modEffects };
}

function computeBalanceScore(stats: { maxHp: number; atk: number; def: number }, baseline: { maxHp: number; atk: number; def: number }): number {
  const nAtk = stats.atk / baseline.atk;
  const nDef = stats.def / baseline.def;
  const nHp = stats.maxHp / baseline.maxHp;
  const min = Math.min(nAtk, nDef, nHp);
  const max = Math.max(nAtk, nDef, nHp);
  return min - (max - min) * 0.1;
}

function computeBaselineStats(): { maxHp: number; atk: number; def: number } {
  const levelBonus = calculateBaseStatsForLevel(level);
  const base = {
    maxHp: levelBonus.maxHp + FINAL_LAND_BASE_STATS.weapon.def + FINAL_LAND_BASE_STATS.armor.def + FINAL_LAND_BASE_STATS.gloves.def + FINAL_LAND_BASE_STATS.boots.def,
    atk: levelBonus.atk + FINAL_LAND_BASE_STATS.weapon.atk + FINAL_LAND_BASE_STATS.armor.atk + FINAL_LAND_BASE_STATS.gloves.atk + FINAL_LAND_BASE_STATS.boots.atk,
    def: levelBonus.def + FINAL_LAND_BASE_STATS.weapon.def + FINAL_LAND_BASE_STATS.armor.def + FINAL_LAND_BASE_STATS.gloves.def + FINAL_LAND_BASE_STATS.boots.def,
  };
  base.atk += FINAL_LAND_BASE_STATS.accessory.atk;
  base.def += FINAL_LAND_BASE_STATS.accessory.def;
  return base;
}

const rng = createRng(seed);
const maxNodes = Math.min(level, 50);
const baseline = computeBaselineStats();

let best: { score: number; stats: { maxHp: number; atk: number; def: number }; build: { level: number; equipment: Equipment; unlockedSkills: string[] } } | null = null;

console.log('='.repeat(70));
console.log('ATK/DEF/HPバランス探索');
console.log(`iterations=${iterations}, seed=${seed}`);
console.log(`アクセ: final_landのみ（fixedMods優先）`);
console.log('='.repeat(70));

for (let i = 0; i < iterations; i++) {
  const equipment = generateEquipment(rng);
  const unlockedSkills = generateBiasedPassiveNodes(maxNodes, rng);
  const build = { level, equipment, unlockedSkills };
  const { finalStats } = calculateFinalStats(level, equipment, unlockedSkills);
  const score = computeBalanceScore(finalStats, baseline);

  if (!best || score > best.score) {
    best = { score, stats: finalStats, build };
  }

  if (i % 200 === 0) {
    console.log(`progress ${i}/${iterations}`);
  }
}

if (best) {
  console.log('\n=== BEST BALANCED BUILD ===');
  console.log(JSON.stringify({ score: best.score, stats: best.stats }, null, 2));
  console.log(JSON.stringify(best.build, null, 2));
}
