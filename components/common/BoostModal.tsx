import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { useAdState } from '@/hooks/useAdStore';
import { ms, fs } from '@/utils/scaling';
import i18n from '@/lib/i18n';

interface BoostModalProps {
  visible: boolean;
  onClose: () => void;
  type: AdBoostType;
}

const colors = {
  bg: '#1B2026',
  bgOverlay: 'rgba(0, 0, 0, 0.7)',
  card: '#232833',
  cardBorder: '#2A3037',
  text: '#C9CDD3',
  textMuted: '#8C929A',
  gold: '#FFD700',
  success: '#4CAF50',
  accent: '#3A4050',
};

const BOOST_CONFIG = {
  drop_rate: {
    icon: 'treasure-chest' as const,
    titleKey: 'boost.dropRate.title',
    descriptionKey: 'boost.dropRate.description',
  },
  tier_boost: {
    icon: 'star-four-points' as const,
    titleKey: 'boost.tierBoost.title',
    descriptionKey: 'boost.tierBoost.description',
  },
};

export const BoostModal = ({ visible, onClose, type }: BoostModalProps) => {
  const { dropRateBoost, tierBoost, checkExpiredBoosts } = useAdBoostStore();
  const { loaded, show } = useAdState(type);
  const [isShowing, setIsShowing] = useState(false);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;
  const config = BOOST_CONFIG[type];

  const getRemainingMinutes = useCallback((): number => {
    if (!boost.active || !boost.expiresAt) return 0;
    const remaining = Math.ceil((boost.expiresAt - Date.now()) / (60 * 1000));
    return Math.max(0, remaining);
  }, [boost.active, boost.expiresAt]);

  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingMinutes());

  // 残り時間の更新
  useEffect(() => {
    checkExpiredBoosts();

    if (!isActive) {
      setRemainingMinutes(0);
      return;
    }

    const interval = setInterval(() => {
      checkExpiredBoosts();
      setRemainingMinutes(getRemainingMinutes());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, boost.expiresAt, checkExpiredBoosts, getRemainingMinutes]);

  const handleShowAd = async () => {
    if (isShowing) return;

    setIsShowing(true);
    try {
      const success = await show();
      if (!success) {
        Alert.alert(i18n.t('boost.error'), i18n.t('boost.adShowFailed'));
      }
    } finally {
      setIsShowing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialCommunityIcons name={config.icon} size={24} color={colors.gold} />
            <Text style={styles.title}>{i18n.t(config.titleKey)}</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>{i18n.t(config.descriptionKey)}</Text>

            {isActive && (
              <View style={styles.activeStatus}>
                <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                <Text style={styles.activeText}>{i18n.t('boost.activeRemaining', { minutes: remainingMinutes })}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.adButton,
                isActive && styles.adButtonDisabled,
                !loaded && !isActive && styles.adButtonDisabled,
                pressed && !isActive && loaded && styles.adButtonPressed,
              ]}
              onPress={handleShowAd}
              disabled={isActive || !loaded || isShowing}
            >
              <MaterialCommunityIcons
                name="play-circle"
                size={20}
                color={isActive || !loaded ? colors.textMuted : colors.text}
              />
              <Text style={[styles.adButtonText, (isActive || !loaded) && styles.adButtonTextDisabled]}>
                {isActive ? i18n.t('boost.active') : isShowing ? i18n.t('boost.playing') : i18n.t('boost.watchAdToActivate')}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>{i18n.t('boost.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  container: {
    width: '100%',
    maxWidth: ms(320),
    backgroundColor: colors.bg,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    paddingVertical: ms(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    padding: ms(20),
    alignItems: 'center',
  },
  description: {
    fontSize: fs(14),
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: ms(16),
  },
  activeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    marginBottom: ms(16),
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: ms(8),
  },
  activeText: {
    fontSize: fs(14),
    color: colors.success,
    fontWeight: '600',
  },
  adButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.accent,
    paddingVertical: ms(12),
    paddingHorizontal: ms(24),
    borderRadius: ms(10),
    width: '100%',
  },
  adButtonPressed: {
    backgroundColor: '#4A5060',
  },
  adButtonDisabled: {
    backgroundColor: 'rgba(58, 64, 80, 0.5)',
  },
  adButtonText: {
    fontSize: fs(15),
    color: colors.text,
    fontWeight: '600',
  },
  adButtonTextDisabled: {
    color: colors.textMuted,
  },
  closeButton: {
    paddingVertical: ms(14),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    alignItems: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeButtonText: {
    fontSize: fs(15),
    color: colors.textMuted,
  },
});
