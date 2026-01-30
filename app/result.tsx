import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Item } from '@/types';
import { ms, fs } from '@/utils/scaling';

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

  const result = params.result as 'cleared' | 'defeat' | 'retreat';
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
  const isRetreat = result === 'retreat';
  const isMultiRun = runCount > 1;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.resultHeader}>
          <Text
            style={[
              styles.resultText,
              isCleared ? styles.clearedText : isRetreat ? styles.retreatText : styles.defeatText,
            ]}
            testID="result-status-text"
          >
            {isCleared ? t('result.cleared') : isRetreat ? t('result.retreat') : t('result.defeat')}
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
                    <Text style={styles.itemName}>{t(`items.${item.id}.name`)}</Text>
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
        <Button
          title={t('result.returnButton')}
          onPress={handleReturn}
          testID="result-return-button"
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
  content: {
    padding: ms(24),
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: ms(24),
  },
  resultText: {
    fontSize: fs(28),
    fontWeight: 'bold',
  },
  clearedText: {
    color: '#FFD700',
  },
  defeatText: {
    color: '#F44336',
  },
  retreatText: {
    color: '#FF9800',
  },
  runCountText: {
    fontSize: fs(18),
    color: '#4CAF50',
    marginTop: ms(8),
    fontWeight: 'bold',
  },
  dungeonInfo: {
    alignItems: 'center',
    marginBottom: ms(32),
  },
  dungeonName: {
    fontSize: fs(20),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  floorProgress: {
    fontSize: fs(16),
    color: '#aaa',
  },
  rewardsSection: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
  },
  sectionTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(16),
    textAlign: 'center',
  },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  rewardLabel: {
    fontSize: fs(16),
    color: '#aaa',
  },
  rewardValue: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  itemsSection: {
    marginTop: ms(16),
  },
  itemsTitle: {
    fontSize: fs(14),
    color: '#aaa',
    marginBottom: ms(8),
  },
  itemsScrollView: {
    maxHeight: ms(300),
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(8),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    marginBottom: ms(4),
  },
  itemName: {
    fontSize: fs(14),
    color: '#fff',
    fontWeight: 'bold',
  },
  itemStats: {
    fontSize: fs(12),
    color: '#4CAF50',
  },
  noItems: {
    paddingVertical: ms(16),
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: fs(14),
    color: '#666',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
