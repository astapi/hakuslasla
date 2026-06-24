import {
  createBattleEngine,
  DUNGEON_EQUIPMENT_SETS,
  runBattleEngineToEnd,
  type EquipmentSet,
  generateRandomEquipmentSet,
} from '../core';
import {
  calculatePassiveEffects,
  getStartNodeId,
  getUnlockableNodes,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../data/passiveTree';
import type { CharacterType, Item, ItemMod } from '../types';
import {
  createBuildState,
  dungeonRequirement,
  fmt,
  passiveNodeBudget,
  representativeEnemy,
  scoreCombat,
  summarizeNodes,
  targetScenarios,
  type BuildSpec,
  type CombatScore,
  type TargetScenario,
} from './passiveTreeScoreExplorer';

const TICKS_PER_SECOND = 30;
const UBER_UBER_SIM_SECONDS = 90;
const UBER_UBER_BATTLE_SEEDS = 3;

export interface LoadoutCandidate {
  label: string;
  equipment: EquipmentSet;
  petId: string;
  petLevel: number;
}

export interface Individual {
  nodes: string[];
  uberNodes: string[];
  score: number;
  combat: CombatScore;
  loadout: LoadoutCandidate;
}

let searchOptions = {
  generations: 10,
  populationSize: 32,
  randomEquipmentPerType: 24,
  maxLoadouts: 36,
};

export const classes: CharacterType[] = ['warrior', 'ranger', 'elementalist', 'frostmage', 'tamer'];
const equipmentTypes = ['ATK', 'DEF', 'CRIT', 'POISON'] as const;
const pets = [
  { id: 'pet_void_walker', level: 4 },
  { id: 'pet_forest_witch', level: 4 },
  { id: 'pet_phoenix', level: 4 },
  { id: 'pet_ice_dragon', level: 4 },
  { id: 'pet_gargoyle', level: 4 },
  { id: 'pet_end_bringer', level: 6 },
] as const;

let strictInstanceCounter = 0;
let cachedUberNodeSets: string[][] | undefined;

export function configureNeutralSearch(options: Partial<typeof searchOptions>): void {
  searchOptions = { ...searchOptions, ...options };
}

export function createRng(seedValue: number): () => number {
  let state = seedValue || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function pick<T>(items: T[], rng: () => number): T {
  return items[randomInt(rng, items.length)];
}

function isPetTreeNode(id: string): boolean {
  return id.startsWith('pet_');
}

function canUseNodeForClass(classType: CharacterType, id: string): boolean {
  return classType === 'tamer' || !isPetTreeNode(id);
}

function unlockableForClass(classType: CharacterType, nodes: string[]) {
  return getUnlockableNodes(nodes).filter((node) =>
    !nodes.includes(node.id) &&
    canUseNodeForClass(classType, node.id)
  );
}

function activate(classType: CharacterType): void {
  setActivePassiveSeason(3);
  setActivePassiveClass(classType);
}

function randomPath(classType: CharacterType, budget: number, rng: () => number): string[] {
  activate(classType);
  const nodes: string[] = [];
  while (nodes.length < budget) {
    const unlockable = unlockableForClass(classType, nodes);
    if (unlockable.length === 0) break;
    nodes.push(pick(unlockable, rng).id);
  }
  return nodes;
}

function repairPath(classType: CharacterType, preferred: string[], budget: number, rng: () => number): string[] {
  activate(classType);
  const start = getStartNodeId();
  const nodes: string[] = [];
  const remaining = preferred.filter((id, index) =>
    id !== start &&
    preferred.indexOf(id) === index &&
    canUseNodeForClass(classType, id)
  );

  while (nodes.length < budget) {
    const unlockable = unlockableForClass(classType, nodes);
    if (unlockable.length === 0) break;
    const preferredIndex = remaining.findIndex((id) => unlockable.some((node) => node.id === id));
    if (preferredIndex >= 0) {
      const [nextId] = remaining.splice(preferredIndex, 1);
      nodes.push(nextId);
    } else {
      nodes.push(pick(unlockable, rng).id);
    }
  }

  return nodes;
}

function crossover(classType: CharacterType, a: string[], b: string[], budget: number, rng: () => number): string[] {
  const cutA = 1 + randomInt(rng, Math.max(1, a.length - 1));
  const cutB = 1 + randomInt(rng, Math.max(1, b.length - 1));
  return repairPath(classType, [...a.slice(0, cutA), ...b.slice(cutB), ...b.slice(0, cutB), ...a.slice(cutA)], budget, rng);
}

function mutate(classType: CharacterType, nodes: string[], budget: number, rng: () => number): string[] {
  if (rng() < 0.7) {
    const keep = 1 + randomInt(rng, Math.max(1, nodes.length - 1));
    return repairPath(classType, nodes.slice(0, keep), budget, rng);
  }
  const shuffled = [...nodes];
  for (let i = 1; i < shuffled.length; i++) {
    if (rng() < 0.2) {
      const j = 1 + randomInt(rng, shuffled.length - 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  return repairPath(classType, shuffled, budget, rng);
}

function uberNodeSetsForBudget(budget: number): string[][] {
  if (budget <= 0) return [[]];
  if (cachedUberNodeSets && budget === 6) return cachedUberNodeSets;
  const routes = {
    atk: ['uber_atk_1', 'uber_atk_2', 'uber_atk_3', 'uber_atk_4'],
    def: ['uber_def_1', 'uber_def_2', 'uber_def_3', 'uber_def_4'],
    crit: ['uber_crit_1', 'uber_crit_2', 'uber_crit_3', 'uber_crit_4'],
    poison: ['uber_poison_1', 'uber_poison_2', 'uber_poison_3', 'uber_poison_4'],
    ignite: ['uber_ignite_1', 'uber_ignite_2', 'uber_ignite_3', 'uber_ignite_4'],
    ice: ['uber_ice_1', 'uber_ice_2', 'uber_ice_3', 'uber_ice_4'],
  } as const;
  const routeKeys = Object.keys(routes) as Array<keyof typeof routes>;
  const takeRoute = (route: keyof typeof routes, count: number) => routes[route].slice(0, Math.min(count, routes[route].length));
  const add = (map: Map<string, string[]>, entries: Array<[keyof typeof routes, number]>): void => {
    const nodes = entries.flatMap(([route, count]) => takeRoute(route, count));
    if (nodes.length !== budget) return;
    const sorted = [...nodes].sort();
    map.set(sorted.join(','), sorted);
  };

  const map = new Map<string, string[]>();
  for (const route of routeKeys) {
    add(map, [[route, 4], ['def', 2]]);
    add(map, [['def', 4], [route, 2]]);
    add(map, [[route, 4], ['ice', 2]]);
  }
  for (let i = 0; i < routeKeys.length; i++) {
    for (let j = i + 1; j < routeKeys.length; j++) {
      add(map, [[routeKeys[i], 3], [routeKeys[j], 3]]);
    }
  }
  for (const a of ['atk', 'crit', 'poison', 'ignite', 'ice'] as Array<keyof typeof routes>) {
    add(map, [['def', 2], [a, 2], ['ice', 2]]);
  }
  add(map, [['def', 4], ['atk', 2]]);
  add(map, [['def', 4], ['poison', 2]]);
  add(map, [['def', 4], ['ignite', 2]]);
  add(map, [['def', 4], ['crit', 2]]);
  add(map, [['def', 4], ['ice', 2]]);

  const sets = [...map.values()];
  if (budget === 6) cachedUberNodeSets = sets;
  return sets;
}

function uberBudgetForScenario(scenario: TargetScenario): number {
  return scenario.dungeonId.startsWith('uber_uber_') ? 6 : 0;
}

function tournament(population: Individual[], rng: () => number): Individual {
  return [pick(population, rng), pick(population, rng), pick(population, rng)]
    .sort((a, b) => b.score - a.score)[0];
}

function neutralSpec(classType: CharacterType, loadout: LoadoutCandidate): BuildSpec {
  return {
    label: `${classType} neutral`,
    classType,
    kind: classType === 'tamer' ? 'tamer' : 'crit',
    equipmentType: 'ATK',
    petId: loadout.petId,
    petLevel: loadout.petLevel,
    offenseWeight: 1,
    defenseWeight: 1,
  };
}

function mod(type: ItemMod['type'], value: number, tier = 1): ItemMod {
  return { type, value, tier };
}

function cloneItemWithMods(item: Item | null, mods: ItemMod[]): Item | null {
  if (!item) return null;
  strictInstanceCounter += 1;
  return {
    ...item,
    instanceId: `${item.instanceId ?? item.id}_strict_${strictInstanceCounter}`,
    mods,
  };
}

function uniqueItem(id: string, name: string, slot: Item['slot'], atk: number, def: number, mods: ItemMod[], evasion = 0): Item {
  strictInstanceCounter += 1;
  return {
    id,
    instanceId: `${id}_unique_${strictInstanceCounter}`,
    name,
    slot,
    atk,
    def,
    evasion,
    mods,
  };
}

function uberEndplate(): Item {
  return uniqueItem('uber_endplate', 'Uber 終焉の甲冑', 'armor', 0, 360, [
    mod('time_def_inc_pct', 10, 0),
    mod('damage_reduction_pct', 5, 0),
    mod('hp_bonus', 320, 0),
    mod('hp_on_hit', 70, 0),
  ]);
}

function uberCrownOfEnd(): Item {
  return uniqueItem('uber_crown_of_end', 'Uber 終焉の王冠', 'accessory', 200, 200, [
    mod('atk_bonus', 120, 0),
    mod('def_bonus', 120, 0),
    mod('hp_regen', 200, 0),
    mod('critical_chance', 60, 0),
  ]);
}

function withUberUberRequiredUniques(equipment: EquipmentSet, nameSuffix = ' + Uber終焉'): EquipmentSet {
  return {
    ...equipment,
    name: `${equipment.name}${nameSuffix}`,
    armor: uberEndplate(),
    accessory: uberCrownOfEnd(),
  };
}

function finalLandEvasionLoadouts(): Array<{ label: string; equipment: EquipmentSet }> {
  return [
    {
      label: 'final_land:STRICT_EVASION',
      equipment: {
        name: '終焉の地 厳選回避型',
        weapon: uniqueItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
          mod('atk_bonus', 75),
          mod('atk_increased_pct', 45),
          mod('attack_speed_pct', 30),
          mod('hp_on_hit', 70),
        ]),
        armor: uniqueItem('final_land_evasion_armor', '終焉の外套', 'armor', 0, 0, [
          mod('evasion', 80),
          mod('evasion_increased_pct', 45),
          mod('damage_defer_pct', 12),
          mod('hp_bonus', 300),
        ], 78),
        gloves: uniqueItem('final_land_evasion_gloves', '終焉の手甲', 'gloves', 70, 0, [
          mod('evasion', 55),
          mod('evasion_increased_pct', 30),
          mod('attack_speed_pct', 30),
          mod('hp_on_hit', 70),
        ], 55),
        boots: uniqueItem('final_land_evasion_boots', '終焉の足袋', 'boots', 48, 0, [
          mod('evasion', 65),
          mod('evasion_increased_pct', 30),
          mod('hp_bonus', 300),
          mod('chill_resist_pct', 30),
        ], 66),
        accessory: uniqueItem('final_land_evasion_accessory', '終焉の護符', 'accessory', 88, 0, [
          mod('evasion', 55),
          mod('evasion_more_pct', 5),
          mod('hp_regen_pct', 5),
          mod('freeze_resist_pct', 30),
        ], 54),
      },
    },
    {
      label: 'final_land:STRICT_UBER_EVASION',
      equipment: {
        name: '終焉の地 Uber回避ユニーク型',
        weapon: uniqueItem('apocalypse_blade', '終焉の剣', 'weapon', 220, 0, [
          mod('atk_bonus', 75),
          mod('atk_increased_pct', 45),
          mod('attack_speed_pct', 30),
          mod('hp_on_hit', 70),
        ]),
        armor: uniqueItem('uber_goblin_evasion_cloak', 'Uber ゴブリンの影外套', 'armor', 0, 0, [
          mod('evasion_increased_pct', 12, 0),
          mod('shield_on_evade_streak_hit_pct', 5, 0),
          mod('hp_bonus', 180, 0),
          mod('damage_defer_pct', 12),
        ], 170),
        gloves: uniqueItem('uber_demon_evasion_grip', 'Uber 魔王の幻影篭手', 'gloves', 70, 0, [
          mod('evasion_increased_pct', 12, 0),
          mod('ignite_resist_pct', 10, 0),
          mod('hp_bonus', 240, 0),
          mod('attack_speed_pct', 30),
        ], 170),
        boots: uniqueItem('uber_bandit_evasion_steps', 'Uber 盗賊王の幻歩', 'boots', 45, 0, [
          mod('evasion', 30, 0),
          mod('evasion_increased_pct', 12, 0),
          mod('attack_speed_pct', 15, 0),
          mod('hp_on_hit', 45, 0),
        ], 160),
        accessory: uniqueItem('uber_end_evasion_crown', 'Uber 終焉の幻冠', 'accessory', 120, 0, [
          mod('evasion', 40, 0),
          mod('evasion_increased_pct', 15, 0),
          mod('evasion_more_pct', 4, 0),
          mod('hp_bonus', 280, 0),
        ], 220),
      },
    },
  ];
}

function strictFinalLandLoadouts(
  source: typeof DUNGEON_EQUIPMENT_SETS.final_land,
  includeUberUberUniques = false
): LoadoutCandidate[] {
  const base = source.sets.ATK;
  const variants: Array<{ label: string; equipment: EquipmentSet }> = [
    {
      label: 'final_land:STRICT_DEFENSE',
      equipment: {
        name: '終焉の地 厳選防御型',
        weapon: cloneItemWithMods(base.weapon, [
          mod('atk_bonus', 75),
          mod('atk_increased_pct', 45),
          mod('lifesteal', 5),
        ]),
        armor: cloneItemWithMods(base.armor, [
          mod('damage_reduction_pct', 5),
          mod('damage_defer_pct', 12),
          mod('def_bonus', 75),
          mod('def_increased_pct', 45),
        ]),
        gloves: cloneItemWithMods(base.gloves, [
          mod('attack_speed_pct', 30),
          mod('critical_chance', 30),
          mod('def_bonus', 50),
          mod('hp_regen', 50),
        ]),
        boots: cloneItemWithMods(base.boots, [
          mod('hp_bonus', 300),
          mod('hp_increased_pct', 30),
          mod('def_bonus', 50),
          mod('hp_regen', 50),
        ]),
        accessory: cloneItemWithMods(base.accessory, [
          mod('hp_bonus', 300),
          mod('hp_regen_pct', 5),
          mod('def_bonus', 50),
          mod('critical_chance', 30),
        ]),
      },
    },
    {
      label: 'final_land:STRICT_BALANCED',
      equipment: {
        name: '終焉の地 厳選バランス型',
        weapon: cloneItemWithMods(base.weapon, [
          mod('atk_bonus', 75),
          mod('atk_increased_pct', 45),
          mod('critical_damage', 100),
          mod('lifesteal', 5),
        ]),
        armor: cloneItemWithMods(base.armor, [
          mod('damage_reduction_pct', 5),
          mod('damage_defer_pct', 12),
          mod('def_bonus', 75),
          mod('hp_bonus', 300),
        ]),
        gloves: cloneItemWithMods(base.gloves, [
          mod('attack_speed_pct', 30),
          mod('critical_chance', 30),
          mod('critical_damage', 100),
          mod('atk_bonus', 50),
        ]),
        boots: cloneItemWithMods(base.boots, [
          mod('atk_bonus', 50),
          mod('hp_bonus', 300),
          mod('hp_regen', 50),
          mod('def_bonus', 50),
        ]),
        accessory: cloneItemWithMods(base.accessory, [
          mod('critical_chance', 30),
          mod('critical_damage', 100),
          mod('poison_chance', 50),
          mod('hp_regen_pct', 5),
        ]),
      },
    },
    {
      label: 'final_land:STRICT_CONTROL',
      equipment: {
        name: '終焉の地 厳選制御型',
        weapon: cloneItemWithMods(base.weapon, [
          mod('atk_bonus', 75),
          mod('chill_chance', 40),
          mod('chill_effect_pct', 100),
          mod('freeze_duration_pct', 100),
        ]),
        armor: cloneItemWithMods(base.armor, [
          mod('damage_reduction_pct', 5),
          mod('damage_defer_pct', 12),
          mod('def_bonus', 75),
          mod('def_increased_pct', 45),
        ]),
        gloves: cloneItemWithMods(base.gloves, [
          mod('attack_speed_pct', 30),
          mod('chill_chance', 40),
          mod('chill_effect_pct', 100),
          mod('freeze_duration_pct', 100),
        ]),
        boots: cloneItemWithMods(base.boots, [
          mod('hp_bonus', 300),
          mod('hp_increased_pct', 30),
          mod('hp_regen', 50),
          mod('def_bonus', 50),
        ]),
        accessory: cloneItemWithMods(base.accessory, [
          mod('hp_bonus', 300),
          mod('hp_regen_pct', 5),
          mod('critical_chance', 30),
          mod('poison_chance', 50),
        ]),
      },
    },
  ];

  variants.push(...finalLandEvasionLoadouts());

  if (includeUberUberUniques) {
    variants.push(
      ...variants.map((variant) => ({
        label: `${variant.label}_UBER_UNIQUE`,
        equipment: withUberUberRequiredUniques(variant.equipment),
      })),
      {
        label: 'final_land:STRICT_UBER_UBER_TAMER',
        equipment: {
          name: '終焉の地 UberUberテイマー実戦型',
          weapon: uniqueItem('apocalypse_staff', '終焉の杖', 'weapon', 220, 0, [
            mod('hp_bonus', 180, 5),
            mod('ignite_chance', 42, 1),
            mod('def_increased_pct', 25, 3),
            mod('atk_increased_pct', 45, 1),
          ]),
          armor: uberEndplate(),
          gloves: uniqueItem('chaos_gauntlets', '混沌の篭手', 'gloves', 52, 60, [
            mod('atk_increased_pct', 30, 1),
            mod('def_increased_pct', 25, 3),
            mod('chill_duration_pct', 47, 6),
            mod('attack_speed_pct', 30, 2),
          ]),
          boots: uniqueItem('end_walker_boots', '終末を歩む者のブーツ', 'boots', 48, 120, [
            mod('poison_chance', 40, 4),
            mod('atk_increased_pct', 30, 1),
            mod('atk_bonus', 25, 6),
            mod('def_increased_pct', 27, 2),
          ]),
          accessory: uberCrownOfEnd(),
        },
      }
    );
  }

  return variants.map((variant) => ({
    label: variant.label,
    equipment: variant.equipment,
    petId: 'pet_end_bringer',
    petLevel: 6,
  }));
}

export function makeLoadouts(scenario: TargetScenario): LoadoutCandidate[] {
  const loadouts: LoadoutCandidate[] = [];
  const source = DUNGEON_EQUIPMENT_SETS[scenario.equipmentSource];
  const isUberUber = scenario.dungeonId.startsWith('uber_uber_');
  if (scenario.equipmentSource === 'final_land') {
    loadouts.push(...strictFinalLandLoadouts(source as typeof DUNGEON_EQUIPMENT_SETS.final_land, isUberUber));
  }
  for (const type of equipmentTypes) {
    const fixedEquipment = isUberUber
      ? withUberUberRequiredUniques(source.sets[type])
      : source.sets[type];
    loadouts.push({
      label: `${scenario.equipmentSource}:${type}`,
      equipment: fixedEquipment,
      petId: 'pet_end_bringer',
      petLevel: 6,
    });
    for (let i = 0; i < searchOptions.randomEquipmentPerType; i++) {
      const randomEquipment = generateRandomEquipmentSet(`${scenario.dungeonId}-${type}-${i}`, scenario.equipmentSource, scenario.equipmentSource);
      loadouts.push({
        label: `${scenario.equipmentSource}:RANDOM_${type}_${i}`,
        equipment: isUberUber ? withUberUberRequiredUniques(randomEquipment) : randomEquipment,
        petId: 'pet_end_bringer',
        petLevel: 6,
      });
    }
  }

  return loadouts.flatMap((loadout) =>
    pets.map((pet) => ({
      ...loadout,
      label: `${loadout.label}+${pet.id}`,
      petId: pet.id,
      petLevel: pet.level,
    }))
  );
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRng(seedValue: number): () => number {
  let state = seedValue || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

export function calibrateUberUberCombatWithBattleEngine(
  scenario: TargetScenario,
  state: ReturnType<typeof createBuildState>,
  combat: CombatScore,
  enemy: ReturnType<typeof representativeEnemy>,
  req: ReturnType<typeof dungeonRequirement>
): CombatScore {
  if (!scenario.dungeonId.startsWith('uber_uber_')) return combat;

  const seedBase = hashString([
    scenario.dungeonId,
    state.nodes.join(','),
    state.uberNodes.join(','),
    state.stats.maxHp,
    state.stats.atk,
    state.stats.def,
    state.mods.blockChance,
    state.mods.damageDeferPct,
    state.mods.hpOnHit,
  ].join('|'));

  const results = Array.from({ length: UBER_UBER_BATTLE_SEEDS }, (_, index) => {
    const { engine } = createBattleEngine({
      playerStats: state.stats,
      playerCurrentHp: state.stats.maxHp,
      playerMods: state.mods,
      enemy,
      dungeonId: scenario.dungeonId,
      rng: seededRng(seedBase + index + 1),
    });
    const result = runBattleEngineToEnd(engine, enemy.exp ?? 0, UBER_UBER_SIM_SECONDS * TICKS_PER_SECOND);
    const finalState = engine.getState();
    return {
      victory: result.victory,
      seconds: result.totalTicks / TICKS_PER_SECOND,
      hpRatio: finalState.player.currentHp / Math.max(1, finalState.player.maxHp),
      enemyHpRatio: finalState.enemy.currentHp / Math.max(1, finalState.enemy.maxHp),
    };
  });

  const wins = results.filter((result) => result.victory);
  const winRate = wins.length / results.length;
  if (wins.length === 0) {
    const progress = 1 - results.reduce((sum, result) => sum + result.enemyHpRatio, 0) / results.length;
    return {
      ...combat,
      dps: Math.max(combat.dps, req.requiredDps * progress * 0.85),
      defenseScore: Math.max(combat.defenseScore, req.requiredDefense * Math.min(0.95, progress * 0.75)),
      survivalSeconds: Math.max(combat.survivalSeconds, Math.max(...results.map((result) => result.seconds))),
      bossPenaltyNotes: [...combat.bossPenaltyNotes, `battleSim ${wins.length}/${results.length}`],
    };
  }

  const averageWinSeconds = wins.reduce((sum, result) => sum + result.seconds, 0) / wins.length;
  const averageHpRatio = wins.reduce((sum, result) => sum + result.hpRatio, 0) / wins.length;
  const clearTimeRatio = Math.min(2, UBER_UBER_SIM_SECONDS / Math.max(1, averageWinSeconds));
  const battleDps = req.requiredDps * winRate * clearTimeRatio;
  const battleDefense =
    req.requiredDefense *
    Math.min(2, 0.85 + winRate * 0.55 + Math.min(0.35, averageHpRatio * 0.35));

  return {
    ...combat,
    dps: Math.max(combat.dps, battleDps),
    defenseScore: Math.max(combat.defenseScore, battleDefense),
    survivalSeconds: Math.max(combat.survivalSeconds, averageWinSeconds),
    bossPenaltyNotes: [
      ...combat.bossPenaltyNotes,
      `battleSim ${wins.length}/${results.length} avg ${averageWinSeconds.toFixed(1)}s`,
    ],
  };
}

function equipmentDefenseUtility(loadout: LoadoutCandidate): number {
  let score = 0;
  for (const item of Object.values(loadout.equipment)) {
    if (!item || typeof item === 'string') continue;
    score += item.def * 0.03;
    score += (item.evasion ?? 0) * 0.08;
    for (const mod of item.mods ?? []) {
      switch (mod.type) {
        case 'damage_reduction_pct':
          score += mod.value * 8;
          break;
        case 'damage_defer_pct':
          score += mod.value * 4;
          break;
        case 'block_chance':
          score += mod.value * 1.5;
          break;
        case 'def_bonus':
          score += mod.value * 0.08;
          break;
        case 'def_increased_pct':
          score += mod.value * 0.8;
          break;
        case 'hp_bonus':
          score += mod.value * 0.03;
          break;
        case 'hp_increased_pct':
          score += mod.value * 0.7;
          break;
        case 'hp_regen':
          score += mod.value * 0.08;
          break;
        case 'hp_regen_pct':
          score += mod.value * 5;
          break;
        case 'evasion':
          score += mod.value * 0.12;
          break;
        case 'evasion_increased_pct':
          score += mod.value * 1.2;
          break;
        case 'evasion_more_pct':
          score += mod.value * 8;
          break;
        case 'shield_on_evade_streak_hit_pct':
          score += mod.value * 12;
          break;
        case 'chill_resist_pct':
        case 'freeze_resist_pct':
          score += mod.value * 1.4;
          break;
        case 'auto_cleanse_interval_ms':
          score += Math.max(0, 20 - mod.value / 100);
          break;
      }
    }
  }
  return score;
}

function selectLoadoutsForClass(
  scenario: TargetScenario,
  classType: CharacterType,
  loadouts: LoadoutCandidate[],
  req: ReturnType<typeof dungeonRequirement>
): LoadoutCandidate[] {
  const enemy = representativeEnemy(scenario);
  const startNodes = (() => {
    activate(classType);
    return scenario.level > 1 ? [getStartNodeId()] : [];
  })();

  const entries = loadouts
    .map((loadout) => {
      const spec = neutralSpec(classType, loadout);
      const state = createBuildState(scenario.level, spec, loadout.equipment, startNodes, []);
      const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
      const dpsRatio = combat.dps / Math.max(1, req.requiredDps);
      const defenseRatio = combat.defenseScore / Math.max(1, req.requiredDefense);
      const defenseUtility = equipmentDefenseUtility(loadout);
      return {
        loadout,
        score: objectiveScoreForScenario(scenario, combat, req),
        dpsRatio,
        defenseRatio,
        defenseUtility,
      };
    });

  const selected = new Map<string, LoadoutCandidate>();
  if (scenario.dungeonId.startsWith('uber_uber_')) {
    for (const entry of entries) {
      if (
        entry.loadout.label.includes('UBER_UNIQUE') ||
        entry.loadout.label.includes('STRICT_UBER_UBER') ||
        entry.loadout.label.includes('EVASION')
      ) {
        selected.set(entry.loadout.label, entry.loadout);
      }
    }
  }
  const take = (
    sorted: typeof entries,
    count: number
  ) => {
    for (const entry of sorted) {
      selected.set(entry.loadout.label, entry.loadout);
      if (selected.size >= Math.max(1, searchOptions.maxLoadouts)) break;
      count -= 1;
      if (count <= 0) break;
    }
  };

  const perBucket = Math.max(4, Math.ceil(searchOptions.maxLoadouts / 5));
  take([...entries].sort((a, b) => b.score - a.score), perBucket);
  take([...entries].sort((a, b) => b.dpsRatio - a.dpsRatio), perBucket);
  take([...entries].sort((a, b) => b.defenseRatio - a.defenseRatio), perBucket);
  take([...entries].sort((a, b) => b.defenseUtility - a.defenseUtility), perBucket);
  take(
    [...entries].sort((a, b) =>
      (Math.min(b.dpsRatio, b.defenseRatio) + b.defenseUtility / 120) -
      (Math.min(a.dpsRatio, a.defenseRatio) + a.defenseUtility / 120)
    ),
    searchOptions.maxLoadouts
  );

  return [...selected.values()];
}

export function neutralScore(combat: CombatScore, req: ReturnType<typeof dungeonRequirement>): number {
  const offense = combat.dps / Math.max(1, req.requiredDps);
  const defense = combat.defenseScore / Math.max(1, req.requiredDefense);
  const clearRatio = Math.min(offense, defense);
  const offenseOverflow = Math.min(2, Math.max(0, offense - 1));
  const defenseOverflow = Math.min(2, Math.max(0, defense - 1));
  const survivalBonus = Math.min(1, combat.survivalSeconds / 30) * 0.25;
  const failPenalty = offense < 1 || defense < 1 ? (Math.max(0, 1 - offense) + Math.max(0, 1 - defense)) * 2 : 0;

  return Math.min(4, clearRatio) * 4 + offenseOverflow * 0.25 + defenseOverflow * 0.5 + survivalBonus - failPenalty;
}

function objectiveScoreForScenario(
  scenario: TargetScenario,
  combat: CombatScore,
  req: ReturnType<typeof dungeonRequirement>
): number {
  const offense = combat.dps / Math.max(1, req.requiredDps);
  const defense = combat.defenseScore / Math.max(1, req.requiredDefense);
  if (!scenario.dungeonId.startsWith('uber_uber_')) return neutralScore(combat, req);

  const survivalBonus = Math.min(1, combat.survivalSeconds / 45) * 0.4;
  if (defense < 1) {
    return defense * 8 + Math.min(offense, 1) * 0.75 + survivalBonus - (1 - defense) * 3;
  }
  if (offense < 1) {
    return 8 + Math.min(2, defense - 1) * 0.8 + offense * 5 + survivalBonus - (1 - offense) * 2;
  }
  return 14 + Math.min(2, offense - 1) * 1.2 + Math.min(2, defense - 1) * 1.2 + survivalBonus;
}

function evaluate(
  scenario: TargetScenario,
  classType: CharacterType,
  nodes: string[],
  loadouts: LoadoutCandidate[],
  req: ReturnType<typeof dungeonRequirement>
): Individual {
  const enemy = representativeEnemy(scenario);
  let best: Individual | undefined;
  const calibrationCandidates: Individual[] = [];
  const uberNodeSets = uberNodeSetsForBudget(uberBudgetForScenario(scenario));

  for (const loadout of loadouts) {
    const spec = neutralSpec(classType, loadout);
    for (const uberNodes of uberNodeSets) {
      const state = createBuildState(scenario.level, spec, loadout.equipment, nodes, uberNodes);
      const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
      const score = objectiveScoreForScenario(scenario, combat, req);
      const candidate = { nodes, uberNodes, score, combat, loadout };
      if (!best || score > best.score) best = candidate;

      if (scenario.dungeonId.startsWith('uber_uber_')) {
        if (
          calibrationCandidates.length < 5 ||
          score > calibrationCandidates[calibrationCandidates.length - 1].score ||
          loadout.label.includes('STRICT_UBER_UBER')
        ) {
          calibrationCandidates.push(candidate);
          calibrationCandidates.sort((a, b) => b.score - a.score);
          const keep = loadout.label.includes('STRICT_UBER_UBER') ? 8 : 5;
          calibrationCandidates.splice(keep);
        }
      }
    }
  }

  if (scenario.dungeonId.startsWith('uber_uber_')) {
    for (const candidate of calibrationCandidates) {
      const spec = neutralSpec(classType, candidate.loadout);
      const state = createBuildState(scenario.level, spec, candidate.loadout.equipment, nodes, candidate.uberNodes);
      const combat = calibrateUberUberCombatWithBattleEngine(scenario, state, candidate.combat, enemy, req);
      const score = objectiveScoreForScenario(scenario, combat, req);
      if (!best || score > best.score) {
        best = { ...candidate, combat, score };
      }
    }
  }

  return best!;
}

export function evolveNeutral(scenario: TargetScenario, classType: CharacterType, rng: () => number): Individual {
  const budget = passiveNodeBudget(scenario.level);
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const loadouts = selectLoadoutsForClass(scenario, classType, makeLoadouts(scenario), req);
  const cache = new Map<string, Individual>();
  const evaluateCached = (nodes: string[]) => {
    const key = nodes.join(',');
    const cached = cache.get(key);
    if (cached) return cached;
    const individual = evaluate(scenario, classType, nodes, loadouts, req);
    cache.set(key, individual);
    return individual;
  };

  let population = Array.from({ length: searchOptions.populationSize }, () =>
    evaluateCached(randomPath(classType, budget, rng))
  ).sort((a, b) => b.score - a.score);
  let best = population[0];
  const eliteCount = Math.max(4, Math.floor(searchOptions.populationSize * 0.12));

  for (let generation = 0; generation < searchOptions.generations; generation++) {
    const next = population.slice(0, eliteCount);
    while (next.length < searchOptions.populationSize) {
      const parentA = tournament(population, rng);
      const parentB = tournament(population, rng);
      let child = crossover(classType, parentA.nodes, parentB.nodes, budget, rng);
      if (rng() < 0.3) child = mutate(classType, child, budget, rng);
      next.push(evaluateCached(child));
    }
    population = next.sort((a, b) => b.score - a.score);
    if (population[0].score > best.score) best = population[0];
  }

  return best;
}

export function mixSummary(classType: CharacterType, nodes: string[]): string {
  activate(classType);
  const passive = calculatePassiveEffects(nodes);
  const parts = [
    `Crit ${passive.critical_chance}/${passive.critical_damage}`,
    `Poison ${passive.poison_chance}/${passive.poison_damage_pct}/stk${passive.poison_max_stacks}`,
    `Ignite ${passive.ignite_chance}/${passive.ignite_damage_pct}`,
    `Pet ${passive.pet_effect_pct ?? 0}`,
    `Shield ${passive.shield ?? 0}/${passive.shield_increased_pct ?? 0}`,
    `Block ${Math.min(50, passive.block_chance ?? 0)}`,
    `EVA ${passive.evasion ?? 0}/${passive.evasion_increased_pct ?? 0}`,
  ];
  return parts.join(' ');
}

export function uberSummary(nodes: string[]): string {
  if (nodes.length === 0) return '-';
  const counts = new Map<string, number>();
  for (const id of nodes) {
    const route = id.split('_')[1] ?? id;
    counts.set(route, (counts.get(route) ?? 0) + 1);
  }
  return [...counts.entries()].map(([route, count]) => `${route}${count}`).join('/');
}

function main(): void {
  const args = process.argv.slice(2);
  const scenarioId = args[0] ?? 'final_land';
  const generations = args[1] ? Number.parseInt(args[1], 10) : 10;
  const populationSize = args[2] ? Number.parseInt(args[2], 10) : 32;
  const seed = args[3] ? Number.parseInt(args[3], 10) : 909090;
  const randomEquipmentPerType = args[4] ? Number.parseInt(args[4], 10) : 24;
  const maxLoadouts = args[5] ? Number.parseInt(args[5], 10) : 36;
  configureNeutralSearch({ generations, populationSize, randomEquipmentPerType, maxLoadouts });

  const scenario = targetScenarios.find((target) => target.dungeonId === scenarioId) ?? targetScenarios[1];
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const rng = createRng(seed);

  console.log('S3 型なし GA パッシブツリー探索');
  console.log(`target=${scenario.dungeonId} Lv${scenario.level} generations=${generations} population=${populationSize} generatedLoadouts=${makeLoadouts(scenario).length} maxLoadouts=${maxLoadouts} seed=${seed}`);
  console.log('遺伝子は取得ノード順のみ。Crit/Poison/Ignite/Pet/Shield などの型ラベルは与えない。');
  console.log('');
  console.log('Class | Score | DPS/Req | Def/Req | Loadout | Uber | Mix | 主な取得ノード');
  console.log('---|---:|---:|---:|---|---|---|---');

  for (const classType of classes) {
    const result = evolveNeutral(scenario, classType, rng);
    const dpsRatio = result.combat.dps / req.requiredDps;
    const defRatio = result.combat.defenseScore / req.requiredDefense;
    console.log([
      classType,
      result.score.toFixed(2),
      `${dpsRatio.toFixed(2)}x`,
      `${defRatio.toFixed(2)}x`,
      result.loadout.label,
      uberSummary(result.uberNodes),
      mixSummary(classType, result.nodes),
      summarizeNodes(result.nodes),
    ].join(' | '));
  }
}

if (require.main === module) {
  main();
}
