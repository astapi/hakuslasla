import { BASE_BOSS_BY_UBER } from '@/core/endContent';

export interface BossSkillInfo {
  skillKey: string; // localesのキー（例: 'shield', 'warlord'）
  descKey: string; // 説明文のキー（例: 'shieldDesc', 'warlordDesc'）
  isUberOnly?: boolean; // Uber限定スキルかどうか
  isThreshold?: boolean; // HP50%以下で発動するスキルかどうか
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
      { skillKey: 'shield', descKey: 'shieldDesc' },
    ],
    thresholdSkills: [
      { skillKey: 'warlord', descKey: 'warlordDesc', isUberOnly: true, isThreshold: true },
    ],
  },
  bandit_leader: {
    bossId: 'bandit_leader',
    regularSkills: [
      { skillKey: 'bearTrap', descKey: 'bearTrapDesc' },
      { skillKey: 'nightAmbush', descKey: 'nightAmbushDesc' },
    ],
    thresholdSkills: [
      { skillKey: 'shadowBind', descKey: 'shadowBindDesc', isUberOnly: true, isThreshold: true },
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
 * UberボスIDの場合はベースボスIDに変換して取得
 */
export const getBossAbilities = (bossId: string): BossAbilities | null => {
  // UberボスIDの場合はベースボスIDに変換
  const baseBossId = BASE_BOSS_BY_UBER[bossId] ?? bossId;
  return BOSS_ABILITIES_MAP[baseBossId] ?? null;
};

/**
 * ダンジョンIDがUberダンジョンかどうかを判定
 */
export const isUberDungeon = (dungeonId: string): boolean => {
  return dungeonId.startsWith('uber_');
};
