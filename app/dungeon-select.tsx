import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { DungeonCard } from '@/components/dungeon/DungeonCard';
import { Button } from '@/components/common/Button';
import { getAllDungeons } from '@/data/dungeons';

export default function DungeonSelectScreen() {
  const router = useRouter();
  const dungeons = getAllDungeons();

  const handleDungeonSelect = (dungeonId: string) => {
    // 戦闘開始時はダンジョン選択を履歴から消す
    router.replace(`/battle/${dungeonId}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>ダンジョン選択</Text>
        <Text style={styles.subtitle}>挑戦するダンジョンを選んでください</Text>

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
        <Button title="戻る" onPress={handleBack} variant="secondary" />
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
