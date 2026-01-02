import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item } from '@/types';
import { getItemIcon, getSlotIcon, getSlotLabel } from '@/data/itemIcons';
import { INVENTORY_MAX_SIZE } from '@/core';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

// アイテムのステータス計算
function calculateItemStats(item: Item) {
  let totalAtk = item.atk;
  let totalDef = item.def;
  const allMods: { type: string; value: number; desc: string }[] = [];

  if (item.mods) {
    for (const mod of item.mods) {
      let desc = '';
      switch (mod.type) {
        case 'atk_bonus':
          totalAtk += mod.value;
          desc = `ATK+${mod.value}`;
          break;
        case 'def_bonus':
          totalDef += mod.value;
          desc = `DEF+${mod.value}`;
          break;
        case 'hp_regen':
          desc = `毎ターンHP${mod.value}回復`;
          break;
        case 'poison_chance':
          desc = `毒付与+${mod.value}%`;
          break;
        case 'critical_chance':
          desc = `クリティカル+${mod.value}%`;
          break;
      }
      if (desc) {
        allMods.push({ type: mod.type, value: mod.value, desc });
      }
    }
  }

  return { totalAtk, totalDef, allMods };
}

export default function InventoryScreen() {
  const router = useRouter();
  const { inventory, equipItem, removeFromInventory } = usePlayerStore();
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // カテゴリごとにアイテムをグループ化
  const itemsBySlot = useMemo(() => {
    const grouped: Record<EquipmentSlot, Item[]> = {
      weapon: [],
      armor: [],
      gloves: [],
      boots: [],
      accessory: [],
    };
    for (const item of inventory) {
      grouped[item.slot].push(item);
    }
    return grouped;
  }, [inventory]);

  // 各カテゴリのアイテム数
  const slotCounts = useMemo(() => {
    const counts: Record<EquipmentSlot, number> = {
      weapon: 0,
      armor: 0,
      gloves: 0,
      boots: 0,
      accessory: 0,
    };
    for (const item of inventory) {
      counts[item.slot]++;
    }
    return counts;
  }, [inventory]);

  // カテゴリ内の最初のアイテムを選択
  useEffect(() => {
    const items = itemsBySlot[selectedSlot];
    if (items.length > 0) {
      setSelectedItem(items[0]);
    } else {
      setSelectedItem(null);
    }
  }, [selectedSlot, itemsBySlot]);

  const handleBack = () => {
    router.back();
  };

  const handleEquip = async (instanceId: string) => {
    await equipItem(instanceId);
    setSelectedItem(null);
  };

  const handleDiscard = async (instanceId: string) => {
    await removeFromInventory(instanceId);
    setSelectedItem(null);
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
  };

  const currentItems = itemsBySlot[selectedSlot];

  const isFull = inventory.length >= INVENTORY_MAX_SIZE;

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>インベントリ</Text>
        <Text style={[styles.headerCount, isFull && styles.headerCountFull]}>
          {inventory.length}/{INVENTORY_MAX_SIZE}
        </Text>
      </View>

      {/* 詳細表示エリア */}
      <View style={styles.detailArea}>
        {selectedItem ? (
          <ItemDetail
            item={selectedItem}
            onEquip={() => handleEquip(selectedItem.instanceId)}
            onDiscard={() => handleDiscard(selectedItem.instanceId)}
          />
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyDetailText}>アイテムを選択してください</Text>
          </View>
        )}
      </View>

      {/* カテゴリタブ */}
      <View style={styles.categoryTabs}>
        {SLOT_ORDER.map((slot) => (
          <Pressable
            key={slot}
            style={[
              styles.categoryTab,
              selectedSlot === slot && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedSlot(slot)}
          >
            <Image source={getSlotIcon(slot)} style={styles.categoryIcon} />
            <Text style={[
              styles.categoryLabel,
              selectedSlot === slot && styles.categoryLabelActive,
            ]}>
              {getSlotLabel(slot)}
            </Text>
            {slotCounts[slot] > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{slotCounts[slot]}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* アイテムグリッド */}
      <View style={styles.gridContainer}>
        {currentItems.length === 0 ? (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>
              {getSlotLabel(selectedSlot)}がありません
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {currentItems.map((item) => {
                const isSelected = selectedItem?.instanceId === item.instanceId;
                const stats = calculateItemStats(item);
                const hasMods = item.mods && item.mods.length > 0;

                return (
                  <Pressable
                    key={item.instanceId}
                    style={[
                      styles.gridItem,
                      isSelected && styles.gridItemSelected,
                    ]}
                    onPress={() => handleSelectItem(item)}
                  >
                    <Image
                      source={getItemIcon(item.id, item.slot)}
                      style={styles.gridItemIcon}
                    />
                    {hasMods && <View style={styles.modIndicator} />}
                    <Text style={styles.gridItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.gridItemStats}>
                      {stats.totalAtk > 0 && `A${stats.totalAtk}`}
                      {stats.totalAtk > 0 && stats.totalDef > 0 && ' '}
                      {stats.totalDef > 0 && `D${stats.totalDef}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        <Button title="戻る" onPress={handleBack} variant="secondary" />
      </View>
    </View>
  );
}

// アイテム詳細コンポーネント
function ItemDetail({
  item,
  onEquip,
  onDiscard,
}: {
  item: Item;
  onEquip: () => void;
  onDiscard: () => void;
}) {
  const stats = calculateItemStats(item);

  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <Image
          source={getItemIcon(item.id, item.slot)}
          style={styles.detailIcon}
        />
        <View style={styles.detailTitleArea}>
          <Text style={styles.detailName}>{item.name}</Text>
          <Text style={styles.detailSlot}>{getSlotLabel(item.slot)}</Text>
        </View>
      </View>

      <View style={styles.detailStats}>
        {stats.totalAtk > 0 && (
          <Text style={styles.detailStatText}>ATK +{stats.totalAtk}</Text>
        )}
        {stats.totalDef > 0 && (
          <Text style={styles.detailStatText}>DEF +{stats.totalDef}</Text>
        )}
      </View>

      {stats.allMods.length > 0 && (
        <View style={styles.detailMods}>
          {stats.allMods.map((mod, idx) => (
            <Text key={idx} style={styles.detailModText}>{mod.desc}</Text>
          ))}
        </View>
      )}

      <View style={styles.detailActions}>
        <Pressable style={styles.equipButton} onPress={onEquip}>
          <Text style={styles.equipButtonText}>装備</Text>
        </Pressable>
        <Pressable style={styles.discardButton} onPress={onDiscard}>
          <Text style={styles.discardButtonText}>捨てる</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  // ヘッダー
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerCount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  headerCountFull: {
    color: '#F44336',
  },
  // 詳細表示エリア
  detailArea: {
    minHeight: 180,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyDetail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDetailText: {
    fontSize: 14,
    color: '#666',
  },
  detailContent: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    width: 48,
    height: 48,
    marginRight: 12,
  },
  detailTitleArea: {
    flex: 1,
  },
  detailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailSlot: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  detailStatText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  detailMods: {
    marginBottom: 12,
  },
  detailModText: {
    fontSize: 13,
    color: '#FFD700',
    marginTop: 2,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
  },
  equipButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
  },
  equipButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  discardButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 8,
    alignItems: 'center',
  },
  discardButtonText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
  },
  // カテゴリタブ
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryIcon: {
    width: 28,
    height: 28,
  },
  categoryLabel: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  categoryLabelActive: {
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  // グリッド
  gridContainer: {
    flex: 1,
  },
  emptyGrid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGridText: {
    fontSize: 14,
    color: '#666',
  },
  gridContent: {
    padding: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: 72,
    height: 88,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  gridItemIcon: {
    width: 32,
    height: 32,
    marginBottom: 4,
  },
  modIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
  gridItemName: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'center',
  },
  gridItemStats: {
    fontSize: 9,
    color: '#4CAF50',
    marginTop: 2,
  },
  // フッター
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
