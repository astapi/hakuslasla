import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DungeonCard } from '@/components/dungeon/DungeonCard';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { getDungeonList, DUNGEON_UNLOCK_ORDER, DEBUG_DUNGEON_IDS } from '@/data/dungeons';
import { BASE_BOSS_BY_UBER, DIMENSIONAL_RUSH_UNLOCK_CHAIN, UBER_DUNGEON_IDS, isDimensionalRushDungeon, isDimensionalCorridorDungeon } from '@/data/endContents';
import { settingsRepository, DungeonClearRecords } from '@/db';
import { DungeonListItem } from '@/types';
import { ms, fs } from '@/utils/scaling';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Analytics } from '@/lib/analytics';
import { useState, useCallback } from 'react';

// ダンジョンが解放されているか判定
function isDungeonUnlocked(
  dungeonId: string,
  clearRecords: DungeonClearRecords
): boolean {
  const index = DUNGEON_UNLOCK_ORDER.indexOf(dungeonId);

  // 解放順序に含まれない（エンドコンテンツ等）
  if (index === -1) return false;

  // 最初のダンジョンは常に解放
  if (index === 0) return true;

  // 前のダンジョンがクリアされていれば解放
  const prevDungeonId = DUNGEON_UNLOCK_ORDER[index - 1];
  return clearRecords[prevDungeonId] !== undefined;
}

interface DungeonWithStatus extends DungeonListItem {
  isLocked: boolean;
  isCleared: boolean;
  requiresTicket?: boolean;
  ticketCount?: number;
  isDisabled?: boolean;
}

export default function DungeonSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dungeons, setDungeons] = useState<DungeonWithStatus[]>([]);

  const loadDungeons = useCallback(async () => {
    const all = getDungeonList();
    const endContentUnlocked = await settingsRepository.getEndContentUnlocked();
    const uberUnlocks = await settingsRepository.getUberBossUnlocks();
    const uberTickets = await settingsRepository.getUberTickets();
    const clearRecords = await settingsRepository.getDungeonClearRecords();

    const result: DungeonWithStatus[] = [];

    for (const dungeon of all) {
      // デバッグ用ダンジョン（__DEV__のみ表示）
      if (__DEV__ && DEBUG_DUNGEON_IDS.includes(dungeon.id)) {
        result.push({
          ...dungeon,
          isLocked: false,
          isCleared: clearRecords[dungeon.id] !== undefined,
        });
        continue;
      }

      // 分割された異次元ラッシュの処理
      if (isDimensionalRushDungeon(dungeon.id)) {
        if (endContentUnlocked) {
          // 開放条件をチェック
          const requiredDungeon = DIMENSIONAL_RUSH_UNLOCK_CHAIN[dungeon.id];
          // requiredDungeonがnullの場合（dimensional_rush_1）は終焉の地クリアで開放済み
          // それ以外は前のダンジョンをクリアしているかチェック
          const isUnlocked = requiredDungeon === null || clearRecords[requiredDungeon] !== undefined;

          if (isUnlocked) {
            result.push({
              ...dungeon,
              isLocked: false,
              isCleared: clearRecords[dungeon.id] !== undefined,
            });
          }
        }
        continue;
      }

      // 次元回廊の処理（異次元ラッシュVI クリアで開放）
      if (isDimensionalCorridorDungeon(dungeon.id)) {
        const isUnlocked = clearRecords['dimensional_rush_6'] !== undefined;
        if (isUnlocked) {
          result.push({
            ...dungeon,
            isLocked: false,
            isCleared: false, // 無制限階層なのでクリア状態は常にfalse
          });
        }
        continue;
      }

      if (UBER_DUNGEON_IDS.includes(dungeon.id)) {
        const baseBossId = BASE_BOSS_BY_UBER[dungeon.id];
        if (!baseBossId) continue;
        const isUnlocked = uberUnlocks[baseBossId];
        const ticketCount = uberTickets[baseBossId] ?? 0;
        if (Boolean(isUnlocked)) {
          result.push({
            ...dungeon,
            isLocked: false,
            isCleared: clearRecords[dungeon.id] !== undefined,
            requiresTicket: true,
            ticketCount,
            isDisabled: ticketCount <= 0,
          });
        }
        continue;
      }

      // 通常ダンジョンの処理
      const isInOrder = DUNGEON_UNLOCK_ORDER.includes(dungeon.id);
      if (!isInOrder) continue;

      const isUnlocked = isDungeonUnlocked(dungeon.id, clearRecords);

      // 未解放ダンジョンは非表示
      if (!isUnlocked) continue;

      const isCleared = clearRecords[dungeon.id] !== undefined;

      result.push({
        ...dungeon,
        isLocked: false,
        isCleared,
      });
    }

    setDungeons(result);
  }, []);

  // 画面がフォーカスされた時にダンジョンリストを再読み込み
  useFocusEffect(
    useCallback(() => {
      loadDungeons();
    }, [loadDungeons])
  );

  const handleDungeonSelect = async (dungeonId: string) => {
    if (UBER_DUNGEON_IDS.includes(dungeonId)) {
      const baseBossId = BASE_BOSS_BY_UBER[dungeonId];
      if (!baseBossId) return;
      const consumed = await settingsRepository.consumeUberTicket(baseBossId);
      if (!consumed) return;
    }

    const dungeon = dungeons.find((d) => d.id === dungeonId);
    Analytics.logDungeonStart({
      dungeon_id: dungeonId,
      dungeon_name: dungeon?.name || dungeonId,
      player_level: usePlayerStore.getState().level,
      is_uber: UBER_DUNGEON_IDS.includes(dungeonId),
    });

    // 戦闘開始時はダンジョン選択を履歴から消す
    router.replace(`/battle/${dungeonId}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('dungeonSelect.title')}</Text>
        <Text style={styles.subtitle}>{t('dungeonSelect.subtitle')}</Text>

        <View style={styles.dungeonList}>
          {dungeons.map((dungeon) => (
            <DungeonCard
              key={dungeon.id}
              dungeon={dungeon}
              onPress={() => handleDungeonSelect(dungeon.id)}
              isCleared={dungeon.isCleared}
              requiresTicket={dungeon.requiresTicket}
              ticketCount={dungeon.ticketCount}
              isDisabled={dungeon.isDisabled}
              testID={`dungeon-card-${dungeon.id}`}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('common.back')}
          onPress={handleBack}
          variant="secondary"
          testID="dungeon-back-button"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
  },
  title: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  subtitle: {
    fontSize: fs(14),
    color: '#aaa',
    textAlign: 'center',
    marginBottom: ms(24),
  },
  dungeonList: {
    gap: ms(12),
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
