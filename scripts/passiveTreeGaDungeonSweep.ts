import { DUNGEON_EQUIPMENT_SETS } from '../core';
import { getDimensionalRushEnemy } from '../data/endContents';
import type { DungeonConfig, EnemyConfig } from '../core/types';
import {
  builds,
  createBuildState,
  dungeonRequirement,
  fmt,
  summarizeNodes,
  toDungeonConfig,
  type TargetScenario,
} from './passiveTreeScoreExplorer';
import {
  createGeneticConfig,
  createRng,
  evolveBuild,
} from './passiveTreeGeneticExplorer';

import dungeonsData from '../data/json/dungeons.json';

type EquipmentSource = keyof typeof DUNGEON_EQUIPMENT_SETS;

interface ProgressionTarget {
  dungeonId: keyof typeof dungeonsData.dungeons;
  level: number;
  equipmentSource: EquipmentSource;
}

const args = process.argv.slice(2);
const generations = args[0] ? Number.parseInt(args[0], 10) : 8;
const populationSize = args[1] ? Number.parseInt(args[1], 10) : 24;
const seed = args[2] ? Number.parseInt(args[2], 10) : 202603;
const equipmentSamples = args[3] ? Number.parseInt(args[3], 10) : 8;

const progressionTargets: ProgressionTarget[] = [
  { dungeonId: 'grassland', level: 1, equipmentSource: 'grassland' },
  { dungeonId: 'cave', level: 5, equipmentSource: 'grassland' },
  { dungeonId: 'ruins', level: 10, equipmentSource: 'cave' },
  { dungeonId: 'goblin_fort', level: 15, equipmentSource: 'ruins' },
  { dungeonId: 'bandit_hideout', level: 18, equipmentSource: 'goblin_fort' },
  { dungeonId: 'demon_castle', level: 20, equipmentSource: 'goblin_fort' },
  { dungeonId: 'vampire_mansion', level: 23, equipmentSource: 'demon_castle' },
  { dungeonId: 'ice_cave', level: 25, equipmentSource: 'demon_castle' },
  { dungeonId: 'underwater_cave', level: 28, equipmentSource: 'ice_cave' },
  { dungeonId: 'volcano', level: 30, equipmentSource: 'ice_cave' },
  { dungeonId: 'orc_fortress', level: 32, equipmentSource: 'volcano' },
  { dungeonId: 'dark_forest', level: 35, equipmentSource: 'volcano' },
  { dungeonId: 'sky_tower', level: 40, equipmentSource: 'dark_forest' },
  { dungeonId: 'hell_gate', level: 50, equipmentSource: 'sky_tower' },
  { dungeonId: 'dragon_nest', level: 60, equipmentSource: 'hell_gate' },
  { dungeonId: 'sacred_temple', level: 70, equipmentSource: 'dragon_nest' },
  { dungeonId: 'chaos_realm', level: 80, equipmentSource: 'sacred_temple' },
  { dungeonId: 'final_land', level: 99, equipmentSource: 'chaos_realm' },
  { dungeonId: 'dimensional_rush_1', level: 80, equipmentSource: 'final_land' },
  { dungeonId: 'dimensional_rush_2', level: 80, equipmentSource: 'final_land' },
  { dungeonId: 'dimensional_rush_3', level: 80, equipmentSource: 'final_land' },
  { dungeonId: 'dimensional_rush_4', level: 80, equipmentSource: 'final_land' },
  { dungeonId: 'dimensional_rush_5', level: 80, equipmentSource: 'final_land' },
  { dungeonId: 'dimensional_rush_6', level: 80, equipmentSource: 'final_land' },
];

function makeScenario(target: ProgressionTarget): TargetScenario {
  const dungeon = toDungeonConfig(dungeonsData.dungeons[target.dungeonId] as typeof dungeonsData.dungeons.grassland);
  return {
    level: target.level,
    dungeonId: dungeon.id,
    dungeon,
    equipmentSource: target.equipmentSource,
    equipmentSamples,
  };
}

function makeFullRushScenario(): TargetScenario {
  const dungeon: DungeonConfig = {
    id: 'dimensional_rush_full',
    name: '異次元ラッシュ全域',
    maxFloor: 200,
    enemies: [],
    dropTable: [],
    boss: { monsterId: 'true_final_boss', floor: 200 },
  };
  return {
    level: 80,
    dungeonId: dungeon.id,
    dungeon,
    equipmentSource: 'final_land',
    equipmentSamples,
    resolveEnemy: (floor) => getDimensionalRushEnemy(floor, () => 0.5) as EnemyConfig,
  };
}

function ratioLabel(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

const config = createGeneticConfig(generations, populationSize, seed);
const scenarios = [...progressionTargets.map(makeScenario), makeFullRushScenario()];

console.log('S3 理想パッシブツリー GA 横断評価');
console.log(`generations=${generations} population=${populationSize} equipmentSamples=${equipmentSamples} seed=${seed}`);
console.log('必要超過 = min(DPS/Req, Def/Req)。1.00x未満なら要求未達');
console.log('');
console.log('Dungeon | Lv | Req DPS/Def | Best | 必要超過 | DPS/Req | Def/Req | Score | HP/Shield | ATK/DEF | 主な取得ノード');
console.log('---|---:|---:|---|---:|---:|---:|---:|---:|---:|---');

for (let i = 0; i < scenarios.length; i++) {
  const scenario = scenarios[i];
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const rng = createRng(seed + i * 9973);
  let bestResult: ReturnType<typeof evolveBuild> | undefined;
  let bestSpec = builds[0];

  for (const spec of builds) {
    const result = evolveBuild(scenario, spec, rng, config);
    if (!bestResult || result.best.score > bestResult.best.score) {
      bestResult = result;
      bestSpec = spec;
    }
  }

  if (!bestResult) continue;

  const state = createBuildState(scenario.level, bestSpec, bestResult.equipment, bestResult.best.nodes);
  const dpsRatio = bestResult.best.combat.dps / req.requiredDps;
  const defRatio = bestResult.best.combat.defenseScore / req.requiredDefense;
  const margin = Math.min(dpsRatio, defRatio);

  console.log([
    scenario.dungeon.name,
    scenario.level,
    `${fmt(req.requiredDps)}/${fmt(req.requiredDefense)}`,
    bestSpec.label,
    ratioLabel(margin),
    ratioLabel(dpsRatio),
    ratioLabel(defRatio),
    bestResult.best.score.toFixed(2),
    `${fmt(state.vitals.maxHp)}/${fmt(state.vitals.maxShield)}`,
    `${fmt(state.stats.atk)}/${fmt(state.stats.def)}`,
    summarizeNodes(bestResult.best.nodes),
  ].join(' | '));
}
