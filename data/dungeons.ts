import { Dungeon, DungeonListItem } from '@/types';
import dungeonListData from './json/dungeonList.json';
import dungeonsData from './json/dungeons.json';

// ダンジョンリスト（選択画面用）
export const dungeonList: DungeonListItem[] = dungeonListData.dungeons;

// ダンジョン詳細データ
const dungeonDetails: Record<string, Dungeon> = dungeonsData.dungeons as Record<string, Dungeon>;

export const getDungeon = (id: string): Dungeon | undefined => {
  return dungeonDetails[id];
};

export const getAllDungeons = (): Dungeon[] => {
  return Object.values(dungeonDetails);
};

export const getDungeonList = (): DungeonListItem[] => {
  return dungeonList;
};
