import {
  BattleConfig,
  BattleEvent,
  ChillState,
  CombinedModEffects,
  GaugeBattleResult,
  GaugeBattleState,
  Stats,
  DEFAULT_BATTLE_CONFIG,
  EnemyConfig,
  PoisonStack,
  IgniteState,
} from './types';
import { getAttackSpeedFromMods } from './modEffects';
import {
  calculateHpRegen,
  calculateLifesteal,
  calculateEnemyDamage,
  executePlayerAttack,
  processPoisonDamage,
  tryApplyPoison,
  tryApplyIgnite,
  processIgniteDamage,
  tryApplyChill,
  tryApplyFreeze,
  processChillState,
  processFreezeState,
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
  initialIgniteState?: IgniteState | null;  // イグナイト伝染用（前の敵から引き継ぐ発火状態）
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
  pendingEnemyChillAfterFreeze: ChillState | null;  // フリーズ解除後にチルに移行する状態
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

  let playerAttackSpeedBase = getAttackSpeedFromMods(config.playerMods) * playerSpeedMultiplier;
  // 重撃: 攻撃速度-20%
  if (config.playerMods.heavyStrike) {
    playerAttackSpeedBase *= 0.8;
  }
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
    enemyIgniteState: config.initialIgniteState ?? null,  // イグナイト伝染から引き継いだ発火状態
    enemyChillState: null,
    enemyFreezeState: null,
    playerChillState: null,
    playerFreezeState: null,
    igniteApplyCount: 0,  // 発火付与回数（敵撃破時リセット）
    warlordEnrageActivated: false,
    enemyWoundStacks: 0,
    enemyWoundActionCounter: 0,
    deferredDamages: [],
    poisonStackAccumulator: 0,
    elapsedTicks: 0,
    isFinished: false,
    winner: null,
  };

  const events: BattleEvent[] = [];

  // イグナイト伝染: 初期発火状態がある場合、spread イベントを発行
  if (config.initialIgniteState) {
    events.push({
      type: 'ignite_spread',
      tick: 0,
      data: {
        damage: config.initialIgniteState.damage,
        durationMs: config.initialIgniteState.remainingMs,
        tickIntervalMs: config.initialIgniteState.tickIntervalMs,
      },
    });
  }

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
    if (intro.initBossEffects) {
      Object.assign(bossEffects, intro.initBossEffects);
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
    pendingEnemyChillAfterFreeze: null,
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
    // HP回復変換: 毎秒HP回復量の一定%をATKに加算
    let regenToAtkBonus = 0;
    if (engine.playerMods.hpRegenToAtkPct > 0) {
      const baseRegen = engine.playerMods.hpRegen + timeHpRegenBonus;
      const pctRegen = Math.floor(engine.state.player.maxHp * engine.playerMods.hpRegenPct / 100);
      regenToAtkBonus = Math.floor((baseRegen + pctRegen) * engine.playerMods.hpRegenToAtkPct / 100);
    }

    const effectivePlayerAtk = Math.max(
      1,
      Math.floor(engine.state.player.atk * (1 + timeAtkIncPct / 100)) + regenToAtkBonus
    );
    const effectivePlayerDef = Math.max(
      0,
      Math.floor(engine.state.player.def * (1 + timeDefIncPct / 100))
    );

    const playerAS = engine.playerAttackSpeedBase * engine.bossEffects.playerAttackSpeedMult;
    const enemyAS = engine.enemyAttackSpeedBase * engine.bossEffects.enemyAttackSpeedMult;
    const gaugePerTick = engine.config.baseGaugePerSecond / engine.config.ticksPerSecond;

    // チル/フリーズ状態の時間経過処理（敵）
    if (engine.state.enemyChillState) {
      const chillResult = processChillState(engine.state.enemyChillState, engine.state.elapsedTicks, engine.config);
      engine.state.enemyChillState = chillResult.updatedState;
      if (chillResult.event) events.push(chillResult.event);
    }
    if (engine.state.enemyFreezeState) {
      const freezeResult = processFreezeState(
        engine.state.enemyFreezeState,
        engine.pendingEnemyChillAfterFreeze,
        engine.state.elapsedTicks,
        engine.config
      );
      engine.state.enemyFreezeState = freezeResult.updatedState;
      if (freezeResult.event) events.push(freezeResult.event);
      // フリーズ解除時にチルに移行
      if (freezeResult.chillTransition) {
        engine.state.enemyChillState = freezeResult.chillTransition;
        engine.pendingEnemyChillAfterFreeze = null;
        events.push({
          type: 'chill_applied',
          tick: engine.state.elapsedTicks,
          data: {
            speedMultiplier: freezeResult.chillTransition.speedMultiplier,
            durationMs: freezeResult.chillTransition.remainingMs,
            source: 'freeze_transition',
          },
        });
      }
    }

    // チル/フリーズ状態の時間経過処理（プレイヤー）
    if (engine.state.playerChillState) {
      const chillResult = processChillState(engine.state.playerChillState, engine.state.elapsedTicks, engine.config);
      engine.state.playerChillState = chillResult.updatedState;
      if (chillResult.event) events.push(chillResult.event);
    }
    if (engine.state.playerFreezeState) {
      const freezeResult = processFreezeState(engine.state.playerFreezeState, null, engine.state.elapsedTicks, engine.config);
      engine.state.playerFreezeState = freezeResult.updatedState;
      if (freezeResult.event) events.push(freezeResult.event);
    }

    // 攻撃速度にチル/フリーズ倍率を適用
    let playerASFinal = playerAS;
    let enemyASFinal = enemyAS;

    // プレイヤーのチル/フリーズ
    if (engine.state.playerFreezeState) {
      playerASFinal = 0;
    } else if (engine.state.playerChillState) {
      playerASFinal *= engine.state.playerChillState.speedMultiplier;
    }

    // 敵のチル/フリーズ
    if (engine.state.enemyFreezeState) {
      enemyASFinal = 0;
    } else if (engine.state.enemyChillState) {
      enemyASFinal *= engine.state.enemyChillState.speedMultiplier;
    }

    // 遷移中はゲージを進めない
    if (!engine.isTransitioning) {
      engine.state.player.gauge += playerASFinal * gaugePerTick;
      engine.state.enemy.gauge += enemyASFinal * gaugePerTick;
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

      // 遅延ダメージ処理（1秒ごと）
      if (engine.state.deferredDamages.length > 0) {
        let totalDeferredDamage = 0;
        const remaining: typeof engine.state.deferredDamages = [];
        for (const dd of engine.state.deferredDamages) {
          totalDeferredDamage += dd.damagePerTick;
          if (dd.remainingTicks > 1) {
            remaining.push({ damagePerTick: dd.damagePerTick, remainingTicks: dd.remainingTicks - 1 });
          }
        }
        engine.state.deferredDamages = remaining;
        if (totalDeferredDamage > 0) {
          engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - totalDeferredDamage);
          events.push({
            type: 'deferred_damage',
            tick: engine.state.elapsedTicks,
            data: { damage: totalDeferredDamage },
          });
          if (engine.state.player.currentHp <= 0) {
            engine.state.isFinished = true;
            engine.state.winner = 'enemy';
            events.push({
              type: 'player_defeated',
              tick: engine.state.elapsedTicks,
              data: { byDeferredDamage: true },
            });
            break;
          }
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

    // 発火ダメージ処理（時間ベース）
    if (engine.state.enemyIgniteState) {
      const igniteResult = processIgniteDamage(engine.state, engine.state.elapsedTicks, engine.playerMods, engine.config);
      // 発火状態を先に更新（撃破時も正しい状態を保持するため）
      engine.state.enemyIgniteState = igniteResult.updatedState;

      if (igniteResult.totalDamage > 0) {
        engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - igniteResult.totalDamage);
        events.push(...igniteResult.events);

        // 発火ダメージ吸収による回復
        if (igniteResult.healAmount > 0) {
          const actualHeal = Math.min(igniteResult.healAmount, engine.playerStats.maxHp - engine.state.player.currentHp);
          if (actualHeal > 0) {
            engine.state.player.currentHp += actualHeal;
            const lifestealEvent = createLifestealEvent(engine.state.elapsedTicks, actualHeal);
            if (lifestealEvent) events.push(lifestealEvent);
          }
        }

        if (engine.state.enemy.currentHp <= 0) {
          engine.state.isFinished = true;
          engine.state.winner = 'player';
          events.push({
            type: 'enemy_defeated',
            tick: engine.state.elapsedTicks,
            data: { byIgnite: true },
          });
          break;
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

      // チル/フリーズダメージ倍率（Uber氷結の覚醒）
      let chillFreezeMult = 1;
      if (effectiveMods.chillFreezeDamageMult > 1 &&
          (engine.state.enemyChillState || engine.state.enemyFreezeState)) {
        chillFreezeMult = effectiveMods.chillFreezeDamageMult;
      }

      // 重傷スタック倍率（重撃の覚醒）
      let woundMult = 1;
      if (effectiveMods.heavyStrike && engine.state.enemyWoundStacks > 0) {
        woundMult = Math.pow(1.2, engine.state.enemyWoundStacks);
      }

      const combinedMult = chillFreezeMult * woundMult;

      // ダメージ適用（メイン攻撃 + 追撃）に倍率適用
      const scaledMainDamage = Math.floor(attackResult.damage * combinedMult);
      const scaledFollowUpDamage = Math.floor(attackResult.followUpDamage * combinedMult);
      const totalDamage = scaledMainDamage + scaledFollowUpDamage;
      engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - totalDamage);

      // イベントのダメージ値をスケール後の値に差し替え（UI側のHP表示と同期）
      for (const ev of attackResult.events) {
        const d = ev.data as Record<string, unknown>;
        if (ev.type === 'critical_hit' || ev.type === 'player_attack') {
          if (d.damage === attackResult.damage) {
            d.damage = scaledMainDamage;
          } else if (d.damage === attackResult.followUpDamage) {
            d.damage = scaledFollowUpDamage;
          }
        }
      }
      events.push(...attackResult.events);
      engine.state.player.gauge = Math.max(0, engine.state.player.gauge - 100);

      // Uberクリティカル追撃（ATK100%、双撃の指輪とは別）
      let uberFollowUpDamage = 0;
      if (attackResult.isCritical && effectiveMods.uberCriticalFollowUp && !effectiveMods.noDirectDamage) {
        const followUpBase = calculateDamage(effectivePlayerAtk, engine.state.enemy.def, totalEnemyDamageReduction);
        uberFollowUpDamage = Math.floor(followUpBase * combinedMult);
        engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - uberFollowUpDamage);
        events.push({
          type: 'player_attack',
          tick: engine.state.elapsedTicks,
          data: { damage: uberFollowUpDamage },
        });
      }

      // 重撃: 攻撃ごとに重傷スタック付与（上限5）
      if (effectiveMods.heavyStrike && totalDamage > 0) {
        if (engine.state.enemyWoundStacks < 5) {
          engine.state.enemyWoundStacks += 1;
          events.push({
            type: 'wound_applied',
            tick: engine.state.elapsedTicks,
            data: { stacks: engine.state.enemyWoundStacks },
          });
        }
      }

      // 重撃: 与ダメージの100%をHP吸収
      if (effectiveMods.heavyStrike && totalDamage + uberFollowUpDamage > 0) {
        const heavyHeal = Math.min(
          totalDamage + uberFollowUpDamage,
          engine.state.player.maxHp - engine.state.player.currentHp
        );
        if (heavyHeal > 0) {
          const scaledHeavyHeal = Math.floor(heavyHeal * engine.bossEffects.playerHealingMult);
          if (scaledHeavyHeal > 0) {
            engine.state.player.currentHp = Math.min(
              engine.state.player.maxHp,
              engine.state.player.currentHp + scaledHeavyHeal
            );
            const healEvent = createLifestealEvent(engine.state.elapsedTicks, scaledHeavyHeal);
            if (healEvent) events.push(healEvent);
          }
        }
      }

      // ライフスティール（メイン攻撃のみ、重撃でない場合）
      if (!effectiveMods.heavyStrike && scaledMainDamage > 0 && engine.state.player.currentHp < engine.state.player.maxHp) {
        const lifestealAmount = calculateLifesteal(
          scaledMainDamage,
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

      // クリティカル時ダメージ吸収%
      if (attackResult.isCritical && effectiveMods.critLifestealPct > 0 && totalDamage > 0 && engine.state.player.currentHp < engine.state.player.maxHp) {
        const critLifesteal = Math.floor(totalDamage * effectiveMods.critLifestealPct / 100 * engine.bossEffects.playerHealingMult);
        if (critLifesteal > 0) {
          engine.state.player.currentHp = Math.min(
            engine.state.player.maxHp,
            engine.state.player.currentHp + critLifesteal
          );
          const critLifestealEvent = createLifestealEvent(engine.state.elapsedTicks, critLifesteal);
          if (critLifestealEvent) events.push(critLifestealEvent);
        }
      }

      // HIT時HP回復（メイン攻撃 + 追撃で2回発動）
      if (attackResult.hasFollowUp && effectiveMods.hpOnHit > 0 && engine.state.player.currentHp < engine.state.player.maxHp) {
        // 追撃分の追加回復
        const additionalHeal = Math.floor(effectiveMods.hpOnHit * engine.bossEffects.playerHealingMult);
        if (additionalHeal > 0) {
          engine.state.player.currentHp = Math.min(
            engine.state.player.maxHp,
            engine.state.player.currentHp + additionalHeal
          );
          events.push({
            type: 'player_heal',
            tick: engine.state.elapsedTicks,
            data: { amount: additionalHeal, source: 'follow_up_on_hit' },
          });
        }
      }
      // Uberクリティカル追撃のHIT時HP回復
      if (uberFollowUpDamage > 0 && effectiveMods.hpOnHit > 0 && engine.state.player.currentHp < engine.state.player.maxHp) {
        const uberFollowHeal = Math.floor(effectiveMods.hpOnHit * engine.bossEffects.playerHealingMult);
        if (uberFollowHeal > 0) {
          engine.state.player.currentHp = Math.min(
            engine.state.player.maxHp,
            engine.state.player.currentHp + uberFollowHeal
          );
          events.push({
            type: 'player_heal',
            tick: engine.state.elapsedTicks,
            data: { amount: uberFollowHeal, source: 'uber_follow_up_on_hit' },
          });
        }
      }

      const baseDamage = calculateDamage(effectivePlayerAtk, engine.state.enemy.def, totalEnemyDamageReduction);
      const poisonResult = tryApplyPoison(engine.state, baseDamage, effectiveMods, engine.config, engine.rng);
      if (poisonResult.poisonStack) {
        // 毒マルチスタック（猛毒の覚醒: 1付与で1.5スタック、端数蓄積式）
        const multiStack = effectiveMods.poisonMultiStack;
        if (multiStack > 1) {
          engine.state.poisonStackAccumulator += multiStack;
          // 整数部分だけスタックを付与
          const stacksToApply = Math.floor(engine.state.poisonStackAccumulator);
          engine.state.poisonStackAccumulator -= stacksToApply;
          for (let s = 0; s < stacksToApply; s++) {
            engine.state.enemyPoisonStacks = [...engine.state.enemyPoisonStacks, { ...poisonResult.poisonStack }];
          }
        } else {
          engine.state.enemyPoisonStacks = [...engine.state.enemyPoisonStacks, poisonResult.poisonStack];
        }
        if (poisonResult.event) events.push(poisonResult.event);
      }

      // 発火付与（上書き式、ただしダメージタイミングは維持）
      // 灼熱加速（Uber業火の覚醒）: 継続時間半分+間隔半分
      const igniteResult = tryApplyIgnite(engine.state, baseDamage, effectiveMods, engine.config, engine.rng);
      if (igniteResult.igniteState) {
        // 発火付与回数を増加（緩慢なる炎キーストーン用）
        engine.state.igniteApplyCount += 1;
        // 灼熱加速: 継続時間半分+間隔半分（DPS2倍）
        let finalIgniteState = igniteResult.igniteState;
        if (effectiveMods.igniteIntensify) {
          finalIgniteState = {
            ...finalIgniteState,
            remainingMs: Math.floor(finalIgniteState.remainingMs / 2),
            tickIntervalMs: Math.max(50, Math.floor(finalIgniteState.tickIntervalMs / 2)),
          };
        }
        // 既存の発火がある場合、lastTickMsを維持（ダメージタイミングを継続）
        const existingLastTickMs = engine.state.enemyIgniteState?.lastTickMs;
        engine.state.enemyIgniteState = {
          ...finalIgniteState,
          lastTickMs: existingLastTickMs ?? finalIgniteState.lastTickMs,
        };
        if (igniteResult.event) events.push(igniteResult.event);
      }

      // チル付与（上書き式）
      const chillResult = tryApplyChill(engine.state, effectiveMods, engine.config, engine.rng);
      if (chillResult.chillState) {
        engine.state.enemyChillState = chillResult.chillState;
        if (chillResult.event) events.push(chillResult.event);
      }

      // フリーズ付与（独立判定、上限10%）
      const freezeResult = tryApplyFreeze(engine.state, effectiveMods, engine.config, engine.rng);
      if (freezeResult.freezeState) {
        engine.state.enemyFreezeState = freezeResult.freezeState;
        engine.state.enemyChillState = null;  // フリーズ中はチルを解除
        engine.pendingEnemyChillAfterFreeze = freezeResult.chillAfterFreeze;
        // フリーズ時にキングスラムカウンタをリセット
        engine.bossEffects.goblinSlamCounter = 0;
        if (freezeResult.event) events.push(freezeResult.event);
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
      if (pre.cleansePoisonIgnite) {
        engine.state.enemyPoisonStacks = [];
        engine.state.enemyIgniteState = null;
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
      const totalEnemyDamage = Math.floor(rawEnemyDamage * engine.bossEffects.playerDamageTakenMult);

      // 遅延ダメージ処理: ダメージのX%を4秒かけて受ける
      const deferPct = Math.min(50, engine.playerMods.damageDeferPct);
      let finalEnemyDamage: number;
      if (deferPct > 0 && totalEnemyDamage > 0) {
        const deferredTotal = Math.floor(totalEnemyDamage * deferPct / 100);
        finalEnemyDamage = totalEnemyDamage - deferredTotal;
        if (deferredTotal > 0) {
          const damagePerTick = Math.max(1, Math.floor(deferredTotal / 4));
          engine.state.deferredDamages.push({
            damagePerTick,
            remainingTicks: 4,
          });
        }
      } else {
        finalEnemyDamage = totalEnemyDamage;
      }

      engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - finalEnemyDamage);
      engine.state.enemy.gauge = Math.max(0, engine.state.enemy.gauge - 100);
      events.push(createEnemyAttackEvent(engine.state.elapsedTicks, finalEnemyDamage));

      // 反撃ダメージ: 被ダメ時DEFのX%を敵に反撃
      if (engine.playerMods.retaliateDefPct > 0 && finalEnemyDamage > 0) {
        const retaliateDamage = Math.floor(effectivePlayerDef * engine.playerMods.retaliateDefPct / 100);
        if (retaliateDamage > 0) {
          engine.state.enemy.currentHp = Math.max(0, engine.state.enemy.currentHp - retaliateDamage);
          events.push({
            type: 'retaliate',
            tick: engine.state.elapsedTicks,
            data: { damage: retaliateDamage },
          });
        }
      }

      // 重傷スタック減衰: 敵行動4回で1スタック減少
      if (engine.playerMods.heavyStrike && engine.state.enemyWoundStacks > 0) {
        engine.state.enemyWoundActionCounter += 1;
        if (engine.state.enemyWoundActionCounter >= 4) {
          engine.state.enemyWoundActionCounter = 0;
          engine.state.enemyWoundStacks = Math.max(0, engine.state.enemyWoundStacks - 1);
          events.push({
            type: 'wound_decayed',
            tick: engine.state.elapsedTicks,
            data: { stacks: engine.state.enemyWoundStacks },
          });
        }
      }

      // 盗賊の頭の追撃（0.5倍ダメージ）
      const baseBossId = getBaseBossId(enemyId);
      if (baseBossId === 'bandit_leader') {
        const followUpDamage = Math.floor(enemyDamage * 0.5 * enemyAttackMultiplier * engine.bossEffects.playerDamageTakenMult);
        engine.state.player.currentHp = Math.max(0, engine.state.player.currentHp - followUpDamage);
        events.push(createEnemyAttackEvent(engine.state.elapsedTicks, followUpDamage));
      }

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

      // 乱軍の王: HP30%以下で1度だけ発動
      if (
        engine.playerMods.warlordEnrage &&
        !engine.state.warlordEnrageActivated &&
        engine.state.player.currentHp > 0 &&
        engine.state.player.currentHp <= engine.state.player.maxHp * 0.3
      ) {
        engine.state.warlordEnrageActivated = true;
        engine.playerMods.attackSpeedPct += 20;
        engine.playerMods.hpOnHit += 300;
        // 攻撃速度を再計算（重撃ペナルティも維持）
        engine.playerAttackSpeedBase = getAttackSpeedFromMods(engine.playerMods) *
          (isEndContent ? getPlayerAttackSpeedMultiplier(enemyId) : 1) *
          (engine.playerMods.heavyStrike ? 0.8 : 1);
        events.push({
          type: 'warlord_enrage',
          tick: engine.state.elapsedTicks,
          data: { attackSpeedPct: 20, hpOnHit: 300 },
        });
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
