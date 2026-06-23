import {
  dungeonRequirement,
  fmt,
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

const uberBossScenarioIds = [
  'uber_goblin_king',
  'uber_demon_lord',
  'uber_true_final_boss',
  'uber_uber_goblin_king',
  'uber_uber_bandit_leader',
  'uber_uber_kraken',
] as const;

const args = process.argv.slice(2);
const generations = args[0] ? Number.parseInt(args[0], 10) : 12;
const populationSize = args[1] ? Number.parseInt(args[1], 10) : 48;
const seed = args[2] ? Number.parseInt(args[2], 10) : 909090;
const randomEquipmentPerType = args[3] ? Number.parseInt(args[3], 10) : 24;
const maxLoadouts = args[4] ? Number.parseInt(args[4], 10) : 36;

configureNeutralSearch({ generations, populationSize, randomEquipmentPerType, maxLoadouts });
const rng = createRng(seed);

console.log('S3 Uber/UberUberボス必要スコアチェック');
console.log(`generations=${generations} population=${populationSize} loadoutRandom=${randomEquipmentPerType} maxLoadouts=${maxLoadouts} seed=${seed}`);
console.log('必要スコア: ボスを12秒で倒すDPS、22秒耐える防御スコア。PASS条件は DPS/Req >= 1 かつ DEF/Req >= 1。');
console.log('');

let failed = false;

for (const scenarioId of uberBossScenarioIds) {
  const scenario = targetScenarios.find((target) => target.dungeonId === scenarioId);
  if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);

  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  console.log(`## ${req.name} (${scenario.dungeonId}) Lv${scenario.level}`);
  console.log(`Required DPS=${fmt(req.requiredDps)} DEF=${fmt(req.requiredDefense)} enemyHP=${fmt(req.enemyHp)} effectiveHP=${fmt(req.enemyEffectiveHp)} enemyHealDPS=${fmt(req.enemyHealingDps)} enemyDR=${req.enemyDamageReductionPct}% incomingDPS=${fmt(req.incomingDps)}`);
  console.log('Class | 判定 | DPS/Req | DEF/Req | Score | Loadout | Uber | Mix');
  console.log('---|---|---:|---:|---:|---|---|---');

  for (const classType of classes) {
    const result = evolveNeutral(scenario, classType, rng);
    const dpsRatio = result.combat.dps / req.requiredDps;
    const defRatio = result.combat.defenseScore / req.requiredDefense;
    const pass = dpsRatio >= 1 && defRatio >= 1;
    if (!pass) failed = true;

    console.log([
      classType,
      pass ? 'PASS' : 'FAIL',
      `${dpsRatio.toFixed(2)}x`,
      `${defRatio.toFixed(2)}x`,
      result.score.toFixed(2),
      result.loadout.label,
      uberSummary(result.uberNodes),
      mixSummary(classType, result.nodes),
    ].join(' | '));
  }

  console.log('');
}

if (failed) process.exitCode = 1;
