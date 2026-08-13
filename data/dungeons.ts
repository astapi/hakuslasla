import { Dungeon, DungeonListItem } from '@/types';
import dungeonListData from './json/dungeonList.json';
import dungeonsData from './json/dungeons.json';

// ダンジョン解放順序（エンドコンテンツは含まない）
export const DUNGEON_UNLOCK_ORDER: string[] = [
  'grassland',       // 始まりの草原
  'cave',            // 地底洞窟
  'ruins',           // 忘却の遺跡
  'goblin_fort',     // ゴブリンの砦
  'bandit_hideout',  // 盗賊のアジト
  'vampire_mansion', // ヴァンパイアの館
  'underwater_cave', // 海底洞窟
  'orc_fortress',    // オークの要塞
  'volcano',         // 灼熱の火山
  'demon_castle',    // 魔王城
  'ice_cave',        // 氷結の洞窟
  'dark_forest',     // 深淵の森
  'sky_tower',       // 天空の塔
  'hell_gate',       // 地獄の門
  'dragon_nest',     // 竜の巣穴
  'sacred_temple',   // 神域の神殿
  'chaos_realm',     // 混沌の領域
  'final_land',      // 終焉の地
];

// デバッグ用ダンジョン
export const DEBUG_DUNGEON_IDS: string[] = [
  'debug_dimensional_goblin_king',
  'debug_dimensional_bandit_leader',
  'debug_dimensional_vampire',
  'debug_dimensional_kraken',
  'debug_dimensional_demon_lord',
  'debug_dimensional_true_final_boss',
  'debug_uber_uber_goblin_king',
  'debug_uber_uber_bandit_leader',
  'debug_uber_uber_demon_lord',
];

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
