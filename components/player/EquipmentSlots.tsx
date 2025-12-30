import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item } from '@/types';
import { getItem } from '@/data/items';

const slotLabels: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '防具',
  gloves: '手袋',
  boots: '靴',
  accessory: 'アクセ',
};

interface EquipmentSlotsProps {
  onEquipItem?: (item: Item) => void;
}

export const EquipmentSlots = ({ onEquipItem }: EquipmentSlotsProps) => {
  const { equipment, inventory, equipItem } = usePlayerStore();

  const handleEquip = async (itemId: string) => {
    const item = getItem(itemId);
    await equipItem(itemId);
    if (item) {
      onEquipItem?.(item);
    }
  };

  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

  // インベントリアイテムをItem型に変換
  const inventoryItems = inventory
    .map((invItem) => {
      const item = getItem(invItem.itemId);
      return item ? { ...item, quantity: invItem.quantity } : null;
    })
    .filter((item): item is Item & { quantity: number } => item !== null);

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

      {inventoryItems.length > 0 && (
        <View style={styles.inventorySection}>
          <Text style={styles.inventoryTitle}>インベントリ ({inventoryItems.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {inventoryItems.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.inventoryItem,
                  pressed && styles.inventoryItemPressed,
                ]}
                onPress={() => handleEquip(item.id)}
              >
                <View style={styles.inventoryIcon}>
                  <Text style={styles.inventoryIconText}>{slotLabels[item.slot].charAt(0)}</Text>
                </View>
                <Text style={styles.inventoryItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.quantity > 1 && (
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                )}
                <Text style={styles.equipButton}>装備</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
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
  inventorySection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 12,
  },
  inventoryTitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  inventoryItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  inventoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inventoryIconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  inventoryItemName: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  equipButton: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  inventoryItemPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
