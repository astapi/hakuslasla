import { View, Text, StyleSheet, Image } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item, ItemMod } from '@/types';
import { getSlotIcon, getSlotLabel } from '@/data/itemIcons';

const MOD_LABELS: Record<string, string> = {
  atk_bonus: 'ATK',
  def_bonus: 'DEF',
  hp_regen: '回復',
  poison_chance: '毒',
  critical_chance: 'クリ',
};

const MOD_COLORS: Record<string, string> = {
  atk_bonus: '#FF6B6B',
  def_bonus: '#4ECDC4',
  hp_regen: '#00BCD4',
  poison_chance: '#9C27B0',
  critical_chance: '#FF9800',
};

interface EquipmentRowProps {
  slot: EquipmentSlot;
  item: Item | null;
}

const EquipmentRow = ({ slot, item }: EquipmentRowProps) => {
  // ATK/DEF MODを加算した合計値を計算
  let totalAtk = item?.atk || 0;
  let totalDef = item?.def || 0;
  const otherMods: ItemMod[] = [];

  if (item?.mods) {
    for (const mod of item.mods) {
      if (mod.type === 'atk_bonus') {
        totalAtk += mod.value;
      } else if (mod.type === 'def_bonus') {
        totalDef += mod.value;
      } else {
        otherMods.push(mod);
      }
    }
  }

  return (
    <View style={styles.row}>
      {/* 左: スロットアイコンとラベル */}
      <View style={styles.slotInfo}>
        <Image source={getSlotIcon(slot)} style={styles.slotIcon} />
        <Text style={styles.slotLabel}>{getSlotLabel(slot)}</Text>
      </View>

      {/* 中央: アイテム情報 */}
      <View style={styles.itemInfo}>
        {item ? (
          <>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.statsRow}>
              {totalAtk > 0 && (
                <Text style={styles.atkText}>+{totalAtk} ATK</Text>
              )}
              {totalDef > 0 && (
                <Text style={styles.defText}>+{totalDef} DEF</Text>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>未装備</Text>
        )}
      </View>

      {/* 右: MOD情報 */}
      <View style={styles.modInfo}>
        {otherMods.length > 0 ? (
          otherMods.map((mod, index) => (
            <View
              key={index}
              style={[
                styles.modTag,
                { backgroundColor: `${MOD_COLORS[mod.type] || '#666'}30` },
              ]}
            >
              <Text
                style={[
                  styles.modTagText,
                  { color: MOD_COLORS[mod.type] || '#fff' },
                ]}
              >
                {MOD_LABELS[mod.type] || mod.type} +{mod.value}
                {mod.type.includes('chance') ? '%' : ''}
              </Text>
            </View>
          ))
        ) : item ? (
          <Text style={styles.noModText}>-</Text>
        ) : null}
      </View>
    </View>
  );
};

export const EquipmentList = () => {
  const { equipment } = usePlayerStore();
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>装備</Text>

      <View style={styles.header}>
        <Text style={styles.headerSlot}>スロット</Text>
        <Text style={styles.headerItem}>アイテム</Text>
        <Text style={styles.headerMod}>MOD</Text>
      </View>

      {slots.map((slot) => (
        <EquipmentRow key={slot} slot={slot} item={equipment[slot]} />
      ))}
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
  header: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 4,
  },
  headerSlot: {
    width: 60,
    fontSize: 10,
    color: '#888',
  },
  headerItem: {
    flex: 1,
    fontSize: 10,
    color: '#888',
  },
  headerMod: {
    width: 80,
    fontSize: 10,
    color: '#888',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  slotInfo: {
    width: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  slotLabel: {
    fontSize: 10,
    color: '#aaa',
  },
  itemInfo: {
    flex: 1,
    paddingHorizontal: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  atkText: {
    fontSize: 11,
    color: '#FF6B6B',
  },
  defText: {
    fontSize: 11,
    color: '#4ECDC4',
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  modInfo: {
    width: 80,
    alignItems: 'flex-end',
    gap: 2,
  },
  modTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  noModText: {
    fontSize: 10,
    color: '#555',
  },
});
