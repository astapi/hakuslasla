import { BattleEvent, PoisonStack } from './types';
import { getBaseBossId, isUberBoss, isUberUberBoss, getPlayerPoisonFromBoss } from './endContent';

export type BossSkillId =
  | 'goblin_shield'
  | 'goblin_warlord'
  | 'bandit_bear_trap'
  | 'bandit_night_ambush'
  | 'bandit_shadow_bind'
  | 'bandit_twin_strike'
  | 'bandit_shadow_garrote'
  | 'vampire_blood_feast'
  | 'vampire_night_feast'
  | 'vampire_crimson_pact'
  | 'kraken_tsunami'
  | 'kraken_deep_embrace'
  | 'kraken_abyssal_ebb'
  | 'kraken_tentacle_flurry'
  | 'demon_death_hand'
  | 'demon_black_flame'
  | 'demon_crown'
  | 'final_end'
  | 'final_convergence'
  | 'final_time_sever'
  | 'goblin_kings_slam'
  | 'goblin_kings_roar'
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
  goblinSlamCounter: number;  // UberUberゴブリンキング: キングスラムまでのカウンタ
  banditGarroteCounter: number;  // UberUber盗賊の頭: 影縛りの絞縄までのカウンタ
  krakenFlurryCounter: number;  // UberUberクラーケン: 触手乱打までのカウンタ
  krakenFlurryRemaining: number;  // UberUberクラーケン: 残り連撃回数
  enemyFreezeResistPct: number;  // 敵のフリーズ耐性（%）
  enemyAttackPlayerChillChance: number;  // 敵攻撃時のチル付与確率（%）
  enemyAttackPlayerFreezeChance: number;  // 敵攻撃時のフリーズ付与確率（%）
  enemyIgniteDamageMult: number;  // 敵が受ける発火ダメージの倍率（デフォルト1、低いほど耐性）
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
  goblinSlamCounter: 0,
  banditGarroteCounter: 0,
  krakenFlurryCounter: 0,
  krakenFlurryRemaining: 0,
  enemyFreezeResistPct: 0,
  enemyAttackPlayerChillChance: 0,
  enemyAttackPlayerFreezeChance: 0,
  enemyIgniteDamageMult: 1,
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
  cleansePoisonIgnite?: boolean;  // ボスの毒・発火状態を解除
  applyPlayerFreeze?: { remainingMs: number };  // プレイヤーをフリーズさせる
  extraEnemyAttacks?: number;  // 同一行動で追加で行う攻撃回数（触手乱打）
}

const createBossSkillEvent = (tick: number, skillId: BossSkillId): BattleEvent => ({
  type: 'boss_skill',
  tick,
  data: { skillId },
});

export const createBossIntroEvents = (
  tick: number,
  enemyId: string
): { events: BattleEvent[]; playerPoison?: PoisonStack; initBossEffects?: Partial<BossEffectState> } => {
  const events: BattleEvent[] = [];
  const poison = getPlayerPoisonFromBoss(enemyId);
  if (poison) {
    const stack: PoisonStack = {
      damagePerTick: poison.damage,
      remainingTicks: poison.turns,
    };
    // UberUber魔王は毒持ちだが、フリーズ耐性も併せて設定する必要があるため
    // ここで初期効果を返す（毒の早期returnより後ろに置くと到達しない）
    if (isUberUberBoss(enemyId) && getBaseBossId(enemyId) === 'demon_lord') {
      return {
        events,
        playerPoison: stack,
        initBossEffects: { enemyFreezeResistPct: 50 },
      };
    }
    return { events, playerPoison: stack };
  }

  // UberUberゴブリンキング: goblin_shield常時 + goblin_warlord常時
  if (isUberUberBoss(enemyId) && getBaseBossId(enemyId) === 'goblin_king') {
    events.push(createBossSkillEvent(tick, 'goblin_shield'));
    events.push(createBossSkillEvent(tick, 'goblin_warlord'));
    return {
      events,
      initBossEffects: {
        // goblin_shield常時
        enemyDamageReductionTempPct: 20,
        enemyDamageReductionTempRemaining: -1,  // 永続
        playerCritChanceMult: 0.5,
        playerPoisonChanceMult: 0.5,
        playerCritPoisonRemaining: -1,  // 永続
        // goblin_warlord常時
        goblinEnrage: true,
        enemyAttackSpeedMult: 1.3,
        enemyHpOnHitBonus: 500,
      },
    };
  }

  // UberUber盗賊の頭: bear_trap + shadow_bind常時（night_ambushはUber同様3回毎に発動）
  if (isUberUberBoss(enemyId) && getBaseBossId(enemyId) === 'bandit_leader') {
    events.push(createBossSkillEvent(tick, 'bandit_bear_trap'));
    events.push(createBossSkillEvent(tick, 'bandit_shadow_bind'));
    return {
      events,
      initBossEffects: {
        // bandit_bear_trap常時: プレイヤー攻撃速度-30%
        playerAttackSpeedMult: 0.7,
        playerAttackSpeedRemaining: -1,
        // bandit_shadow_bind常時: 回復効果-25%
        banditShadow: true,
        playerHealingMult: 0.75,
        playerHealingRemaining: -1,
      },
    };
  }

  // UberUberクラーケン: フリーズ耐性70% + 攻撃時チル20%/フリーズ10%付与 + 発火耐性（被ダメージ2/3）
  if (isUberUberBoss(enemyId) && getBaseBossId(enemyId) === 'kraken') {
    return {
      events,
      initBossEffects: {
        enemyFreezeResistPct: 70,
        enemyAttackPlayerChillChance: 20,
        enemyAttackPlayerFreezeChance: 10,
        enemyIgniteDamageMult: 2 / 3,
      },
    };
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

  // UberUberゴブリンキング: キングスラム（10回に1回、ATK×3）
  if (baseBossId === 'goblin_king' && isUberUberBoss(ctx.enemyId)) {
    bossEffects.goblinSlamCounter += 1;
    if (bossEffects.goblinSlamCounter >= 10) {
      bossEffects.goblinSlamCounter = 0;
      bossEffects.enemyNextAttackMult = 3.0;
      events.push(createBossSkillEvent(tick, 'goblin_kings_slam'));
    }
    // 王の咆哮: 3回に1回、毒・発火状態を解除（cleansePoisonIgniteフラグ）
    if (bossEffects.enemyAttackCount % 3 === 0) {
      events.push(createBossSkillEvent(tick, 'goblin_kings_roar'));
      return { events, cleansePoisonIgnite: true };
    }
    return { events };
  }

  // UberUber盗賊の頭: 影縛りの絞縄（10回に1回、プレイヤーを0.5秒フリーズ）
  // 闘夜の奇襲はUber同様3回毎に発動、bear_trap/shadow_bindは常時化済み
  if (baseBossId === 'bandit_leader' && isUberUberBoss(ctx.enemyId)) {
    bossEffects.banditGarroteCounter += 1;
    let freezeResult: BossBehaviorResult | null = null;
    if (bossEffects.banditGarroteCounter >= 10) {
      bossEffects.banditGarroteCounter = 0;
      events.push(createBossSkillEvent(tick, 'bandit_shadow_garrote'));
      freezeResult = { events, applyPlayerFreeze: { remainingMs: 500 } };
    }
    // 3回毎の闘夜の奇襲（Uber同様、次撃+40%）
    if (bossEffects.enemyAttackCount % 3 === 0) {
      bossEffects.enemyNextAttackMult = 1.4;
      events.push(createBossSkillEvent(tick, 'bandit_night_ambush'));
    }
    return freezeResult ?? { events };
  }

  // UberUberクラーケン: 触手乱打（10回に1回、10連撃）
  // 通常クラーケンの津波/深淵の引き潮も継続発動
  let krakenExtraAttacks = 0;
  if (baseBossId === 'kraken' && isUberUberBoss(ctx.enemyId)) {
    bossEffects.krakenFlurryCounter += 1;
    if (bossEffects.krakenFlurryCounter >= 10) {
      bossEffects.krakenFlurryCounter = 0;
      krakenExtraAttacks = 9;  // 既にこの行動で1回分の攻撃をするので+9で合計10連撃
      events.push(createBossSkillEvent(tick, 'kraken_tentacle_flurry'));
    }
  }

  const shouldTrigger = bossEffects.enemyAttackCount % 3 === 0;
  if (!shouldTrigger) {
    return krakenExtraAttacks > 0 ? { events, extraEnemyAttacks: krakenExtraAttacks } : { events };
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

  return krakenExtraAttacks > 0 ? { events, extraEnemyAttacks: krakenExtraAttacks } : { events };
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
