import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, FlatList, ListRenderItemInfo, useWindowDimensions } from 'react-native';
import { useRouter , useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { EquipmentSlot, Item } from '@/types';
import { getItemIcon, getSlotIcon } from '@/data/itemIcons';
import { storageRepository } from '@/db/repositories/storageRepository';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { getTierColor, getTierDisplayName } from '@/data/items';
import { ms, fs } from '@/utils/scaling';
import { UBER_BOSS_BY_BASE } from '@/data/endContents';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { calculateFinalStats } from '@/core/battle';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];
type InventoryTab = 'equipment' | 'misc';

/**
 * 特定のスロットに特定のアイテムを装備した状態での
 * プレイヤーの総ステータスを計算
 */
function calculatePlayerStatsWithItem(
  playerBaseStats: { atk: number; def: number; maxHp: number },
  currentEquipment: Record<EquipmentSlot, Item | null>,
  unlockedSkills: string[],
  newItem: Item | null,
  targetSlot: EquipmentSlot
): { atk: number; def: number; maxHp: number } {
  // 1. 装備構成をシミュレート
  const simulatedEquipment = { ...currentEquipment };
  simulatedEquipment[targetSlot] = newItem;

  // 2. フラット値とincreased%を集計
  let baseAtk = playerBaseStats.atk;
  let baseDef = playerBaseStats.def;
  let baseMaxHp = playerBaseStats.maxHp;
  let equipAtkIncPct = 0;
  let equipDefIncPct = 0;
  let equipHpIncPct = 0;

  Object.values(simulatedEquipment).forEach((item) => {
    if (item) {
      baseAtk += item.atk;
      baseDef += item.def;

      if (item.mods) {
        for (const mod of item.mods) {
          if (mod.type === 'atk_bonus') baseAtk += mod.value;
          if (mod.type === 'def_bonus') baseDef += mod.value;
          if (mod.type === 'hp_bonus') baseMaxHp += mod.value;
          if (mod.type === 'atk_increased_pct') equipAtkIncPct += mod.value;
          if (mod.type === 'def_increased_pct') equipDefIncPct += mod.value;
          if (mod.type === 'hp_increased_pct') equipHpIncPct += mod.value;
        }
      }
    }
  });

  // 3. パッシブ効果を取得
  const passiveEffects = calculatePassiveEffects(unlockedSkills);

  // 4. PoE式で最終ステータスを計算
  const finalStats = calculateFinalStats(
    { maxHp: baseMaxHp, atk: baseAtk, def: baseDef },
    {
      hp_increased_pct: passiveEffects.hp_increased_pct + equipHpIncPct,
      atk_increased_pct: passiveEffects.atk_increased_pct + equipAtkIncPct,
      def_increased_pct: passiveEffects.def_increased_pct + equipDefIncPct,
      hp_more_pct: passiveEffects.hp_more_pct,
      atk_more_pct: passiveEffects.atk_more_pct,
      def_more_pct: passiveEffects.def_more_pct,
    }
  );

  return finalStats;
}

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
          desc = `[${tierLabel}] ${t('modDescriptions.attackSpeed', { value: mod.value })}`;
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
      }
      if (desc) {
        allMods.push({ type: mod.type, value: mod.value, tier, desc, color });
      }
    }
  }

  return { totalAtk, totalDef, allMods };
}

// グリッド設定
const GRID_COLUMNS = 5;
const GRID_PADDING = ms(12);
const GRID_GAP = ms(6);

export default function InventoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // アイテムサイズを画面幅から計算
  const itemWidth = useMemo(() => {
    const totalGap = GRID_GAP * (GRID_COLUMNS - 1);
    const totalPadding = GRID_PADDING * 2;
    return (screenWidth - totalPadding - totalGap) / GRID_COLUMNS;
  }, [screenWidth]);

  // Zustand Selector パターン: 必要なフィールドのみ購読
  const inventory = usePlayerStore((state) => state.inventory);
  const equipment = usePlayerStore((state) => state.equipment);
  const equipItem = usePlayerStore((state) => state.equipItem);
  const unequipItem = usePlayerStore((state) => state.unequipItem);
  const removeFromInventory = usePlayerStore((state) => state.removeFromInventory);
  const isInventoryFull = usePlayerStore((state) => state.isInventoryFull);
  const getInventoryMaxSize = usePlayerStore((state) => state.getInventoryMaxSize);
  const playerAtk = usePlayerStore((state) => state.atk);
  const playerDef = usePlayerStore((state) => state.def);
  const playerMaxHp = usePlayerStore((state) => state.maxHp);
  const unlockedSkills = usePlayerStore((state) => state.unlockedSkills);

  const [activeTab, setActiveTab] = useState<InventoryTab>('equipment');
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('weapon');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [uberTickets, setUberTickets] = useState<Record<string, number>>({});
  const [respecTokens, setRespecTokens] = useState(0);

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

  useFocusEffect(
    useCallback(() => {
      const loadMisc = async () => {
        const tickets = await settingsRepository.getUberTickets();
        const tokens = await settingsRepository.getRespecTokens();
        setUberTickets(tickets);
        setRespecTokens(tokens);
      };
      void loadMisc();
    }, [])
  );

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
    const result = await storageRepository.addItem(item);
    if (!result.success && result.reason === 'full') {
      alert(t('storage.storageFull'));
      return;
    }
    await removeFromInventory(item.instanceId);
    setSelectedItem(nextItem);
  };

  const handleUnequip = async (slot: EquipmentSlot) => {
    // インベントリが満杯の場合は外せない
    if (isInventoryFull()) {
      alert(t('storage.inventoryFull'));
      return;
    }

    await unequipItem(slot);
    // 装備を外した後、選択を解除
    setSelectedItem(null);
  };

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  const currentItems = itemsBySlot[selectedSlot];
  const inventoryMaxSize = getInventoryMaxSize();
  const isFull = inventory.length >= inventoryMaxSize;

  const isUniqueItem = (item: Item) => item.mods?.some((mod) => mod.tier === 0);

  // グリッドアイテムのレンダリング関数
  const renderGridItem = useCallback(({ item }: ListRenderItemInfo<Item>) => {
    const isSelected = selectedItem?.instanceId === item.instanceId;
    const stats = calculateItemStats(item, t);
    const hasMods = item.mods && item.mods.length > 0;
    const isUnique = isUniqueItem(item);

    return (
      <Pressable
        style={[
          styles.gridItem,
          { width: itemWidth, height: itemWidth * 1.2 },
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
            <Text style={styles.uniqueBadgeText}>U</Text>
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
  }, [selectedItem?.instanceId, t, handleSelectItem, itemWidth]);

  const keyExtractorGrid = useCallback((item: Item) => item.instanceId, []);

  const ticketEntries = useMemo(() => {
    return Object.entries(UBER_BOSS_BY_BASE)
      .map(([baseBossId, uberDungeonId]) => ({
        baseBossId,
        uberDungeonId,
        count: uberTickets[baseBossId] ?? 0,
      }))
      .filter((entry) => entry.count > 0);
  }, [uberTickets]);

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('inventory.title')}</Text>
        <Text style={[styles.headerCount, isFull && styles.headerCountFull]}>
          {inventory.length}/{inventoryMaxSize}
        </Text>
      </View>

      {/* タブ */}
      <View style={styles.inventoryTabs}>
        <Pressable
          style={[styles.inventoryTab, activeTab === 'equipment' && styles.inventoryTabActive]}
          onPress={() => setActiveTab('equipment')}
        >
          <MaterialCommunityIcons name="sword-cross" size={16} color={activeTab === 'equipment' ? '#fff' : '#888'} />
          <Text style={[styles.inventoryTabLabel, activeTab === 'equipment' && styles.inventoryTabLabelActive]}>
            {t('inventory.tabs.equipment')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.inventoryTab, activeTab === 'misc' && styles.inventoryTabActive]}
          onPress={() => setActiveTab('misc')}
        >
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={16} color={activeTab === 'misc' ? '#fff' : '#888'} />
          <Text style={[styles.inventoryTabLabel, activeTab === 'misc' && styles.inventoryTabLabelActive]}>
            {t('inventory.tabs.misc')}
          </Text>
        </Pressable>
      </View>

      {activeTab === 'equipment' && (
        <>
          {/* 詳細表示エリア */}
          <View style={styles.detailArea}>
            {selectedItem ? (
              <ItemDetail
                item={selectedItem}
                equippedItem={equippedItem}
                onEquip={() => handleEquip(selectedItem.instanceId)}
                onUnequip={() => handleUnequip(selectedItem.slot)}
                onStorage={() => handleStorage(selectedItem)}
                onSell={() => handleSell(selectedItem.instanceId)}
                t={t}
                playerAtk={playerAtk}
                playerDef={playerDef}
                playerMaxHp={playerMaxHp}
                equipment={equipment}
                unlockedSkills={unlockedSkills}
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
              <FlatList
                data={currentItems}
                renderItem={renderGridItem}
                keyExtractor={keyExtractorGrid}
                numColumns={5}
                contentContainerStyle={styles.gridContent}
                columnWrapperStyle={styles.gridRow}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                windowSize={5}
                removeClippedSubviews={true}
              />
            )}
          </View>
        </>
      )}

      {activeTab === 'misc' && (
        <View style={styles.miscContainer}>
          <Text style={styles.miscTitle}>{t('inventory.tickets.title')}</Text>
          {ticketEntries.length === 0 ? (
            <View style={styles.miscEmpty}>
              <Text style={styles.miscEmptyText}>{t('inventory.tickets.empty')}</Text>
            </View>
          ) : (
            <View style={styles.ticketList}>
              {ticketEntries.map((entry) => (
                <View key={entry.baseBossId} style={styles.ticketRow}>
                  <Text style={styles.ticketName}>
                    {t('inventory.tickets.item', { name: t(`dungeons.${entry.uberDungeonId}.name`) })}
                  </Text>
                  <View style={styles.ticketCountBadge}>
                    <Text style={styles.ticketCountText}>{entry.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.miscTitle, styles.miscSectionSpacing]}>
            {t('inventory.respec.title')}
          </Text>
          {respecTokens <= 0 ? (
            <View style={styles.miscEmpty}>
              <Text style={styles.miscEmptyText}>{t('inventory.respec.empty')}</Text>
            </View>
          ) : (
            <View style={styles.ticketList}>
              <View style={styles.ticketRow}>
                <Text style={styles.ticketName}>{t('inventory.respec.item')}</Text>
                <View style={styles.ticketCountBadge}>
                  <Text style={styles.ticketCountText}>{respecTokens}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* フッター */}
      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

// 差分表示用コンポーネント
const StatDiff = memo(({ label, newValue, oldValue }: { label: string; newValue: number; oldValue: number }) => {
  const diff = newValue - oldValue;
  if (diff === 0) return null;

  const isPositive = diff > 0;
  return (
    <Text style={[styles.diffText, isPositive ? styles.diffPositive : styles.diffNegative]}>
      {label} {isPositive ? '+' : ''}{diff}
    </Text>
  );
});

StatDiff.displayName = 'StatDiff';

// アイテム詳細コンポーネント
const ItemDetail = memo(({
  item,
  equippedItem,
  onEquip,
  onUnequip,
  onStorage,
  onSell,
  t,
  playerAtk,
  playerDef,
  playerMaxHp,
  equipment,
  unlockedSkills,
}: {
  item: Item;
  equippedItem: Item | null;
  onEquip: () => void;
  onUnequip: () => void;
  onStorage: () => void;
  onSell: () => void;
  t: (key: string) => string;
  playerAtk: number;
  playerDef: number;
  playerMaxHp: number;
  equipment: Record<EquipmentSlot, Item | null>;
  unlockedSkills: string[];
}) => {
  const stats = calculateItemStats(item, t);
  const equippedStats = equippedItem ? calculateItemStats(equippedItem, t) : null;

  // 新しいアイテムを装備した場合のプレイヤーステータス
  const newItemPlayerStats = useMemo(() =>
    calculatePlayerStatsWithItem(
      { atk: playerAtk, def: playerDef, maxHp: playerMaxHp },
      equipment,
      unlockedSkills,
      item,
      item.slot
    ),
    [playerAtk, playerDef, playerMaxHp, equipment, unlockedSkills, item]
  );

  // 現在のプレイヤーステータス
  const currentPlayerStats = useMemo(() =>
    calculatePlayerStatsWithItem(
      { atk: playerAtk, def: playerDef, maxHp: playerMaxHp },
      equipment,
      unlockedSkills,
      equipment[item.slot],
      item.slot
    ),
    [playerAtk, playerDef, playerMaxHp, equipment, unlockedSkills, item.slot]
  );

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
            <StatDiff label="ATK" newValue={newItemPlayerStats.atk} oldValue={currentPlayerStats.atk} />
            <StatDiff label="DEF" newValue={newItemPlayerStats.def} oldValue={currentPlayerStats.def} />
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

      {/* アクションボタン */}
      <View style={styles.detailActions}>
        <Pressable style={styles.equipButton} onPress={onEquip}>
          <Text style={styles.equipButtonText}>{t('common.equip')}</Text>
        </Pressable>
        {equippedItem && (
          <Pressable style={styles.unequipActionButton} onPress={onUnequip}>
            <MaterialCommunityIcons name="close-circle-outline" size={20} color="#F44336" />
            <Text style={styles.unequipActionButtonText}>{t('common.unequip')}</Text>
          </Pressable>
        )}
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
});

ItemDetail.displayName = 'ItemDetail';

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
  inventoryTabs: {
    flexDirection: 'row',
    gap: ms(8),
    paddingHorizontal: ms(16),
    paddingBottom: ms(8),
  },
  inventoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(6),
    paddingVertical: ms(10),
    borderRadius: ms(10),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  inventoryTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inventoryTabLabel: {
    fontSize: fs(12),
    color: '#888',
    fontWeight: 'bold',
  },
  inventoryTabLabelActive: {
    color: '#fff',
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
    width: ms(70),
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingTop: ms(32),
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
  unequipActionButton: {
    width: ms(50),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: ms(8),
    alignItems: 'center',
  },
  unequipActionButtonText: {
    fontSize: fs(9),
    color: '#F44336',
    marginTop: ms(2),
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
  miscContainer: {
    flex: 1,
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
  },
  miscTitle: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(12),
  },
  miscSectionSpacing: {
    marginTop: ms(16),
  },
  miscEmpty: {
    padding: ms(16),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(10),
  },
  miscEmptyText: {
    fontSize: fs(12),
    color: '#888',
    textAlign: 'center',
  },
  ticketList: {
    gap: ms(10),
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: ms(12),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  ticketName: {
    fontSize: fs(12),
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
    marginRight: ms(8),
  },
  ticketCountBadge: {
    minWidth: ms(28),
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: ms(12),
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.6)',
    alignItems: 'center',
  },
  ticketCountText: {
    fontSize: fs(12),
    color: '#fff',
    fontWeight: 'bold',
  },
  gridContent: {
    padding: ms(12),
  },
  gridRow: {
    gap: ms(6),
    marginBottom: ms(6),
  },
  gridItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ms(6),
    padding: ms(4),
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
    width: ms(28),
    height: ms(28),
    marginBottom: ms(2),
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
