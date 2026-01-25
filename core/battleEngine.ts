import {
  BattleConfig,
  BattleEvent,
  CombinedModEffects,
  GaugeBattleResult,
  GaugeBattleState,
  Stats,
  DEFAULT_BATTLE_CONFIG,
  EnemyConfig,
  PoisonStack,
} from './types';
import { getAttackSpeedFromMods } from './modEffects';
import {
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
  executePlayerAttack,
  processPoisonDamage,
  tryApplyPoison,
  createHpRegenEvent,
  createLifestealEvent,
  createEnemyAttackEvent,
} from './combatEffects';
import {
  getEnemyAtkMultiplier,
  getEnemyAttackSpeedMultiplier,
  getEnemyDamageReductionPct,
  getEnemyHpOnHit,
  getEnemyRegenPerSecond,
  getPlayerAtkMultiplier,
  getPlayerAttackSpeedMultiplier,
  getPlayerDefMultiplier,
  getBaseBossId,
  isEndContentDungeon,
  isUberBoss,
  getBossSkillName,
} from './endContent';
import { calculateDamage } from './battle';
import {
  BossEffectState,
  BossSkillId,
  createBossEffectState,
  createBossIntroEvents,
  applyEnemyAttackPostEffects,
  applyEnemyAttackPreEffects,
  applyEnemyHpThresholdEffects,
  applyPlayerAttackPostEffects,
} from './bossBehaviors';

export interface BattleEngineConfig {
  playerStats: Stats;
  playerCurrentHp: number;
  playerMods: CombinedModEffects;
  enemy: EnemyConfig & { attackSpeed?: number };
  dungeonId?: string;
  config?: BattleConfig;
  rng?: () => number;
}

export interface BattleEngine {
  getState: () => GaugeBattleState;
  getBossEffects: () => BossEffectState;
  advanceTicks: (ticks: number) => BattleEvent[];
  isFinished: () => boolean;
  setTransitioning: (value: boolean) => void;
}

interface BattleEngineState {
  state: GaugeBattleState;
  bossEffects: BossEffectState;
  playerStats: Stats;
  playerMods: CombinedModEffects;
  enemy: EnemyConfig & { attackSpeed?: number };
  config: BattleConfig;
  rng: () => number;
  dungeonId?: string;
  regenCounter: number;
  enemyRegenCounter: number;
  playerAttackSpeedBase: number;
  enemyAttackSpeedBase: number;
  isTransitioning: boolean;
}

const createBossSkillEvent = (tick: number, skillId: BossSkillId): BattleEvent => ({
  type: 'boss_skill',
  tick,
  data: { skillId },
});

const createPlayerPoisonEvent = (tick: number, stack: PoisonStack): BattleEvent => ({
  type: 'player_poison_applied',
  tick,
  data: { damagePerTurn: stack.damagePerTick, turns: stack.remainingTicks },
});

export const createBattleEngine = (config: BattleEngineConfig): { engine: BattleEngine; events: BattleEvent[] } => {
  const battleConfig = config.config ?? DEFAULT_BATTLE_CONFIG;
  const rng = config.rng ?? Math.random;
  const isEndContent = config.dungeonId ? isEndContentDungeon(config.dungeonId) : false;
  const enemyId = config.enemy.id;

  const bossEffects = createBossEffectState();

  const playerAtkMultiplier = isEndContent ? getPlayerAtkMultiplier(enemyId) : 1;
  const playerDefMultiplier = isEndContent ? getPlayerDefMultiplier(enemyId) : 1;
  const enemyAtkMultiplier = isEndContent ? getEnemyAtkMultiplier(enemyId) : 1;
  const enemySpeedMultiplier = isEndContent ? getEnemyAttackSpeedMultiplier(enemyId) : 1;
  const playerSpeedMultiplier = isEndContent ? getPlayerAttackSpeedMultiplier(enemyId) : 1;

  const playerAttackSpeedBase = getAttackSpeedFromMods(config.playerMods) * playerSpeedMultiplier;
  const enemyAttackSpeedBase = (config.enemy.attackSpeed ?? 1) * enemySpeedMultiplier;

  const state: GaugeBattleState = {
    player: {
      currentHp: config.playerCurrentHp,
      maxHp: config.playerStats.maxHp,
      atk: Math.max(1, Math.floor(config.playerStats.atk * playerAtkMultiplier)),
      def: Math.max(0, Math.floor(config.playerStats.def * playerDefMultiplier)),
      attackSpeed: playerAttackSpeedBase,
      gauge: 0,
    },
    enemy: {
      currentHp: config.enemy.maxHp,
      maxHp: config.enemy.maxHp,
      atk: Math.max(1, Math.floor(config.enemy.atk * enemyAtkMultiplier)),
      def: Math.max(0, Math.floor(config.enemy.def)),
      attackSpeed: enemyAttackSpeedBase,
      gauge: 0,
    },
    enemyPoisonStacks: [],
    playerPoisonStacks: [],
    elapsedTicks: 0,
    isFinished: false,
    winner: null,
  };

  const events: BattleEvent[] = [];

  if (isEndContent) {
    const skillName = getBossSkillName(enemyId);
    if (skillName) {
      events.push({
        type: 'boss_intro',
        tick: 0,
        data: { skillName },
      });
    }
    const intro = createBossIntroEvents(0, enemyId);
    if (intro.events.length > 0) {
      events.push(...intro.events);
    }
    if (intro.playerPoison) {
      state.playerPoisonStacks = [intro.playerPoison];
      events.push(createPlayerPoisonEvent(0, intro.playerPoison));
    }
  }

  const engineState: BattleEngineState = {
    state,
    bossEffects,
    playerStats: config.playerStats,
    playerMods: config.playerMods,
    enemy: config.enemy,
    config: battleConfig,
    rng,
    dungeonId: config.dungeonId,
    regenCounter: 0,
    enemyRegenCounter: 0,
    playerAttackSpeedBase,
    enemyAttackSpeedBase,
    isTransitioning: false,
  };

  const engine: BattleEngine = {
    getState: () => engineState.state,
    getBossEffects: () => engineState.bossEffects,
    isFinished: () => engineState.state.isFinished,
    advanceTicks: (ticks: number) => advanceBattleEngineTicks(engineState, ticks),
    setTransitioning: (value: boolean) => {
      engineState.isTransitioning = value;
    },
  };

  return { engine, events };
};

const advanceBattleEngineTicks = (engine: BattleEngineState, ticks: number): BattleEvent[] => {
  const events: BattleEvent[] = [];
  if (engine.state.isFinished || ticks <= 0) return events;

  const isEndContent = engine.dungeonId ? isEndContentDungeon(engine.dungeonId) : false;
  const enemyId = engine.enemy.id;
  const enemyDamageReductionBase = isEndContent ? getEnemyDamageReductionPct(enemyId) : 0;
  const enemyRegenBase = isEndContent ? getEnemyRegenPerSecond(enemyId) : 0;
  const enemyHpOnHitBase = isEndContent ? getEnemyHpOnHit(enemyId) : 0;

  for (let i = 0; i < ticks; i++) {
    if (engine.state.isFinished) break;

    engine.state.elapsedTicks += 1;
    const timeStacks = Math.floor(
      engine.state.elapsedTicks / (engine.config.ticksPerSecond * 5)
    );
    const timeAtkIncPct = engine.playerMods.timeAtkIncPct * timeStacks;
    const timeDefIncPct = engine.playerMods.timeDefIncPct * timeStacks;
    const timeHpRegenBonus = engine.playerMods.timeHpRegen * timeStacks;
    const effectivePlayerAtk = Math.max(
      1,
      Math.floor(engine.state.player.atk * (1 + timeAtkIncPct / 100))
    );
    const effectivePlayerDef = Math.max(
      0,
      Math.floor(engine.state.player.def * (1 + timeDefIncPct / 100))
    );

    const playerAS = engine.playerAttackSpeedBase * engine.bossEffects.playerAttackSpeedMult;
    const enemyAS = engine.enemyAttackSpeedBase * engine.bossEffects.enemyAttackSpeedMult;
    const gaugePerTick = engine.config.baseGaugePerSecond / engine.config.ticksPerSecond;

    // 遷移中はゲージを進めない
    if (!engine.isTransitioning) {
      engine.state.player.gauge += playerAS * gaugePerTick;
      engine.state.enemy.gauge += enemyAS * gaugePerTick;
    }

    // HP回復（1秒ごと）
    engine.regenCounter += 1;
    while (engine.regenCounter >= engine.config.ticksPerSecond) {
      engine.regenCounter -= engine.config.ticksPerSecond;
      const regenMods = timeHpRegenBonus > 0
        ? { ...engine.playerMods, hpRegen: engine.playerMods.hpRegen + timeHpRegenBonus }
        : engine.playerMods;
      const regenAmount = calculateHpRegen(
        engine.state.player.currentHp,
        engine.state.player.maxHp,
        regenMods
      );
      if (regenAmount > 0) {
        const scaled = Math.floor(regenAmount * engine.bossEffects.playerHealingMult);
        if (scaled > 0) {
          engine.state.player.currentHp = Math.min(
            engine.state.player.maxHp,
            engine.state.player.currentHp + scaled
          );
          const regenEvent = createHpRegenEvent(engine.state.elapsedTicks, scaled);
          if (regenEvent) events.push(regenEvent);
        }
      }
    }

    // 敵HP回復（エンドコンテンツ）
    if (enemyRegenBase > 0) {
      engine.enemyRegenCounter += 1;
      while (engine.enemyRegenCounter >= engine.config.ticksPerSecond) {
        engine.enemyRegenCounter -= engine.config.ticksPerSecond;
        let regenPerSecond = enemyRegenBase;
        const baseBossId = getBaseBossId(enemyId);
        const isUber = isUberBoss(enemyId);
        if (baseBossId === 'demon_lord' && isUber && engine.bossEffects.demonCrown) {
          regenPerSecond *= 2;
        }
        const nextEnemyHp = Math.min(
          engine.state.enemy.maxHp,
          engine.state.enemy.currentHp + regenPerSecond
        );
        const amount = nextEnemyHp - engine.state.enemy.currentHp;
        if (amount > 0) {
          engine.state.enemy.currentHp = nextEnemyHp;
          events.push({
            type: 'enemy_heal',
            tick: engine.state.elapsedTicks,
            data: { amount, source: 'regen' },
          });
        }
      }
    }

    // プレイヤー行動（多重行動対応）
    // 遷移中は攻撃処理をスキップ
    let playerActions = 0;
    while (!engine.isTransitioning && engine.state.player.gauge >= 100 && playerActions < 5) {
      playerActions += 1;

      // 毒ダメージ処理（プレイヤー行動時）
      if (engine.state.enemyPoisonStacks.length > 0) {
        const poisonResult = processPoisonDamage(engine.state, engine.state.elapsedTicks, engine.playerMods);
        if (poisonResult.totalDamage > 0) {
          engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - poisonResult.totalDamage);
          engine.state.enemyPoisonStacks = poisonResult.updatedStacks;
          events.push(...poisonResult.events);

          if (poisonResult.healAmount > 0) {
            const scaledHeal = Math.floor(poisonResult.healAmount * engine.bossEffects.playerHealingMult);
            if (scaledHeal > 0) {
              engine.state.player.currentHp = Math.min(
                engine.state.player.maxHp,
                engine.state.player.currentHp + scaledHeal
              );
              const healEvent = createHpRegenEvent(engine.state.elapsedTicks, scaledHeal);
              if (healEvent) events.push(healEvent);
            }
          }

          if (engine.state.enemy.currentHp <= 0) {
            engine.state.isFinished = true;
            engine.state.winner = 'player';
            events.push({
              type: 'enemy_defeated',
              tick: engine.state.elapsedTicks,
              data: { byPoison: true },
            });
            break;
          }
        }
      }

      const effectiveMods: CombinedModEffects = {
        ...engine.playerMods,
        criticalChance: engine.playerMods.criticalChance * engine.bossEffects.playerCritChanceMult,
        poisonChance: engine.playerMods.poisonChance * engine.bossEffects.playerPoisonChanceMult,
      };

      const totalEnemyDamageReduction = enemyDamageReductionBase
        + engine.bossEffects.enemyDamageReductionTempPct
        + engine.bossEffects.enemyDamageReductionStackPct;

      const attackResult = executePlayerAttack(
        engine.state,
        effectivePlayerAtk,
        effectiveMods,
        engine.config,
        engine.rng,
        totalEnemyDamageReduction
      );
      events.push(...attackResult.events);

      engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - attackResult.damage);
      engine.state.player.gauge = Math.max(0, engine.state.player.gauge - 100);

      if (attackResult.damage > 0 && engine.state.player.currentHp < engine.state.player.maxHp) {
        const lifestealAmount = calculateLifesteal(
          attackResult.damage,
          attackResult.isCritical,
          effectiveMods
        );
        const scaledLifesteal = Math.floor(lifestealAmount * engine.bossEffects.playerHealingMult);
        if (scaledLifesteal > 0) {
          engine.state.player.currentHp = Math.min(
            engine.state.player.maxHp,
            engine.state.player.currentHp + scaledLifesteal
          );
          const lifestealEvent = createLifestealEvent(engine.state.elapsedTicks, scaledLifesteal);
          if (lifestealEvent) events.push(lifestealEvent);
        }
      }

      const baseDamage = calculateDamage(effectivePlayerAtk, engine.state.enemy.def, totalEnemyDamageReduction);
      const poisonResult = tryApplyPoison(engine.state, baseDamage, effectiveMods, engine.config, engine.rng);
      if (poisonResult.poisonStack) {
        engine.state.enemyPoisonStacks = [...engine.state.enemyPoisonStacks, poisonResult.poisonStack];
        if (poisonResult.event) events.push(poisonResult.event);
      }

      const baseBossId = getBaseBossId(enemyId);
      if (baseBossId === 'demon_lord' && engine.bossEffects.demonMark && attackResult.damage > 0) {
        const reflectDamage = Math.max(1, Math.floor(attackResult.damage * 0.05));
        engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - reflectDamage);
        events.push({
          type: 'player_damage',
          tick: engine.state.elapsedTicks,
          data: { damage: reflectDamage, reason: 'demon_mark_reflect' },
        });
      }

      if (engine.state.enemy.currentHp <= 0) {
        engine.state.isFinished = true;
        engine.state.winner = 'player';
        events.push({
          type: 'enemy_defeated',
          tick: engine.state.elapsedTicks,
          data: { byPoison: false },
        });
        break;
      }

      const thresholdEvents = applyEnemyHpThresholdEffects(
        {
          enemyId,
          enemyMaxHp: engine.state.enemy.maxHp,
          enemyCurrentHp: engine.state.enemy.currentHp,
          playerCurrentHp: engine.state.player.currentHp,
          playerMaxHp: engine.state.player.maxHp,
        },
        engine.bossEffects,
        engine.state.elapsedTicks
      );
      if (thresholdEvents.length > 0) events.push(...thresholdEvents);

      const postEvents = applyPlayerAttackPostEffects(
        {
          enemyId,
          enemyMaxHp: engine.state.enemy.maxHp,
          enemyCurrentHp: engine.state.enemy.currentHp,
          playerCurrentHp: engine.state.player.currentHp,
          playerMaxHp: engine.state.player.maxHp,
        },
        engine.bossEffects,
        engine.state.elapsedTicks
      );
      if (postEvents.length > 0) events.push(...postEvents);
    }

    if (engine.state.isFinished) {
      break;
    }

    // 敵行動（多重行動対応）
    // 遷移中は攻撃処理をスキップ
    let enemyActions = 0;
    while (!engine.isTransitioning && engine.state.enemy.gauge >= 100 && enemyActions < 5) {
      enemyActions += 1;
      const pre = applyEnemyAttackPreEffects(
        {
          enemyId,
          enemyMaxHp: engine.state.enemy.maxHp,
          enemyCurrentHp: engine.state.enemy.currentHp,
          playerCurrentHp: engine.state.player.currentHp,
          playerMaxHp: engine.state.player.maxHp,
        },
        engine.bossEffects,
        engine.state.elapsedTicks
      );
      if (pre.events.length > 0) events.push(...pre.events);
      if (pre.applyPlayerPoison) {
        engine.state.playerPoisonStacks = [...engine.state.playerPoisonStacks, pre.applyPlayerPoison];
        events.push(createPlayerPoisonEvent(engine.state.elapsedTicks, pre.applyPlayerPoison));
      }
      if (pre.resetPlayerGauge) {
        engine.state.player.gauge = 0;
        events.push({
          type: 'reset_player_gauge',
          tick: engine.state.elapsedTicks,
          data: {},
        });
        events.push(createBossSkillEvent(engine.state.elapsedTicks, 'final_time_sever'));
      }

      if (engine.state.playerPoisonStacks.length > 0) {
        const poisonDamage = engine.state.playerPoisonStacks.reduce(
          (sum, stack) => sum + stack.damagePerTick,
          0
        );
        const updatedStacks = engine.state.playerPoisonStacks
          .map((stack) => ({ ...stack, remainingTicks: stack.remainingTicks - 1 }))
          .filter((stack) => stack.remainingTicks > 0);
        engine.state.playerPoisonStacks = updatedStacks;
        engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - poisonDamage);
        if (poisonDamage > 0) {
          events.push({
            type: 'player_poison_damage',
            tick: engine.state.elapsedTicks,
            data: { damage: poisonDamage },
          });
        }
        if (engine.state.player.currentHp <= 0) {
          engine.state.isFinished = true;
          engine.state.winner = 'enemy';
          events.push({
            type: 'player_defeated',
            tick: engine.state.elapsedTicks,
            data: { byPoison: true },
          });
          break;
        }
      }

      const enemyDamage = calculateEnemyDamage(
        engine.state.enemy.atk,
        effectivePlayerDef,
        engine.playerMods,
        engine.state.enemyPoisonStacks.length > 0
      );
      const enemyAttackMultiplier = engine.bossEffects.enemyAttackMult * engine.bossEffects.enemyNextAttackMult;
      const rawEnemyDamage = Math.floor(enemyDamage * enemyAttackMultiplier);
      const finalEnemyDamage = Math.floor(rawEnemyDamage * engine.bossEffects.playerDamageTakenMult);
      engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - finalEnemyDamage);
      engine.state.enemy.gauge = Math.max(0, engine.state.enemy.gauge - 100);
      events.push(createEnemyAttackEvent(engine.state.elapsedTicks, finalEnemyDamage));

      if (enemyHpOnHitBase > 0) {
        let hpOnHitMult = engine.bossEffects.enemyHpOnHitMult;
        const baseBossId = getBaseBossId(enemyId);
        if (baseBossId === 'vampire' && engine.state.playerPoisonStacks.length > 0) {
          hpOnHitMult *= 1.5;
          if (!engine.bossEffects.vampireNightFeastLogged) {
            engine.bossEffects.vampireNightFeastLogged = true;
            events.push(createBossSkillEvent(engine.state.elapsedTicks, 'vampire_night_feast'));
          }
        }
        if (baseBossId === 'vampire' && isUberBoss(enemyId) && engine.bossEffects.vampirePact) {
          const ratio = Math.min(1, Math.max(0, engine.state.player.currentHp / Math.max(1, engine.state.player.maxHp)));
          hpOnHitMult *= 1 + ratio * 0.5;
        }
        const amount = Math.floor(enemyHpOnHitBase * hpOnHitMult + engine.bossEffects.enemyHpOnHitBonus);
        if (amount > 0) {
          engine.state.enemy.currentHp = Math.min(
            engine.state.enemy.maxHp,
            engine.state.enemy.currentHp + amount
          );
          events.push({
            type: 'enemy_heal',
            tick: engine.state.elapsedTicks,
            data: { amount, source: 'on_hit' },
          });
          if (engine.bossEffects.enemyHpOnHitMultRemaining > 0) {
            engine.bossEffects.enemyHpOnHitMultRemaining -= 1;
            if (engine.bossEffects.enemyHpOnHitMultRemaining <= 0) {
              engine.bossEffects.enemyHpOnHitMult = 1;
            }
          }
        }
      }

      if (engine.state.player.currentHp <= 0) {
        engine.state.isFinished = true;
        engine.state.winner = 'enemy';
        events.push({
          type: 'player_defeated',
          tick: engine.state.elapsedTicks,
          data: {},
        });
        break;
      }

      applyEnemyAttackPostEffects(engine.bossEffects);
    }

    if (engine.state.isFinished) {
      break;
    }
  }

  return events;
};

export const runBattleEngineToEnd = (
  engine: BattleEngine,
  enemyExp: number,
  maxTicks: number = 30000
): GaugeBattleResult => {
  const events: BattleEvent[] = [];
  while (!engine.isFinished() && engine.getState().elapsedTicks < maxTicks) {
    const tickEvents = engine.advanceTicks(1);
    if (tickEvents.length > 0) {
      events.push(...tickEvents);
    }
  }

  const finalState = engine.getState();
  return {
    victory: finalState.winner === 'player',
    totalTicks: finalState.elapsedTicks,
    playerHpRemaining: finalState.player.currentHp,
    expGained: finalState.winner === 'player' ? enemyExp : 0,
    events,
  };
};
