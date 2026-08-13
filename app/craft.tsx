import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import {
  ENGRAVE_DEFS,
  canEngraveOnSlot,
  getEngraveDef,
  type EngraveDef,
} from '@/data/engraveMods';
import {
  applyEngrave,
  hasEngravedMod,
  isUniqueItem,
  previewEngrave,
} from '@/core/engrave';
import { getModDescription, getModTierColor, getTierDisplayName } from '@/data/items';
import { getItemIcon } from '@/data/itemIcons';
import type { EquipmentSlot, Item, ItemMod } from '@/types';

const ALL_SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];
const SLOT_LABEL_KEY: Record<EquipmentSlot, string> = {
  weapon: 'slots.weapon',
  armor: 'slots.armor',
  gloves: 'slots.gloves',
  boots: 'slots.boots',
  accessory: 'slots.accessory',
};

const colors = {
  bg: '#15191E',
  panel: '#1E2530',
  panelSel: '#2A3446',
  border: '#333A47',
  text: '#FFFFFF',
  textMuted: '#9AA4B2',
  accent: '#FF7043', // 刻印カラー
  gold: '#FFD700',
  success: '#4CAF50',
  danger: '#F44336',
};

export default function CraftScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const inventory = usePlayerStore((s) => s.inventory);
  const equipment = usePlayerStore((s) => s.equipment);
  const updateItemInstance = usePlayerStore((s) => s.updateItemInstance);

  const [stones, setStones] = useState<Record<string, number>>({});
  const [selectedEngraveId, setSelectedEngraveId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all');

  const refreshStones = useCallback(async () => {
    setStones(await settingsRepository.getEngraveStones());
  }, []);

  useEffect(() => {
    refreshStones();
  }, [refreshStones]);

  // 所持している刻印
  const ownedEngraves = useMemo(
    () => ENGRAVE_DEFS.filter((d) => (stones[d.id] ?? 0) > 0),
    [stones]
  );

  const selectedEngrave: EngraveDef | undefined = selectedEngraveId
    ? getEngraveDef(selectedEngraveId)
    : undefined;

  // クラフト対象になり得る装備（レア/通常のみ・装備中＋インベントリ）
  const craftableItems = useMemo(() => {
    const equipped = Object.values(equipment).filter(Boolean) as Item[];
    const all = [...equipped, ...inventory];
    return all.filter((it) => !isUniqueItem(it));
  }, [equipment, inventory]);

  // 選択中の刻印を彫れる装備だけ
  const eligibleItems = useMemo(() => {
    if (!selectedEngrave) return craftableItems;
    return craftableItems.filter((it) =>
      canEngraveOnSlot(selectedEngrave, it.slot, it.weaponType)
    );
  }, [craftableItems, selectedEngrave]);

  // この刻印を彫れるスロットのうち、実際に該当装備があるスロット
  const slotsWithItems = useMemo(() => {
    const set = new Set(eligibleItems.map((it) => it.slot));
    return ALL_SLOTS.filter((s) => set.has(s));
  }, [eligibleItems]);

  // スロット絞り込み＋ソート（未刻印を先頭、次にスロット順）
  const displayItems = useMemo(() => {
    const filtered =
      slotFilter === 'all'
        ? eligibleItems
        : eligibleItems.filter((it) => it.slot === slotFilter);
    return [...filtered].sort((a, b) => {
      const ae = hasEngravedMod(a) ? 1 : 0;
      const be = hasEngravedMod(b) ? 1 : 0;
      if (ae !== be) return ae - be;
      return ALL_SLOTS.indexOf(a.slot) - ALL_SLOTS.indexOf(b.slot);
    });
  }, [eligibleItems, slotFilter]);

  const selectedItem = useMemo(
    () => craftableItems.find((it) => it.instanceId === selectedInstanceId) ?? null,
    [craftableItems, selectedInstanceId]
  );

  const preview = useMemo(() => {
    if (!selectedItem || !selectedEngraveId) return null;
    return previewEngrave(selectedItem, selectedEngraveId);
  }, [selectedItem, selectedEngraveId]);

  // 刻印を切り替えたら装備選択をリセット（スロット不一致回避）
  const handleSelectEngrave = (id: string) => {
    setSelectedEngraveId(id);
    setSelectedInstanceId(null);
    setReplaceIndex(null);
    setMessage(null);
    setSlotFilter('all');
  };

  const handleSelectItem = (item: Item) => {
    setSelectedInstanceId(item.instanceId);
    setReplaceIndex(null);
    setMessage(null);
  };

  const equippedSet = useMemo(
    () => new Set((Object.values(equipment).filter(Boolean) as Item[]).map((i) => i.instanceId)),
    [equipment]
  );

  const canApply =
    !!selectedItem &&
    !!selectedEngrave &&
    !!preview?.ok &&
    (!preview.needsReplaceChoice || replaceIndex !== null);

  const handleApply = async () => {
    if (!selectedItem || !selectedEngraveId || !preview?.ok) return;
    if (preview.needsReplaceChoice && replaceIndex === null) return;

    const result = applyEngrave(
      selectedItem,
      selectedEngraveId,
      replaceIndex ?? undefined
    );
    if ('error' in result) {
      setMessage(t('engrave.error.generic', { defaultValue: '刻印できませんでした' }));
      return;
    }

    const consumed = await settingsRepository.consumeEngraveStone(selectedEngraveId);
    if (!consumed) {
      setMessage(t('engrave.error.noStone', { defaultValue: '刻印が足りません' }));
      return;
    }

    const saved = await updateItemInstance(result.item);
    if (!saved) {
      // 消費だけ済んだ場合の巻き戻し
      await settingsRepository.addEngraveStone(selectedEngraveId);
      setMessage(t('engrave.error.generic', { defaultValue: '刻印できませんでした' }));
      return;
    }

    await refreshStones();
    setSelectedInstanceId(result.item.instanceId);
    setReplaceIndex(null);
    setMessage(t('engrave.applied', { defaultValue: '刻印しました！' }));
  };

  const engraveName = (id: string) =>
    t(`engrave.mods.${id}`, { defaultValue: id });

  const modLabel = (mod: ItemMod) =>
    mod.engraved ? t('engrave.tag', { defaultValue: '刻印' }) : getTierDisplayName(mod.tier);

  return (
    <ScreenWrapper backgroundColor={colors.bg}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="craft-back">
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t('engrave.title', { defaultValue: '刻印クラフト' })}</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={selectedEngrave ? displayItems : []}
        keyExtractor={(it) => it.instanceId}
        numColumns={5}
        contentContainerStyle={styles.scroll}
        columnWrapperStyle={styles.itemRow}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const sel = item.instanceId === selectedInstanceId;
          const already = hasEngravedMod(item);
          return (
            <Pressable
              onPress={() => handleSelectItem(item)}
              style={[styles.itemCell, sel && styles.itemCellSel, already && styles.itemCellLocked]}
              testID={`craft-item-${item.instanceId}`}
            >
              <Image source={getItemIcon(item.id, item.slot, item.weaponType)} style={styles.itemIcon} />
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {equippedSet.has(item.instanceId) && (
                <View style={styles.equipBadge}>
                  <Text style={styles.equipBadgeText}>E</Text>
                </View>
              )}
              {already && (
                <MaterialCommunityIcons name="lock" size={12} color={colors.accent} style={styles.lockIcon} />
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          selectedEngrave && eligibleItems.length === 0 ? (
            <Text style={styles.empty}>
              {t('engrave.empty.items', { defaultValue: 'この刻印を彫れるレア装備がありません' })}
            </Text>
          ) : null
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.hint}>
              {t('engrave.hint', {
                defaultValue: 'レア装備に狙ったMODを1つ彫り込む（1装備につき1つ・ユニーク不可）',
              })}
            </Text>

            {/* 1. 刻印選択 */}
            <Text style={styles.sectionTitle}>
              {t('engrave.section.stones', { defaultValue: '① 刻印を選ぶ' })}
            </Text>
            {ownedEngraves.length === 0 ? (
              <Text style={styles.empty}>
                {t('engrave.empty.stones', {
                  defaultValue: '刻印を持っていません（終焉以降のダンジョンでドロップ）',
                })}
              </Text>
            ) : (
              <View style={styles.chipWrap}>
                {ownedEngraves.map((d) => {
                  const sel = d.id === selectedEngraveId;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => handleSelectEngrave(d.id)}
                      style={[styles.chip, sel && styles.chipSel]}
                      testID={`engrave-stone-${d.id}`}
                    >
                      <MaterialCommunityIcons name="seal" size={16} color={sel ? colors.accent : colors.textMuted} />
                      <Text style={[styles.chipText, sel && { color: colors.text }]} numberOfLines={1}>
                        {engraveName(d.id)}
                      </Text>
                      <Text style={styles.chipCount}>×{stones[d.id] ?? 0}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* 選択中の刻印の効果 */}
            {selectedEngrave && (
              <View style={styles.engraveInfo}>
                <MaterialCommunityIcons name="arrow-right-bold" size={16} color={colors.accent} />
                <Text style={[styles.engraveInfoText, { color: colors.accent }]}>
                  {getModDescription(
                    { type: selectedEngrave.modType, value: selectedEngrave.value, tier: 1 },
                    t
                  )}
                  {'  '}
                  <Text style={styles.engraveTag}>[{t('engrave.tag', { defaultValue: '刻印' })}]</Text>
                </Text>
              </View>
            )}

            {/* 2. 装備選択 見出し + スロット絞り込みタブ */}
            {selectedEngrave && eligibleItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  {t('engrave.section.items', { defaultValue: '② 装備を選ぶ' })}
                  <Text style={styles.countText}>{`  (${displayItems.length})`}</Text>
                </Text>
                {slotsWithItems.length > 1 && (
                  <View style={styles.slotTabs}>
                    <Pressable
                      onPress={() => setSlotFilter('all')}
                      style={[styles.slotTab, slotFilter === 'all' && styles.slotTabSel]}
                    >
                      <Text style={[styles.slotTabText, slotFilter === 'all' && styles.slotTabTextSel]}>
                        {t('common.all', { defaultValue: 'すべて' })}
                      </Text>
                    </Pressable>
                    {slotsWithItems.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setSlotFilter(s)}
                        style={[styles.slotTab, slotFilter === s && styles.slotTabSel]}
                        testID={`craft-slot-${s}`}
                      >
                        <Text style={[styles.slotTabText, slotFilter === s && styles.slotTabTextSel]}>
                          {t(SLOT_LABEL_KEY[s], { defaultValue: s })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        }
        ListFooterComponent={
          <View>
            {/* 3. プレビュー */}
            {selectedItem && selectedEngrave && (
              <View style={styles.previewBox}>
                <Text style={styles.sectionTitle}>
                  {t('engrave.section.preview', { defaultValue: '③ プレビュー' })}
                </Text>
                <Text style={styles.previewItemName}>{selectedItem.name}</Text>

                {/* 彫れない理由（既刻印/ユニーク/スロット不可）。MODは下に必ず表示する */}
                {!preview?.ok && (
                  <Text style={[styles.previewNote, { color: colors.danger }]}>
                    {preview?.error === 'already'
                      ? t('engrave.error.already', { defaultValue: 'この装備は既に刻印済みです' })
                      : preview?.error === 'unique'
                      ? t('engrave.error.unique', { defaultValue: 'ユニーク装備には刻印できません' })
                      : t('engrave.error.slot', { defaultValue: 'このスロットには彫れません' })}
                  </Text>
                )}
                {preview?.ok && preview.needsReplaceChoice && (
                  <Text style={styles.previewNote}>
                    {t('engrave.replaceHint', {
                      defaultValue: 'MODが4つ埋まっています。置き換えるMODを選んでください',
                    })}
                  </Text>
                )}
                <View style={styles.modList}>
                  {(selectedItem.mods ?? []).map((mod, idx) => {
                    const isReplaceTarget = !!preview?.needsReplaceChoice && replaceIndex === idx;
                    const willReplace = preview?.duplicateIndex === idx || isReplaceTarget;
                    const tappable = !!preview?.needsReplaceChoice;
                    return (
                      <Pressable
                        key={idx}
                        disabled={!tappable}
                        onPress={() => setReplaceIndex(idx)}
                        style={[styles.modRow, isReplaceTarget && styles.modRowReplace]}
                      >
                        <Text style={[styles.modTier, { color: getModTierColor(mod) }]}>
                          {modLabel(mod)}
                        </Text>
                        <Text
                          style={[styles.modDesc, willReplace && styles.modDescStrike]}
                          numberOfLines={1}
                        >
                          {getModDescription(mod, t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {/* 追加される刻印MOD（彫れる場合のみ） */}
                  {preview?.ok && (
                    <View style={[styles.modRow, styles.modRowNew]}>
                      <Text style={[styles.modTier, { color: colors.accent }]}>
                        {t('engrave.tag', { defaultValue: '刻印' })}
                      </Text>
                      <Text style={[styles.modDesc, { color: colors.accent }]} numberOfLines={1}>
                        {getModDescription(
                          { type: selectedEngrave.modType, value: selectedEngrave.value, tier: 1 },
                          t
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {message && (
              <Text
                style={[
                  styles.message,
                  { color: message.includes('!') || message.includes('！') ? colors.success : colors.danger },
                ]}
              >
                {message}
              </Text>
            )}
          </View>
        }
      />

      {/* 適用ボタン */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleApply}
          disabled={!canApply}
          style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
          testID="craft-apply"
        >
          <MaterialCommunityIcons name="hammer" size={20} color={canApply ? '#1a1a2e' : colors.textMuted} />
          <Text style={[styles.applyText, !canApply && { color: colors.textMuted }]}>
            {t('engrave.apply', { defaultValue: '刻印する' })}
          </Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 12, paddingBottom: 24 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSel: { borderColor: colors.accent, backgroundColor: colors.panelSel },
  chipText: { color: colors.textMuted, fontSize: 12, maxWidth: 120 },
  chipCount: { color: colors.gold, fontSize: 12, fontWeight: '700', marginLeft: 2 },
  engraveInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  engraveInfoText: { fontSize: 13, fontWeight: '600' },
  engraveTag: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  countText: { color: colors.textMuted, fontSize: 12, fontWeight: '400' },
  slotTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  slotTab: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  slotTabSel: { borderColor: colors.accent, backgroundColor: colors.panelSel },
  slotTabText: { color: colors.textMuted, fontSize: 12 },
  slotTabTextSel: { color: colors.text, fontWeight: '700' },
  itemRow: { gap: 8, marginBottom: 8 },
  itemCell: {
    width: 64,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
  },
  itemCellSel: { borderColor: colors.accent, backgroundColor: colors.panelSel },
  itemCellLocked: { opacity: 0.5 },
  itemIcon: { width: 44, height: 44, resizeMode: 'contain' },
  itemName: { color: colors.textMuted, fontSize: 9, marginTop: 2, maxWidth: 60 },
  equipBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: colors.success,
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  equipBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  lockIcon: { position: 'absolute', top: 2, right: 2 },
  previewBox: {
    marginTop: 8,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  previewItemName: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  previewNote: { color: colors.gold, fontSize: 12, marginBottom: 8 },
  modList: { gap: 4 },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  modRowReplace: { backgroundColor: 'rgba(244,67,54,0.15)' },
  modRowNew: { backgroundColor: 'rgba(255,112,67,0.15)' },
  modTier: { fontSize: 12, fontWeight: '700', width: 40 },
  modDesc: { color: colors.text, fontSize: 13, flex: 1 },
  modDescStrike: { textDecorationLine: 'line-through', color: colors.textMuted },
  message: { textAlign: 'center', fontSize: 14, fontWeight: '700', marginTop: 12 },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
  },
  applyBtnDisabled: { backgroundColor: colors.panel },
  applyText: { color: '#1a1a2e', fontSize: 16, fontWeight: '700' },
});
