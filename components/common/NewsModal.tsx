import { View, Text, StyleSheet, Modal, Pressable, FlatList, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ms, fs } from '@/utils/scaling';
import { RssItem } from '@/lib/rss';

type Props = {
  visible: boolean;
  items: RssItem[];
  onClose: () => void;
};

function formatDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (isNaN(date.getTime())) return pubDate;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function NewsModal({ visible, items, onClose }: Props) {
  const { t } = useTranslation();

  const handlePressItem = (link: string) => {
    Linking.openURL(link);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.accent} />
            <Text style={styles.title}>{t('news.modalTitle')}</Text>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.link}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => handlePressItem(item.link)}
              >
                <View style={styles.itemContent}>
                  <Text style={styles.itemDate}>{formatDate(item.pubDate)}</Text>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          />

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const colors = {
  bg: '#15191E',
  slab: '#1B2026',
  slabEdge: '#2A3037',
  accent: '#FFD700',
  text: '#C9CDD3',
  textMuted: '#8C929A',
  bgDeep: '#101418',
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  content: {
    width: '100%',
    maxWidth: ms(360),
    maxHeight: '70%',
    backgroundColor: colors.slab,
    borderRadius: ms(16),
    padding: ms(20),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginBottom: ms(16),
  },
  title: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  list: {
    flexGrow: 0,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(12),
    paddingHorizontal: ms(4),
    gap: ms(8),
  },
  itemPressed: {
    backgroundColor: 'rgba(35, 40, 51, 0.6)',
    borderRadius: ms(8),
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
  closeButton: {
    marginTop: ms(16),
    paddingVertical: ms(12),
    borderRadius: ms(8),
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  closeText: {
    fontSize: fs(14),
    color: colors.textMuted,
  },
});
