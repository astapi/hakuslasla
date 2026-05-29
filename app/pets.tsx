import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getPet, getAllPets, getPetImageKey } from '@/data/pets';
import { getMonsterImage, monsterBattleScales } from '@/data/images';
import { ms, fs, s } from '@/utils/scaling';
import { PetDefinition, PetInstance } from '@/types';

interface PetEntry {
  def: PetDefinition;
  instances: PetInstance[]; // 空配列なら未入手
}

export default function PetsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { pets, activePetInstanceId, setActivePet, getPetMaxSize } = usePlayerStore();
  const petMaxSize = getPetMaxSize();

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

  const handleBack = () => router.back();

  const handleTapEntry = (entry: PetEntry) => {
    if (entry.instances.length === 0) return; // 未入手は何もしない
    const isActive = activePet?.petId === entry.def.id;
    if (isActive) {
      void setActivePet(null);
    } else {
      void setActivePet(entry.instances[0].instanceId);
    }
  };

  const renderEntry = (entry: PetEntry) => {
    const { def, instances } = entry;
    const owned = instances.length > 0;
    const isActive = owned && activePet?.petId === def.id;
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
                </Text>
                <Text style={styles.activeBuff}>
                  {t(`pets.${activeDef.id}.buff`, { defaultValue: '' })}
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
});
