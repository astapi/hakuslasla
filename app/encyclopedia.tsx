import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { getDungeonList, DUNGEON_UNLOCK_ORDER } from '@/data/dungeons';
import { DIMENSIONAL_RUSH_ID, UBER_DUNGEON_IDS } from '@/data/endContents';
import { settingsRepository, DungeonClearRecords } from '@/db';
import { DungeonListItem } from '@/types';
import { ms, fs } from '@/utils/scaling';

interface ClearedDungeon extends DungeonListItem {
  clearedAt: string;
  bestFloor: number;
}

export default function EncyclopediaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [clearedDungeons, setClearedDungeons] = useState<ClearedDungeon[]>([]);

  const loadClearedDungeons = useCallback(async () => {
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

    setClearedDungeons(cleared);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClearedDungeons();
    }, [loadClearedDungeons])
  );

  const handleDungeonPress = (dungeonId: string) => {
    router.push(`/encyclopedia-detail/${dungeonId}` as '/encyclopedia');
  };

  const handleBack = () => {
    router.back();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t('encyclopedia.title')}</Text>
        <Text style={styles.subtitle}>{t('encyclopedia.subtitle')}</Text>

        {clearedDungeons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('encyclopedia.noClearedDungeons')}</Text>
          </View>
        ) : (
          <View style={styles.dungeonList}>
            {clearedDungeons.map((dungeon) => (
              <Pressable
                key={dungeon.id}
                style={({ pressed }) => [
                  styles.dungeonCard,
                  pressed && styles.dungeonCardPressed,
                ]}
                onPress={() => handleDungeonPress(dungeon.id)}
              >
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>{dungeon.maxFloor}F</Text>
                </View>
                <View style={styles.infoContainer}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{t(`dungeons.${dungeon.id}.name`)}</Text>
                    <Text style={styles.clearMark}>✓</Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {t(`dungeons.${dungeon.id}.description`)}
                  </Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>
                      {t('encyclopedia.bestFloor', { floor: dungeon.bestFloor })}
                    </Text>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.statsText}>
                      {t('encyclopedia.clearedAt', { date: formatDate(dungeon.clearedAt) })}
                    </Text>
                  </View>
                </View>
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrow}>→</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: ms(80),
  },
  emptyText: {
    fontSize: fs(16),
    color: '#888',
    textAlign: 'center',
  },
  dungeonList: {
    gap: ms(12),
  },
  dungeonCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
    alignItems: 'center',
  },
  dungeonCardPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconContainer: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(30),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(16),
  },
  icon: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  name: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  clearMark: {
    fontSize: fs(18),
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: ms(8),
  },
  description: {
    fontSize: fs(12),
    color: '#aaa',
    marginBottom: ms(8),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  statsText: {
    fontSize: fs(11),
    color: '#888',
  },
  separator: {
    fontSize: fs(11),
    color: '#666',
  },
  arrowContainer: {
    paddingLeft: ms(12),
    width: ms(30),
  },
  arrow: {
    fontSize: fs(24),
    color: '#fff',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
