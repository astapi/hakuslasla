import { Enemy } from '@/types';

export const enemies: Record<string, Enemy> = {
  slime: {
    id: 'slime',
    name: 'スライム',
    image: 'slime',
    maxHp: 20,
    atk: 5,
    def: 2,
    exp: 10,
  },
  goblin: {
    id: 'goblin',
    name: 'ゴブリン',
    image: 'goblin',
    maxHp: 30,
    atk: 8,
    def: 3,
    exp: 15,
  },
  wolf: {
    id: 'wolf',
    name: 'オオカミ',
    image: 'wolf',
    maxHp: 25,
    atk: 10,
    def: 2,
    exp: 12,
  },
  skeleton: {
    id: 'skeleton',
    name: 'スケルトン',
    image: 'skeleton',
    maxHp: 35,
    atk: 12,
    def: 5,
    exp: 20,
  },
  orc: {
    id: 'orc',
    name: 'オーク',
    image: 'orc',
    maxHp: 50,
    atk: 15,
    def: 8,
    exp: 30,
  },
  troll: {
    id: 'troll',
    name: 'トロール',
    image: 'troll',
    maxHp: 80,
    atk: 20,
    def: 10,
    exp: 50,
  },
};

export const getEnemy = (id: string): Enemy | undefined => {
  return enemies[id];
};

export const getRandomEnemy = (enemyIds: string[]): Enemy | undefined => {
  const randomIndex = Math.floor(Math.random() * enemyIds.length);
  return getEnemy(enemyIds[randomIndex]);
};
