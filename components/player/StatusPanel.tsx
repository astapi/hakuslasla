import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { HPBar } from '../battle/HPBar';

interface StatusPanelProps {
  currentHp?: number;
}

export const StatusPanel = ({ currentHp }: StatusPanelProps) => {
  // 装備・スキル変更時に再レンダリングするため、関連する state を購読
  const { level, exp, expToNextLevel, skillPoints, maxHp, atk, def, equipment, getTotalStats } = usePlayerStore();
  void equipment; // 購読のためだけに使用
  void maxHp; void atk; void def; // スキル取得時の再レンダリング用
  const stats = getTotalStats();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ステータス</Text>
        <Text style={styles.level}>Lv.{level}</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>HP</Text>
          <Text style={styles.statValue}>{stats.maxHp}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>ATK</Text>
          <Text style={styles.statValue}>{stats.atk}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>DEF</Text>
          <Text style={styles.statValue}>{stats.def}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>SP</Text>
          <Text style={styles.statValue}>{skillPoints}</Text>
        </View>
      </View>

      <View style={styles.expContainer}>
        <Text style={styles.expLabel}>EXP</Text>
        <View style={styles.expBarContainer}>
          <HPBar current={exp} max={expToNextLevel} color="#9C27B0" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  level: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  expContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expLabel: {
    fontSize: 12,
    color: '#aaa',
    marginRight: 8,
    width: 30,
  },
  expBarContainer: {
    flex: 1,
  },
});
