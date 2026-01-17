import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { Item } from '@/types';

export default function ResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    dungeonId: string;
    dungeonName: string;
    result: string;
    floorsCleared: string;
    maxFloor: string;
    expGained: string;
    itemsGained: string;
    runCount: string;
    grandTotalExp: string;
    grandTotalItems: string;
  }>();

  const result = params.result as 'cleared' | 'defeat';
  const floorsCleared = parseInt(params.floorsCleared || '0', 10);
  const maxFloor = parseInt(params.maxFloor || '5', 10);
  const expGained = parseInt(params.expGained || '0', 10);
  const itemsGained: Item[] = params.itemsGained ? JSON.parse(params.itemsGained) : [];
  const runCount = parseInt(params.runCount || '1', 10);
  const grandTotalExp = parseInt(params.grandTotalExp || expGained.toString(), 10);
  const grandTotalItems: Item[] = params.grandTotalItems ? JSON.parse(params.grandTotalItems) : itemsGained;

  const handleReturn = () => {
    router.replace('/home');
  };

  const isCleared = result === 'cleared';
  const isMultiRun = runCount > 1;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.resultHeader}>
          <Text style={[styles.resultText, isCleared ? styles.clearedText : styles.defeatText]}>
            {isCleared ? t('result.cleared') : t('result.defeat')}
          </Text>
          {isMultiRun && (
            <Text style={styles.runCountText}>{t('result.runsCompleted', { count: runCount })}</Text>
          )}
        </View>

        <View style={styles.dungeonInfo}>
          <Text style={styles.dungeonName}>{params.dungeonName}</Text>
          <Text style={styles.floorProgress}>
            {t('result.floorsCleared', { current: floorsCleared, max: maxFloor })}
          </Text>
        </View>

        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>{t('result.rewards')}</Text>

          {/* 累計経験値 */}
          <View style={styles.rewardItem}>
            <Text style={styles.rewardLabel}>
              {isMultiRun ? t('result.totalExp') : t('result.exp')}
            </Text>
            <Text style={styles.rewardValue}>+{grandTotalExp} EXP</Text>
          </View>

          {/* 累計アイテム */}
          {grandTotalItems.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.itemsTitle}>
                {isMultiRun ? t('result.totalItems', { count: grandTotalItems.length }) : t('result.items')}
              </Text>
              <ScrollView
                style={styles.itemsScrollView}
                nestedScrollEnabled={true}
              >
                {grandTotalItems.map((item, index) => (
                  <View key={`${item.id}-${index}`} style={styles.itemRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemStats}>
                      {item.atk > 0 ? `ATK+${item.atk} ` : ''}
                      {item.def > 0 ? `DEF+${item.def}` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {grandTotalItems.length === 0 && (
            <View style={styles.noItems}>
              <Text style={styles.noItemsText}>{t('result.noItems')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('result.returnButton')} onPress={handleReturn} />
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
  runCountText: {
    fontSize: 18,
    color: '#4CAF50',
    marginTop: 8,
    fontWeight: 'bold',
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
  itemsScrollView: {
    maxHeight: 300,
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
