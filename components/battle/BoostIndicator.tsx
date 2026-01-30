import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdBoostStore } from '@/stores/useAdBoostStore';
import { ms, fs } from '@/utils/scaling';

export const BoostIndicator = () => {
  const { dropRateBoost, tierBoost, checkExpiredBoosts } = useAdBoostStore();

  // 定期的に期限切れチェック
  useEffect(() => {
    const interval = setInterval(() => {
      checkExpiredBoosts();
    }, 1000);

    return () => clearInterval(interval);
  }, [checkExpiredBoosts]);

  const dropActive = dropRateBoost.active;
  const tierActive = tierBoost.active;

  if (!dropActive && !tierActive) {
    return null; // ブーストがない場合は何も表示しない
  }

  return (
    <View style={styles.container}>
      {dropActive && (
        <View style={[styles.badge, styles.dropBadge]}>
          <MaterialCommunityIcons name="treasure-chest" size={14} color="#FFD700" />
          <Text style={styles.badgeText}>ドロップ率UP</Text>
        </View>
      )}
      {tierActive && (
        <View style={[styles.badge, styles.tierBadge]}>
          <MaterialCommunityIcons name="star-four-points" size={14} color="#FF69B4" />
          <Text style={styles.badgeText}>高品質UP</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: ms(6),
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: ms(12),
    gap: ms(4),
    borderWidth: 1,
  },
  dropBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  tierBadge: {
    backgroundColor: 'rgba(255, 105, 180, 0.15)',
    borderColor: 'rgba(255, 105, 180, 0.4)',
  },
  badgeText: {
    fontSize: fs(11),
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
