import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentSlots } from '@/components/player/EquipmentSlots';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { playerImages } from '@/data/images';

export default function HomeScreen() {
  const router = useRouter();
  const { skillPoints, characterName, isLoaded, clear } = usePlayerStore();

  const handleOpenSkills = () => {
    router.push('/skills');
  };

  const handleOpenInventory = () => {
    router.push('/inventory');
  };

  const handleOpenStorage = () => {
    router.push('/storage');
  };

  const handleOpenDungeonSelect = () => {
    router.push('/dungeon-select');
  };

  const handleChangeCharacter = () => {
    clear();
    router.replace('/');
  };

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
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
              <Pressable style={styles.changeButton} onPress={handleChangeCharacter}>
                <Text style={styles.changeButtonText}>変更</Text>
              </Pressable>
            </View>
            <StatusPanel />
          </View>
        </View>

        <View style={styles.section}>
          <EquipmentSlots />
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
          <Text style={[styles.menuLabel, skillPoints > 0 && styles.menuLabelHighlight]}>スキル</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenInventory}
        >
          <MaterialCommunityIcons name="bag-personal" size={24} color="#fff" />
          <Text style={styles.menuLabel}>持ち物</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenStorage}
        >
          <MaterialCommunityIcons name="treasure-chest" size={24} color="#fff" />
          <Text style={styles.menuLabel}>倉庫</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.menuItem, styles.dungeonMenuItem, pressed && styles.menuItemPressed]}
          onPress={handleOpenDungeonSelect}
        >
          <MaterialCommunityIcons name="castle" size={24} color="#fff" />
          <Text style={styles.menuLabel}>冒険</Text>
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
  dungeonMenuItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
    marginLeft: 8,
  },
});
