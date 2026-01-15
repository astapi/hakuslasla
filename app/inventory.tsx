import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item } from '@/types';
import { getItemIcon, getSlotIcon, getSlotLabel } from '@/data/itemIcons';
import { INVENTORY_MAX_SIZE } from '@/core';
import { storageRepository } from '@/db/repositories/storageRepository';
import { getTierColor, getTierDisplayName } from '@/data/items';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

// アイテムのステータス計算
function calculateItemStats(item: Item) {
  let totalAtk = item.atk;
  let totalDef = item.def;
  const allMods: { type: string; value: number; tier: number; desc: string; color: string }[] = [];

  if (item.mods) {
    for (const mod of item.mods) {
      let desc = '';
      const tier = mod.tier ?? 10;  // 既存アイテムはデフォルトtier 10
      const tierLabel = getTierDisplayName(tier);
      const color = getTierColor(tier);

      switch (mod.type) {
        case 'atk_bonus':
          totalAtk += mod.value;
          desc = `[${tierLabel}] ATK+${mod.value}`;
          break;
        case 'def_bonus':
          totalDef += mod.value;
          desc = `[${tierLabel}] DEF+${mod.value}`;
          break;
        case 'hp_bonus':
          desc = `[${tierLabel}] HP+${mod.value}`;
          break;
        case 'hp_regen':
          desc = `[${tierLabel}] 毎ターンHP${mod.value}回復`;
          break;
        case 'hp_regen_pct':
          desc = `[${tierLabel}] 毎ターンHP${mod.value}%回復`;
          break;
        case 'poison_chance':
          desc = `[${tierLabel}] 毒付与+${mod.value}%`;
          break;
        case 'critical_chance':
          desc = `[${tierLabel}] クリティカル+${mod.value}%`;
          break;
        case 'critical_damage':
          desc = `[${tierLabel}] クリダメ+${mod.value}%`;
          break;
        case 'atk_increased_pct':
          desc = `[${tierLabel}] ATK+${mod.value}%`;
          break;
        case 'def_increased_pct':
          desc = `[${tierLabel}] DEF+${mod.value}%`;
          break;
        case 'hp_increased_pct':
          desc = `[${tierLabel}] HP+${mod.value}%`;
          break;
        case 'atk_more_pct':
          desc = `[${tierLabel}] ATK ${mod.value}% more`;
          break;
        case 'def_more_pct':
          desc = `[${tierLabel}] DEF ${mod.value}% more`;
          break;
        case 'hp_more_pct':
          desc = `[${tierLabel}] HP ${mod.value}% more`;
          break;
      }
      if (desc) {
        allMods.push({ type: mod.type, value: mod.value, tier, desc, color });
      }
    }
  }

  return { totalAtk, totalDef, allMods };
}

export default function InventoryScreen() {
  const router = useRouter();
  const { inventory, equipment, equipItem, removeFromInventory } = usePlayerStore();
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // 選択中アイテムのスロットに対応する装備中アイテム
  const equippedItem = selectedItem ? equipment[selectedItem.slot] : null;

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

  // 削除後に次のアイテムを選択するための共通関数
  const getNextItemAfterRemoval = (instanceId: string): Item | null => {
    const items = itemsBySlot[selectedSlot];
    const currentIndex = items.findIndex(item => item.instanceId === instanceId);

    if (items.length <= 1) {
      return null;
    }

    // 最後のアイテムでなければ次のアイテム、最後なら前のアイテム
    if (currentIndex < items.length - 1) {
      return items[currentIndex + 1];
    }
    return items[currentIndex - 1];
  };

  const handleEquip = async (instanceId: string) => {
    await equipItem(instanceId);
    setSelectedItem(null);
  };

  const handleSell = async (instanceId: string) => {
    const nextItem = getNextItemAfterRemoval(instanceId);
    // TODO: お金の概念を追加したら売却金額を加算
    await removeFromInventory(instanceId);
    setSelectedItem(nextItem);
  };

  const handleStorage = async (item: Item) => {
    const nextItem = getNextItemAfterRemoval(item.instanceId);
    // 倉庫に送る（MOD保持）
    await storageRepository.addItem(item);
    await removeFromInventory(item.instanceId);
    setSelectedItem(nextItem);
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
            equippedItem={equippedItem}
            onEquip={() => handleEquip(selectedItem.instanceId)}
            onStorage={() => handleStorage(selectedItem)}
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
                    {hasMods && (
                      <View style={styles.modIndicator}>
                        <Text style={styles.modIndicatorText}>{item.mods.length}</Text>
                      </View>
                    )}
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

// 差分表示用コンポーネント
function StatDiff({ label, newValue, oldValue }: { label: string; newValue: number; oldValue: number }) {
  const diff = newValue - oldValue;
  if (diff === 0) return null;

  const isPositive = diff > 0;
  return (
    <Text style={[styles.diffText, isPositive ? styles.diffPositive : styles.diffNegative]}>
      {label} {isPositive ? '+' : ''}{diff}
    </Text>
  );
}

// アイテム詳細コンポーネント
function ItemDetail({
  item,
  equippedItem,
  onEquip,
  onStorage,
  onSell,
}: {
  item: Item;
  equippedItem: Item | null;
  onEquip: () => void;
  onStorage: () => void;
  onSell: () => void;
}) {
  const stats = calculateItemStats(item);
  const equippedStats = equippedItem ? calculateItemStats(equippedItem) : null;

  return (
    <View style={styles.detailContent}>
      {/* 比較表示 */}
      <View style={styles.comparisonContainer}>
        {/* 選択中のアイテム */}
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>選択中</Text>
          <View style={styles.comparisonHeader}>
            <Image
              source={getItemIcon(item.id, item.slot)}
              style={styles.comparisonIcon}
            />
            <View style={styles.comparisonInfo}>
              <Text style={styles.comparisonName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.comparisonStats}>
                {stats.totalAtk > 0 && (
                  <Text style={styles.atkText}>ATK {stats.totalAtk}</Text>
                )}
                {stats.totalDef > 0 && (
                  <Text style={styles.defText}>DEF {stats.totalDef}</Text>
                )}
              </View>
            </View>
          </View>
          {stats.allMods.length > 0 && (
            <View style={styles.comparisonMods}>
              {stats.allMods.map((mod, idx) => (
                <Text key={idx} style={[styles.modText, { color: mod.color }]} numberOfLines={1}>{mod.desc}</Text>
              ))}
            </View>
          )}
        </View>

        {/* 矢印と差分 */}
        <View style={styles.comparisonArrow}>
          <Text style={styles.arrowText}>→</Text>
          <View style={styles.diffContainer}>
            <StatDiff label="ATK" newValue={stats.totalAtk} oldValue={equippedStats?.totalAtk ?? 0} />
            <StatDiff label="DEF" newValue={stats.totalDef} oldValue={equippedStats?.totalDef ?? 0} />
          </View>
        </View>

        {/* 装備中のアイテム */}
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>装備中</Text>
          {equippedItem && equippedStats ? (
            <>
              <View style={styles.comparisonHeader}>
                <Image
                  source={getItemIcon(equippedItem.id, equippedItem.slot)}
                  style={styles.comparisonIcon}
                />
                <View style={styles.comparisonInfo}>
                  <Text style={styles.comparisonName} numberOfLines={1}>{equippedItem.name}</Text>
                  <View style={styles.comparisonStats}>
                    {equippedStats.totalAtk > 0 && (
                      <Text style={styles.atkText}>ATK {equippedStats.totalAtk}</Text>
                    )}
                    {equippedStats.totalDef > 0 && (
                      <Text style={styles.defText}>DEF {equippedStats.totalDef}</Text>
                    )}
                  </View>
                </View>
              </View>
              {equippedStats.allMods.length > 0 && (
                <View style={styles.comparisonMods}>
                  {equippedStats.allMods.map((mod, idx) => (
                    <Text key={idx} style={[styles.modText, { color: mod.color }]} numberOfLines={1}>{mod.desc}</Text>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyEquipped}>
              <Text style={styles.emptyEquippedText}>未装備</Text>
            </View>
          )}
        </View>
      </View>

      {/* アクションボタン（案4: メインボタン + アイコンボタン） */}
      <View style={styles.detailActions}>
        <Pressable style={styles.equipButton} onPress={onEquip}>
          <Text style={styles.equipButtonText}>装備</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onStorage}>
          <MaterialCommunityIcons name="warehouse" size={20} color="#4ECDC4" />
          <Text style={styles.iconButtonText}>倉庫</Text>
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
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  headerCountFull: {
    color: '#F44336',
  },
  // 詳細表示エリア
  detailArea: {
    minHeight: 225,
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
  // 比較表示
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  comparisonItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
  },
  comparisonLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 6,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonIcon: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  comparisonInfo: {
    flex: 1,
  },
  comparisonName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  comparisonStats: {
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
  comparisonMods: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modText: {
    fontSize: 10,
    color: '#FFD700',
  },
  // 矢印と差分
  comparisonArrow: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
  },
  arrowText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 4,
  },
  diffContainer: {
    alignItems: 'center',
  },
  diffText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  diffPositive: {
    color: '#4CAF50',
  },
  diffNegative: {
    color: '#F44336',
  },
  // 未装備表示
  emptyEquipped: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyEquippedText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  modIndicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a1a2e',
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
