import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdBoostStore } from '@/stores/useAdBoostStore';
import { ms } from '@/utils/scaling';

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
          <MaterialCommunityIcons name="treasure-chest" size={16} color="#FFD700" />
        </View>
      )}
      {tierActive && (
        <View style={[styles.badge, styles.tierBadge]}>
          <MaterialCommunityIcons name="star-four-points" size={16} color="#FF69B4" />
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
    alignItems: 'center',
    justifyContent: 'center',
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
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
});
