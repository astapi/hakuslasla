import { ImageBackground, View, Text, StyleSheet, ScrollView, Modal, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Picker } from '@react-native-picker/picker';
import { DungeonCard } from '@/components/dungeon/DungeonCard';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { getDungeonList, DUNGEON_UNLOCK_ORDER, DEBUG_DUNGEON_IDS } from '@/data/dungeons';
import { BASE_BOSS_BY_UBER, DIMENSIONAL_RUSH_UNLOCK_CHAIN, UBER_DUNGEON_IDS, UBER_UBER_DUNGEON_IDS, UBER_BY_UBER_UBER, isDimensionalRushDungeon, isDimensionalCorridorDungeon, DIMENSIONAL_CORRIDOR_ID } from '@/data/endContents';
import { BADGE_IDS_EXCEPT_UBER_UBER } from '@/data/badges';
import { settingsRepository, badgeRepository, DungeonClearRecords } from '@/db';
import { DungeonListItem } from '@/types';
import { ms, fs } from '@/utils/scaling';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { Analytics } from '@/lib/analytics';
import { getDungeonBackgroundImage } from '@/data/images';
import { useState, useCallback, useMemo } from 'react';

// ダンジョンが解放されているか判定
function isDungeonUnlocked(
  dungeonId: string,
  clearRecords: DungeonClearRecords
): boolean {
  const index = DUNGEON_UNLOCK_ORDER.indexOf(dungeonId);

  // 解放順序に含まれない（エンドコンテンツ等）
  if (index === -1) return false;

  // 最初のダンジョンは常に解放
  if (index === 0) return true;

  // 前のダンジョンがクリアされていれば解放
  const prevDungeonId = DUNGEON_UNLOCK_ORDER[index - 1];
  return clearRecords[prevDungeonId] !== undefined;
}

interface DungeonWithStatus extends DungeonListItem {
  isLocked: boolean;
  isCleared: boolean;
  requiresTicket?: boolean;
  ticketCount?: number;
  isDisabled?: boolean;
}

// 次元回廊のスタート階層選択肢を生成（201F, 401F, ...）
function getFloorOptions(bestFloor: number): number[] {
  const options = [1];
  const maxTier = Math.floor((bestFloor - 1) / 200);
  for (let i = 1; i <= maxTier; i++) {
    options.push(i * 200 + 1);
  }
  return options;
}

export default function DungeonSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dungeons, setDungeons] = useState<DungeonWithStatus[]>([]);
  const [dimensionalCorridorBest, setDimensionalCorridorBest] = useState(0);
  const [showFloorSelect, setShowFloorSelect] = useState(false);
  const [selectedStartFloor, setSelectedStartFloor] = useState(1);

  const floorOptions = useMemo(() => getFloorOptions(dimensionalCorridorBest), [dimensionalCorridorBest]);

  const loadDungeons = useCallback(async () => {
    const all = getDungeonList();
    const season = usePlayerStore.getState().season;
    const endContentUnlocked = await settingsRepository.getEndContentUnlocked(season);
    const uberUnlocks = await settingsRepository.getUberBossUnlocks(season);
    const uberTickets = await settingsRepository.getUberTickets(season);
    const clearRecords = await settingsRepository.getDungeonClearRecords(season);

    const result: DungeonWithStatus[] = [];

    for (const dungeon of all) {
      // デバッグ用ダンジョン（__DEV__のみ表示）
      if (__DEV__ && DEBUG_DUNGEON_IDS.includes(dungeon.id)) {
        result.push({
          ...dungeon,
          isLocked: false,
          isCleared: clearRecords[dungeon.id] !== undefined,
        });
        continue;
      }

      // 分割された異次元ラッシュの処理
      if (isDimensionalRushDungeon(dungeon.id)) {
        if (endContentUnlocked) {
          // 開放条件をチェック
          const requiredDungeon = DIMENSIONAL_RUSH_UNLOCK_CHAIN[dungeon.id];
          // requiredDungeonがnullの場合（dimensional_rush_1）は終焉の地クリアで開放済み
          // それ以外は前のダンジョンをクリアしているかチェック
          const isUnlocked = requiredDungeon === null || clearRecords[requiredDungeon] !== undefined;

          if (isUnlocked) {
            result.push({
              ...dungeon,
              isLocked: false,
              isCleared: clearRecords[dungeon.id] !== undefined,
            });
          }
        }
        continue;
      }

      // 次元回廊の処理（異次元ラッシュVI クリアで開放）
      if (isDimensionalCorridorDungeon(dungeon.id)) {
        const isUnlocked = clearRecords['dimensional_rush_6'] !== undefined;
        if (isUnlocked) {
          result.push({
            ...dungeon,
            isLocked: false,
            isCleared: false, // 無制限階層なのでクリア状態は常にfalse
          });
        }
        continue;
      }

      if (UBER_DUNGEON_IDS.includes(dungeon.id)) {
        const baseBossId = BASE_BOSS_BY_UBER[dungeon.id];
        if (!baseBossId) continue;
        const isUnlocked = uberUnlocks[baseBossId];
        const ticketCount = uberTickets[baseBossId] ?? 0;
        if (Boolean(isUnlocked)) {
          result.push({
            ...dungeon,
            isLocked: false,
            isCleared: clearRecords[dungeon.id] !== undefined,
            requiresTicket: true,
            ticketCount,
            isDisabled: ticketCount <= 0,
          });
        }
        continue;
      }

      // UberUberダンジョンの処理（全バッジ所持が条件、Uberチケット共通）
      if (UBER_UBER_DUNGEON_IDS.includes(dungeon.id)) {
        const characterId = usePlayerStore.getState().characterId;
        if (!characterId) continue;
        const hasAllBadges = await badgeRepository.hasAllBadgesExcept(
          characterId,
          BADGE_IDS_EXCEPT_UBER_UBER,
          []
        );
        if (!hasAllBadges) continue;
        // UberUber → Uber → Base のチケットを使用
        const uberDungeonId = UBER_BY_UBER_UBER[dungeon.id];
        const baseBossId = uberDungeonId ? BASE_BOSS_BY_UBER[uberDungeonId] : undefined;
        if (!baseBossId) continue;
        const ticketCount = uberTickets[baseBossId] ?? 0;
        result.push({
          ...dungeon,
          isLocked: false,
          isCleared: clearRecords[dungeon.id] !== undefined,
          requiresTicket: true,
          ticketCount,
          isDisabled: ticketCount <= 0,
        });
        continue;
      }

      // 通常ダンジョンの処理
      const isInOrder = DUNGEON_UNLOCK_ORDER.includes(dungeon.id);
      if (!isInOrder) continue;

      const isUnlocked = isDungeonUnlocked(dungeon.id, clearRecords);

      // 未解放ダンジョンは非表示
      if (!isUnlocked) continue;

      const isCleared = clearRecords[dungeon.id] !== undefined;

      result.push({
        ...dungeon,
        isLocked: false,
        isCleared,
      });
    }

    // 次元回廊の最高到達階を取得（キャラのシーズンのキーで取得）
    const characterId = usePlayerStore.getState().characterId;
    if (characterId) {
      const season = usePlayerStore.getState().season;
      const best = await settingsRepository.getDimensionalCorridorBest(characterId, season);
      setDimensionalCorridorBest(best);
    }

    setDungeons(result);
  }, []);

  // 画面がフォーカスされた時にダンジョンリストを再読み込み
  useFocusEffect(
    useCallback(() => {
      loadDungeons();
    }, [loadDungeons])
  );

  const handleDungeonSelect = async (dungeonId: string) => {
    // 次元回廊で201F以上到達済みならスタート階層選択モーダルを表示
    if (isDimensionalCorridorDungeon(dungeonId) && dimensionalCorridorBest >= 201) {
      setSelectedStartFloor(floorOptions[floorOptions.length - 1]);
      setShowFloorSelect(true);
      return;
    }

    if (UBER_DUNGEON_IDS.includes(dungeonId)) {
      const baseBossId = BASE_BOSS_BY_UBER[dungeonId];
      if (!baseBossId) return;
      const season = usePlayerStore.getState().season;
      const consumed = await settingsRepository.consumeUberTicket(baseBossId, 1, season);
      if (!consumed) return;
    } else if (UBER_UBER_DUNGEON_IDS.includes(dungeonId)) {
      const uberDungeonId = UBER_BY_UBER_UBER[dungeonId];
      const baseBossId = uberDungeonId ? BASE_BOSS_BY_UBER[uberDungeonId] : undefined;
      if (!baseBossId) return;
      const season = usePlayerStore.getState().season;
      const consumed = await settingsRepository.consumeUberTicket(baseBossId, 1, season);
      if (!consumed) return;
    }

    const dungeon = dungeons.find((d) => d.id === dungeonId);
    const isUber = UBER_DUNGEON_IDS.includes(dungeonId) || UBER_UBER_DUNGEON_IDS.includes(dungeonId);
    Analytics.logDungeonStart({
      dungeon_id: dungeonId,
      dungeon_name: dungeon?.name || dungeonId,
      player_level: usePlayerStore.getState().level,
      is_uber: isUber,
    });

    // 戦闘開始時はダンジョン選択を履歴から消す
    router.replace(`/battle/${dungeonId}`);
  };

  const handleFloorSelectConfirm = () => {
    setShowFloorSelect(false);

    const dungeon = dungeons.find((d) => d.id === DIMENSIONAL_CORRIDOR_ID);
    Analytics.logDungeonStart({
      dungeon_id: DIMENSIONAL_CORRIDOR_ID,
      dungeon_name: dungeon?.name || DIMENSIONAL_CORRIDOR_ID,
      player_level: usePlayerStore.getState().level,
      is_uber: false,
    });

    router.replace(`/battle/${DIMENSIONAL_CORRIDOR_ID}?startFloor=${selectedStartFloor}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenWrapper>
      <ImageBackground
        source={getDungeonBackgroundImage('dimensional_rush_1')}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>{t('dungeonSelect.title')}</Text>
            <Text style={styles.subtitle}>{t('dungeonSelect.subtitle')}</Text>

            <View style={styles.dungeonList}>
              {dungeons.map((dungeon) => (
                <DungeonCard
                  key={dungeon.id}
                  dungeon={dungeon}
                  onPress={() => handleDungeonSelect(dungeon.id)}
                  isCleared={dungeon.isCleared}
                  requiresTicket={dungeon.requiresTicket}
                  ticketCount={dungeon.ticketCount}
                  isDisabled={dungeon.isDisabled}
                  testID={`dungeon-card-${dungeon.id}`}
                  backgroundImage={getDungeonBackgroundImage(dungeon.id)}
                  onRankingPress={
                    isDimensionalCorridorDungeon(dungeon.id)
                      ? () => router.push('/ranking')
                      : undefined
                  }
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={t('common.back')}
              onPress={handleBack}
              variant="secondary"
              testID="dungeon-back-button"
            />
          </View>
        </View>
      </ImageBackground>

      {/* 次元回廊スタート階層選択モーダル */}
      <Modal
        visible={showFloorSelect}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFloorSelect(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFloorSelect(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('dungeonSelect.selectStartFloor')}</Text>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedStartFloor}
                onValueChange={(value) => setSelectedStartFloor(value)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {floorOptions.map((floor) => (
                  <Picker.Item
                    key={floor}
                    label={t('dungeonSelect.startFloorLabel', { floor })}
                    value={floor}
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.modalButtons}>
              <Button
                title={t('dungeonSelect.cancelButton')}
                onPress={() => setShowFloorSelect(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                title={t('dungeonSelect.startButton')}
                onPress={handleFloorSelectConfirm}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  background: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.48,
  },
  backgroundOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 13, 0.68)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
    paddingBottom: ms(8),
  },
  title: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  subtitle: {
    fontSize: fs(14),
    color: '#aaa',
    textAlign: 'center',
    marginBottom: ms(24),
  },
  dungeonList: {
    gap: ms(12),
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: ms(12),
    padding: ms(20),
    width: '85%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  pickerContainer: {
    marginVertical: ms(8),
  },
  picker: {
    width: '100%',
  },
  pickerItem: {
    color: '#fff',
    fontSize: fs(18),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: ms(12),
    marginTop: ms(12),
  },
});
