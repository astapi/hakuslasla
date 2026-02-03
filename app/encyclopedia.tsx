import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { useEncyclopediaStore } from '@/stores/useEncyclopediaStore';
import { ms, fs } from '@/utils/scaling';

export default function EncyclopediaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const clearedDungeons = useEncyclopediaStore((state) => state.clearedDungeons);
  const loadClearedDungeons = useEncyclopediaStore((state) => state.loadClearedDungeons);

  // 安全策: データが空の場合は自動的にロード（開発時のホットリロードやディープリンク対策）
  useEffect(() => {
    if (clearedDungeons.length === 0) {
      loadClearedDungeons();
    }
  }, [clearedDungeons.length, loadClearedDungeons]);

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

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('encyclopedia.title')}</Text>
        <Text style={styles.subtitle}>{t('encyclopedia.subtitle')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {clearedDungeons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('encyclopedia.noClearedDungeons')}</Text>
          </View>
        ) : (
          <View style={styles.dungeonList}>
            {clearedDungeons.map((dungeon) => (
              <Pressable
                key={dungeon.id}
                style={({ pressed }) => [
                  styles.dungeonCard,
                  pressed && styles.dungeonCardPressed,
                ]}
                onPress={() => handleDungeonPress(dungeon.id)}
              >
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>{dungeon.maxFloor}F</Text>
                </View>
                <View style={styles.infoContainer}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{t(`dungeons.${dungeon.id}.name`)}</Text>
                    <Text style={styles.clearMark}>✓</Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {t(`dungeons.${dungeon.id}.description`)}
                  </Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>
                      {t('encyclopedia.bestFloor', { floor: dungeon.bestFloor })}
                    </Text>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.statsText}>
                      {t('encyclopedia.clearedAt', { date: formatDate(dungeon.clearedAt) })}
                    </Text>
                  </View>
                </View>
                <View style={styles.arrowContainer}>
                  <Text style={styles.arrow}>→</Text>
                </View>
              </Pressable>
            ))}
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
  arrowContainer: {
    paddingLeft: ms(12),
    width: ms(30),
  },
  arrow: {
    fontSize: fs(24),
    color: '#fff',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
