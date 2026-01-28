import { BattleEvent, PoisonStack } from './types';
import { getBaseBossId, isUberBoss, getPlayerPoisonFromBoss } from './endContent';

export type BossSkillId =
  | 'goblin_shield'
  | 'goblin_warlord'
  | 'bandit_bear_trap'
  | 'bandit_night_ambush'
  | 'bandit_shadow_bind'
  | 'vampire_blood_feast'
  | 'vampire_night_feast'
  | 'vampire_crimson_pact'
  | 'kraken_tsunami'
  | 'kraken_deep_embrace'
  | 'kraken_abyssal_ebb'
  | 'demon_death_hand'
  | 'demon_black_flame'
  | 'demon_crown'
  | 'final_end'
  | 'final_convergence'
  | 'final_time_sever'
  | 'boss_intro';

export interface BossEffectState {
  enemyAttackCount: number;
  playerAttackCount: number;
  playerAttackSpeedMult: number;
  playerAttackSpeedRemaining: number;
  playerCritChanceMult: number;
  playerPoisonChanceMult: number;
  playerCritPoisonRemaining: number;
  playerHealingMult: number;
  playerHealingRemaining: number;
  playerDamageTakenMult: number;
  playerDamageTakenRemainingEnemyAttacks: number;
  enemyDamageReductionTempPct: number;
  enemyDamageReductionTempRemaining: number;
  enemyDamageReductionStackPct: number;
  enemyAttackSpeedMult: number;
  enemyAttackMult: number;
  enemyNextAttackMult: number;
  enemyHpOnHitBonus: number;
  enemyHpOnHitMult: number;
  enemyHpOnHitMultRemaining: number;
  goblinEnrage: boolean;
  banditShadow: boolean;
  krakenEmbrace: boolean;
  demonMark: boolean;
  demonCrown: boolean;
  vampirePact: boolean;
  vampireNightFeastLogged: boolean;
  finalEndStacks: number;
  convergenceStacks: number;
}

export const createBossEffectState = (): BossEffectState => ({
  enemyAttackCount: 0,
  playerAttackCount: 0,
  playerAttackSpeedMult: 1,
  playerAttackSpeedRemaining: 0,
  playerCritChanceMult: 1,
  playerPoisonChanceMult: 1,
  playerCritPoisonRemaining: 0,
  playerHealingMult: 1,
  playerHealingRemaining: 0,
  playerDamageTakenMult: 1,
  playerDamageTakenRemainingEnemyAttacks: 0,
  enemyDamageReductionTempPct: 0,
  enemyDamageReductionTempRemaining: 0,
  enemyDamageReductionStackPct: 0,
  enemyAttackSpeedMult: 1,
  enemyAttackMult: 1,
  enemyNextAttackMult: 1,
  enemyHpOnHitBonus: 0,
  enemyHpOnHitMult: 1,
  enemyHpOnHitMultRemaining: 0,
  goblinEnrage: false,
  banditShadow: false,
  krakenEmbrace: false,
  demonMark: false,
  demonCrown: false,
  vampirePact: false,
  vampireNightFeastLogged: false,
  finalEndStacks: 0,
  convergenceStacks: 0,
});

export interface BossBehaviorContext {
  enemyId: string;
  enemyMaxHp: number;
  enemyCurrentHp: number;
  playerCurrentHp: number;
  playerMaxHp: number;
}

export interface BossBehaviorResult {
  events: BattleEvent[];
  resetPlayerGauge?: boolean;
  applyPlayerPoison?: PoisonStack;
}

const createBossSkillEvent = (tick: number, skillId: BossSkillId): BattleEvent => ({
  type: 'boss_skill',
  tick,
  data: { skillId },
});

export const createBossIntroEvents = (
  tick: number,
  enemyId: string
): { events: BattleEvent[]; playerPoison?: PoisonStack } => {
  const events: BattleEvent[] = [];
  const poison = getPlayerPoisonFromBoss(enemyId);
  if (poison) {
    const stack: PoisonStack = {
      damagePerTick: poison.damage,
      remainingTicks: poison.turns,
    };
    return { events, playerPoison: stack };
  }
  return { events };
};

export const applyEnemyHpThresholdEffects = (
  ctx: BossBehaviorContext,
  bossEffects: BossEffectState,
  tick: number
): BattleEvent[] => {
  const events: BattleEvent[] = [];
  const baseBossId = getBaseBossId(ctx.enemyId);
  const isUber = isUberBoss(ctx.enemyId);
  if (ctx.enemyCurrentHp <= 0) return events;
  const hpRatio = ctx.enemyCurrentHp / Math.max(1, ctx.enemyMaxHp);
  if (hpRatio > 0.5) return events;

  if (baseBossId === 'goblin_king' && isUber && !bossEffects.goblinEnrage) {
    bossEffects.goblinEnrage = true;
    bossEffects.enemyAttackSpeedMult = 1.3;
    bossEffects.enemyHpOnHitBonus = 500;
    events.push(createBossSkillEvent(tick, 'goblin_warlord'));
  }

  if (baseBossId === 'bandit_leader' && isUber && !bossEffects.banditShadow) {
    bossEffects.banditShadow = true;
    bossEffects.playerHealingMult = 0.5;
    bossEffects.playerHealingRemaining = -1;
    events.push(createBossSkillEvent(tick, 'bandit_shadow_bind'));
  }

  if (baseBossId === 'kraken' && !bossEffects.krakenEmbrace) {
    bossEffects.krakenEmbrace = true;
    bossEffects.playerAttackSpeedMult = 0.8;
    bossEffects.playerAttackSpeedRemaining = 3;
    bossEffects.playerHealingMult = Math.min(bossEffects.playerHealingMult, 0.7);
    bossEffects.playerHealingRemaining = Math.max(bossEffects.playerHealingRemaining, 3);
    events.push(createBossSkillEvent(tick, 'kraken_deep_embrace'));
  }

  if (baseBossId === 'demon_lord' && !bossEffects.demonMark) {
    bossEffects.demonMark = true;
    bossEffects.enemyDamageReductionStackPct += 10;
    events.push(createBossSkillEvent(tick, 'demon_black_flame'));
  }

  if (baseBossId === 'demon_lord' && isUber && !bossEffects.demonCrown) {
    bossEffects.demonCrown = true;
    bossEffects.enemyHpOnHitMult = 1;
    events.push(createBossSkillEvent(tick, 'demon_crown'));
  }

  if (baseBossId === 'vampire' && isUber && !bossEffects.vampirePact) {
    bossEffects.vampirePact = true;
    events.push(createBossSkillEvent(tick, 'vampire_crimson_pact'));
  }

  return events;
};

export const applyPlayerAttackPostEffects = (
  ctx: BossBehaviorContext,
  bossEffects: BossEffectState,
  tick: number
): BattleEvent[] => {
  const events: BattleEvent[] = [];
  const baseBossId = getBaseBossId(ctx.enemyId);

  bossEffects.playerAttackCount += 1;
  // Final Convergence削除

  if (bossEffects.playerAttackSpeedRemaining > 0) {
    bossEffects.playerAttackSpeedRemaining -= 1;
    if (bossEffects.playerAttackSpeedRemaining <= 0) {
      bossEffects.playerAttackSpeedMult = 1;
    }
  }
  if (bossEffects.playerCritPoisonRemaining > 0) {
    bossEffects.playerCritPoisonRemaining -= 1;
    if (bossEffects.playerCritPoisonRemaining <= 0) {
      bossEffects.playerCritChanceMult = 1;
      bossEffects.playerPoisonChanceMult = 1;
    }
  }
  if (bossEffects.playerHealingRemaining > 0) {
    bossEffects.playerHealingRemaining -= 1;
    if (bossEffects.playerHealingRemaining <= 0) {
      bossEffects.playerHealingMult = 1;
    }
  }
  if (bossEffects.enemyDamageReductionTempRemaining > 0) {
    bossEffects.enemyDamageReductionTempRemaining -= 1;
    if (bossEffects.enemyDamageReductionTempRemaining <= 0) {
      bossEffects.enemyDamageReductionTempPct = 0;
    }
  }

  return events;
};

export const applyEnemyAttackPreEffects = (
  ctx: BossBehaviorContext,
  bossEffects: BossEffectState,
  tick: number
): BossBehaviorResult => {
  const events: BattleEvent[] = [];
  const baseBossId = getBaseBossId(ctx.enemyId);
  const isUber = isUberBoss(ctx.enemyId);

  bossEffects.enemyAttackCount += 1;
  const shouldTrigger = bossEffects.enemyAttackCount % 3 === 0;
  if (!shouldTrigger) {
    return { events };
  }

  if (baseBossId === 'goblin_king') {
    bossEffects.enemyDamageReductionTempPct = 20;
    bossEffects.enemyDamageReductionTempRemaining = 2;
    bossEffects.playerCritChanceMult = 0.5;
    bossEffects.playerPoisonChanceMult = 0.5;
    bossEffects.playerCritPoisonRemaining = 2;
    events.push(createBossSkillEvent(tick, 'goblin_shield'));
  }

  if (baseBossId === 'bandit_leader') {
    bossEffects.playerAttackSpeedMult = 0.7;
    bossEffects.playerAttackSpeedRemaining = 2;
    bossEffects.enemyNextAttackMult = 1.4;
    events.push(createBossSkillEvent(tick, 'bandit_bear_trap'));
    events.push(createBossSkillEvent(tick, 'bandit_night_ambush'));
  }

  if (baseBossId === 'vampire') {
    bossEffects.enemyHpOnHitMult = 1.5;
    bossEffects.enemyHpOnHitMultRemaining = 1;
    events.push(createBossSkillEvent(tick, 'vampire_blood_feast'));
  }

  if (baseBossId === 'kraken') {
    bossEffects.enemyNextAttackMult = 1.5;
    bossEffects.playerDamageTakenMult = 1.3;
    bossEffects.playerDamageTakenRemainingEnemyAttacks = 1;
    events.push(createBossSkillEvent(tick, 'kraken_tsunami'));
    if (isUber) {
      bossEffects.playerAttackSpeedMult = 0.85;
      bossEffects.playerAttackSpeedRemaining = Math.max(bossEffects.playerAttackSpeedRemaining, 2);
      events.push(createBossSkillEvent(tick, 'kraken_abyssal_ebb'));
    }
  }

  if (baseBossId === 'demon_lord') {
    bossEffects.playerHealingMult = Math.min(bossEffects.playerHealingMult, 0.7);
    bossEffects.playerHealingRemaining = Math.max(bossEffects.playerHealingRemaining, 2);
    events.push(createBossSkillEvent(tick, 'demon_death_hand'));
    const poison = getPlayerPoisonFromBoss(ctx.enemyId);
    if (poison) {
      const stack: PoisonStack = {
        damagePerTick: poison.damage,
        remainingTicks: poison.turns,
      };
      return { events, applyPlayerPoison: stack };
    }
  }

  if (baseBossId === 'true_final_boss') {
    // Final End: Uber版はプレイヤーゲージリセットのみ
    events.push(createBossSkillEvent(tick, 'final_end'));
    if (isUber) {
      return { events, resetPlayerGauge: true };
    }
  }

  return { events };
};

export const applyEnemyAttackPostEffects = (
  bossEffects: BossEffectState
): void => {
  if (bossEffects.playerDamageTakenRemainingEnemyAttacks > 0) {
    bossEffects.playerDamageTakenRemainingEnemyAttacks -= 1;
    if (bossEffects.playerDamageTakenRemainingEnemyAttacks <= 0) {
      bossEffects.playerDamageTakenMult = 1;
    }
  }
  if (bossEffects.enemyNextAttackMult !== 1) {
    bossEffects.enemyNextAttackMult = 1;
  }
};
