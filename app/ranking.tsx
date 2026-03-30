import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/common/Button';
import { RankingList } from '@/components/ranking/RankingList';
import { getRankings, isCacheValid, getCacheRemainingTime } from '@/lib/rankingCache';
import { getDeviceId, RankingEntryWithRank } from '@/lib/firestore';
import { getCurrentSeason } from '@/lib/rankingSeason';
import { ms, fs } from '@/utils/scaling';

export default function RankingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [rankings, setRankings] = useState<RankingEntryWithRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | undefined>();
  const [cacheInfo, setCacheInfo] = useState<string>('');

  const loadRankings = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getRankings(forceRefresh);
      setRankings(data);
      updateCacheInfo();
    } catch (err) {
      console.error('[Ranking] Failed to load:', err);
      setError(t('ranking.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const updateCacheInfo = () => {
    if (isCacheValid()) {
      const remaining = getCacheRemainingTime();
      const minutes = Math.ceil(remaining / 60000);
      setCacheInfo(t('ranking.cacheInfo', { minutes }));
    } else {
      setCacheInfo('');
    }
  };

  // 画面フォーカス時にランキングを取得
  useFocusEffect(
    useCallback(() => {
      loadRankings();
      getDeviceId().then(setMyDeviceId);
    }, [loadRankings])
  );

  // キャッシュ情報を定期更新
  useEffect(() => {
    const interval = setInterval(updateCacheInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleBack = () => {
    router.back();
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('ranking.title')}</Text>
          <Text style={styles.subtitle}>
            {t('ranking.dimensionalCorridor')}
            {getCurrentSeason() > 1 && ` - ${t('ranking.season', { season: getCurrentSeason() })}`}
          </Text>
          {cacheInfo && <Text style={styles.cacheInfo}>{cacheInfo}</Text>}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4FC3F7" />
              <Text style={styles.loadingText}>{t('ranking.loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={ms(48)} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => loadRankings(true)} style={styles.retryButton}>
                <Text style={styles.retryText}>{t('ranking.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <RankingList rankings={rankings} myDeviceId={myDeviceId} />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title={t('common.back')}
            onPress={handleBack}
            variant="secondary"
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
  },
  title: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: fs(14),
    color: '#aaa',
    marginTop: ms(4),
  },
  cacheInfo: {
    fontSize: fs(10),
    color: '#666',
    marginTop: ms(8),
  },
  content: {
    flex: 1,
    paddingHorizontal: ms(16),
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fs(14),
    color: '#888',
    marginTop: ms(12),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(20),
  },
  errorText: {
    fontSize: fs(14),
    color: '#F44336',
    textAlign: 'center',
    marginTop: ms(12),
    marginBottom: ms(20),
  },
  retryButton: {
    backgroundColor: '#4FC3F7',
    paddingHorizontal: ms(24),
    paddingVertical: ms(12),
    borderRadius: ms(8),
  },
  retryText: {
    fontSize: fs(14),
    fontWeight: '600',
    color: '#000',
  },
});
