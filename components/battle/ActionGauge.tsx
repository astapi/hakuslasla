import { View, StyleSheet } from 'react-native';
import { ms } from '@/utils/scaling';

interface ActionGaugeProps {
  value: number;        // 0-100
  color?: string;
}

export const ActionGauge = ({
  value,
  color = '#FFD700',
}: ActionGaugeProps) => {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <View style={styles.container}>
      <View style={styles.background}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${percentage}%`,
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: ms(4),
  },
  background: {
    height: ms(6),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: ms(3),
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: ms(3),
  },
});
