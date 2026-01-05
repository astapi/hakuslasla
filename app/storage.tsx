import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { storageRepository } from '@/db';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getItemIcon, getSlotIcon, getSlotLabel } from '@/data/itemIcons';
import { Item, EquipmentSlot } from '@/types';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

// アイテムのステータス計算（インベントリと同じ）
function calculateItemStats(item: Item) {
  let totalAtk = item.atk;
  let totalDef = item.def;
  const otherMods: { type: string; value: number; desc: string }[] = [];

  if (item.mods) {
    for (const mod of item.mods) {
      let desc = '';
      switch (mod.type) {
        case 'atk_bonus':
          totalAtk += mod.value;
          break;
        case 'def_bonus':
          totalDef += mod.value;
          break;
        case 'hp_regen':
          desc = `HP回復+${mod.value}`;
          break;
        case 'poison_chance':
          desc = `毒+${mod.value}%`;
          break;
        case 'critical_chance':
          desc = `クリ+${mod.value}%`;
          break;
      }
      if (desc) {
        otherMods.push({ type: mod.type, value: mod.value, desc });
      }
    }
  }

  return { totalAtk, totalDef, otherMods };
}

export default function StorageScreen() {
  const router = useRouter();
  const { addToInventory, isInventoryFull } = usePlayerStore();
  const [storageItems, setStorageItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const fetchStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await storageRepository.getAll();
      setStorageItems(items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStorage();
    }, [fetchStorage])
  );

  // カテゴリごとにアイテムをグループ化
  const itemsBySlot = useMemo(() => {
    const grouped: Record<EquipmentSlot, Item[]> = {
      weapon: [],
      armor: [],
      gloves: [],
      boots: [],
      accessory: [],
    };
    for (const item of storageItems) {
      grouped[item.slot].push(item);
    }
    return grouped;
  }, [storageItems]);

  // 各カテゴリのアイテム数
  const slotCounts = useMemo(() => {
    const counts: Record<EquipmentSlot, number> = {
      weapon: 0,
      armor: 0,
      gloves: 0,
      boots: 0,
      accessory: 0,
    };
    for (const item of storageItems) {
      counts[item.slot]++;
    }
    return counts;
  }, [storageItems]);

  const handleBack = () => {
    router.back();
  };

  const handleWithdraw = async (item: Item) => {
    if (isInventoryFull()) {
      return;
    }
    const success = await storageRepository.removeItem(item.instanceId);
    if (success) {
      await addToInventory(item);
      await fetchStorage();
      setSelectedItem(null);
    }
  };

  const handleSell = async (instanceId: string) => {
    // TODO: お金の概念を追加したら売却金額を加算
    const success = await storageRepository.removeItem(instanceId);
    if (success) {
      await fetchStorage();
      setSelectedItem(null);
    }
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
  };

  const currentItems = itemsBySlot[selectedSlot];
  const inventoryFull = isInventoryFull();

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>倉庫</Text>
        <Text style={styles.headerCount}>{storageItems.length}個</Text>
      </View>

      {/* 詳細表示エリア */}
      <View style={styles.detailArea}>
        {selectedItem ? (
          <StorageItemDetail
            item={selectedItem}
            inventoryFull={inventoryFull}
            onWithdraw={() => handleWithdraw(selectedItem)}
            onSell={() => handleSell(selectedItem.instanceId)}
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
        {isLoading ? (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>読み込み中...</Text>
          </View>
        ) : currentItems.length === 0 ? (
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

// 倉庫アイテム詳細コンポーネント
function StorageItemDetail({
  item,
  inventoryFull,
  onWithdraw,
  onSell,
}: {
  item: Item;
  inventoryFull: boolean;
  onWithdraw: () => void;
  onSell: () => void;
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
          <Text style={styles.atkText}>ATK +{stats.totalAtk}</Text>
        )}
        {stats.totalDef > 0 && (
          <Text style={styles.defText}>DEF +{stats.totalDef}</Text>
        )}
      </View>

      {stats.otherMods.length > 0 && (
        <View style={styles.detailMods}>
          {stats.otherMods.map((mod, idx) => (
            <Text key={idx} style={styles.modText}>{mod.desc}</Text>
          ))}
        </View>
      )}

      {/* アクションボタン */}
      <View style={styles.detailActions}>
        <Pressable
          style={[styles.withdrawButton, inventoryFull && styles.buttonDisabled]}
          onPress={onWithdraw}
          disabled={inventoryFull}
        >
          <MaterialCommunityIcons
            name="bag-personal"
            size={18}
            color={inventoryFull ? '#666' : '#4CAF50'}
          />
          <Text style={[styles.withdrawButtonText, inventoryFull && styles.buttonTextDisabled]}>
            {inventoryFull ? 'インベントリ満杯' : 'インベントリへ'}
          </Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onSell}>
          <MaterialCommunityIcons name="cash" size={20} color="#FFD700" />
          <Text style={styles.iconButtonText}>売却</Text>
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
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  // 詳細表示エリア
  detailArea: {
    minHeight: 160,
    padding: 12,
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
  atkText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  defText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  detailMods: {
    marginBottom: 12,
  },
  modText: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 2,
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 8,
  },
  withdrawButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(100, 100, 100, 0.2)',
  },
  buttonTextDisabled: {
    color: '#666',
  },
  iconButton: {
    width: 50,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 9,
    color: '#aaa',
    marginTop: 2,
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
    backgroundColor: '#4ECDC4',
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
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
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
    color: '#4ECDC4',
    marginTop: 2,
  },
  // フッター
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
