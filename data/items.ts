import { Item } from '@/types';

export const items: Record<string, Item> = {
  // 武器
  wooden_sword: {
    id: 'wooden_sword',
    name: '木の剣',
    slot: 'weapon',
    atk: 3,
    def: 0,
  },
  iron_sword: {
    id: 'iron_sword',
    name: '鉄の剣',
    slot: 'weapon',
    atk: 6,
    def: 0,
  },
  steel_sword: {
    id: 'steel_sword',
    name: '鋼の剣',
    slot: 'weapon',
    atk: 10,
    def: 0,
  },
  // 防具
  leather_armor: {
    id: 'leather_armor',
    name: '革の鎧',
    slot: 'armor',
    atk: 0,
    def: 3,
  },
  iron_armor: {
    id: 'iron_armor',
    name: '鉄の鎧',
    slot: 'armor',
    atk: 0,
    def: 6,
  },
  // 手袋
  leather_gloves: {
    id: 'leather_gloves',
    name: '革の手袋',
    slot: 'gloves',
    atk: 1,
    def: 1,
  },
  iron_gloves: {
    id: 'iron_gloves',
    name: '鉄の手袋',
    slot: 'gloves',
    atk: 2,
    def: 2,
  },
  // 靴
  leather_boots: {
    id: 'leather_boots',
    name: '革のブーツ',
    slot: 'boots',
    atk: 0,
    def: 2,
  },
  iron_boots: {
    id: 'iron_boots',
    name: '鉄のブーツ',
    slot: 'boots',
    atk: 0,
    def: 4,
  },
  // アクセサリー
  power_ring: {
    id: 'power_ring',
    name: '力の指輪',
    slot: 'accessory',
    atk: 3,
    def: 0,
  },
  guard_ring: {
    id: 'guard_ring',
    name: '守りの指輪',
    slot: 'accessory',
    atk: 0,
    def: 3,
  },
};

export const getItem = (id: string): Item | undefined => {
  return items[id];
};

export const getRandomItem = (itemIds: string[]): Item | undefined => {
  const randomIndex = Math.floor(Math.random() * itemIds.length);
  return getItem(itemIds[randomIndex]);
};
