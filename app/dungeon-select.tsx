import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DungeonCard } from '@/components/dungeon/DungeonCard';
import { Button } from '@/components/common/Button';
import { getDungeonList } from '@/data/dungeons';

export default function DungeonSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dungeons = getDungeonList();

  const handleDungeonSelect = (dungeonId: string) => {
    // 戦闘開始時はダンジョン選択を履歴から消す
    router.replace(`/battle/${dungeonId}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
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
    </View>
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
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
  },
  dungeonList: {
    gap: 12,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
