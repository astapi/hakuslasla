import { create } from 'zustand';
import { settingsRepository, DungeonClearRecords, badgeRepository } from '@/db';
import { getDungeonList, DUNGEON_UNLOCK_ORDER } from '@/data/dungeons';
import { DIMENSIONAL_RUSH_IDS, UBER_DUNGEON_IDS, UBER_UBER_DUNGEON_IDS, isDimensionalRushDungeon, BASE_BOSS_BY_UBER } from '@/data/endContents';
import { BADGE_IDS_EXCEPT_UBER_UBER } from '@/data/badges';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { DungeonListItem } from '@/types';

interface EncyclopediaDungeon extends DungeonListItem {
  clearedAt: string | null;
  bestFloor: number;
  isCleared: boolean;
}

interface EncyclopediaStore {
  dungeons: EncyclopediaDungeon[];
  loadDungeons: () => Promise<void>;
  /** @deprecated Use dungeons instead */
  clearedDungeons: EncyclopediaDungeon[];
  /** @deprecated Use loadDungeons instead */
  loadClearedDungeons: () => Promise<void>;
}

export const useEncyclopediaStore = create<EncyclopediaStore>((set, get) => ({
  dungeons: [],
  clearedDungeons: [],

  loadDungeons: async () => {
    const season = usePlayerStore.getState().season;
    const clearRecords: DungeonClearRecords = await settingsRepository.getDungeonClearRecords(season);
    const uberUnlocks = await settingsRepository.getUberBossUnlocks(season);
    const allDungeons = getDungeonList();

    // UberUber解放判定（全Uberバッジ取得済み）
    const characterId = usePlayerStore.getState().characterId;
    let isUberUberUnlocked = false;
    if (characterId) {
      isUberUberUnlocked = await badgeRepository.hasAllBadgesExcept(
        characterId,
        BADGE_IDS_EXCEPT_UBER_UBER,
        []
      );
    }

    const result: EncyclopediaDungeon[] = [];
    for (const dungeon of allDungeons) {
      const record = clearRecords[dungeon.id];

      // Uberダンジョンの場合、解放済みかどうかをチェック
      const isUberDungeon = UBER_DUNGEON_IDS.includes(dungeon.id);
      const baseBossId = isUberDungeon ? BASE_BOSS_BY_UBER[dungeon.id] : null;
      const isUberUnlocked = baseBossId ? uberUnlocks[baseBossId] : false;

      // UberUberダンジョンの場合、全Uberバッジ取得済みかチェック
      const isUberUberDungeon = UBER_UBER_DUNGEON_IDS.includes(dungeon.id);

      // クリア済み、またはUber解放済み、またはUberUber解放済みなら追加
      if (record || isUberUnlocked || (isUberUberDungeon && isUberUberUnlocked)) {
        result.push({
          ...dungeon,
          clearedAt: record?.clearedAt ?? null,
          bestFloor: record?.bestFloor ?? 0,
          isCleared: !!record,
        });
      }
    }

    // ダンジョン選択画面と同じ順番でソート
    result.sort((a, b) => {
      const getOrder = (dungeonId: string): number => {
        // 通常ダンジョン
        const unlockIndex = DUNGEON_UNLOCK_ORDER.indexOf(dungeonId);
        if (unlockIndex !== -1) return unlockIndex;

        // 分割された異次元ラッシュ
        if (isDimensionalRushDungeon(dungeonId)) {
          const drIndex = DIMENSIONAL_RUSH_IDS.indexOf(dungeonId as typeof DIMENSIONAL_RUSH_IDS[number]);
          return DUNGEON_UNLOCK_ORDER.length + drIndex;
        }

        // Uberダンジョン
        const uberIndex = UBER_DUNGEON_IDS.indexOf(dungeonId);
        if (uberIndex !== -1) return DUNGEON_UNLOCK_ORDER.length + DIMENSIONAL_RUSH_IDS.length + uberIndex;

        // UberUberダンジョン（Uberの後ろに並べる）
        const uberUberIndex = UBER_UBER_DUNGEON_IDS.indexOf(dungeonId);
        if (uberUberIndex !== -1) return DUNGEON_UNLOCK_ORDER.length + DIMENSIONAL_RUSH_IDS.length + UBER_DUNGEON_IDS.length + uberUberIndex;

        // その他（デバッグなど）
        return 9999;
      };

      return getOrder(a.id) - getOrder(b.id);
    });

    set({ dungeons: result, clearedDungeons: result });
  },

  loadClearedDungeons: async () => {
    // 後方互換性のため、loadDungeonsを呼び出す
    await get().loadDungeons();
  },
}));
