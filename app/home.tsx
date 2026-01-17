import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentList } from '@/components/player/EquipmentList';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { playerImages } from '@/data/images';
import { ms, fs } from '@/utils/scaling';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { skillPoints, characterName, isLoaded, clear } = usePlayerStore();

  // 画面フォーカス時に再レンダリングをトリガーするためのキー
  const [focusKey, setFocusKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // 画面がフォーカスされたときにキーを更新して子コンポーネントを再レンダリング
      setFocusKey(prev => prev + 1);
    }, [])
  );

  const handleOpenSkills = () => {
    router.push('/skills');
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

  if (!isLoaded) {
    return (
      <ScreenWrapper>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.characterSection}>
          <Image
            source={playerImages.standing}
            style={styles.characterImage}
            resizeMode="contain"
          />
          <View style={styles.characterInfo}>
            <View style={styles.characterHeader}>
              <Text style={styles.characterName}>{characterName}</Text>
              <View style={styles.headerButtons}>
                <Pressable style={styles.debugButton} onPress={handleOpenDebug}>
                  <MaterialCommunityIcons name="flask" size={16} color="#FFA500" />
                </Pressable>
                <Pressable style={styles.changeButton} onPress={handleChangeCharacter}>
                  <Text style={styles.changeButtonText}>{t('common.change')}</Text>
                </Pressable>
              </View>
            </View>
            <StatusPanel key={`status-${focusKey}`} />
          </View>
        </View>

        <View style={styles.section}>
          <EquipmentList key={`equipment-${focusKey}`} />
        </View>
      </ScrollView>

      {/* 下部メニューバー */}
      <View style={styles.bottomMenu}>
        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenSkills}
        >
          <View style={styles.menuIconContainer}>
            <MaterialCommunityIcons name="star-four-points" size={24} color={skillPoints > 0 ? '#FFD700' : '#fff'} />
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
          onPress={handleOpenInventory}
        >
          <MaterialCommunityIcons name="bag-personal" size={24} color="#fff" />
          <Text style={styles.menuLabel}>{t('home.menu.inventory')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenStorage}
        >
          <MaterialCommunityIcons name="treasure-chest" size={24} color="#fff" />
          <Text style={styles.menuLabel}>{t('home.menu.storage')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenSettings}
        >
          <MaterialCommunityIcons name="filter-cog" size={24} color="#fff" />
          <Text style={styles.menuLabel}>{t('home.menu.settings')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenDungeonSelect}
        >
          <MaterialCommunityIcons name="castle" size={24} color="#fff" />
          <Text style={styles.menuLabel}>{t('home.menu.adventure')}</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: ms(32),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
    paddingBottom: ms(80),
  },
  characterSection: {
    flexDirection: 'row',
    marginBottom: ms(16),
  },
  characterImage: {
    width: ms(120),
    height: ms(160),
    marginRight: ms(16),
  },
  characterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  characterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(12),
  },
  characterName: {
    fontSize: fs(20),
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  debugButton: {
    padding: ms(6),
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderRadius: ms(6),
  },
  changeButton: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(6),
  },
  changeButtonText: {
    fontSize: fs(12),
    color: '#aaa',
  },
  section: {
    marginTop: ms(16),
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: ms(8),
    paddingHorizontal: ms(16),
    paddingBottom: ms(24),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: ms(8),
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: ms(-4),
    right: ms(-8),
    backgroundColor: '#F44336',
    borderRadius: ms(8),
    minWidth: ms(16),
    height: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(4),
  },
  badgeText: {
    fontSize: fs(10),
    fontWeight: 'bold',
    color: '#fff',
  },
  menuLabel: {
    fontSize: fs(10),
    color: '#aaa',
    marginTop: ms(4),
  },
  menuLabelHighlight: {
    color: '#FFD700',
  },
});
