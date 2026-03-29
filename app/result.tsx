import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as StoreReview from 'expo-store-review';
import { Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { ModFilterTooltip } from '@/components/common/ModFilterTooltip';
import { EndContentTooltip } from '@/components/common/EndContentTooltip';
import { UberTreeTooltip } from '@/components/common/UberTreeTooltip';
import { DimensionalCorridorTooltip } from '@/components/common/DimensionalCorridorTooltip';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { UBER_DUNGEON_IDS, UBER_UBER_DUNGEON_IDS, UBER_BY_UBER_UBER, BASE_BOSS_BY_UBER } from '@/core/endContent';
import { getUberBossClearBadgeId } from '@/data/badges';
import { Item } from '@/types';
import { ms, fs } from '@/utils/scaling';
import { isRepeatDisabled } from '@/core/resultHelpers';

export default function ResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    dungeonId: string;
    dungeonName: string;
    result: string;
    floorsCleared: string;
    maxFloor: string;
    expGained: string;
    itemsGained: string;
    runCount: string;
    grandTotalExp: string;
    grandTotalItems: string;
  }>();

  const result = params.result as 'cleared' | 'defeat' | 'retreat';
  const floorsCleared = parseInt(params.floorsCleared || '0', 10);
  const maxFloor = parseInt(params.maxFloor || '5', 10);
  const expGained = parseInt(params.expGained || '0', 10);
  const itemsGained: Item[] = params.itemsGained ? JSON.parse(params.itemsGained) : [];
  const runCount = parseInt(params.runCount || '1', 10);
  const grandTotalExp = parseInt(params.grandTotalExp || expGained.toString(), 10);
  const grandTotalItems: Item[] = params.grandTotalItems ? JSON.parse(params.grandTotalItems) : itemsGained;

  // MODフィルターツールチップの表示状態
  const [showModFilterTooltip, setShowModFilterTooltip] = useState(false);
  // エンドコンテンツ解放ツールチップの表示状態
  const [showEndContentTooltip, setShowEndContentTooltip] = useState(false);
  // Uberツリー解放ツールチップの表示状態
  const [showUberTreeTooltip, setShowUberTreeTooltip] = useState(false);
  // 次元回廊解放ツールチップの表示状態
  const [showDimensionalCorridorTooltip, setShowDimensionalCorridorTooltip] = useState(false);

  // Uber入場券の状態（UberUberも共通チケット）
  const dungeonId = params.dungeonId ?? '';
  const isUberUberDungeon = UBER_UBER_DUNGEON_IDS.includes(dungeonId);
  const isUberDungeon = UBER_DUNGEON_IDS.includes(dungeonId) || isUberUberDungeon;
  const baseBossId = isUberUberDungeon
    ? (() => { const uberId = UBER_BY_UBER_UBER[dungeonId]; return uberId ? BASE_BOSS_BY_UBER[uberId] : undefined; })()
    : (UBER_DUNGEON_IDS.includes(dungeonId) ? BASE_BOSS_BY_UBER[dungeonId] : undefined);
  const [uberTicketCount, setUberTicketCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isUberDungeon || !baseBossId) return;
    void settingsRepository.getUberTicketCount(baseBossId).then(setUberTicketCount);
  }, [isUberDungeon, baseBossId]);

  // ゴブリンの砦初回クリア時にMODフィルターツールチップを表示
  useEffect(() => {
    const checkModFilterTooltip = async () => {
      // ゴブリンの砦をクリアした場合のみ
      if (params.dungeonId !== 'goblin_fort') return;
      if (result !== 'cleared') return;

      // DEVモードでは常に表示、本番では表示済みかチェック
      if (!__DEV__) {
        const alreadyShown = await settingsRepository.hasModFilterTooltipBeenShown();
        if (alreadyShown) return;
      }

      setShowModFilterTooltip(true);
    };

    checkModFilterTooltip();
  }, [params.dungeonId, result]);

  // 終焉の地初回クリア時にエンドコンテンツ解放ツールチップを表示
  useEffect(() => {
    const checkEndContentTooltip = async () => {
      if (params.dungeonId !== 'final_land') return;
      if (result !== 'cleared') return;

      if (!__DEV__) {
        const alreadyShown = await settingsRepository.hasEndContentTooltipBeenShown();
        if (alreadyShown) return;
      }

      setShowEndContentTooltip(true);
    };

    checkEndContentTooltip();
  }, [params.dungeonId, result]);

  // Uberボス初回クリア時にUberツリー解放ツールチップを表示
  useEffect(() => {
    const checkUberTreeTooltip = async () => {
      if (result !== 'cleared') return;
      // Uberボスダンジョンかチェック（UberUberは対象外）
      if (!UBER_DUNGEON_IDS.includes(dungeonId)) return;
      // バッジIDがあるか（Uberボスか）
      const badgeId = getUberBossClearBadgeId(dungeonId);
      if (!badgeId) return;

      if (!__DEV__) {
        const alreadyShown = await settingsRepository.hasUberTreeTooltipBeenShown();
        if (alreadyShown) return;
      }

      setShowUberTreeTooltip(true);
    };

    checkUberTreeTooltip();
  }, [dungeonId, result]);

  // 異次元ラッシュVI初回クリア時に次元回廊解放ツールチップを表示
  useEffect(() => {
    const checkDimensionalCorridorTooltip = async () => {
      if (params.dungeonId !== 'dimensional_rush_6') return;
      if (result !== 'cleared') return;

      if (!__DEV__) {
        const alreadyShown = await settingsRepository.hasDimensionalCorridorTooltipBeenShown();
        if (alreadyShown) return;
      }

      setShowDimensionalCorridorTooltip(true);
    };

    checkDimensionalCorridorTooltip();
  }, [params.dungeonId, result]);

  // 特定ダンジョン初回クリア時にストアレビューをリクエスト
  // - 魔王城（demon_castle）
  // - 異次元ラッシュⅡ（dimensional_rush_2）
  useEffect(() => {
    const STORE_REVIEW_DUNGEONS = ['demon_castle', 'dimensional_rush_2'];

    const requestStoreReview = async () => {
      const dungeonId = params.dungeonId;
      if (!dungeonId) return;
      if (result !== 'cleared') return;

      // 対象ダンジョンかチェック
      if (!STORE_REVIEW_DUNGEONS.includes(dungeonId)) return;

      // DEVモードでは常に表示、本番ではリクエスト済みかチェック
      if (!__DEV__) {
        const alreadyRequested = await settingsRepository.hasStoreReviewBeenRequestedFor(dungeonId);
        if (alreadyRequested) return;
      }

      // リクエスト済みフラグを設定
      await settingsRepository.setStoreReviewRequestedFor(dungeonId);

      // ストアレビューが利用可能か確認
      const isAvailable = await StoreReview.isAvailableAsync();
      if (!isAvailable) return;

      // 少し遅延させてからレビューをリクエスト（UX向上）
      setTimeout(async () => {
        await StoreReview.requestReview();
      }, 1000);
    };

    requestStoreReview();
  }, [params.dungeonId, result]);

  const handleReturn = () => {
    router.replace('/home');
  };

  const handleRepeat = async () => {
    if (isUberDungeon && baseBossId) {
      const consumed = await settingsRepository.consumeUberTicket(baseBossId);
      if (!consumed) return;
      setUberTicketCount((prev) => (prev ?? 1) - 1);
    }
    router.replace(`/battle/${params.dungeonId}`);
  };

  const isCleared = result === 'cleared';
  const isRetreat = result === 'retreat';
  const isMultiRun = runCount > 1;
  const repeatDisabled = isRepeatDisabled(isUberDungeon, uberTicketCount);

  return (
    <ScreenWrapper>
      {/* MODフィルターツールチップ */}
      <ModFilterTooltip
        visible={showModFilterTooltip}
        onDismiss={() => setShowModFilterTooltip(false)}
      />
      {/* エンドコンテンツ解放ツールチップ */}
      <EndContentTooltip
        visible={showEndContentTooltip}
        onDismiss={() => setShowEndContentTooltip(false)}
      />
      {/* Uberツリー解放ツールチップ */}
      <UberTreeTooltip
        visible={showUberTreeTooltip}
        onDismiss={() => setShowUberTreeTooltip(false)}
      />
      {/* 次元回廊解放ツールチップ */}
      <DimensionalCorridorTooltip
        visible={showDimensionalCorridorTooltip}
        onDismiss={() => setShowDimensionalCorridorTooltip(false)}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.resultHeader}>
          <Text
            style={[
              styles.resultText,
              isCleared ? styles.clearedText : isRetreat ? styles.retreatText : styles.defeatText,
            ]}
            testID="result-status-text"
          >
            {isCleared ? t('result.cleared') : isRetreat ? t('result.retreat') : t('result.defeat')}
          </Text>
          {isMultiRun && (
            <Text style={styles.runCountText}>{t('result.runsCompleted', { count: runCount })}</Text>
          )}
        </View>

        <View style={styles.dungeonInfo}>
          <Text style={styles.dungeonName}>{t(`dungeons.${params.dungeonId}.name`)}</Text>
          <Text style={styles.floorProgress}>
            {t('result.floorsCleared', { current: floorsCleared, max: maxFloor })}
          </Text>
        </View>

        <View style={styles.rewardsSection}>

          {/* 累計経験値 */}
          <View style={styles.rewardItem}>
            <Text style={styles.rewardLabel}>
              {isMultiRun ? t('result.totalExp') : t('result.exp')}
            </Text>
            <Text style={styles.rewardValue}>+{grandTotalExp} EXP</Text>
          </View>

          {/* 累計アイテム */}
          {grandTotalItems.length > 0 && (
            <View style={styles.itemsSection}>
              <Text style={styles.itemsTitle}>
                {isMultiRun ? t('result.totalItems', { count: grandTotalItems.length }) : t('result.items')}
              </Text>
              <ScrollView
                style={styles.itemsScrollView}
                nestedScrollEnabled={true}
              >
                {grandTotalItems.map((item, index) => (
                  <View key={`${item.id}-${index}`} style={styles.itemRow}>
                    <Text style={styles.itemName}>{t(`items.${item.id}.name`)}</Text>
                    <Text style={styles.itemStats}>
                      {item.atk > 0 ? `ATK+${item.atk} ` : ''}
                      {item.def > 0 ? `DEF+${item.def}` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {grandTotalItems.length === 0 && (
            <View style={styles.noItems}>
              <Text style={styles.noItemsText}>{t('result.noItems')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          onPress={handleReturn}
          testID="result-return-button"
        >
          <Ionicons name="home" size={ms(28)} color="#fff" />
        </Pressable>
        <View style={styles.repeatContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              repeatDisabled && styles.iconButtonDisabled,
              pressed && !repeatDisabled && styles.iconButtonPressed,
            ]}
            onPress={handleRepeat}
            disabled={repeatDisabled}
            testID="result-repeat-button"
          >
            <Ionicons name="reload" size={ms(28)} color={repeatDisabled ? '#666' : '#fff'} />
          </Pressable>
          {isUberDungeon && uberTicketCount !== null && (
            <Text style={[styles.ticketText, repeatDisabled && styles.ticketTextDisabled]}>
              {t('common.ticket')} x{uberTicketCount}
            </Text>
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: ms(24),
    paddingTop: ms(8),
    paddingBottom: ms(8),
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: ms(4),
  },
  resultText: {
    fontSize: fs(28),
    fontWeight: 'bold',
  },
  clearedText: {
    color: '#FFD700',
  },
  defeatText: {
    color: '#F44336',
  },
  retreatText: {
    color: '#FF9800',
  },
  runCountText: {
    fontSize: fs(18),
    color: '#4CAF50',
    marginTop: ms(8),
    fontWeight: 'bold',
  },
  dungeonInfo: {
    alignItems: 'center',
    marginBottom: ms(8),
  },
  dungeonName: {
    fontSize: fs(20),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  floorProgress: {
    fontSize: fs(16),
    color: '#aaa',
  },
  rewardsSection: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(12),
  },
  sectionTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
    textAlign: 'center',
  },
  rewardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  rewardLabel: {
    fontSize: fs(16),
    color: '#aaa',
  },
  rewardValue: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  itemsSection: {
    flex: 1,
    marginTop: ms(8),
  },
  itemsTitle: {
    fontSize: fs(14),
    color: '#aaa',
    marginBottom: ms(8),
  },
  itemsScrollView: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(8),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(8),
    paddingHorizontal: ms(12),
    marginBottom: ms(4),
  },
  itemName: {
    fontSize: fs(14),
    color: '#fff',
    fontWeight: 'bold',
  },
  itemStats: {
    fontSize: fs(12),
    color: '#4CAF50',
  },
  noItems: {
    paddingVertical: ms(16),
    alignItems: 'center',
  },
  noItemsText: {
    fontSize: fs(14),
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(32),
    padding: ms(16),
    paddingBottom: ms(16),
  },
  iconButton: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.5,
  },
  iconButtonPressed: {
    opacity: 0.6,
  },
  repeatContainer: {
    alignItems: 'center',
    gap: ms(4),
  },
  ticketText: {
    fontSize: fs(11),
    color: '#aaa',
  },
  ticketTextDisabled: {
    color: '#666',
  },
});
