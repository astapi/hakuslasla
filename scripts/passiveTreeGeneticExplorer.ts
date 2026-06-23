import type { EquipmentSet } from '../core';
import {
  getStartNodeId,
  getUnlockableNodes,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../data/passiveTree';
import type { CharacterType } from '../types';
import {
  builds,
  chooseEquipmentForExplorer,
  createBuildState,
  dungeonRequirement,
  fmt,
  objectiveScore,
  passiveNodeBudget,
  representativeEnemy,
  scoreCombat,
  summarizeNodes,
  targetScenarios,
  type BuildSpec,
  type CombatScore,
  type TargetScenario,
} from './passiveTreeScoreExplorer';

export interface Individual {
  nodes: string[];
  score: number;
  combat: CombatScore;
}

export interface GeneticConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  seed: number;
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

function activate(classType: CharacterType): void {
  setActivePassiveSeason(3);
  setActivePassiveClass(classType);
}

function randomPath(classType: CharacterType, budget: number, rng: () => number): string[] {
  activate(classType);
  const nodes: string[] = [];
  while (nodes.length < budget) {
    const unlockable = getUnlockableNodes(nodes).filter((node) => !nodes.includes(node.id));
    if (unlockable.length === 0) break;
    nodes.push(pick(unlockable, rng).id);
  }
  return nodes;
}

function repairPath(classType: CharacterType, preferred: string[], budget: number, rng: () => number): string[] {
  activate(classType);
  const start = getStartNodeId();
  const nodes: string[] = [];
  const remaining = preferred.filter((id, index) => id !== start && preferred.indexOf(id) === index);

  while (nodes.length < budget) {
    const unlockable = getUnlockableNodes(nodes).filter((node) => !nodes.includes(node.id));
    if (unlockable.length === 0) break;

    const preferredIndex = remaining.findIndex((id) => unlockable.some((node) => node.id === id));
    if (preferredIndex >= 0) {
      const [nextId] = remaining.splice(preferredIndex, 1);
      nodes.push(nextId);
      continue;
    }

    nodes.push(pick(unlockable, rng).id);
  }

  return nodes;
}

function crossover(classType: CharacterType, a: string[], b: string[], budget: number, rng: () => number): string[] {
  const cutA = 1 + randomInt(rng, Math.max(1, a.length - 1));
  const cutB = 1 + randomInt(rng, Math.max(1, b.length - 1));
  const preferred = [
    ...a.slice(0, cutA),
    ...b.slice(cutB),
    ...b.slice(0, cutB),
    ...a.slice(cutA),
  ];
  return repairPath(classType, preferred, budget, rng);
}

function mutate(classType: CharacterType, nodes: string[], budget: number, rng: () => number): string[] {
  if (nodes.length <= 2) return randomPath(classType, budget, rng);

  const mode = rng();
  if (mode < 0.55) {
    const keep = 1 + randomInt(rng, nodes.length - 1);
    return repairPath(classType, nodes.slice(0, keep), budget, rng);
  }

  const shuffled = [...nodes];
  for (let i = 1; i < shuffled.length; i++) {
    if (rng() < 0.18) {
      const j = 1 + randomInt(rng, shuffled.length - 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  return repairPath(classType, shuffled, budget, rng);
}

function tournament(population: Individual[], rng: () => number): Individual {
  const a = pick(population, rng);
  const b = pick(population, rng);
  const c = pick(population, rng);
  return [a, b, c].sort((left, right) => right.score - left.score)[0];
}

function evaluateFactory(scenario: TargetScenario, spec: BuildSpec, equipment: EquipmentSet) {
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const enemy = representativeEnemy(scenario);
  const cache = new Map<string, Individual>();

  return {
    req,
    evaluate(nodes: string[]): Individual {
      const key = nodes.join(',');
      const cached = cache.get(key);
      if (cached) return cached;

      const state = createBuildState(scenario.level, spec, equipment, nodes);
      const combat = scoreCombat(state, enemy, spec, { dungeonId: scenario.dungeonId });
      const score = objectiveScore(combat, req, spec);
      const individual = { nodes, combat, score };
      cache.set(key, individual);
      return individual;
    },
  };
}

export function createGeneticConfig(generations: number, populationSize: number, seed: number): GeneticConfig {
  return {
    populationSize,
    generations,
    eliteCount: Math.max(4, Math.floor(populationSize * 0.12)),
    mutationRate: 0.28,
    seed,
  };
}

export function evolveBuild(scenario: TargetScenario, spec: BuildSpec, rng: () => number, config: GeneticConfig): {
  best: Individual;
  equipment: EquipmentSet;
  req: ReturnType<typeof dungeonRequirement>;
  history: number[];
} {
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const equipment = chooseEquipmentForExplorer(scenario, spec, req);
  const evaluator = evaluateFactory(scenario, spec, equipment);
  const budget = passiveNodeBudget(scenario.level);

  let population = Array.from({ length: config.populationSize }, () =>
    evaluator.evaluate(randomPath(spec.classType, budget, rng))
  );
  let best = population.sort((a, b) => b.score - a.score)[0];
  const history = [best.score];

  for (let generation = 1; generation <= config.generations; generation++) {
    population.sort((a, b) => b.score - a.score);
    const next = population.slice(0, config.eliteCount);

    while (next.length < config.populationSize) {
      const parentA = tournament(population, rng);
      const parentB = tournament(population, rng);
      let childNodes = crossover(spec.classType, parentA.nodes, parentB.nodes, budget, rng);
      if (rng() < config.mutationRate) {
        childNodes = mutate(spec.classType, childNodes, budget, rng);
      }
      next.push(evaluator.evaluate(childNodes));
    }

    population = next.sort((a, b) => b.score - a.score);
    if (population[0].score > best.score) {
      best = population[0];
    }
    history.push(best.score);
  }

  return { best, equipment, req: evaluator.req, history };
}

export function resultLine(spec: BuildSpec, result: ReturnType<typeof evolveBuild>, scenario: TargetScenario): string {
  const state = createBuildState(scenario.level, spec, result.equipment, result.best.nodes);
  const dpsRatio = result.best.combat.dps / result.req.requiredDps;
  const defRatio = result.best.combat.defenseScore / result.req.requiredDefense;
  const first = result.history[0];
  const last = result.history[result.history.length - 1];
  const growth = first > 0 ? ((last / first - 1) * 100).toFixed(0) : '0';
  const breakdown = [
    `直${fmt(result.best.combat.directDps)}`,
    `毒${fmt(result.best.combat.poisonDps)}`,
    `火${fmt(result.best.combat.igniteDps)}`,
    `Pet${fmt(result.best.combat.petDps)}`,
  ].join(' ');

  return [
    spec.label,
    result.best.score.toFixed(2),
    `+${growth}%`,
    `${dpsRatio.toFixed(2)}x`,
    `${defRatio.toFixed(2)}x`,
    result.best.combat.survivalSeconds.toFixed(1),
    breakdown,
    `${fmt(state.vitals.maxHp)}/${fmt(state.vitals.maxShield)}`,
    `${fmt(state.stats.atk)}/${fmt(state.stats.def)}`,
    summarizeNodes(result.best.nodes),
  ].join(' | ');
}

function main(): void {
  const args = process.argv.slice(2);
  const scenarioId = args[0] ?? 'final_land';
  const generations = args[1] ? Number.parseInt(args[1], 10) : 50;
  const populationSize = args[2] ? Number.parseInt(args[2], 10) : 72;
  const seed = args[3] ? Number.parseInt(args[3], 10) : 777;
  const config = createGeneticConfig(generations, populationSize, seed);
  const scenario = targetScenarios.find((target) => target.dungeonId === scenarioId) ?? targetScenarios[1];
  const rng = createRng(config.seed);

  console.log('S3 パッシブツリー GA 探索');
  console.log(`target=${scenario.dungeonId} Lv${scenario.level} generations=${config.generations} population=${config.populationSize} seed=${config.seed}`);
  console.log('個体=取得ノード順、交叉=親2つの取得順を合成、突然変異=途中から取り直し/順序撹拌');
  console.log('');
  console.log('Build | Score | 改善 | DPS/Req | Def/Req | 生存秒 | DPS内訳 | HP/Shield | ATK/DEF | 主な取得ノード');
  console.log('---|---:|---:|---:|---:|---:|---|---:|---:|---');

  for (const spec of builds) {
    const result = evolveBuild(scenario, spec, rng, config);
    console.log(resultLine(spec, result, scenario));
  }
}

if (require.main === module) {
  main();
}
