import { useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentList } from '@/components/player/EquipmentList';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { BoostIconButton } from '@/components/common/BoostIconButton';
import { BoostTooltip } from '@/components/common/BoostTooltip';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useEncyclopediaStore } from '@/stores/useEncyclopediaStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import { useAdState } from '@/hooks/useAdStore';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { ENTITLEMENT_IDS } from '@/constants/purchases';
import { characterImages } from '@/data/images';
import { NewsModal } from '@/components/common/NewsModal';
import { fetchRssItems, filterItemsByLocale, RssItem } from '@/lib/rss';
import { ms, fs, isTablet } from '@/utils/scaling';

// タブレット用スケーリング
const tabIconSize = isTablet ? 32 : 24;
const tabLabelSize = isTablet ? 13 : 10;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { skillPoints, characterName, characterType, isLoaded, clear, renameCharacter } = usePlayerStore();
  const loadEncyclopediaData = useEncyclopediaStore((state) => state.loadClearedDungeons);
  const [statusExpanded, setStatusExpanded] = useState(false);

  // 画面フォーカス時に再レンダリングをトリガーするためのキー
  const [focusKey, setFocusKey] = useState(0);

  // キャラクター名変更モーダル
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  // お知らせモーダルの状態
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsItems, setNewsItems] = useState<RssItem[]>([]);

  // ブーストツールチップの状態
  const [showBoostTooltip, setShowBoostTooltip] = useState(false);
  const hasPermanentBoost = usePurchaseStore((state) =>
    state.hasEntitlement(ENTITLEMENT_IDS.PERMANENT_BOOST)
  );
  const { loaded: dropRateAdLoaded } = useAdState('drop_rate');
  const { loaded: tierBoostAdLoaded } = useAdState('tier_boost');
  const anyAdLoaded = dropRateAdLoaded || tierBoostAdLoaded;

  // 新着お知らせチェック
  useEffect(() => {
    const checkNews = async () => {
      try {
        const allItems = await fetchRssItems();
        const items = filterItemsByLocale(allItems, i18n.language);
        if (items.length === 0) return;
        const lastRead = await settingsRepository.getNewsLastReadDate();
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
        const unreadItems = items.filter(
          (item) => new Date(item.pubDate).getTime() > lastReadTime
        );
        if (unreadItems.length > 0) {
          setNewsItems(unreadItems.slice(0, 5));
          setShowNewsModal(true);
        }
      } catch {
        // お知らせ取得失敗は無視
      }
    };
    checkNews();
  }, []);

  const handleCloseNewsModal = async () => {
    setShowNewsModal(false);
    if (newsItems.length > 0) {
      const latestDate = newsItems
        .map((item) => new Date(item.pubDate).getTime())
        .reduce((a, b) => Math.max(a, b), 0);
      await settingsRepository.setNewsLastReadDate(new Date(latestDate).toISOString());
    }
  };

  // 初回表示のツールチップチェック
  useEffect(() => {
    const checkTooltip = async () => {
      // 永久ブースト購入済みの場合は表示しない
      if (hasPermanentBoost) return;
      // 広告がロードされていない場合は表示しない
      if (!anyAdLoaded) return;

      const alreadyShown = await settingsRepository.hasBoostTooltipBeenShown();
      if (!alreadyShown) {
        setShowBoostTooltip(true);
      }
    };
    checkTooltip();
  }, [hasPermanentBoost, anyAdLoaded]);

  // カスタムヘッダーを設定
  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[headerStyles.header, { paddingTop: insets.top + ms(8) }]}>
          <View style={headerStyles.boostButtons}>
            <BoostIconButton type="drop_rate" />
            <BoostIconButton type="tier_boost" />
          </View>
          <View style={headerStyles.spacer} />
        </View>
      ),
    });
  }, [navigation, t, insets.top]);

  useFocusEffect(
    useCallback(() => {
      // 画面がフォーカスされたときにキーを更新して子コンポーネントを再レンダリング
      setFocusKey(prev => prev + 1);
      // 図鑑データも更新（ダンジョンクリア後に最新データを反映）
      loadEncyclopediaData();
    }, [loadEncyclopediaData])
  );

  const handleOpenSkills = () => {
    router.push('/skills');
  };

  const handleOpenUberTree = () => {
    router.push('/uber-tree' as any);
  };

  const handleOpenInventory = () => {
    router.push('/inventory');
  };

  const handleOpenStorage = () => {
    router.push('/storage');
  };

  const handleOpenSettings = () => {
    router.push('/settings');
  };

  const handleOpenShop = () => {
    router.push('/shop');
  };

  const handleOpenEncyclopedia = async () => {
    // 画面遷移前にデータを取得
    await loadEncyclopediaData();
    router.push('/encyclopedia');
  };

  const handleOpenDungeonSelect = () => {
    router.push('/dungeon-select');
  };

  const handleChangeCharacter = () => {
    clear();
    router.replace('/');
  };

  const handleOpenDebug = () => {
    router.push('/debug' as '/home');
  };

  const handleOpenRenameModal = () => {
    setNewName(characterName);
    setIsRenameModalVisible(true);
  };

  const handleSaveRename = async () => {
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== characterName) {
      await renameCharacter(trimmedName);
    }
    setIsRenameModalVisible(false);
  };

  if (!isLoaded) {
    return (
      <ScreenWrapper>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      edges={['left', 'right']}
      style={styles.container}
      backgroundColor={colors.bg}
    >
      {/* ブーストツールチップ */}
      <BoostTooltip
        visible={showBoostTooltip}
        onDismiss={() => setShowBoostTooltip(false)}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.characterCard}>
          <View style={styles.characterSection}>
            {!statusExpanded && (
              <Image
                source={characterImages[characterType].standing}
                style={[styles.characterImage, characterImages[characterType].standingScale ? { transform: [{ scale: characterImages[characterType].standingScale! }] } : undefined]}
                resizeMode="contain"
              />
            )}
            <View style={[styles.characterInfo, statusExpanded && styles.characterInfoExpanded]}>
              <View style={styles.characterHeader}>
                <Pressable onPress={handleOpenRenameModal}>
                  <Text style={styles.characterName}>{characterName}</Text>
                </Pressable>
                <View style={styles.headerButtons}>
                  {__DEV__ && (
                    <Pressable style={styles.debugButton} onPress={handleOpenDebug}>
                      <MaterialCommunityIcons name="flask" size={16} color={colors.iconMuted} />
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.changeButton}
                    onPress={handleChangeCharacter}
                    testID="home-change-character"
                  >
                    <Text style={styles.changeButtonText}>{t('common.change')}</Text>
                  </Pressable>
                </View>
              </View>
              <StatusPanel
                key={`status-${focusKey}`}
                onDetailsChange={setStatusExpanded}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <EquipmentList key={`equipment-${focusKey}`} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.adventureCta}>
        <Pressable
          style={({ pressed }) => [styles.adventureButton, pressed && styles.adventureButtonPressed]}
          onPress={handleOpenDungeonSelect}
          testID="home-adventure-button"
        >
          <MaterialCommunityIcons name="castle" size={20} color={colors.text} />
          <Text style={styles.adventureLabel}>{t('home.menu.adventure')}</Text>
        </Pressable>
      </View>

      {/* 下部メニューバー */}
      <View style={styles.bottomMenu}>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenSkills}
          testID="home-menu-skills"
        >
          <View style={styles.menuIconContainer}>
            {skillPoints > 0 && <View style={styles.menuIconRing} />}
            <MaterialCommunityIcons
              name="star-four-points"
              size={tabIconSize}
              color={skillPoints > 0 ? colors.icon : colors.iconMuted}
            />
            {skillPoints > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{skillPoints}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.menuLabel, skillPoints > 0 && styles.menuLabelHighlight]}>{t('home.menu.skills')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenUberTree}
          testID="home-menu-uber-tree"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="star-shooting" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.uberTree')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenInventory}
          testID="home-menu-inventory"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="bag-personal" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.inventory')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenStorage}
          testID="home-menu-storage"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="treasure-chest" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.storage')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenEncyclopedia}
          testID="home-menu-encyclopedia"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="book-open-variant" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.encyclopedia')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenSettings}
          testID="home-menu-settings"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="filter-cog" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.settings')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenShop}
          testID="home-menu-shop"
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="shopping" size={tabIconSize} color={colors.iconMuted} />
          </View>
          <Text style={styles.menuLabel}>{t('home.menu.shop')}</Text>
        </Pressable>
      </View>

      {/* お知らせモーダル */}
      <NewsModal
        visible={showNewsModal}
        items={newsItems}
        onClose={handleCloseNewsModal}
      />

      {/* キャラクター名変更モーダル */}
      <Modal
        visible={isRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('home.renameCharacter')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              maxLength={20}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveButton}
                onPress={handleSaveRename}
              >
                <Text style={styles.modalSaveText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const colors = {
  bg: '#15191E',
  bgDeep: '#101418',
  slab: '#1B2026',
  slabEdge: '#2A3037',
  accent: '#232833',
  text: '#C9CDD3',
  textMuted: '#8C929A',
  icon: '#AEB5BE',
  iconMuted: '#8C929A',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  loadingText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: ms(32),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ms(16),
    paddingTop: ms(0),
    paddingBottom: ms(144),
  },
  characterCard: {
    backgroundColor: colors.slab,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    padding: ms(10),
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: ms(10),
    shadowOffset: { width: 0, height: ms(6) },
    elevation: 3,
  },
  characterSection: {
    flexDirection: 'row',
  },
  characterImage: {
    width: ms(104),
    height: ms(140),
    marginRight: ms(12),
  },
  characterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  characterInfoExpanded: {
    width: '100%',
  },
  characterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  characterName: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  debugButton: {
    padding: ms(6),
    backgroundColor: 'rgba(35, 40, 51, 0.5)',
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  changeButton: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(22, 26, 32, 0.6)',
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  changeButtonText: {
    fontSize: fs(12),
    color: colors.textMuted,
  },
  section: {
    marginTop: ms(16),
  },
  sectionTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: ms(12),
    paddingHorizontal: ms(4),
  },
  sectionCard: {
    backgroundColor: colors.slab,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    padding: ms(12),
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: ms(10),
    shadowOffset: { width: 0, height: ms(6) },
    elevation: 2,
  },
  adventureCta: {
    paddingHorizontal: ms(16),
    paddingBottom: ms(16),
  },
  adventureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(8),
    backgroundColor: colors.accent,
    borderRadius: ms(12),
    paddingVertical: ms(12),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  adventureButtonPressed: {
    backgroundColor: 'rgba(35, 40, 51, 0.8)',
  },
  adventureLabel: {
    fontSize: fs(14),
    color: colors.text,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: colors.slab,
    paddingVertical: ms(10),
    paddingHorizontal: ms(16),
    paddingBottom: ms(24),
    borderTopWidth: 1,
    borderTopColor: colors.slabEdge,
  },
  menuItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: ms(8),
    borderRadius: ms(10),
  },
  menuItemPressed: {
    backgroundColor: 'rgba(35, 40, 51, 0.6)',
  },
  menuIconContainer: {
    position: 'relative',
    width: ms(isTablet ? 40 : 32),
    height: ms(isTablet ? 40 : 32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: colors.accent,
  },
  badge: {
    position: 'absolute',
    top: ms(-4),
    right: ms(-8),
    backgroundColor: '#2B2F36',
    borderRadius: ms(8),
    minWidth: ms(16),
    height: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(4),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  badgeText: {
    fontSize: fs(10),
    fontWeight: 'bold',
    color: colors.text,
  },
  menuLabel: {
    fontSize: fs(tabLabelSize),
    color: colors.textMuted,
    marginTop: ms(4),
  },
  menuLabelHighlight: {
    color: colors.text,
  },
  // モーダルスタイル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.slab,
    borderRadius: ms(16),
    padding: ms(20),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  modalTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: ms(16),
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    padding: ms(12),
    fontSize: fs(16),
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.slabEdge,
    marginBottom: ms(16),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: ms(12),
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: ms(12),
    borderRadius: ms(8),
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: fs(14),
    color: colors.textMuted,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: ms(12),
    borderRadius: ms(8),
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: fs(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
});

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15191E',
    paddingHorizontal: ms(16),
    paddingBottom: ms(12),
  },
  boostButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    minWidth: ms(80),
    minHeight: ms(isTablet ? 44 : 36),
  },
  spacer: {
    width: ms(80),
  },
});
