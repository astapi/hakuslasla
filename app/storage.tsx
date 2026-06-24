import { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, ListRenderItemInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { storageRepository } from '@/db';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getItemIcon, getSlotIcon } from '@/data/itemIcons';
import { Item, EquipmentSlot } from '@/types';
import { getModDescription, getTierColor, getTierDisplayName } from '@/data/items';
import { ms, fs } from '@/utils/scaling';
const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

// アイテムのステータス計算（インベントリと同じ）
function calculateItemStats(
  item: Item,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  let totalAtk = item.atk;
  let totalDef = item.def;
  let totalEvasion = item.evasion ?? 0;
  const otherMods: { type: string; value: number; tier: number; desc: string; color: string }[] = [];

  if (item.mods) {
    for (const mod of item.mods) {
      let desc = '';
      const tier = mod.tier ?? 10;
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
        case 'evasion':
          totalEvasion += mod.value;
          desc = `[${tierLabel}] ${t('modDescriptions.evasion', { value: mod.value })}`;
          break;
        case 'evasion_increased_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.evasionIncreased', { value: mod.value })}`;
          break;
        case 'evasion_more_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.evasionMore', { value: mod.value })}`;
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
        case 'ignite_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.igniteChance', { value: mod.value })}`;
          break;
        case 'ignite_duration_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.igniteDuration', { value: mod.value })}`;
          break;
        case 'ignite_tick_speed_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.igniteTickSpeed', { value: mod.value })}`;
          break;
        case 'ignite_damage_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.igniteDamage', { value: mod.value })}`;
          break;
        case 'critical_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.criticalChance', { value: mod.value })}`;
          break;
        case 'critical_damage':
          desc = `[${tierLabel}] ${t('modDescriptions.criticalDamage', { value: mod.value })}`;
          break;
        case 'damage_defer_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.damageDefer', { value: mod.value })}`;
          break;
        case 'damage_reduction_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.damageReduction', { value: mod.value })}`;
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
        case 'attack_speed_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.attackSpeed', { value: `${mod.value >= 0 ? '+' : ''}${mod.value}` })}`;
          break;
        case 'hp_on_hit':
          desc = `[${tierLabel}] ${t('modDescriptions.hpOnHit', { value: mod.value })}`;
          break;
        case 'lifesteal':
          desc = `[${tierLabel}] ${t('modDescriptions.lifesteal', { value: mod.value })}`;
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
        case 'attack_speed_more_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.attackSpeedMore', { value: `${mod.value >= 0 ? '+' : ''}${mod.value}` })}`;
          break;
        case 'time_atk_inc_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.timeAtkInc', { value: mod.value })}`;
          break;
        case 'time_def_inc_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.timeDefInc', { value: mod.value })}`;
          break;
        case 'time_hp_regen':
          desc = `[${tierLabel}] ${t('modDescriptions.timeHpRegen', { value: mod.value })}`;
          break;
        case 'warlord_enrage':
          desc = `[${tierLabel}] ${t('modDescriptions.warlordEnrage')}`;
          break;
        case 'chill_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.chillChance', { value: mod.value })}`;
          break;
        case 'chill_effect_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.chillEffect', { value: mod.value })}`;
          break;
        case 'chill_duration_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.chillDuration', { value: mod.value })}`;
          break;
        case 'freeze_chance':
          desc = `[${tierLabel}] ${t('modDescriptions.freezeChance', { value: mod.value })}`;
          break;
        case 'freeze_duration_pct':
          desc = `[${tierLabel}] ${t('modDescriptions.freezeDuration', { value: mod.value })}`;
          break;
      }
      if (!desc) {
        const fallbackDesc = getModDescription(mod, t);
        if (fallbackDesc) {
          desc = `[${tierLabel}] ${fallbackDesc}`;
        }
      }
      if (desc) {
        otherMods.push({ type: mod.type, value: mod.value, tier, desc, color });
      }
    }
  }

  return { totalAtk, totalDef, totalEvasion, otherMods };
}

export default function StorageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addToInventory, isInventoryFull, season } = usePlayerStore();
  const [storageItems, setStorageItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const storageMaxSize = storageRepository.getMaxSize();

  const fetchStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await storageRepository.getAll(season);
      setStorageItems(items);
    } finally {
      setIsLoading(false);
    }
  }, [season]);

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
    const success = await storageRepository.removeItem(item.instanceId, season);
    if (success) {
      await addToInventory(item);
      await fetchStorage();
      setSelectedItem(null);
    }
  };

  const handleSell = async (instanceId: string) => {
    // TODO: お金の概念を追加したら売却金額を加算
    const success = await storageRepository.removeItem(instanceId, season);
    if (success) {
      await fetchStorage();
      setSelectedItem(null);
    }
  };

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  const currentItems = itemsBySlot[selectedSlot];
  const inventoryFull = isInventoryFull();

  // グリッドアイテムのレンダリング関数
  const renderGridItem = useCallback(({ item }: ListRenderItemInfo<Item>) => {
    const isSelected = selectedItem?.instanceId === item.instanceId;
    const stats = calculateItemStats(item, t);
    const hasMods = item.mods && item.mods.length > 0;

    return (
      <Pressable
        style={[
          styles.gridItem,
          isSelected && styles.gridItemSelected,
        ]}
        onPress={() => handleSelectItem(item)}
      >
        <Image
          source={getItemIcon(item.id, item.slot, item.weaponType)}
          style={styles.gridItemIcon}
        />
        {hasMods && <View style={styles.modIndicator} />}
        <Text style={styles.gridItemName} numberOfLines={1}>
          {t(`items.${item.id}.name`)}
        </Text>
        <Text style={styles.gridItemStats}>
          {stats.totalAtk > 0 && `A${stats.totalAtk}`}
          {stats.totalAtk > 0 && (stats.totalDef > 0 || stats.totalEvasion > 0) && ' '}
          {stats.totalDef > 0 && `D${stats.totalDef}`}
          {stats.totalDef > 0 && stats.totalEvasion > 0 && ' '}
          {stats.totalEvasion > 0 && `E${stats.totalEvasion}`}
        </Text>
      </Pressable>
    );
  }, [selectedItem?.instanceId, t, handleSelectItem]);

  const keyExtractorGrid = useCallback((item: Item) => item.instanceId, []);

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('storage.title')}</Text>
        <Text style={styles.headerCount}>{storageItems.length}/{storageMaxSize}</Text>
      </View>

      {/* 詳細表示エリア */}
      <View style={styles.detailArea}>
        {selectedItem ? (
          <StorageItemDetail
            item={selectedItem}
            inventoryFull={inventoryFull}
            onWithdraw={() => handleWithdraw(selectedItem)}
            onSell={() => handleSell(selectedItem.instanceId)}
            t={t}
          />
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyDetailText}>{t('storage.selectItem')}</Text>
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
        {isLoading ? (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>{t('common.loading')}</Text>
          </View>
        ) : currentItems.length === 0 ? (
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyGridText}>
              {t('storage.noItemsInSlot', { slot: t(`slots.${selectedSlot}`) })}
            </Text>
          </View>
        ) : (
          <FlatList
            data={currentItems}
            renderItem={renderGridItem}
            keyExtractor={keyExtractorGrid}
            numColumns={4}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridRow}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
          />
        )}
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

// 倉庫アイテム詳細コンポーネント
const StorageItemDetail = memo(({
  item,
  inventoryFull,
  onWithdraw,
  onSell,
  t,
}: {
  item: Item;
  inventoryFull: boolean;
  onWithdraw: () => void;
  onSell: () => void;
  t: (key: string) => string;
}) => {
  const stats = calculateItemStats(item, t);

  return (
    <View style={styles.detailContent}>
      <View style={styles.detailHeader}>
        <Image
          source={getItemIcon(item.id, item.slot, item.weaponType)}
          style={styles.detailIcon}
        />
        <View style={styles.detailTitleArea}>
          <Text style={styles.detailName}>{t(`items.${item.id}.name`)}</Text>
          <Text style={styles.detailSlot}>{t(`slots.${item.slot}`)}</Text>
        </View>
      </View>

      <View style={styles.detailStats}>
        {stats.totalAtk > 0 && (
          <Text style={styles.atkText}>ATK +{stats.totalAtk}</Text>
        )}
        {stats.totalDef > 0 && (
          <Text style={styles.defText}>DEF +{stats.totalDef}</Text>
        )}
        {stats.totalEvasion > 0 && (
          <Text style={styles.evasionText}>EVA +{stats.totalEvasion}</Text>
        )}
      </View>

      {stats.otherMods.length > 0 && (
        <View style={styles.detailMods}>
          {stats.otherMods.map((mod, idx) => (
            <Text key={idx} style={[styles.modText, { color: mod.color }]}>{mod.desc}</Text>
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
            {inventoryFull ? t('storage.inventoryFull') : t('storage.toInventory')}
          </Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onSell}>
          <MaterialCommunityIcons name="cash" size={20} color="#FFD700" />
          <Text style={styles.iconButtonText}>{t('common.sell')}</Text>
        </Pressable>
      </View>
    </View>
  );
});

StorageItemDetail.displayName = 'StorageItemDetail';

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
    color: '#4ECDC4',
    fontWeight: 'bold',
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
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(12),
  },
  detailIcon: {
    width: ms(48),
    height: ms(48),
    marginRight: ms(12),
  },
  detailTitleArea: {
    flex: 1,
  },
  detailName: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  detailSlot: {
    fontSize: fs(12),
    color: '#aaa',
    marginTop: ms(2),
  },
  detailStats: {
    flexDirection: 'row',
    gap: ms(16),
    marginBottom: ms(8),
  },
  atkText: {
    fontSize: fs(14),
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  defText: {
    fontSize: fs(14),
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  evasionText: {
    fontSize: fs(14),
    color: '#80CBC4',
    fontWeight: 'bold',
  },
  detailMods: {
    marginBottom: ms(12),
  },
  modText: {
    fontSize: fs(12),
    color: '#FFD700',
    marginTop: ms(2),
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginTop: 'auto',
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(6),
    paddingVertical: ms(10),
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: ms(8),
  },
  withdrawButtonText: {
    fontSize: fs(14),
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
    backgroundColor: '#4ECDC4',
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
  gridRow: {
    justifyContent: 'flex-start',
    gap: ms(8),
    marginBottom: ms(8),
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
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  gridItemIcon: {
    width: ms(32),
    height: ms(32),
    marginBottom: ms(4),
  },
  modIndicator: {
    position: 'absolute',
    top: ms(4),
    right: ms(4),
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#FFD700',
  },
  gridItemName: {
    fontSize: fs(10),
    color: '#fff',
    textAlign: 'center',
  },
  gridItemStats: {
    fontSize: fs(9),
    color: '#4ECDC4',
    marginTop: ms(2),
  },
  // フッター
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
