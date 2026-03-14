import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { Button } from '@/components/common/Button';
import { fetchRssItems, filterItemsByLocale, RssItem } from '@/lib/rss';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { ms, fs } from '@/utils/scaling';

function formatDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return pubDate;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    setError(false);
    try {
      const allItems = await fetchRssItems();
      const rssItems = filterItemsByLocale(allItems, i18n.language);
      setItems(rssItems);
      // 一覧を開いた時点で既読にする
      if (rssItems.length > 0) {
        const latestDate = rssItems
          .map((item) => new Date(item.pubDate).getTime())
          .reduce((a, b) => Math.max(a, b), 0);
        await settingsRepository.setNewsLastReadDate(new Date(latestDate).toISOString());
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('news.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('news.fetchError')}</Text>
          <Pressable style={styles.retryButton} onPress={loadNews}>
            <Text style={styles.retryText}>{t('news.retry')}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('news.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.link}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => Linking.openURL(item.link)}
            >
              <View style={styles.itemContent}>
                <Text style={styles.itemDate}>{formatDate(item.pubDate)}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

const colors = {
  bg: '#15191E',
  slab: '#1B2026',
  slabEdge: '#2A3037',
  text: '#C9CDD3',
  textMuted: '#8C929A',
  bgDeep: '#101418',
  accent: '#FFD700',
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(8),
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(12),
  },
  errorText: {
    color: colors.textMuted,
    fontSize: fs(14),
  },
  retryButton: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(8),
    backgroundColor: colors.slab,
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  retryText: {
    color: colors.text,
    fontSize: fs(13),
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fs(14),
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: ms(16),
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(14),
    paddingHorizontal: ms(8),
    gap: ms(8),
    borderRadius: ms(8),
  },
  itemPressed: {
    backgroundColor: 'rgba(35, 40, 51, 0.6)',
  },
  itemContent: {
    flex: 1,
    gap: ms(4),
  },
  itemDate: {
    fontSize: fs(11),
    color: colors.textMuted,
  },
  itemTitle: {
    fontSize: fs(14),
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
