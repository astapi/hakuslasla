import { BASE_BOSS_BY_UBER, UBER_BY_UBER_UBER } from '@/core/endContent';

export type SkillTriggerType =
  | 'persistent'   // 戦闘開始時から永続発動
  | 'regular'      // 3回攻撃ごと
  | 'everyAttack'  // 毎攻撃
  | 'every10'      // 10回攻撃ごと
  | 'threshold';   // HP50%以下

export interface BossSkillInfo {
  skillKey: string; // localesのキー（例: 'shield', 'warlord'）
  descKey: string; // 説明文のキー（例: 'shieldDesc', 'warlordDesc'）
  descKeyUberUber?: string; // UberUber時に使用する説明文キー（常時化等の差分）
  isUberOnly?: boolean; // Uber限定スキルかどうか
  isUberUberOnly?: boolean; // UberUber限定スキルかどうか
  isThreshold?: boolean; // HP50%以下で発動するスキルかどうか（後方互換）
  triggerType?: SkillTriggerType; // 発動タイプ（明示）
  triggerTypeUberUber?: SkillTriggerType; // UberUber時の発動タイプ（上書き）
}

export interface BossAbilities {
  bossId: string; // ベースボスID（例: 'goblin_king'）
  regularSkills: BossSkillInfo[]; // 通常スキル（3回攻撃ごと発動）
  thresholdSkills: BossSkillInfo[]; // HP50%以下で発動するスキル
}

// 各ボスのスキル情報
const BOSS_ABILITIES_MAP: Record<string, BossAbilities> = {
  goblin_king: {
    bossId: 'goblin_king',
    regularSkills: [
      { skillKey: 'shield', descKey: 'shieldDesc', descKeyUberUber: 'shieldDescUberUber', triggerType: 'regular', triggerTypeUberUber: 'persistent' },
      { skillKey: 'kingsSlam', descKey: 'kingsSlamDesc', isUberUberOnly: true, triggerType: 'every10' },
      { skillKey: 'kingsRoar', descKey: 'kingsRoarDesc', isUberUberOnly: true, triggerType: 'regular' },
    ],
    thresholdSkills: [
      { skillKey: 'warlord', descKey: 'warlordDesc', descKeyUberUber: 'warlordDescUberUber', isUberOnly: true, isThreshold: true, triggerType: 'threshold', triggerTypeUberUber: 'persistent' },
    ],
  },
  bandit_leader: {
    bossId: 'bandit_leader',
    regularSkills: [
      { skillKey: 'bearTrap', descKey: 'bearTrapDesc', descKeyUberUber: 'bearTrapDescUberUber', triggerType: 'regular', triggerTypeUberUber: 'persistent' },
      { skillKey: 'nightAmbush', descKey: 'nightAmbushDesc', triggerType: 'regular' },
      { skillKey: 'twinStrike', descKey: 'twinStrikeDesc', isUberUberOnly: true, triggerType: 'everyAttack' },
      { skillKey: 'shadowGarrote', descKey: 'shadowGarroteDesc', isUberUberOnly: true, triggerType: 'every10' },
    ],
    thresholdSkills: [
      { skillKey: 'shadowBind', descKey: 'shadowBindDesc', descKeyUberUber: 'shadowBindDescUberUber', isUberOnly: true, isThreshold: true, triggerType: 'threshold', triggerTypeUberUber: 'persistent' },
    ],
  },
  vampire: {
    bossId: 'vampire',
    regularSkills: [
      { skillKey: 'bloodFeast', descKey: 'bloodFeastDesc' },
      { skillKey: 'nightFeast', descKey: 'nightFeastDesc', isUberOnly: true },
    ],
    thresholdSkills: [
      { skillKey: 'crimsonPact', descKey: 'crimsonPactDesc', isUberOnly: true, isThreshold: true },
    ],
  },
  kraken: {
    bossId: 'kraken',
    regularSkills: [
      { skillKey: 'tsunami', descKey: 'tsunamiDesc' },
      { skillKey: 'abyssalEbb', descKey: 'abyssalEbbDesc', isUberOnly: true },
      { skillKey: 'tentacleFlurry', descKey: 'tentacleFlurryDesc', isUberUberOnly: true, triggerType: 'every10' },
      { skillKey: 'frostAura', descKey: 'frostAuraDesc', isUberUberOnly: true, triggerType: 'persistent' },
      { skillKey: 'freezeResist', descKey: 'freezeResistDesc', isUberUberOnly: true, triggerType: 'persistent' },
      { skillKey: 'igniteResist', descKey: 'igniteResistDesc', isUberUberOnly: true, triggerType: 'persistent' },
    ],
    thresholdSkills: [
      { skillKey: 'deepEmbrace', descKey: 'deepEmbraceDesc', isThreshold: true },
    ],
  },
  demon_lord: {
    bossId: 'demon_lord',
    regularSkills: [
      { skillKey: 'deathHand', descKey: 'deathHandDesc' },
    ],
    thresholdSkills: [
      { skillKey: 'blackFlame', descKey: 'blackFlameDesc', isThreshold: true },
      { skillKey: 'crown', descKey: 'crownDesc', isUberOnly: true, isThreshold: true },
    ],
  },
  true_final_boss: {
    bossId: 'true_final_boss',
    regularSkills: [
      { skillKey: 'end', descKey: 'endDesc' },
    ],
    thresholdSkills: [],
  },
};

/**
 * ボスIDからスキル情報を取得
 * Uber/UberUberボスIDの場合はベースボスIDに変換して取得
 */
export const getBossAbilities = (bossId: string): BossAbilities | null => {
  // UberUber → Uber → Base の順で解決
  const fromUberUber = UBER_BY_UBER_UBER[bossId];
  const uberId = fromUberUber ?? bossId;
  const baseBossId = BASE_BOSS_BY_UBER[uberId] ?? uberId;
  return BOSS_ABILITIES_MAP[baseBossId] ?? null;
};

/**
 * ダンジョンIDがUberダンジョンかどうかを判定
 * UberUberダンジョンも Uber に含む（uber_uber_xxx は uber_ で始まる）
 */
export const isUberDungeon = (dungeonId: string): boolean => {
  return dungeonId.startsWith('uber_');
};

/**
 * ダンジョンIDがUberUberダンジョンかどうかを判定
 */
export const isUberUberDungeon = (dungeonId: string): boolean => {
  return dungeonId.startsWith('uber_uber_');
};
