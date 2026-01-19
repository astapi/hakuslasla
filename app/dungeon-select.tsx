import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DungeonCard } from '@/components/dungeon/DungeonCard';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { getDungeonList } from '@/data/dungeons';
import { BASE_BOSS_BY_UBER, DIMENSIONAL_RUSH_ID, UBER_DUNGEON_IDS } from '@/data/endContents';
import { settingsRepository } from '@/db';
import { DungeonListItem } from '@/types';
import { ms, fs } from '@/utils/scaling';
import { useEffect, useState } from 'react';

export default function DungeonSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dungeons, setDungeons] = useState<DungeonListItem[]>([]);

  useEffect(() => {
    const loadDungeons = async () => {
      const all = getDungeonList();
      const endContentUnlocked = await settingsRepository.getEndContentUnlocked();
      const uberUnlocks = await settingsRepository.getUberBossUnlocks();
      const uberTickets = await settingsRepository.getUberTickets();

      const filtered = all.filter((dungeon) => {
        if (dungeon.id === DIMENSIONAL_RUSH_ID) {
          return endContentUnlocked;
        }
        if (UBER_DUNGEON_IDS.includes(dungeon.id)) {
          const baseBossId = BASE_BOSS_BY_UBER[dungeon.id];
          if (!baseBossId) return false;
          const isUnlocked = uberUnlocks[baseBossId];
          const ticketCount = uberTickets[baseBossId] ?? 0;
          return Boolean(isUnlocked) && ticketCount > 0;
        }
        return true;
      });

      setDungeons(filtered);
    };

    loadDungeons();
  }, []);

  const handleDungeonSelect = async (dungeonId: string) => {
    if (UBER_DUNGEON_IDS.includes(dungeonId)) {
      const baseBossId = BASE_BOSS_BY_UBER[dungeonId];
      if (!baseBossId) return;
      const consumed = await settingsRepository.consumeUberTicket(baseBossId);
      if (!consumed) return;
    }
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
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
