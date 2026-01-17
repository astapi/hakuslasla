import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentList } from '@/components/player/EquipmentList';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { playerImages } from '@/data/images';

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
      <View style={styles.container}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
    </View>
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
    marginTop: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  characterSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  characterImage: {
    width: 120,
    height: 160,
    marginRight: 16,
  },
  characterInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  characterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  characterName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debugButton: {
    padding: 6,
    backgroundColor: 'rgba(255, 165, 0, 0.15)',
    borderRadius: 6,
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  changeButtonText: {
    fontSize: 12,
    color: '#aaa',
  },
  section: {
    marginTop: 16,
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuItemPressed: {
    opacity: 0.6,
  },
  menuIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuLabel: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 4,
  },
  menuLabelHighlight: {
    color: '#FFD700',
  },
});
