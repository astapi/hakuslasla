import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { Button } from './Button';
import { ms, fs } from '@/utils/scaling';
import i18n from '@/lib/i18n';

interface RewardAdBoostProps {
  type: AdBoostType;
}

// 広告ユニットID
const AD_UNIT_IDS = {
  drop_rate: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/9679992270',
  tier_boost: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/8366910606',
};

export const RewardAdBoost = ({ type }: RewardAdBoostProps) => {
  const { dropRateBoost, tierBoost, activateDropRateBoost, activateTierBoost, checkExpiredBoosts } = useAdBoostStore();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;
  const expiresAt = boost.expiresAt;

  // 残り時間を計算（分）
  const getRemainingMinutes = useCallback((): number => {
    if (!isActive || !expiresAt) return 0;
    const remaining = Math.max(0, expiresAt - Date.now());
    return Math.ceil(remaining / (60 * 1000));
  }, [isActive, expiresAt]);

  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingMinutes());

  // 広告のロード関数
  const loadAd = useCallback(() => {
    setAdError(null);
    setAdLoaded(false);

    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS[type], {
      requestNonPersonalizedAdsOnly: true,
    });

    // 広告ロード完了イベント
    const loadedListener = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setAdLoaded(true);
      setAdError(null);
    });

    // エラーイベント
    const errorListener = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('Ad failed to load:', error);
      setAdLoaded(false);
      setAdError(i18n.t('boost.adLoadFailed'));
    });

    // 報酬獲得イベント
    const earnedListener = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      // ブーストを有効化
      if (type === 'drop_rate') {
        activateDropRateBoost();
      } else {
        activateTierBoost();
      }
      setAdLoaded(false);
      // 次の広告をロード
      setTimeout(() => loadAd(), 1000);
    });

    // 広告をロード
    ad.load();
    setRewardedAd(ad);

    return () => {
      loadedListener();
      errorListener();
      earnedListener();
    };
  }, [type, activateDropRateBoost, activateTierBoost]);

  // 広告の初期化とロード
  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, [loadAd]);

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
  }, [isActive, expiresAt, checkExpiredBoosts, getRemainingMinutes]);

  const handleShowAd = () => {
    if (!rewardedAd || !adLoaded) {
      Alert.alert(i18n.t('boost.error'), i18n.t('boost.adNotReady'));
      return;
    }

    rewardedAd.show();
  };

  const getBoostTitle = () => {
    return type === 'drop_rate' ? i18n.t('boost.dropRate.title') : i18n.t('boost.tierBoost.title');
  };

  const getBoostDescription = () => {
    if (type === 'drop_rate') {
      return i18n.t('boost.dropRate.longDescription');
    } else {
      return i18n.t('boost.tierBoost.longDescription');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getBoostTitle()}</Text>
        {isActive && (
          <Text style={styles.activeLabel}>{i18n.t('boost.activeRemaining', { minutes: remainingMinutes })}</Text>
        )}
      </View>
      <Text style={styles.description}>{getBoostDescription()}</Text>
      <Text style={styles.duration}>{i18n.t('boost.duration')}</Text>

      <Button
        title={isActive ? i18n.t('boost.active') : i18n.t('boost.watchAdToActivate')}
        onPress={handleShowAd}
        disabled={isActive || !adLoaded}
        variant={isActive ? 'secondary' : 'primary'}
        style={styles.button}
      />

      {!adLoaded && !isActive && !adError && (
        <Text style={styles.loadingText}>{i18n.t('boost.loadingAd')}</Text>
      )}

      {adError && !isActive && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{adError}</Text>
          <Button
            title={i18n.t('boost.retry')}
            onPress={loadAd}
            variant="secondary"
            style={styles.retryButton}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
    marginBottom: ms(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  title: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#FFD700',
  },
  activeLabel: {
    fontSize: fs(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  description: {
    fontSize: fs(14),
    color: '#fff',
    marginBottom: ms(8),
    lineHeight: fs(20),
  },
  duration: {
    fontSize: fs(12),
    color: '#aaa',
    marginBottom: ms(12),
  },
  button: {
    marginTop: ms(8),
  },
  loadingText: {
    fontSize: fs(12),
    color: '#888',
    textAlign: 'center',
    marginTop: ms(8),
  },
  errorContainer: {
    marginTop: ms(8),
    alignItems: 'center',
  },
  errorText: {
    fontSize: fs(12),
    color: '#F44336',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  retryButton: {
    paddingHorizontal: ms(16),
  },
});
