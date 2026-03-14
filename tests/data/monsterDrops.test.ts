import { describe, expect, it } from 'vitest';
import monstersData from '../../data/json/monsters.json';
import itemsData from '../../data/json/items.json';

const getMonster = (id: string) => (monstersData.monsters as Record<string, any>)[id];
const getItem = (id: string) => (itemsData.items as Record<string, any>)[id];

describe('モンスターのユニークドロップ設定', () => {
  describe('盗賊の頭 (bandit_leader)', () => {
    const enemy = getMonster('bandit_leader');

    it('モンスターが存在する', () => {
      expect(enemy).toBeDefined();
    });

    it('uniqueDropsが設定されている', () => {
      expect(enemy.uniqueDrops).toBeDefined();
      expect(enemy.uniqueDrops.length).toBeGreaterThanOrEqual(2);
    });

    it('盗賊王の王冠が5%でドロップする', () => {
      const drop = enemy.uniqueDrops.find((d: any) => d.itemId === 'bandit_crown');
      expect(drop).toBeDefined();
      expect(drop.dropRate).toBe(5);
    });

    it('双撃の指輪が10%でドロップする', () => {
      const drop = enemy.uniqueDrops.find((d: any) => d.itemId === 'double_strike_ring');
      expect(drop).toBeDefined();
      expect(drop.dropRate).toBe(10);
    });

    it('ドロップアイテムが全てアイテムマスターに存在する', () => {
      for (const drop of enemy.uniqueDrops) {
        const item = getItem(drop.itemId);
        expect(item, `${drop.itemId} がアイテムマスターに存在しない`).toBeDefined();
      }
    });
  });

  describe('Uber 盗賊の頭 (uber_bandit_leader)', () => {
    const enemy = getMonster('uber_bandit_leader');

    it('モンスターが存在する', () => {
      expect(enemy).toBeDefined();
    });

    it('uniqueDropsが設定されている', () => {
      expect(enemy.uniqueDrops).toBeDefined();
      expect(enemy.uniqueDrops.length).toBeGreaterThanOrEqual(6);
    });

    it('Uber 双撃の指輪が10%でドロップする', () => {
      const drop = enemy.uniqueDrops.find((d: any) => d.itemId === 'uber_double_strike_ring');
      expect(drop).toBeDefined();
      expect(drop.dropRate).toBe(10);
    });

    it('ドロップアイテムが全てアイテムマスターに存在する', () => {
      for (const drop of enemy.uniqueDrops) {
        const item = getItem(drop.itemId);
        expect(item, `${drop.itemId} がアイテムマスターに存在しない`).toBeDefined();
      }
    });
  });
});
