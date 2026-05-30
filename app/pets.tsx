import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getPet, getAllPets, getPetImageKey, getPetLevelFactor, getPetUpgradeCost, PET_MAX_LEVEL } from '@/data/pets';
import { getMonsterImage, monsterBattleScales } from '@/data/images';
import { CLASS_ABILITIES } from '@/core/player';
import { ms, fs, s } from '@/utils/scaling';
import { PetBuff, PetDefinition, PetInstance } from '@/types';

interface PetEntry {
  def: PetDefinition;
  instances: PetInstance[]; // 空配列なら未入手
}

// バフ文字列を組み立てる際のフィールド順（プチキングの表記順に合わせる）
const BUFF_FIELDS: (keyof PetBuff)[] = [
  'atkIncreasedPct',
  'defIncreasedPct',
  'attackSpeedPct',
  'maxHp',
  'poisonChance',
  'igniteChance',
  'freezeChance',
  'freezeChanceCapPct',
  'critChancePct',
  'lifestealPct',
  'hpRegen',
];

export default function PetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    pets,
    activePetInstanceId,
    setActivePet,
    getPetMaxSize,
    characterType,
    petLevels,
    discardPetDuplicate,
    upgradePet,
  } = usePlayerStore();
  const petMaxSize = getPetMaxSize();

  // テイマーなどクラス固有能力によるペット効果倍率
  const petMultiplier = CLASS_ABILITIES[characterType].petEffectMultiplier ?? 1;

  // 詳細モーダルで選択中のペット種類
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // バフ値に「強化レベル倍率 × クラス倍率」を掛けて表示用文字列を組み立てる
  const formatBuff = (buff: PetBuff, level: number): string => {
    const factor = getPetLevelFactor(level) * petMultiplier;
    const parts: string[] = [];
    for (const field of BUFF_FIELDS) {
      const raw = buff[field];
      if (!raw) continue;
      const value = Math.round(raw * factor * 10) / 10;
      parts.push(t(`petBuff.${field}`, { value }));
    }
    const text = parts.join(t('petBuff.separator'));
    return petMultiplier !== 1
      ? text + t('petBuff.multiplierSuffix', { value: petMultiplier })
      : text;
  };

  // 全ペット定義を取得して、所持インスタンスとマージ
  const entries = useMemo<PetEntry[]>(() => {
    const ownedByPetId = new Map<string, PetInstance[]>();
    for (const inst of pets) {
      const list = ownedByPetId.get(inst.petId) ?? [];
      list.push(inst);
      ownedByPetId.set(inst.petId, list);
    }
    return getAllPets().map((def) => ({
      def,
      instances: ownedByPetId.get(def.id) ?? [],
    }));
  }, [pets]);

  const activePet = activePetInstanceId
    ? pets.find((p) => p.instanceId === activePetInstanceId)
    : undefined;
  const activeDef = activePet ? getPet(activePet.petId) : undefined;
  const activeLevel = activePet ? (petLevels[activePet.petId] ?? 1) : 1;

  const handleBack = () => router.back();

  const handleTapEntry = (entry: PetEntry) => {
    if (entry.instances.length === 0) return; // 未入手は何もしない
    setSelectedPetId(entry.def.id);
  };

  const renderEntry = (entry: PetEntry) => {
    const { def, instances } = entry;
    const owned = instances.length > 0;
    const isActive = owned && activePet?.petId === def.id;
    const level = petLevels[def.id] ?? 1;
    const imageKey = getPetImageKey(def);
    const scale = monsterBattleScales[imageKey] ?? 1;
    const imageSize = s(56) * scale;

    return (
      <Pressable
        key={def.id}
        style={[
          styles.gridCell,
          owned && styles.gridCellOwned,
          isActive && styles.gridCellActive,
        ]}
        onPress={() => handleTapEntry(entry)}
      >
        <View style={styles.gridImageContainer}>
          <Image
            source={getMonsterImage(imageKey)}
            style={[
              { width: imageSize, height: imageSize },
              !owned && styles.silhouette,
            ]}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.gridName} numberOfLines={1}>
          {owned ? t(`monsters.${def.sourceMonsterId}.name`, { defaultValue: def.sourceMonsterId }) : '???'}
        </Text>
        {owned && instances.length > 1 && (
          <Text style={styles.gridCount}>×{instances.length}</Text>
        )}
        {/* Lvバッジはアクティブバッジ（左上）の真下に配置（下部の名前と重ならないように） */}
        {owned && level > 1 && (
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Lv{level}</Text>
          </View>
        )}
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{t('petsScreen.active')}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const ownedCount = pets.length;
  const collectedSpecies = entries.filter((e) => e.instances.length > 0).length;
  const totalSpecies = entries.length;

  // ===== 詳細モーダル用の算出 =====
  const selectedEntry = selectedPetId
    ? entries.find((e) => e.def.id === selectedPetId && e.instances.length > 0)
    : undefined;

  const closeModal = () => setSelectedPetId(null);

  const handleToggleActive = (entry: PetEntry) => {
    const isActive = activePet?.petId === entry.def.id;
    if (isActive) {
      void setActivePet(null);
    } else {
      void setActivePet(entry.instances[0].instanceId);
    }
  };

  const handleUpgrade = (entry: PetEntry, cost: number) => {
    const name = t(`monsters.${entry.def.sourceMonsterId}.name`, { defaultValue: entry.def.sourceMonsterId });
    Alert.alert(
      t('petsScreen.confirmUpgradeTitle'),
      t('petsScreen.confirmUpgradeMessage', { name, count: cost }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('petsScreen.upgrade'), onPress: () => void upgradePet(entry.def.id) },
      ]
    );
  };

  const handleDiscard = (entry: PetEntry) => {
    const name = t(`monsters.${entry.def.sourceMonsterId}.name`, { defaultValue: entry.def.sourceMonsterId });
    Alert.alert(
      t('petsScreen.confirmDiscardTitle'),
      t('petsScreen.confirmDiscardMessage', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('petsScreen.discard'), style: 'destructive', onPress: () => void discardPetDuplicate(entry.def.id) },
      ]
    );
  };

  const renderModal = () => {
    if (!selectedEntry) return null;
    const { def, instances } = selectedEntry;
    const level = petLevels[def.id] ?? 1;
    const isActive = activePet?.petId === def.id;
    const duplicates = instances.length - 1; // 残す1体を除いた重複数
    const cost = getPetUpgradeCost(level); // 次Lvに必要な重複数（最大時null）
    const isMax = level >= PET_MAX_LEVEL;
    const canUpgrade = cost !== null && duplicates >= cost;
    const canDiscard = instances.length >= 2;
    const imageKey = getPetImageKey(def);
    const name = t(`monsters.${def.sourceMonsterId}.name`, { defaultValue: def.sourceMonsterId });

    return (
      <Modal visible transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* ヘッダー: 画像 + 名前 + レベル */}
            <View style={styles.modalHeader}>
              <View style={styles.modalImageBox}>
                <Image source={getMonsterImage(imageKey)} style={styles.modalImage} resizeMode="contain" />
              </View>
              <View style={styles.modalHeaderInfo}>
                <Text style={styles.modalName}>{name}</Text>
                <Text style={styles.modalLevel}>
                  {t('petsScreen.levelValue', { level, max: PET_MAX_LEVEL })}
                </Text>
                <Text style={styles.modalOwned}>
                  {t('petsScreen.duplicates', { count: duplicates })}
                </Text>
              </View>
            </View>

            {/* 現在のバフ */}
            <Text style={styles.modalBuff}>{formatBuff(def.buff, level)}</Text>

            {/* アクション */}
            <View style={styles.modalActions}>
              <Button
                title={isActive ? t('petsScreen.unsetActive') : t('petsScreen.setActive')}
                onPress={() => handleToggleActive(selectedEntry)}
                variant={isActive ? 'secondary' : 'primary'}
              />

              {isMax ? (
                <View style={styles.modalNote}>
                  <Text style={styles.modalNoteText}>{t('petsScreen.upgradeMax')}</Text>
                </View>
              ) : (
                <>
                  <Button
                    title={t('petsScreen.upgrade')}
                    onPress={() => handleUpgrade(selectedEntry, cost as number)}
                    disabled={!canUpgrade}
                  />
                  <Text style={styles.modalHint}>
                    {t('petsScreen.upgradeCost', { count: cost ?? 0 })}
                  </Text>
                </>
              )}

              <Button
                title={t('petsScreen.discard')}
                onPress={() => handleDiscard(selectedEntry)}
                variant="danger"
                disabled={!canDiscard}
              />
              {!canDiscard && (
                <Text style={styles.modalHint}>{t('petsScreen.cannotDiscard')}</Text>
              )}
            </View>

            <Button title={t('petsScreen.close')} onPress={closeModal} variant="secondary" />
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <ScreenWrapper style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('petsScreen.title')}</Text>
        <Text style={[styles.headerCount, ownedCount >= petMaxSize && styles.headerCountFull]}>
          {ownedCount}/{petMaxSize}
        </Text>
      </View>

      {/* アクティブペット表示 */}
      <View style={styles.activeSection}>
        <Text style={styles.sectionLabel}>{t('petsScreen.active')}</Text>
        {activeDef ? (() => {
          const activeImageKey = getPetImageKey(activeDef);
          return (
            <View style={styles.activeCard}>
              <View style={styles.activeImageBox}>
                <Image
                  source={getMonsterImage(activeImageKey)}
                  style={styles.activeImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.activeInfo}>
                <Text style={styles.activeName}>
                  {t(`monsters.${activeDef.sourceMonsterId}.name`, { defaultValue: activeDef.sourceMonsterId })}
                  {activeLevel > 1 ? ` Lv${activeLevel}` : ''}
                </Text>
                <Text style={styles.activeBuff}>
                  {formatBuff(activeDef.buff, activeLevel)}
                </Text>
              </View>
            </View>
          );
        })() : (
          <View style={styles.activeCardEmpty}>
            <Text style={styles.activeEmptyText}>{t('petsScreen.none')}</Text>
          </View>
        )}
      </View>

      {/* 進捗表示 */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {t('petsScreen.collected', { count: collectedSpecies, total: totalSpecies })}
        </Text>
      </View>

      {/* ペット図鑑グリッド */}
      <ScrollView style={styles.list} contentContainerStyle={styles.gridContainer}>
        {entries.map(renderEntry)}
      </ScrollView>

      {/* フッター */}
      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>

      {renderModal()}
    </ScreenWrapper>
  );
}

const GRID_GAP = ms(8);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
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
  activeSection: {
    paddingHorizontal: ms(16),
    paddingTop: ms(12),
  },
  sectionLabel: {
    fontSize: fs(12),
    color: '#8C929A',
    marginBottom: ms(8),
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2026',
    borderRadius: ms(12),
    padding: ms(12),
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  activeImageBox: {
    width: s(56),
    height: s(56),
    marginRight: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeImage: {
    width: '100%',
    height: '100%',
  },
  activeInfo: {
    flex: 1,
  },
  activeName: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(4),
  },
  activeBuff: {
    fontSize: fs(12),
    color: '#FFD700',
  },
  activeCardEmpty: {
    backgroundColor: '#1B2026',
    borderRadius: ms(12),
    padding: ms(14),
    borderWidth: 1,
    borderColor: '#2A3037',
    alignItems: 'center',
  },
  activeEmptyText: {
    fontSize: fs(13),
    color: '#8C929A',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: ms(16),
    paddingTop: ms(12),
    paddingBottom: ms(4),
  },
  statsText: {
    fontSize: fs(12),
    color: '#8C929A',
  },
  list: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(32),
    gap: GRID_GAP,
  },
  gridCell: {
    width: '31%',
    aspectRatio: 1.1,
    backgroundColor: '#1B2026',
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#2A3037',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(2),
    paddingHorizontal: ms(4),
    position: 'relative',
  },
  gridCellOwned: {
    borderColor: '#3A434C',
  },
  gridCellActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  gridImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouette: {
    tintColor: '#000',
    opacity: 0.65,
  },
  gridName: {
    fontSize: fs(11),
    color: '#C9CDD3',
    textAlign: 'center',
    marginTop: ms(2),
  },
  gridCount: {
    position: 'absolute',
    top: ms(4),
    right: ms(6),
    fontSize: fs(11),
    fontWeight: 'bold',
    color: '#FFD700',
  },
  levelBadge: {
    position: 'absolute',
    top: ms(24),
    left: ms(4),
    backgroundColor: 'rgba(76, 175, 80, 0.85)',
    borderRadius: ms(4),
    paddingHorizontal: ms(4),
    paddingVertical: ms(1),
  },
  levelBadgeText: {
    fontSize: fs(9),
    fontWeight: 'bold',
    color: '#0d1f0e',
  },
  activeBadge: {
    position: 'absolute',
    top: ms(4),
    left: ms(4),
    backgroundColor: 'rgba(255, 215, 0, 0.85)',
    borderRadius: ms(4),
    paddingHorizontal: ms(4),
    paddingVertical: ms(1),
  },
  activeBadgeText: {
    fontSize: fs(9),
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
  // ===== 詳細モーダル =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: ms(24),
  },
  modalCard: {
    backgroundColor: '#1B2026',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#3A434C',
    padding: ms(20),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(12),
  },
  modalImageBox: {
    width: s(64),
    height: s(64),
    marginRight: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(2),
  },
  modalLevel: {
    fontSize: fs(13),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  modalOwned: {
    fontSize: fs(12),
    color: '#8C929A',
    marginTop: ms(2),
  },
  modalBuff: {
    fontSize: fs(13),
    color: '#FFD700',
    marginBottom: ms(16),
  },
  modalActions: {
    gap: ms(8),
    marginBottom: ms(8),
  },
  modalHint: {
    fontSize: fs(11),
    color: '#8C929A',
    textAlign: 'center',
    marginTop: ms(-2),
  },
  modalNote: {
    backgroundColor: '#15191E',
    borderRadius: ms(8),
    paddingVertical: ms(10),
    alignItems: 'center',
  },
  modalNoteText: {
    fontSize: fs(12),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});
