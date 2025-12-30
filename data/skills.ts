import { SkillNode } from '@/types';

export const skillNodes: SkillNode[] = [
  {
    id: 'skill_atk_1',
    name: '攻撃力強化 I',
    description: '攻撃力 +5',
    effect: { atk: 5 },
    requiredSkillId: null,
  },
  {
    id: 'skill_hp_1',
    name: 'HP強化 I',
    description: 'HP +20',
    effect: { hp: 20 },
    requiredSkillId: 'skill_atk_1',
  },
  {
    id: 'skill_atk_2',
    name: '攻撃力強化 II',
    description: '攻撃力 +10',
    effect: { atk: 10 },
    requiredSkillId: 'skill_hp_1',
  },
  {
    id: 'skill_def_1',
    name: '防御力強化 I',
    description: '防御力 +5',
    effect: { def: 5 },
    requiredSkillId: 'skill_atk_2',
  },
  {
    id: 'skill_hp_2',
    name: 'HP強化 II',
    description: 'HP +50',
    effect: { hp: 50 },
    requiredSkillId: 'skill_def_1',
  },
];

export const getSkillNode = (id: string): SkillNode | undefined => {
  return skillNodes.find((node) => node.id === id);
};

export const canUnlockSkill = (skillId: string, unlockedSkills: string[]): boolean => {
  const skill = getSkillNode(skillId);
  if (!skill) return false;
  if (unlockedSkills.includes(skillId)) return false; // 既に取得済み
  if (skill.requiredSkillId === null) return true; // 前提なし
  return unlockedSkills.includes(skill.requiredSkillId);
};
