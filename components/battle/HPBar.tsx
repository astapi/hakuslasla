import { View, Text, StyleSheet } from 'react-native';
import { ms, fs } from '@/utils/scaling';

interface HPBarProps {
  current: number;
  max: number;
  color?: string;
  showText?: boolean;
}

export const HPBar = ({ current, max, color = '#4CAF50', showText = true }: HPBarProps) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  // HPが低いほど色を赤くする
  const barColor = percentage > 50 ? color : percentage > 25 ? '#FFC107' : '#F44336';

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
      </View>
      {showText && (
        <Text style={styles.text}>
          {current}/{max}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barBackground: {
    height: ms(16),
    backgroundColor: '#333',
    borderRadius: ms(8),
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: ms(8),
  },
  text: {
    fontSize: fs(12),
    color: '#fff',
    textAlign: 'center',
    marginTop: ms(2),
  },
});
