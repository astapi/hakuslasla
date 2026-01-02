import { Enemy, MonsterSpawn } from '@/types';
import monstersData from './json/monsters.json';

// モンスターデータ
const monsters: Record<string, Enemy> = monstersData.monsters as Record<string, Enemy>;

export const getEnemy = (id: string): Enemy | undefined => {
  return monsters[id];
};

export const getAllEnemies = (): Enemy[] => {
  return Object.values(monsters);
};

/**
 * 出現確率に基づいてランダムな敵を選択
 * @param monsterSpawns モンスター出現設定の配列
 * @returns 選択された敵、または見つからない場合はundefined
 */
export const getRandomEnemy = (monsterSpawns: MonsterSpawn[]): Enemy | undefined => {
  if (monsterSpawns.length === 0) return undefined;

  // 合計確率を計算
  const totalRate = monsterSpawns.reduce((sum, spawn) => sum + spawn.spawnRate, 0);

  // ランダム値を生成（0〜totalRate）
  const random = Math.random() * totalRate;

  // 累積確率で選択
  let cumulative = 0;
  for (const spawn of monsterSpawns) {
    cumulative += spawn.spawnRate;
    if (random < cumulative) {
      return getEnemy(spawn.monsterId);
    }
  }

  // フォールバック（最後のモンスターを返す）
  return getEnemy(monsterSpawns[monsterSpawns.length - 1].monsterId);
};

/**
 * 敵IDの配列からランダムな敵を選択（旧API互換）
 * @deprecated getRandomEnemy(monsterSpawns) を使用してください
 */
export const getRandomEnemyByIds = (enemyIds: string[]): Enemy | undefined => {
  const randomIndex = Math.floor(Math.random() * enemyIds.length);
  return getEnemy(enemyIds[randomIndex]);
};
