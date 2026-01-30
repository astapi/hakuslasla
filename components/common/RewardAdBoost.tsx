import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { Button } from './Button';
import { ms, fs } from '@/utils/scaling';

interface RewardAdBoostProps {
  type: AdBoostType;
}

// テスト用広告ユニットID（開発環境）
// 本番環境では実際のIDに置き換える必要があります
const AD_UNIT_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

export const RewardAdBoost = ({ type }: RewardAdBoostProps) => {
  const { dropRateBoost, tierBoost, activateDropRateBoost, activateTierBoost, checkExpiredBoosts } = useAdBoostStore();
  const [adLoaded, setAdLoaded] = useState(false);
  const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;
  const expiresAt = boost.expiresAt;

  // 残り時間を計算（分）
  const getRemainingMinutes = (): number => {
    if (!isActive || !expiresAt) return 0;
    const remaining = Math.max(0, expiresAt - Date.now());
    return Math.ceil(remaining / (60 * 1000));
  };

  const [remainingMinutes, setRemainingMinutes] = useState(getRemainingMinutes());

  // 広告の初期化とロード
  useEffect(() => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    // 広告ロード完了イベント
    const loadedListener = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setAdLoaded(true);
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
    });

    // 広告をロード
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
  }, [isActive, expiresAt, checkExpiredBoosts]);

  const handleShowAd = () => {
    if (!rewardedAd || !adLoaded) {
      Alert.alert('エラー', '広告の準備ができていません。しばらく待ってからもう一度お試しください。');
      return;
    }

    rewardedAd.show();
  };

  const getBoostTitle = () => {
    return type === 'drop_rate' ? 'ドロップ率UP' : '上位Tier確率UP';
  };

  const getBoostDescription = () => {
    if (type === 'drop_rate') {
      return 'ユニークドロップ率+1%\nアイテムドロップ確率1.5倍';
    } else {
      return '高品質Tier(T1-T3)の出現確率UP\n通常はT4,5が最も出やすい';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getBoostTitle()}</Text>
        {isActive && (
          <Text style={styles.activeLabel}>有効中: 残り{remainingMinutes}分</Text>
        )}
      </View>
      <Text style={styles.description}>{getBoostDescription()}</Text>
      <Text style={styles.duration}>効果時間: 30分</Text>

      <Button
        title={isActive ? '有効中' : '広告を見て有効化'}
        onPress={handleShowAd}
        disabled={isActive || !adLoaded}
        variant={isActive ? 'secondary' : 'primary'}
        style={styles.button}
      />

      {!adLoaded && !isActive && (
        <Text style={styles.loadingText}>広告を読み込み中...</Text>
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
});
