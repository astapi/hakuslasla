import { View, Text, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item, ItemMod } from '@/types';
import { getSlotIcon } from '@/data/itemIcons';
import { ms, fs, s } from '@/utils/scaling';

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
  t: (key: string) => string;
}

const EquipmentRow = ({ slot, item, t }: EquipmentRowProps) => {
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
        <Text style={styles.slotLabel}>{t(`slots.${slot}`)}</Text>
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
          <Text style={styles.emptyText}>{t('common.unequipped')}</Text>
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
                {t(`mods.${mod.type}`)} +{mod.value}
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
  const { t } = useTranslation();
  const { equipment } = usePlayerStore();
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('equipment.title')}</Text>

      <View style={styles.header}>
        <Text style={styles.headerSlot}>{t('equipment.slot')}</Text>
        <Text style={styles.headerItem}>{t('equipment.item')}</Text>
        <Text style={styles.headerMod}>{t('equipment.mod')}</Text>
      </View>

      {slots.map((slot) => (
        <EquipmentRow key={slot} slot={slot} item={equipment[slot]} t={t} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: ms(12),
    padding: ms(12),
  },
  title: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(12),
  },
  header: {
    flexDirection: 'row',
    paddingBottom: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: ms(4),
  },
  headerSlot: {
    width: ms(60),
    fontSize: fs(10),
    color: '#888',
  },
  headerItem: {
    flex: 1,
    fontSize: fs(10),
    color: '#888',
  },
  headerMod: {
    width: ms(80),
    fontSize: fs(10),
    color: '#888',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  slotInfo: {
    width: ms(60),
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotIcon: {
    width: s(20),
    height: s(20),
    marginRight: ms(4),
  },
  slotLabel: {
    fontSize: fs(10),
    color: '#aaa',
  },
  itemInfo: {
    flex: 1,
    paddingHorizontal: ms(8),
  },
  itemName: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#fff',
    marginBottom: ms(2),
  },
  statsRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  atkText: {
    fontSize: fs(11),
    color: '#FF6B6B',
  },
  defText: {
    fontSize: fs(11),
    color: '#4ECDC4',
  },
  emptyText: {
    fontSize: fs(12),
    color: '#666',
    fontStyle: 'italic',
  },
  modInfo: {
    width: ms(80),
    alignItems: 'flex-end',
    gap: ms(2),
  },
  modTag: {
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderRadius: ms(4),
  },
  modTagText: {
    fontSize: fs(9),
    fontWeight: 'bold',
  },
  noModText: {
    fontSize: fs(10),
    color: '#555',
  },
});
