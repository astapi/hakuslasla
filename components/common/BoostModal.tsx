import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { ms, fs } from '@/utils/scaling';

interface BoostModalProps {
  visible: boolean;
  onClose: () => void;
  type: AdBoostType;
}

const AD_UNIT_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

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
    title: 'ドロップ率UP',
    description: '30分間ドロップ率1.5倍、ユニーク+1%',
  },
  tier_boost: {
    icon: 'star-four-points' as const,
    title: '上位Tier確率UP',
    description: '30分間高品質アイテムの出現率UP',
  },
};

export const BoostModal = ({ visible, onClose, type }: BoostModalProps) => {
  const {
    dropRateBoost,
    tierBoost,
    activateDropRateBoost,
    activateTierBoost,
    checkExpiredBoosts,
  } = useAdBoostStore();

  const [adLoaded, setAdLoaded] = useState(false);
  const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;
  const config = BOOST_CONFIG[type];

  const getRemainingMinutes = (): number => {
    if (!boost.active || !boost.expiresAt) return 0;
    const remaining = Math.ceil((boost.expiresAt - Date.now()) / (60 * 1000));
    return Math.max(0, remaining);
  };

  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingMinutes());

  // 広告の初期化
  useEffect(() => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedListener = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setAdLoaded(true);
    });

    const earnedListener = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      if (type === 'drop_rate') {
        activateDropRateBoost();
      } else {
        activateTierBoost();
      }
      setAdLoaded(false);
      ad.load();
    });

    ad.load();
    setRewardedAd(ad);

    return () => {
      loadedListener();
      earnedListener();
    };
  }, [type, activateDropRateBoost, activateTierBoost]);

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
  }, [isActive, boost.expiresAt, checkExpiredBoosts]);

  const handleShowAd = () => {
    if (!rewardedAd || !adLoaded) {
      Alert.alert('エラー', '広告の準備ができていません。しばらくお待ちください。');
      return;
    }
    rewardedAd.show();
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
            <Text style={styles.title}>{config.title}</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>{config.description}</Text>

            {isActive && (
              <View style={styles.activeStatus}>
                <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                <Text style={styles.activeText}>有効中: 残り{remainingMinutes}分</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.adButton,
                isActive && styles.adButtonDisabled,
                !adLoaded && !isActive && styles.adButtonLoading,
                pressed && !isActive && adLoaded && styles.adButtonPressed,
              ]}
              onPress={handleShowAd}
              disabled={isActive || !adLoaded}
            >
              <MaterialCommunityIcons
                name="play-circle"
                size={20}
                color={isActive ? colors.textMuted : colors.text}
              />
              <Text style={[styles.adButtonText, isActive && styles.adButtonTextDisabled]}>
                {isActive ? '有効中' : !adLoaded ? '読み込み中...' : '広告を見て有効化'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>閉じる</Text>
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
  adButtonLoading: {
    backgroundColor: 'rgba(58, 64, 80, 0.7)',
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
