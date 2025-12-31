import { View, Text, StyleSheet } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot } from '@/types';

const slotLabels: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '防具',
  gloves: '手袋',
  boots: '靴',
  accessory: 'アクセ',
};

export const EquipmentSlots = () => {
  const { equipment } = usePlayerStore();
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>装備</Text>

      <View style={styles.slotsContainer}>
        {slots.map((slot) => {
          const item = equipment[slot];
          return (
            <View key={slot} style={styles.slotItem}>
              <View style={styles.slotIcon}>
                <Text style={styles.slotIconText}>{slotLabels[slot].charAt(0)}</Text>
              </View>
              <Text style={styles.slotLabel}>{slotLabels[slot]}</Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {item?.name || '-'}
              </Text>
              {item && (
                <Text style={styles.itemStats}>
                  {item.atk > 0 ? `+${item.atk}ATK ` : ''}
                  {item.def > 0 ? `+${item.def}DEF` : ''}
                </Text>
              )}
            </View>
          );
        })}
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
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  slotIconText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  slotLabel: {
    fontSize: 10,
    color: '#aaa',
    marginBottom: 2,
  },
  itemName: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  itemStats: {
    fontSize: 8,
    color: '#4CAF50',
    textAlign: 'center',
  },
});
