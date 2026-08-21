/**
 * battleEngineとUIのイベント適用ロジックが一致するかの簡易検証
 *
 * 実行:
 *   npx tsx scripts/verifyBattleEngineConsistency.ts
 */

import { createBattleEngine, createRng, CombinedModEffects, Stats } from '../core';
import { createEmptyModEffects } from '../core/modEffects';
import type { BattleEvent, EnemyConfig, PoisonStack } from '../core/types';
import monstersData from '../data/json/monsters.json';

type UiPoisonStack = { damagePerTurn: number; remainingTurns: number };
type UiState = {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPoison: UiPoisonStack[];
  playerPoison: UiPoisonStack[];
  winner: 'player' | 'enemy' | null;
};

const enemyMap = new Map<string, EnemyConfig>();
for (const [id, monster] of Object.entries(monstersData.monsters)) {
  enemyMap.set(id, monster as EnemyConfig);
}

const createTestMods = (): CombinedModEffects => {
  const base = createEmptyModEffects();
  return {
    ...base,
    poisonChance: 55,
    poisonDamagePct: 80,
    poisonDamageMorePct: [50],
    poisonMaxStacks: 2,
    poisonLifesteal: 30,
    criticalChance: 25,
    criticalDamage: 50,
    hpRegen: 40,
    hpRegenPct: 1,
    hpOnHit: 20,
    hpOnCrit: 30,
    damageDeferPct: 10,
    attackSpeedPct: 20,
  };
};

const applyEventsToUiState = (state: UiState, events: BattleEvent[]): void => {
  for (const event of events) {
    const data = event.data as Record<string, unknown>;
    switch (event.type) {
      case 'player_attack': {
        const damage = Number(data.damage ?? 0);
        state.enemyHp = Math.max(0, state.enemyHp - damage);
        break;
      }
      case 'critical_hit': {
        const damage = Number(data.damage ?? 0);
        state.enemyHp = Math.max(0, state.enemyHp - damage);
        break;
      }
      case 'enemy_attack': {
        const damage = Number(data.damage ?? 0);
        state.playerHp = Math.max(0, state.playerHp - damage);
        break;
      }
      case 'poison_applied': {
        const damagePerTurn = Number(data.damage ?? 0);
        const turns = Number(data.duration ?? 0);
        state.enemyPoison.push({ damagePerTurn, remainingTurns: turns });
        break;
      }
      case 'poison_damage': {
        const damage = Number(data.damage ?? 0);
        state.enemyHp = Math.max(0, state.enemyHp - damage);
        state.enemyPoison = state.enemyPoison
          .map((stack) => ({ ...stack, remainingTurns: stack.remainingTurns - 1 }))
          .filter((stack) => stack.remainingTurns > 0);
        break;
      }
      case 'player_poison_applied': {
        const damagePerTurn = Number(data.damagePerTurn ?? 0);
        const turns = Number(data.turns ?? 0);
        state.playerPoison.push({ damagePerTurn, remainingTurns: turns });
        break;
      }
      case 'player_poison_damage': {
        const damage = Number(data.damage ?? 0);
        state.playerHp = Math.max(0, state.playerHp - damage);
        state.playerPoison = state.playerPoison
          .map((stack) => ({ ...stack, remainingTurns: stack.remainingTurns - 1 }))
          .filter((stack) => stack.remainingTurns > 0);
        break;
      }
      case 'hp_regen':
      case 'lifesteal': {
        const amount = Number(data.amount ?? 0);
        state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount);
        break;
      }
      case 'enemy_heal': {
        const amount = Number(data.amount ?? 0);
        state.enemyHp = Math.min(state.enemyMaxHp, state.enemyHp + amount);
        break;
      }
      case 'player_damage': {
        const damage = Number(data.damage ?? 0);
        state.playerHp = Math.max(0, state.playerHp - damage);
        break;
      }
      case 'deferred_damage': {
        // 遅延ダメージ（damageDeferPct）もプレイヤーHPを削る
        const damage = Number(data.damage ?? 0);
        state.playerHp = Math.max(0, state.playerHp - damage);
        break;
      }
      case 'enemy_defeated':
        state.winner = 'player';
        break;
      case 'player_defeated':
        state.winner = 'enemy';
        break;
      default:
        break;
    }
  }
};

const assertEqual = (label: string, a: number, b: number, tick: number): void => {
  if (a !== b) {
    throw new Error(`[${label}] mismatch at tick ${tick}: ${a} !== ${b}`);
  }
};

const assertPoisonEqual = (label: string, a: PoisonStack[], b: UiPoisonStack[], tick: number): void => {
  if (a.length !== b.length) {
    throw new Error(`[${label}] stack count mismatch at tick ${tick}: ${a.length} !== ${b.length}`);
  }
  for (let i = 0; i < a.length; i++) {
    const core = a[i];
    const ui = b[i];
    if (core.damagePerTick !== ui.damagePerTurn || core.remainingTicks !== ui.remainingTurns) {
      throw new Error(
        `[${label}] stack mismatch at tick ${tick}: core(${core.damagePerTick},${core.remainingTicks}) ui(${ui.damagePerTurn},${ui.remainingTurns})`
      );
    }
  }
};

const verifyBattle = (enemyId: string, maxTicks: number): void => {
  const enemy = enemyMap.get(enemyId);
  if (!enemy) {
    throw new Error(`enemy not found: ${enemyId}`);
  }

  const playerStats: Stats = {
    maxHp: 3200,
    atk: 1100,
    def: 900,
  };
  const mods = createTestMods();

  const rng = createRng(12345);
  const { engine } = createBattleEngine({
    playerStats,
    playerCurrentHp: playerStats.maxHp,
    playerMods: mods,
    enemy: {
      ...enemy,
      attackSpeed: enemy.attackSpeed ?? 1,
    },
    dungeonId: enemyId,
    rng,
  });

  const uiState: UiState = {
    playerHp: playerStats.maxHp,
    playerMaxHp: playerStats.maxHp,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyPoison: [],
    playerPoison: [],
    winner: null,
  };

  for (let tick = 1; tick <= maxTicks; tick++) {
    if (engine.isFinished()) break;
    const events = engine.advanceTicks(1);
    applyEventsToUiState(uiState, events);
    const coreState = engine.getState();

    assertEqual('playerHp', coreState.player.currentHp, uiState.playerHp, tick);
    assertEqual('enemyHp', coreState.enemy.currentHp, uiState.enemyHp, tick);
    assertPoisonEqual('enemyPoison', coreState.enemyPoisonStacks, uiState.enemyPoison, tick);
    assertPoisonEqual('playerPoison', coreState.playerPoisonStacks, uiState.playerPoison, tick);
  }

  if (engine.isFinished()) {
    const coreWinner = engine.getState().winner;
    if (coreWinner !== uiState.winner) {
      throw new Error(`winner mismatch: core=${coreWinner} ui=${uiState.winner}`);
    }
  }
};

const main = (): void => {
  const targets = ['uber_goblin_king', 'uber_true_final_boss'];
  for (const id of targets) {
    verifyBattle(id, 8000);
  }
  console.log('battleEngine consistency check: OK');
};

main();
