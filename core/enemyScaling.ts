import type { DungeonConfig, EnemyConfig } from './types';

export const scaleEnemyHpForDungeon = <T extends EnemyConfig>(
  enemy: T,
  dungeon: Pick<DungeonConfig, 'boss' | 'enemyHpMultiplier' | 'bossHpMultiplier'>,
): T => {
  const isBoss = dungeon.boss?.monsterId === enemy.id;
  const multiplier = isBoss ? dungeon.bossHpMultiplier : dungeon.enemyHpMultiplier;
  if (!multiplier || multiplier === 1) return enemy;

  return {
    ...enemy,
    maxHp: Math.max(1, Math.round(enemy.maxHp * multiplier)),
  };
};
