import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createBuildState,
  dungeonRequirement,
  fmt,
  summarizeNodes,
  targetScenarios,
} from './passiveTreeScoreExplorer';
import {
  classes,
  configureNeutralSearch,
  createRng,
  evolveNeutral,
  mixSummary,
  uberSummary,
} from './passiveTreeNeutralGeneticExplorer';

const args = process.argv.slice(2);
const scenarioId = args[0] ?? 'final_land';
const generations = args[1] ? Number.parseInt(args[1], 10) : 8;
const populationSize = args[2] ? Number.parseInt(args[2], 10) : 24;
const seed = args[3] ? Number.parseInt(args[3], 10) : 909090;
const randomEquipmentPerType = args[4] ? Number.parseInt(args[4], 10) : 24;
const maxLoadouts = args[5] ? Number.parseInt(args[5], 10) : 36;

const scenario = targetScenarios.find((target) => target.dungeonId === scenarioId) ?? targetScenarios[1];
const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
const rng = createRng(seed);
configureNeutralSearch({ generations, populationSize, randomEquipmentPerType, maxLoadouts });

const exported = {
  generatedAt: new Date().toISOString(),
  mode: 'neutral-ga',
  scenario: {
    id: scenario.dungeonId,
    name: scenario.dungeon.name,
    level: scenario.level,
    requiredDps: req.requiredDps,
    requiredDefense: req.requiredDefense,
  },
  options: {
    generations,
    populationSize,
    seed,
    randomEquipmentPerType,
    maxLoadouts,
  },
  results: classes.map((classType) => {
    const result = evolveNeutral(scenario, classType, rng);
    const dpsRatio = result.combat.dps / req.requiredDps;
    const defRatio = result.combat.defenseScore / req.requiredDefense;
    const spec = {
      label: `${classType} neutral`,
      classType,
      kind: 'crit' as const,
      equipmentType: 'ATK' as const,
      petId: result.loadout.petId,
      petLevel: result.loadout.petLevel,
      offenseWeight: 1,
      defenseWeight: 1,
    };
    const state = createBuildState(scenario.level, spec, result.loadout.equipment, result.nodes, result.uberNodes);

    return {
      id: `${scenario.dungeonId}_${classType}_neutral`,
      label: `${scenario.dungeon.name} / ${classType}`,
      classType,
      score: Number(result.score.toFixed(3)),
      dpsRatio: Number(dpsRatio.toFixed(3)),
      defenseRatio: Number(defRatio.toFixed(3)),
      loadout: result.loadout.label,
      uber: uberSummary(result.uberNodes),
      uberNodes: result.uberNodes,
      mix: mixSummary(classType, result.nodes),
      summary: summarizeNodes(result.nodes),
      skillPointsSpent: result.nodes.length,
      stats: {
        hp: state.vitals.maxHp,
        shield: state.vitals.maxShield,
        atk: state.stats.atk,
        def: state.stats.def,
        display: `${fmt(state.vitals.maxHp)}/${fmt(state.vitals.maxShield)} HP/Shield ${fmt(state.stats.atk)}/${fmt(state.stats.def)} ATK/DEF`,
      },
      nodes: result.nodes,
    };
  }),
};

const outPath = path.resolve(process.cwd(), 'data/json/passiveTree_ga_results.json');
fs.writeFileSync(outPath, JSON.stringify(exported, null, 2) + '\n', 'utf8');

console.log(`GA results exported: ${outPath}`);
for (const result of exported.results) {
console.log(`${result.label}: score=${result.score} DPS=${result.dpsRatio}x DEF=${result.defenseRatio}x SP=${result.skillPointsSpent}`);
}
