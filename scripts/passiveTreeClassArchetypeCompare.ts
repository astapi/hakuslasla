import type { CharacterType } from '../types';
import {
  builds,
  createBuildState,
  fmt,
  summarizeNodes,
  targetScenarios,
  type BuildKind,
  type BuildSpec,
} from './passiveTreeScoreExplorer';
import {
  createGeneticConfig,
  createRng,
  evolveBuild,
} from './passiveTreeGeneticExplorer';

const args = process.argv.slice(2);
const scenarioId = args[0] ?? 'final_land';
const generations = args[1] ? Number.parseInt(args[1], 10) : 6;
const populationSize = args[2] ? Number.parseInt(args[2], 10) : 18;
const seed = args[3] ? Number.parseInt(args[3], 10) : 424242;

const classes: CharacterType[] = ['warrior', 'ranger', 'elementalist', 'frostmage', 'tamer'];

const archetypes: Array<Omit<BuildSpec, 'label' | 'classType'>> = [
  { kind: 'crit', equipmentType: 'CRIT', petId: 'pet_void_walker', petLevel: 4, offenseWeight: 1.25, defenseWeight: 0.75 },
  { kind: 'poison', equipmentType: 'POISON', petId: 'pet_forest_witch', petLevel: 4, offenseWeight: 1.15, defenseWeight: 0.85 },
  { kind: 'ignite', equipmentType: 'ATK', petId: 'pet_phoenix', petLevel: 4, offenseWeight: 1.2, defenseWeight: 0.8 },
  { kind: 'frost', equipmentType: 'DEF', petId: 'pet_ice_dragon', petLevel: 4, offenseWeight: 0.9, defenseWeight: 1.1 },
  { kind: 'tamer', equipmentType: 'DEF', petId: 'pet_end_bringer', petLevel: 6, offenseWeight: 1, defenseWeight: 1 },
  { kind: 'shield', equipmentType: 'DEF', petId: 'pet_gargoyle', petLevel: 4, offenseWeight: 0.7, defenseWeight: 1.3 },
];

function labelFor(classType: CharacterType, kind: BuildKind): string {
  const classLabel: Record<CharacterType, string> = {
    warrior: 'Warrior',
    ranger: 'Ranger',
    elementalist: 'Elementalist',
    frostmage: 'Frostmage',
    tamer: 'Tamer',
  };
  const kindLabel: Record<BuildKind, string> = {
    crit: 'Crit',
    poison: 'Poison',
    ignite: 'Ignite',
    frost: 'Frost',
    tamer: 'Pet',
    shield: 'Shield',
  };
  return `${classLabel[classType]} ${kindLabel[kind]}`;
}

function makeSpecs(): BuildSpec[] {
  return classes.flatMap((classType) =>
    archetypes.map((archetype) => ({
      ...archetype,
      classType,
      label: labelFor(classType, archetype.kind),
    }))
  );
}

const scenario = targetScenarios.find((target) => target.dungeonId === scenarioId) ?? targetScenarios[1];
const config = createGeneticConfig(generations, populationSize, seed);
const rng = createRng(seed);
const specs = makeSpecs();

console.log('S3 クラス×型 パッシブツリー比較');
console.log(`target=${scenario.dungeonId} Lv${scenario.level} generations=${generations} population=${populationSize} seed=${seed}`);
console.log('注意: 事前に Warrior=Crit / Ranger=Poison へ固定せず、全クラスで全型を試す');
console.log('');
console.log('Class | Best | Score | DPS/Req | Def/Req | HP/Shield | ATK/DEF | 主な取得ノード');
console.log('---|---|---:|---:|---:|---:|---:|---');

for (const classType of classes) {
  const classResults = specs
    .filter((spec) => spec.classType === classType)
    .map((spec) => ({ spec, result: evolveBuild(scenario, spec, rng, config) }))
    .sort((a, b) => b.result.best.score - a.result.best.score);

  const best = classResults[0];
  const state = createBuildState(scenario.level, best.spec, best.result.equipment, best.result.best.nodes);
  const dpsRatio = best.result.best.combat.dps / best.result.req.requiredDps;
  const defRatio = best.result.best.combat.defenseScore / best.result.req.requiredDefense;
  console.log([
    best.spec.classType,
    best.spec.label,
    best.result.best.score.toFixed(2),
    `${dpsRatio.toFixed(2)}x`,
    `${defRatio.toFixed(2)}x`,
    `${fmt(state.vitals.maxHp)}/${fmt(state.vitals.maxShield)}`,
    `${fmt(state.stats.atk)}/${fmt(state.stats.def)}`,
    summarizeNodes(best.result.best.nodes),
  ].join(' | '));

  const detail = classResults
    .map(({ spec, result }) => {
      const dps = result.best.combat.dps / result.req.requiredDps;
      const def = result.best.combat.defenseScore / result.req.requiredDefense;
      return `${spec.kind}:${result.best.score.toFixed(2)}(${dps.toFixed(2)}x/${def.toFixed(2)}x)`;
    })
    .join('  ');
  console.log(`  details | ${detail}`);
}

console.log('');
console.log('既存プリセット比較:');
for (const spec of builds) {
  const result = evolveBuild(scenario, spec, rng, config);
  const dpsRatio = result.best.combat.dps / result.req.requiredDps;
  const defRatio = result.best.combat.defenseScore / result.req.requiredDefense;
  console.log(`${spec.label}: score=${result.best.score.toFixed(2)} DPS=${dpsRatio.toFixed(2)}x DEF=${defRatio.toFixed(2)}x`);
}
