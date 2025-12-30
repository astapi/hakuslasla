import { Dungeon } from '@/types';

export const dungeons: Record<string, Dungeon> = {
  beginners_forest: {
    id: 'beginners_forest',
    name: '初心者の森',
    description: '冒険者が最初に訪れる静かな森。弱いモンスターが生息している。',
    maxFloor: 5,
    enemies: ['slime', 'slime', 'goblin'], // スライムが多め
    dropTable: ['wooden_sword', 'leather_armor', 'leather_gloves', 'leather_boots'],
  },
  goblin_cave: {
    id: 'goblin_cave',
    name: 'ゴブリンの洞窟',
    description: 'ゴブリンたちが住み着いた暗い洞窟。',
    maxFloor: 5,
    enemies: ['goblin', 'goblin', 'wolf', 'skeleton'],
    dropTable: ['iron_sword', 'leather_armor', 'iron_gloves', 'power_ring'],
  },
  ancient_ruins: {
    id: 'ancient_ruins',
    name: '古代遺跡',
    description: '古の文明が残した危険な遺跡。強力なモンスターが徘徊する。',
    maxFloor: 5,
    enemies: ['skeleton', 'orc', 'troll'],
    dropTable: ['steel_sword', 'iron_armor', 'iron_boots', 'guard_ring'],
  },
};

export const getDungeon = (id: string): Dungeon | undefined => {
  return dungeons[id];
};

export const getAllDungeons = (): Dungeon[] => {
  return Object.values(dungeons);
};
