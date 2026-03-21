import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { badgeRepository, BadgeRecord } from '@/db/repositories/badgeRepository';
import { BADGES, BadgeDefinition } from '@/data/badges';
import { usePlayerStore } from '@/stores/usePlayerStore';
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

export const BadgeList = () => {
  const { t } = useTranslation();
  const characterId = usePlayerStore(s => s.characterId);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set());

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

  if (BADGES.length === 0) return null;

  const earned = BADGES.filter(b => earnedBadgeIds.has(b.id));
  const notEarned = BADGES.filter(b => !earnedBadgeIds.has(b.id));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('badges.title')} ({earned.length}/{BADGES.length})</Text>
      <View style={styles.badgeGrid}>
        {BADGES.map(badge => {
          const isEarned = earnedBadgeIds.has(badge.id);
          return (
            <View key={badge.id} style={[styles.badgeItem, !isEarned && styles.badgeItemLocked]}>
              <Text style={[styles.badgeIcon, !isEarned && styles.badgeIconLocked]}>
                {BADGE_ICONS[badge.icon] ?? '?'}
              </Text>
              <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]} numberOfLines={1}>
                {t(badge.nameKey)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: ms(12),
  },
  title: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(6),
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: ms(8),
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  badgeItemLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  badgeIcon: {
    fontSize: fs(14),
    marginRight: ms(4),
  },
  badgeIconLocked: {
    opacity: 0.3,
  },
  badgeName: {
    fontSize: fs(11),
    color: '#FFD700',
    fontWeight: '600',
  },
  badgeNameLocked: {
    color: '#666',
  },
});
