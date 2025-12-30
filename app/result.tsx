import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/common/Button';
import { Item } from '@/types';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    dungeonId: string;
    dungeonName: string;
    result: string;
    floorsCleared: string;
    maxFloor: string;
    expGained: string;
    itemsGained: string;
  }>();

  const result = params.result as 'cleared' | 'defeat';
  const floorsCleared = parseInt(params.floorsCleared || '0', 10);
  const maxFloor = parseInt(params.maxFloor || '5', 10);
  const expGained = parseInt(params.expGained || '0', 10);
  const itemsGained: Item[] = params.itemsGained ? JSON.parse(params.itemsGained) : [];

  const handleReturn = () => {
    router.replace('/home');
  };

  const isCleared = result === 'cleared';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultText, isCleared ? styles.clearedText : styles.defeatText]}>
            {isCleared ? 'ダンジョン踏破！' : '敗北...'}
          </Text>
        </View>

        <View style={styles.dungeonInfo}>
          <Text style={styles.dungeonName}>{params.dungeonName}</Text>
          <Text style={styles.floorProgress}>
            {floorsCleared}/{maxFloor} 階クリア
          </Text>
        </View>

        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>獲得報酬</Text>

          <View style={styles.rewardItem}>
            <Text style={styles.rewardLabel}>経験値</Text>
            <Text style={styles.rewardValue}>+{expGained} EXP</Text>
          </View>

          {itemsGained.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.itemsTitle}>獲得アイテム</Text>
              {itemsGained.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemStats}>
                    {item.atk > 0 ? `ATK+${item.atk} ` : ''}
                    {item.def > 0 ? `DEF+${item.def}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {itemsGained.length === 0 && (
            <View style={styles.noItems}>
              <Text style={styles.noItemsText}>アイテムなし</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="ダンジョン選択に戻る" onPress={handleReturn} />
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
  content: {
    padding: 24,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  clearedText: {
    color: '#FFD700',
  },
  defeatText: {
    color: '#F44336',
  },
  dungeonInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  dungeonName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  floorProgress: {
    fontSize: 16,
    color: '#aaa',
  },
  rewardsSection: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  rewardLabel: {
    fontSize: 16,
    color: '#aaa',
  },
  rewardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  itemsSection: {
    marginTop: 16,
  },
  itemsTitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  itemStats: {
    fontSize: 12,
    color: '#4CAF50',
  },
  noItems: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: 14,
    color: '#666',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
