import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { fs, ms } from '@/utils/scaling';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type StatConfig = {
  key: 'atk' | 'def' | 'evasion';
  value: number;
  color: string;
  icon: IconName;
};

type EquipmentStatSummaryProps = {
  atk: number;
  def: number;
  evasion: number;
  showPlus?: boolean;
  size?: 'small' | 'regular';
  style?: StyleProp<ViewStyle>;
};

export function EquipmentStatSummary({
  atk,
  def,
  evasion,
  showPlus = false,
  size = 'regular',
  style,
}: EquipmentStatSummaryProps) {
  const statConfigs: StatConfig[] = [
    { key: 'atk', value: atk, color: '#FF6B6B', icon: 'sword-cross' },
    { key: 'def', value: def, color: '#4ECDC4', icon: 'shield-outline' },
    { key: 'evasion', value: evasion, color: '#80CBC4', icon: 'run-fast' },
  ];
  const stats = statConfigs.filter((stat) => stat.value > 0);

  if (stats.length === 0) return null;

  const isSmall = size === 'small';
  const iconSize = isSmall ? ms(12) : ms(16);

  return (
    <View style={[styles.container, isSmall ? styles.smallGap : styles.regularGap, style]}>
      {stats.map((stat) => (
        <View key={stat.key} style={styles.statItem}>
          <MaterialCommunityIcons name={stat.icon} size={iconSize} color={stat.color} />
          <Text style={[styles.valueText, isSmall ? styles.smallText : styles.regularText, { color: stat.color }]}>
            {showPlus ? '+' : ''}{stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  smallGap: {
    gap: ms(6),
  },
  regularGap: {
    gap: ms(12),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(2),
  },
  valueText: {
    fontWeight: 'bold',
  },
  smallText: {
    fontSize: fs(11),
  },
  regularText: {
    fontSize: fs(14),
  },
});
