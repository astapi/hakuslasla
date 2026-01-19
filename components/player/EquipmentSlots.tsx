import { View, Text, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot } from '@/types';
import { getSlotIcon } from '@/data/itemIcons';
import { ms, fs, s } from '@/utils/scaling';

export const EquipmentSlots = () => {
  const { t } = useTranslation();
  const { equipment } = usePlayerStore();
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('equipment.title')}</Text>

      <View style={styles.slotsContainer}>
        {slots.map((slot) => {
          const item = equipment[slot];
          return (
            <View key={slot} style={styles.slotItem}>
              <Image source={getSlotIcon(slot)} style={styles.slotIcon} />
              <Text style={styles.slotLabel}>{t(`slots.${slot}`)}</Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {item
                  ? t(`items.${item.id}.name`, { defaultValue: item.name })
                  : '-'}
              </Text>
              {item && (
                <>
                  {(() => {
                    // ATK/DEF MODを加算した合計値
                    let totalAtk = item.atk;
                    let totalDef = item.def;
                    let otherModCount = 0;
                    if (item.mods) {
                      for (const mod of item.mods) {
                        if (mod.type === 'atk_bonus') totalAtk += mod.value;
                        else if (mod.type === 'def_bonus') totalDef += mod.value;
                        else otherModCount++;
                      }
                    }
                    return (
                      <>
                        <Text style={styles.itemStats}>
                          {totalAtk > 0 ? `+${totalAtk}ATK ` : ''}
                          {totalDef > 0 ? `+${totalDef}DEF` : ''}
                        </Text>
                        {otherModCount > 0 && (
                          <View style={styles.modBadge}>
                            <Text style={styles.modBadgeText}>
                              {t('equipment.modCount', { count: otherModCount })}
                            </Text>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </>
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
    borderRadius: ms(12),
    padding: ms(12),
  },
  title: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(12),
  },
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: ms(4),
  },
  slotIcon: {
    width: s(28),
    height: s(28),
    marginBottom: ms(4),
  },
  slotLabel: {
    fontSize: fs(10),
    color: '#aaa',
    marginBottom: ms(2),
  },
  itemName: {
    fontSize: fs(10),
    color: '#fff',
    textAlign: 'center',
  },
  itemStats: {
    fontSize: fs(8),
    color: '#4CAF50',
    textAlign: 'center',
  },
  modBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: ms(4),
    paddingHorizontal: ms(4),
    paddingVertical: ms(1),
    marginTop: ms(2),
  },
  modBadgeText: {
    fontSize: fs(7),
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
