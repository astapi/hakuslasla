import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { useEncyclopediaStore } from '@/stores/useEncyclopediaStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { BADGES } from '@/data/badges';
import { badgeRepository } from '@/db/repositories/badgeRepository';
import { ms, fs } from '@/utils/scaling';

const BADGE_ICONS: Record<string, string> = {
  crown: '\u{1F451}',
  knife: '\u{1F5E1}',
  sun: '\u{2600}',
  anchor: '\u{2693}',
  fire: '\u{1F525}',
  star: '\u{2B50}',
  infinity: '\u{267E}',
  trophy: '\u{1F3C6}',
};

type Tab = 'dungeons' | 'badges';

export default function EncyclopediaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('dungeons');
  const dungeons = useEncyclopediaStore((state) => state.dungeons);
  const loadDungeons = useEncyclopediaStore((state) => state.loadDungeons);
  const characterId = usePlayerStore(s => s.characterId);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());

  // 安全策: データが空の場合は自動的にロード（開発時のホットリロードやディープリンク対策）
  useEffect(() => {
    if (dungeons.length === 0) {
      loadDungeons();
    }
  }, [dungeons.length, loadDungeons]);

  const loadBadges = useCallback(async () => {
    if (!characterId) return;
    const badges = await badgeRepository.getBadges(characterId);
    setEarnedBadgeIds(new Set(badges.map(b => b.badgeId)));
  }, [characterId]);

  useFocusEffect(
    useCallback(() => {
      loadBadges();
    }, [loadBadges])
  );

  const handleDungeonPress = (dungeonId: string) => {
    router.push(`/encyclopedia-detail/${dungeonId}` as any);
  };

  const handleBack = () => {
    router.back();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const earnedCount = BADGES.filter(b => earnedBadgeIds.has(b.id)).length;

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('encyclopedia.title')}</Text>
        <Text style={styles.subtitle}>{t('encyclopedia.subtitle')}</Text>
      </View>

      {/* セグメント切替 */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentTab, activeTab === 'dungeons' && styles.segmentTabActive]}
          onPress={() => setActiveTab('dungeons')}
        >
          <Text style={[styles.segmentText, activeTab === 'dungeons' && styles.segmentTextActive]}>
            {t('encyclopedia.tabDungeons')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentTab, activeTab === 'badges' && styles.segmentTabActive]}
          onPress={() => setActiveTab('badges')}
        >
          <Text style={[styles.segmentText, activeTab === 'badges' && styles.segmentTextActive]}>
            {t('encyclopedia.tabBadges')} ({earnedCount}/{BADGES.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'dungeons' ? (
          /* ダンジョンタブ */
          dungeons.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('encyclopedia.noClearedDungeons')}</Text>
            </View>
          ) : (
            <View style={styles.dungeonList}>
              {dungeons.map((dungeon) => (
                <Pressable
                  key={dungeon.id}
                  style={({ pressed }) => [
                    styles.dungeonCard,
                    !dungeon.isCleared && styles.dungeonCardNotCleared,
                    pressed && styles.dungeonCardPressed,
                  ]}
                  onPress={() => handleDungeonPress(dungeon.id)}
                >
                  <View style={[
                    styles.iconContainer,
                    !dungeon.isCleared && styles.iconContainerNotCleared,
                  ]}>
                    <Text style={styles.icon}>{dungeon.maxFloor}F</Text>
                  </View>
                  <View style={styles.infoContainer}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{t(`dungeons.${dungeon.id}.name`)}</Text>
                      {dungeon.isCleared ? (
                        <Text style={styles.clearMark}>✓</Text>
                      ) : (
                        <Text style={styles.notClearedMark}>{t('encyclopedia.notCleared')}</Text>
                      )}
                    </View>
                    <Text style={styles.description} numberOfLines={2}>
                      {t(`dungeons.${dungeon.id}.description`)}
                    </Text>
                    <View style={styles.statsRow}>
                      {dungeon.isCleared ? (
                        <>
                          <Text style={styles.statsText}>
                            {t('encyclopedia.bestFloor', { floor: dungeon.bestFloor })}
                          </Text>
                          <Text style={styles.separator}>•</Text>
                          <Text style={styles.statsText}>
                            {t('encyclopedia.clearedAt', { date: formatDate(dungeon.clearedAt!) })}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.uberUnlockedText}>{t('encyclopedia.uberUnlocked')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.arrowContainer}>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : (
          /* バッジタブ */
          <View style={styles.badgeList}>
            {BADGES.map(badge => {
              const isEarned = earnedBadgeIds.has(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIconContainer, !isEarned && styles.badgeIconContainerLocked]}>
                    <Text style={[styles.badgeIconText, !isEarned && styles.badgeIconTextLocked]}>
                      {BADGE_ICONS[badge.icon] ?? '?'}
                    </Text>
                  </View>
                  <View style={styles.badgeInfo}>
                    <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}>
                      {t(badge.nameKey)}
                    </Text>
                    <Text style={[styles.badgeDescription, !isEarned && styles.badgeDescriptionLocked]}>
                      {t(badge.descriptionKey)}
                    </Text>
                  </View>
                  {isEarned && (
                    <Text style={styles.badgeEarnedMark}>✓</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(16),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
    paddingTop: 0,
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
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: ms(16),
    marginBottom: ms(12),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(8),
    padding: ms(3),
  },
  segmentTab: {
    flex: 1,
    paddingVertical: ms(8),
    alignItems: 'center',
    borderRadius: ms(6),
  },
  segmentTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  segmentText: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#888',
  },
  segmentTextActive: {
    color: '#fff',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: ms(400),
    paddingVertical: ms(80),
  },
  emptyText: {
    fontSize: fs(16),
    color: '#888',
    textAlign: 'center',
  },
  dungeonList: {
    gap: ms(12),
  },
  dungeonCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
    alignItems: 'center',
  },
  dungeonCardNotCleared: {
    backgroundColor: 'rgba(147, 112, 219, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(147, 112, 219, 0.3)',
  },
  dungeonCardPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  iconContainer: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(30),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(16),
  },
  iconContainerNotCleared: {
    backgroundColor: 'rgba(147, 112, 219, 0.3)',
  },
  icon: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  name: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  clearMark: {
    fontSize: fs(18),
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: ms(8),
  },
  notClearedMark: {
    fontSize: fs(11),
    color: '#9370DB',
    fontWeight: 'bold',
    marginLeft: ms(8),
    backgroundColor: 'rgba(147, 112, 219, 0.2)',
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderRadius: ms(4),
  },
  description: {
    fontSize: fs(12),
    color: '#aaa',
    marginBottom: ms(8),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  statsText: {
    fontSize: fs(11),
    color: '#888',
  },
  separator: {
    fontSize: fs(11),
    color: '#666',
  },
  uberUnlockedText: {
    fontSize: fs(11),
    color: '#9370DB',
    fontStyle: 'italic',
  },
  arrowContainer: {
    paddingLeft: ms(12),
    width: ms(30),
  },
  arrow: {
    fontSize: fs(24),
    color: '#fff',
  },
  badgeList: {
    gap: ms(10),
  },
  badgeCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: ms(12),
    padding: ms(14),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  badgeCardLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    borderColor: 'rgba(128, 128, 128, 0.15)',
  },
  badgeIconContainer: {
    width: ms(48),
    height: ms(48),
    borderRadius: ms(24),
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(14),
  },
  badgeIconContainerLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  badgeIconText: {
    fontSize: fs(22),
  },
  badgeIconTextLocked: {
    opacity: 0.3,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: fs(15),
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: ms(3),
  },
  badgeNameLocked: {
    color: '#666',
  },
  badgeDescription: {
    fontSize: fs(12),
    color: '#ccc',
  },
  badgeDescriptionLocked: {
    color: '#555',
  },
  badgeEarnedMark: {
    fontSize: fs(18),
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: ms(8),
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
