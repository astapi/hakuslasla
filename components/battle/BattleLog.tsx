import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BattleLogEntry } from '@/types';

interface BattleLogProps {
  logs: BattleLogEntry[];
}

const getLogColor = (type: BattleLogEntry['type']): string => {
  switch (type) {
    case 'player_attack':
      return '#4CAF50';
    case 'enemy_attack':
      return '#F44336';
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
    case 'heal':
      return '#00BCD4'; // シアン（回復）
    default:
      return '#fff';
  }
};

export const BattleLog = ({ logs }: BattleLogProps) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [logs.length]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>戦闘ログ</Text>
      <ScrollView ref={scrollViewRef} style={styles.scrollView}>
        {logs.map((log) => (
          <Text key={log.id} style={[styles.logEntry, { color: getLogColor(log.type) }]}>
            {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  logEntry: {
    fontSize: 12,
    marginBottom: 4,
  },
});
