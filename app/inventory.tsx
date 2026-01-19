import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item } from '@/types';
import { getItemIcon, getSlotIcon } from '@/data/itemIcons';
import { INVENTORY_MAX_SIZE } from '@/core';
import { storageRepository } from '@/db/repositories/storageRepository';
import { getTierColor, getTierDisplayName } from '@/data/items';
import { ms, fs } from '@/utils/scaling';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

// アイテムのステータス計算
function calculateItemStats(
  item: Item,
  t: (key: string, options?: Record<string, unknown>) => string
) {
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
          desc = `[${tierLabel}] ${t('mods.everyTurnHpRegen', { value: mod.value })}`;
          break;
        case 'hp_regen_pct':
          desc = `[${tierLabel}] ${t('mods.everyTurnHpRegenPct', { value: mod.value })}`;
          break;
        case 'poison_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.poisonChance', { value: mod.value })}`;
          break;
        case 'critical_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.criticalChance', { value: mod.value })}`;
          break;
        case 'critical_damage':
          desc = `[${tierLabel}] ${t('modDescriptions.criticalDamage', { value: mod.value })}`;
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
  const { t } = useTranslation();
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

  const isUniqueItem = (item: Item) => item.mods?.some((mod) => mod.tier === 0);

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
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
            t={t}
          />
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyDetailText}>{t('inventory.selectItem')}</Text>
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
              {t(`slots.${slot}`)}
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
              {t('inventory.noItemsInSlot', { slot: t(`slots.${selectedSlot}`) })}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.gridContent}>
            <View style={styles.grid}>
              {currentItems.map((item) => {
                const isSelected = selectedItem?.instanceId === item.instanceId;
                const stats = calculateItemStats(item, t);
                const hasMods = item.mods && item.mods.length > 0;
                const isUnique = isUniqueItem(item);

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
                    {isUnique && (
                      <View style={styles.uniqueBadge}>
                        <Text style={styles.uniqueBadgeText}>UNIQUE</Text>
                      </View>
                    )}
                    {hasMods && (
                      <View style={styles.modIndicator}>
                        <Text style={styles.modIndicatorText}>{item.mods.length}</Text>
                      </View>
                    )}
                    <Text style={styles.gridItemName} numberOfLines={1}>
                      {t(`items.${item.id}.name`)}
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
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
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
  t,
}: {
  item: Item;
  equippedItem: Item | null;
  onEquip: () => void;
  onStorage: () => void;
  onSell: () => void;
  t: (key: string) => string;
}) {
  const stats = calculateItemStats(item, t);
  const equippedStats = equippedItem ? calculateItemStats(equippedItem, t) : null;

  return (
    <View style={styles.detailContent}>
      {/* 比較表示 */}
      <View style={styles.comparisonContainer}>
        {/* 選択中のアイテム */}
        <View style={styles.comparisonItem}>
          <Text style={styles.comparisonLabel}>{t('inventory.selected')}</Text>
          <View style={styles.comparisonHeader}>
            <Image
              source={getItemIcon(item.id, item.slot)}
              style={styles.comparisonIcon}
            />
            <View style={styles.comparisonInfo}>
              <Text style={styles.comparisonName} numberOfLines={1}>{t(`items.${item.id}.name`)}</Text>
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
          <Text style={styles.comparisonLabel}>{t('inventory.equipped')}</Text>
          {equippedItem && equippedStats ? (
            <>
              <View style={styles.comparisonHeader}>
                <Image
                  source={getItemIcon(equippedItem.id, equippedItem.slot)}
                  style={styles.comparisonIcon}
                />
                <View style={styles.comparisonInfo}>
                  <Text style={styles.comparisonName} numberOfLines={1}>{t(`items.${equippedItem.id}.name`)}</Text>
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
              <Text style={styles.emptyEquippedText}>{t('common.unequipped')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* アクションボタン（案4: メインボタン + アイコンボタン） */}
      <View style={styles.detailActions}>
        <Pressable style={styles.equipButton} onPress={onEquip}>
          <Text style={styles.equipButtonText}>{t('common.equip')}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onStorage}>
          <MaterialCommunityIcons name="warehouse" size={20} color="#4ECDC4" />
          <Text style={styles.iconButtonText}>{t('inventory.storage')}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onSell}>
          <MaterialCommunityIcons name="cash" size={20} color="#FFD700" />
          <Text style={styles.iconButtonText}>{t('common.sell')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  // ヘッダー
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(8),
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  headerCount: {
    fontSize: fs(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  headerCountFull: {
    color: '#F44336',
  },
  // 詳細表示エリア
  detailArea: {
    minHeight: ms(225),
    padding: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyDetail: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDetailText: {
    fontSize: fs(14),
    color: '#666',
  },
  detailContent: {
    flex: 1,
  },
  // 比較表示
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: ms(12),
  },
  comparisonItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(8),
    padding: ms(8),
  },
  comparisonLabel: {
    fontSize: fs(10),
    color: '#888',
    marginBottom: ms(6),
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonIcon: {
    width: ms(36),
    height: ms(36),
    marginRight: ms(8),
  },
  comparisonInfo: {
    flex: 1,
  },
  comparisonName: {
    fontSize: fs(12),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(2),
  },
  comparisonStats: {
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
  comparisonMods: {
    marginTop: ms(6),
    paddingTop: ms(6),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modText: {
    fontSize: fs(10),
    color: '#FFD700',
  },
  // 矢印と差分
  comparisonArrow: {
    width: ms(50),
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: ms(20),
  },
  arrowText: {
    fontSize: fs(18),
    color: '#666',
    marginBottom: ms(4),
  },
  diffContainer: {
    alignItems: 'center',
  },
  diffText: {
    fontSize: fs(11),
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
    paddingVertical: ms(16),
  },
  emptyEquippedText: {
    fontSize: fs(12),
    color: '#666',
    fontStyle: 'italic',
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: 'auto',
  },
  equipButton: {
    flex: 1,
    paddingVertical: ms(10),
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: ms(8),
    alignItems: 'center',
  },
  equipButtonText: {
    fontSize: fs(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  iconButton: {
    width: ms(50),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ms(8),
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: fs(9),
    color: '#aaa',
    marginTop: ms(2),
  },
  // カテゴリタブ
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: ms(8),
    paddingVertical: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: ms(8),
    borderRadius: ms(8),
    position: 'relative',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryIcon: {
    width: ms(28),
    height: ms(28),
  },
  categoryLabel: {
    fontSize: fs(10),
    color: '#888',
    marginTop: ms(2),
  },
  categoryLabelActive: {
    color: '#fff',
  },
  countBadge: {
    position: 'absolute',
    top: ms(2),
    right: ms(8),
    backgroundColor: '#4CAF50',
    borderRadius: ms(8),
    minWidth: ms(16),
    height: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(4),
  },
  countText: {
    fontSize: fs(10),
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
    fontSize: fs(14),
    color: '#666',
  },
  gridContent: {
    padding: ms(12),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(8),
  },
  gridItem: {
    width: ms(72),
    height: ms(88),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ms(8),
    padding: ms(6),
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
    width: ms(32),
    height: ms(32),
    marginBottom: ms(4),
  },
  uniqueBadge: {
    position: 'absolute',
    top: ms(2),
    left: ms(2),
    paddingHorizontal: ms(4),
    height: ms(14),
    borderRadius: ms(7),
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uniqueBadgeText: {
    fontSize: fs(8),
    fontWeight: 'bold',
    color: '#15191E',
  },
  modIndicator: {
    position: 'absolute',
    top: ms(2),
    right: ms(2),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(4),
  },
  modIndicatorText: {
    fontSize: fs(10),
    fontWeight: 'bold',
    color: '#15191E',
  },
  gridItemName: {
    fontSize: fs(10),
    color: '#fff',
    textAlign: 'center',
  },
  gridItemStats: {
    fontSize: fs(9),
    color: '#4CAF50',
    marginTop: ms(2),
  },
  // フッター
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
