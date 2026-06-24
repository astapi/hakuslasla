import {
  createBattleEngine,
  runBattleEngineToEnd,
  type EquipmentSet,
} from '../core';
import {
  calculatePassiveEffects,
  getPassiveNode,
  getStartNodeId,
  getUnlockableNodes,
  setActivePassiveClass,
  setActivePassiveSeason,
} from '../data/passiveTree';
import type { CharacterType, Item, ItemMod, PassiveNode } from '../types';
import {
  createBuildState,
  dungeonRequirement,
  passiveNodeBudget,
  representativeEnemy,
  scoreCombat,
  summarizeNodes,
  targetScenarios,
  type BuildSpec,
} from './passiveTreeScoreExplorer';
import { mixSummary, uberSummary } from './passiveTreeNeutralGeneticExplorer';

const TICKS_PER_SECOND = 30;
const SIM_SECONDS = 90;
const LEVEL = 80;
const BEAM_WIDTH = 180;
const HEURISTIC_CANDIDATES = 420;
const VALIDATION_BATTLES = 30;

const classes: CharacterType[] = ['warrior', 'elementalist', 'frostmage'];

function mod(type: ItemMod['type'], value: number, tier = 1): ItemMod {
  return { type, value, tier };
}

let itemSeq = 0;
function item(
  id: string,
  name: string,
  slot: Item['slot'],
  atk: number,
  def: number,
  mods: ItemMod[],
  evasion = 0
): Item {
  itemSeq += 1;
  return {
    id,
    instanceId: `${id}_${itemSeq}`,
    name,
    slot,
    atk,
    def,
    evasion,
    mods,
  };
}

function rareWeapon(id: string, extra: ItemMod): Item {
  return item(id, id, 'weapon', 220, 0, [
    mod('atk_bonus', 75),
    mod('atk_increased_pct', 45),
    mod('hp_bonus', 240, 3),
    extra,
  ]);
}

const rareDefArmor = item('rare_def_armor', '良MOD通常鎧', 'armor', 0, 180, [
  mod('damage_reduction_pct', 5),
  mod('damage_defer_pct', 12),
  mod('hp_bonus', 300, 3),
  mod('def_increased_pct', 45),
]);

const rareEvaArmor = item('rare_eva_armor', '良MOD回避鎧', 'armor', 0, 90, [
  mod('evasion', 80),
  mod('evasion_increased_pct', 45),
  mod('damage_defer_pct', 12),
  mod('hp_bonus', 300, 3),
], 78);

const rareAsDefGloves = item('rare_as_def_gloves', '良MOD通常手', 'gloves', 70, 80, [
  mod('attack_speed_pct', 30),
  mod('def_bonus', 75),
  mod('def_increased_pct', 45),
  mod('hp_on_hit', 70),
]);

const rareAsPoisonGloves = item('rare_as_poison_gloves', '良MOD毒手', 'gloves', 70, 60, [
  mod('attack_speed_pct', 30),
  mod('poison_chance', 50),
  mod('poison_damage_pct', 60, 3),
  mod('hp_on_hit', 70),
]);

const rareDefBoots = item('rare_def_boots', '良MOD通常足', 'boots', 48, 120, [
  mod('atk_bonus', 50),
  mod('atk_increased_pct', 30),
  mod('hp_bonus', 300, 3),
  mod('def_increased_pct', 30),
]);

const rareEvaBoots = item('rare_eva_boots', '良MOD回避足', 'boots', 48, 60, [
  mod('evasion', 80),
  mod('evasion_increased_pct', 45),
  mod('hp_bonus', 300, 3),
  mod('def_increased_pct', 30),
], 66);

const uberCrown = item('uber_crown_of_end', 'Uber 終焉の王冠', 'accessory', 200, 200, [
  mod('atk_bonus', 120, 0),
  mod('def_bonus', 120, 0),
  mod('hp_regen', 200, 0),
  mod('critical_chance', 60, 0),
]);

const doubleStrike = item('uber_uber_double_strike_ring', 'UberUber 双撃の指輪', 'accessory', 200, 200, [
  mod('follow_up_attack_pct', 100, 0),
  mod('hp_on_hit', 200, 0),
  mod('attack_speed_pct', 25, 0),
  mod('def_bonus', 150, 0),
]);

const evaCrown = item('uber_end_evasion_crown', 'Uber 終焉の幻冠', 'accessory', 120, 0, [
  mod('evasion', 40, 0),
  mod('evasion_increased_pct', 15, 0),
  mod('evasion_more_pct', 4, 0),
  mod('hp_bonus', 280, 0),
], 220);

const uberEvaArmor = item('uber_goblin_evasion_cloak', 'Uber ゴブリンの影外套', 'armor', 0, 0, [
  mod('evasion_increased_pct', 12, 0),
  mod('shield_on_evade_streak_hit_pct', 5, 0),
  mod('hp_bonus', 180, 0),
  mod('damage_defer_pct', 12),
], 170);

const uberEvaGloves = item('uber_demon_evasion_grip', 'Uber 魔王の幻影篭手', 'gloves', 70, 0, [
  mod('evasion_increased_pct', 12, 0),
  mod('ignite_resist_pct', 10, 0),
  mod('hp_bonus', 240, 0),
  mod('attack_speed_pct', 30),
], 170);

const uberEvaBoots = item('uber_bandit_evasion_steps', 'Uber 盗賊王の幻歩', 'boots', 45, 0, [
  mod('evasion', 30, 0),
  mod('evasion_increased_pct', 12, 0),
  mod('attack_speed_pct', 15, 0),
  mod('hp_on_hit', 45, 0),
], 160);

function loadouts(): Array<{ label: string; equipment: EquipmentSet }> {
  const weapons = [
    rareWeapon('rare_atk_def_weapon', mod('def_bonus', 75)),
    rareWeapon('rare_atk_def_inc_weapon', mod('def_increased_pct', 45)),
    rareWeapon('rare_atk_poison_weapon', mod('poison_chance', 50)),
  ];
  const accessories = [
    ['CROWN', uberCrown],
    ['DOUBLE', doubleStrike],
    ['EVA_CROWN', evaCrown],
  ] as const;
  const bodies = [
    ['RARE_DEF', rareDefArmor, rareAsDefGloves, rareDefBoots],
    ['RARE_POISON', rareDefArmor, rareAsPoisonGloves, rareDefBoots],
    ['RARE_EVA', rareEvaArmor, rareAsPoisonGloves, rareEvaBoots],
    ['UBER_EVA', uberEvaArmor, uberEvaGloves, uberEvaBoots],
  ] as const;

  const out: Array<{ label: string; equipment: EquipmentSet }> = [];
  for (const weapon of weapons) {
    for (const [bodyLabel, armor, gloves, boots] of bodies) {
      for (const [accessoryLabel, accessory] of accessories) {
        out.push({
          label: `${weapon.id}+${bodyLabel}+${accessoryLabel}`,
          equipment: {
            name: `${weapon.id}+${bodyLabel}+${accessoryLabel}`,
            weapon,
            armor,
            gloves,
            boots,
            accessory,
          },
        });
      }
    }
  }
  return out;
}

function activate(classType: CharacterType): void {
  setActivePassiveSeason(3);
  setActivePassiveClass(classType);
}

function nodeValue(node: PassiveNode): number {
  const e = node.effect;
  let score = 0;
  score += (e.atk ?? 0) * 0.10;
  score += (e.atk_increased_pct ?? 0) * 2.2;
  score += (e.atk_more_pct ?? 0) * 18;
  score += (e.attack_speed_pct ?? 0) * 4.0;
  score += (e.attack_speed_more_pct ?? 0) * 28;
  score += (e.poison_chance ?? 0) * 6.0;
  score += (e.poison_damage_pct ?? 0) * 3.6;
  score += (e.poison_damage_more_pct ?? 0) * 32;
  score += (e.poison_max_stacks ?? 0) * 260;
  score += (e.poison_lifesteal ?? 0) * 18;
  score += e.no_direct_damage ? -900 : 0;
  score += (e.ignite_damage_reduction ?? 0) * 10;
  score += (e.def ?? 0) * 0.08;
  score += (e.def_increased_pct ?? 0) * 1.6;
  score += (e.def_more_pct ?? 0) * 18;
  score += (e.hp ?? 0) * 0.08;
  score += (e.hp_increased_pct ?? 0) * 1.3;
  score += (e.damage_defer_pct ?? 0) * 10;
  score += (e.block_chance ?? 0) * 6;
  score += (e.evasion ?? 0) * 1.5;
  score += (e.evasion_increased_pct ?? 0) * 4.5;
  score += (e.evasion_more_pct ?? 0) * 55;
  score += (e.shield_on_evade_streak_hit_pct ?? 0) * 35;
  score += (e.shield ?? 0) * 0.15;
  score += (e.shield_increased_pct ?? 0) * 2.2;
  score += (e.shield_more_pct ?? 0) * 25;
  score += (e.shield_on_10_attacks_pct ?? 0) * 18;
  score += (e.hp_on_hit ?? 0) * 4;
  score += (e.hp_regen ?? 0) * 0.8;
  score += (e.hp_regen_pct ?? 0) * 18;
  score += (e.repeat_hit_damage_reduction_pct ?? 0) * 7;
  score += (e.low_hp_damage_reduction_pct ?? 0) * 5;
  score += (e.chill_resist_pct ?? 0) * 3;
  score += (e.freeze_resist_pct ?? 0) * 3;
  score += e.auto_cleanse_interval_ms ? Math.max(0, 250 - e.auto_cleanse_interval_ms / 10) : 0;
  score += (e.ignite_chance ?? 0) * 0.8;
  score += (e.ignite_damage_pct ?? 0) * 0.6;
  score += (e.freeze_chance ?? 0) * 0.9;
  score += (e.chill_chance ?? 0) * 0.8;
  score += ((e.chill_freeze_damage_mult ?? 1) - 1) * 220;
  score += (e.critical_chance ?? 0) * 0.15;
  score += (e.critical_damage ?? 0) * 0.10;
  return score;
}

function pathValue(nodes: string[]): number {
  activate(activeClassForPath);
  const passive = calculatePassiveEffects(nodes);
  return nodes.reduce((sum, id) => sum + nodeValue(getPassiveNode(id)!), 0)
    + passive.poison_max_stacks * passive.poison_chance * 8
    + passive.evasion * (1 + passive.evasion_increased_pct / 100) * 1.2
    + passive.shield_on_evade_streak_hit_pct * Math.max(1, passive.evasion / 80) * 45;
}

let activeClassForPath: CharacterType = 'warrior';

function beamPaths(classType: CharacterType): string[][] {
  activeClassForPath = classType;
  activate(classType);
  const budget = passiveNodeBudget(LEVEL);
  const start = getStartNodeId();
  let beam = [{ nodes: [start], value: nodeValue(getPassiveNode(start)!) }];

  while (beam[0]?.nodes.length < budget) {
    const next = new Map<string, { nodes: string[]; value: number }>();
    for (const entry of beam) {
      const unlockable = getUnlockableNodes(entry.nodes).filter((node) => !node.id.startsWith('pet_'));
      for (const node of unlockable) {
        const nodes = [...entry.nodes, node.id];
        const value = pathValue(nodes);
        const key = nodes.join(',');
        const current = next.get(key);
        if (!current || value > current.value) next.set(key, { nodes, value });
      }
    }
    beam = [...next.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, BEAM_WIDTH);
    if (beam.length === 0) break;
  }
  return beam
    .sort((a, b) => b.value - a.value)
    .slice(0, HEURISTIC_CANDIDATES)
    .map((entry) => entry.nodes);
}

function spec(classType: CharacterType): BuildSpec {
  return {
    label: `${classType} practical`,
    classType,
    kind: 'poison',
    equipmentType: 'POISON',
    petId: 'pet_end_bringer',
    petLevel: 6,
    offenseWeight: 1,
    defenseWeight: 1,
  };
}

const uberSets = [
  ['uber_poison_1', 'uber_poison_2', 'uber_poison_3', 'uber_poison_4', 'uber_def_1', 'uber_def_2'],
  ['uber_def_1', 'uber_def_2', 'uber_def_3', 'uber_def_4', 'uber_poison_1', 'uber_poison_2'],
  ['uber_atk_1', 'uber_atk_2', 'uber_atk_3', 'uber_atk_4', 'uber_poison_1', 'uber_poison_2'],
  ['uber_poison_1', 'uber_poison_2', 'uber_poison_3', 'uber_poison_4', 'uber_atk_1', 'uber_atk_2'],
  ['uber_def_1', 'uber_def_2', 'uber_def_3', 'uber_def_4', 'uber_atk_1', 'uber_atk_2'],
];

function objective(dpsRatio: number, defRatio: number): number {
  return Math.min(dpsRatio, defRatio) * 10 + Math.min(2, dpsRatio) + Math.min(2, defRatio) * 1.5;
}

function rng(seedValue: number): () => number {
  let state = seedValue || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function validate(state: ReturnType<typeof createBuildState>, enemy: ReturnType<typeof representativeEnemy>, dungeonId: string): {
  wins: number;
  avgSeconds: number;
  avgEnemyHp: number;
} {
  let wins = 0;
  let seconds = 0;
  let enemyHp = 0;
  const base = hash(`${dungeonId}|${state.nodes.join(',')}|${state.uberNodes.join(',')}|${state.stats.atk}|${state.stats.def}|${state.mods.evasion}`);
  for (let i = 0; i < VALIDATION_BATTLES; i++) {
    const { engine } = createBattleEngine({
      playerStats: state.stats,
      playerCurrentHp: state.stats.maxHp,
      playerMods: state.mods,
      enemy,
      dungeonId,
      rng: rng(base + i + 1),
    });
    const result = runBattleEngineToEnd(engine, enemy.exp ?? 0, SIM_SECONDS * TICKS_PER_SECOND);
    const finalState = engine.getState();
    if (result.victory) wins += 1;
    seconds += result.totalTicks / TICKS_PER_SECOND;
    enemyHp += finalState.enemy.currentHp;
  }
  return {
    wins,
    avgSeconds: seconds / VALIDATION_BATTLES,
    avgEnemyHp: enemyHp / VALIDATION_BATTLES,
  };
}

function main(): void {
  const scenario = targetScenarios.find((target) => target.dungeonId === 'uber_uber_kraken')!;
  const enemy = representativeEnemy(scenario);
  const req = dungeonRequirement(scenario.dungeon, scenario.resolveEnemy);
  const equips = loadouts();

  console.log('実戦値ビーム探索: UberUber クラーケン / 良MOD通常装備 + 王冠/双撃/EVA Unique');
  console.log(`beam=${BEAM_WIDTH} paths=${HEURISTIC_CANDIDATES} loadouts=${equips.length} battles=${VALIDATION_BATTLES}`);

  for (const classType of classes) {
    activate(classType);
    const paths = beamPaths(classType);
    const candidates: Array<{
      state: ReturnType<typeof createBuildState>;
      loadout: string;
      score: number;
      dpsRatio: number;
      defRatio: number;
      combat: ReturnType<typeof scoreCombat>;
    }> = [];

    for (const nodes of paths) {
      for (const loadout of equips) {
        for (const uberNodes of uberSets) {
          const state = createBuildState(LEVEL, spec(classType), loadout.equipment, nodes, uberNodes);
          const combat = scoreCombat(state, enemy, spec(classType), { dungeonId: scenario.dungeonId });
          const dpsRatio = combat.dps / req.requiredDps;
          const defRatio = combat.defenseScore / req.requiredDefense;
          candidates.push({
            state,
            loadout: loadout.label,
            score: objective(dpsRatio, defRatio),
            dpsRatio,
            defRatio,
            combat,
          });
        }
      }
    }

    const shortlist = candidates.sort((a, b) => b.score - a.score).slice(0, 18);
    const validated = shortlist
      .map((candidate) => ({
        ...candidate,
        result: validate(candidate.state, enemy, scenario.dungeonId),
      }))
      .sort((a, b) =>
        b.result.wins - a.result.wins ||
        a.result.avgEnemyHp - b.result.avgEnemyHp ||
        b.score - a.score
      );

    const best = validated[0];
    const p = best.state.mods;
    console.log('');
    console.log(`## ${classType}`);
    console.log(`wins=${best.result.wins}/${VALIDATION_BATTLES} avgTime=${best.result.avgSeconds.toFixed(1)}s avgEnemyHp=${Math.round(best.result.avgEnemyHp).toLocaleString()}`);
    console.log(`approx DPS/Req=${best.dpsRatio.toFixed(2)} DEF/Req=${best.defRatio.toFixed(2)} loadout=${best.loadout} uber=${uberSummary(best.state.uberNodes)}`);
    console.log(`stats HP=${best.state.stats.maxHp} ATK=${best.state.stats.atk} DEF=${best.state.stats.def} shield=${best.state.vitals.maxShield} EVA=${p.evasion} block=${p.blockChance} follow=${p.followUpAttackPct} hpOnHit=${p.hpOnHit}`);
    console.log(`mods poison=${p.poisonChance}/${p.poisonDamagePct}/stack+${p.poisonMaxStacks} AS=${p.attackSpeedPct} defer=${p.damageDeferPct} dr=${p.damageReductionPct} shieldOnEvade=${p.shieldOnEvadeStreakHitPct}`);
    console.log(`mix=${mixSummary(classType, best.state.nodes)}`);
    console.log(`nodes=${summarizeNodes(best.state.nodes)}`);
    console.log(`topNodeIds=${best.state.nodes.map((id) => getPassiveNode(id)?.name ?? id).slice(-18).join(' / ')}`);
  }
}

main();
