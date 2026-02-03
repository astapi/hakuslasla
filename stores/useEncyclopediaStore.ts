import { create } from 'zustand';
import { settingsRepository, DungeonClearRecords } from '@/db';
import { getDungeonList, DUNGEON_UNLOCK_ORDER } from '@/data/dungeons';
import { DIMENSIONAL_RUSH_ID, UBER_DUNGEON_IDS } from '@/data/endContents';
import { DungeonListItem } from '@/types';

interface ClearedDungeon extends DungeonListItem {
  clearedAt: string;
  bestFloor: number;
}

interface EncyclopediaStore {
  clearedDungeons: ClearedDungeon[];
  loadClearedDungeons: () => Promise<void>;
}

export const useEncyclopediaStore = create<EncyclopediaStore>((set) => ({
  clearedDungeons: [],

  loadClearedDungeons: async () => {
    const clearRecords: DungeonClearRecords = await settingsRepository.getDungeonClearRecords();
    const allDungeons = getDungeonList();

    const cleared: ClearedDungeon[] = [];
    for (const dungeon of allDungeons) {
      const record = clearRecords[dungeon.id];
      if (record) {
        cleared.push({
          ...dungeon,
          clearedAt: record.clearedAt,
          bestFloor: record.bestFloor,
        });
      }
    }

    // ダンジョン選択画面と同じ順番でソート
    cleared.sort((a, b) => {
      const getOrder = (dungeonId: string): number => {
        // 通常ダンジョン
        const unlockIndex = DUNGEON_UNLOCK_ORDER.indexOf(dungeonId);
        if (unlockIndex !== -1) return unlockIndex;

        // 異次元ラッシュ
        if (dungeonId === DIMENSIONAL_RUSH_ID) return DUNGEON_UNLOCK_ORDER.length;

        // Uberダンジョン
        const uberIndex = UBER_DUNGEON_IDS.indexOf(dungeonId);
        if (uberIndex !== -1) return DUNGEON_UNLOCK_ORDER.length + 1 + uberIndex;

        // その他（デバッグなど）
        return 9999;
      };

      return getOrder(a.id) - getOrder(b.id);
    });

    set({ clearedDungeons: cleared });
  },
}));
