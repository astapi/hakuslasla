import { View, Text, StyleSheet, Image } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot } from '@/types';
import { getSlotIcon, getSlotLabel } from '@/data/itemIcons';

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
              <Image source={getSlotIcon(slot)} style={styles.slotIcon} />
              <Text style={styles.slotLabel}>{getSlotLabel(slot)}</Text>
              <Text style={styles.itemName} numberOfLines={1}>
                {item?.name || '-'}
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
                            <Text style={styles.modBadgeText}>MOD x{otherModCount}</Text>
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
    width: 28,
    height: 28,
    marginBottom: 4,
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
  modBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  modBadgeText: {
    fontSize: 7,
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
