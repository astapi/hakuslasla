import { useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, FlatList, ListRenderItemInfo } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BattleLogEntry } from '@/types';
import { ms, fs } from '@/utils/scaling';

interface BattleLogProps {
  logs: BattleLogEntry[];
}

const getLogColor = (type: BattleLogEntry['type']): string => {
  switch (type) {
    case 'player_attack':
      return '#4CAF50';
    case 'enemy_attack':
      return '#F44336';
    case 'block':
      return '#FFD54F';
    case 'victory':
      return '#FFD700';
    case 'defeat':
      return '#FF6B6B';
    case 'floor_clear':
      return '#2196F3';
    case 'poison':
      return '#9C27B0'; // 紫色（毒）
    case 'critical':
      return '#FF9800'; // オレンジ（クリティカル）
    case 'ignite':
      return '#FF5722'; // 赤オレンジ（発火）
    case 'heal':
      return '#00BCD4'; // シアン（回復）
    default:
      return '#fff';
  }
};

export const BattleLog = memo(({ logs }: BattleLogProps) => {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList<BattleLogEntry>>(null);

  // メッセージがあるログのみフィルタリング
  const filteredLogs = logs.filter(log => log.message);

  useEffect(() => {
    if (filteredLogs.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [filteredLogs.length]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<BattleLogEntry>) => (
    <Text style={[styles.logEntry, { color: getLogColor(item.type) }]}>
      {item.message}
    </Text>
  ), []);

  const keyExtractor = useCallback((item: BattleLogEntry) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('battleLog.title')}</Text>
      <FlatList
        ref={flatListRef}
        data={filteredLogs}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.scrollView}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
});

BattleLog.displayName = 'BattleLog';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: ms(8),
    padding: ms(12),
  },
  title: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  scrollView: {
    flex: 1,
  },
  logEntry: {
    fontSize: fs(12),
    marginBottom: ms(4),
  },
});
