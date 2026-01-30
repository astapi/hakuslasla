import { describe, it, expect } from 'vitest';
import {
  applyPercentageScaling,
  calculateDamage,
  executeTurn,
  runBattle,
  runDungeon,
  estimateWinChance,
} from '../../core/battle';
import { Stats, EnemyConfig, BattleState, DungeonConfig } from '../../core/types';

const basicEnemy: EnemyConfig = {
  id: 'e1',
  name: 'E',
  maxHp: 10,
  atk: 5,
  def: 0,
  exp: 2,
};

const basicPlayer: Stats = { maxHp: 20, atk: 5, def: 0 };

describe('core/battle', () => {
  it('applyPercentageScaling は increased と more を順に反映する', () => {
    // base 100, increased 50% -> 150, more 20% -> 180
    expect(applyPercentageScaling(100, 50, [20])).toBe(180);
  });

  it('calculateDamage は最低 1 ダメージを保証する', () => {
    const damage = calculateDamage(10, 10_000, 0);
    expect(damage).toBe(1);
  });

  it('calculateDamage は追加軽減の上限を 99% に制限する', () => {
    const damage = calculateDamage(100, 0, 200); // 追加軽減 200% でも 99% が上限
    expect(damage).toBe(1);
  });

  it('executeTurn は敵撃破時に敵の攻撃が発生しない', () => {
    const player: Stats = { maxHp: 100, atk: 999, def: 0 };
    const enemy: EnemyConfig = { ...basicEnemy, maxHp: 10, atk: 50, def: 0 };
    const state: BattleState = { playerHp: 100, playerMaxHp: 100, enemyHp: 10, enemyMaxHp: 10, turn: 0 };

    const result = executeTurn(player, enemy, state);
    expect(result.enemyDefeated).toBe(true);
    expect(result.enemyDamageDealt).toBe(0);
    expect(result.playerHpAfter).toBe(100);
  });

  it('runBattle は勝利時に exp と残HPを返す', () => {
    const result = runBattle(basicPlayer, 20, basicEnemy);
    expect(result.victory).toBe(true);
    expect(result.expGained).toBe(basicEnemy.exp);
    expect(result.playerHpRemaining).toBeGreaterThan(0);
  });

  it('runBattle は毒ダメージで敗北する場合がある', () => {
    const result = runBattle(
      basicPlayer,
      5,
      { ...basicEnemy, maxHp: 100 },
      { playerPoison: { damage: 5, turns: 1 } }
    );
    expect(result.victory).toBe(false);
  });

  it('runDungeon は敗北時に floorsCleared を正しく返す', () => {
    const dungeon: DungeonConfig = {
      id: 'd1',
      name: 'D',
      maxFloor: 2,
      enemies: [basicEnemy.id],
      dropTable: [],
    };

    const weakPlayer: Stats = { maxHp: 1, atk: 1, def: 0 };
    const result = runDungeon(
      weakPlayer,
      dungeon,
      () => basicEnemy,
      (ids) => ids[0]
    );

    expect(result.cleared).toBe(false);
    expect(result.floorsCleared).toBe(0);
    expect(result.playerHpRemaining).toBe(0);
  });

  it('runDungeon はクリア時にドロップを返す', () => {
    const dungeon: DungeonConfig = {
      id: 'd2',
      name: 'D2',
      maxFloor: 1,
      enemies: [basicEnemy.id],
      dropTable: ['item1'],
    };
    const result = runDungeon(
      { maxHp: 50, atk: 50, def: 0 },
      dungeon,
      () => basicEnemy,
      (ids) => ids[0],
      undefined,
      () => 0,
      (table) => table[0]
    );
    expect(result.cleared).toBe(true);
    expect(result.droppedItems.length).toBe(1);
  });

  it('estimateWinChance は 0〜1 の範囲に収まる', () => {
    const chance = estimateWinChance(basicPlayer, basicEnemy);
    expect(chance).toBeGreaterThanOrEqual(0);
    expect(chance).toBeLessThanOrEqual(1);
  });
});
