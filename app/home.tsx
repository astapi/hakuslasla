import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentSlots } from '@/components/player/EquipmentSlots';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';

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
        <View style={styles.characterHeader}>
          <Text style={styles.characterName}>{characterName}</Text>
          <Pressable style={styles.changeButton} onPress={handleChangeCharacter}>
            <Text style={styles.changeButtonText}>変更</Text>
          </Pressable>
        </View>

        <StatusPanel />

        <View style={styles.section}>
          <EquipmentSlots />
        </View>

        <View style={styles.menuSection}>
          <Button
            title={`スキルツリー${skillPoints > 0 ? ` (SP: ${skillPoints})` : ''}`}
            onPress={handleOpenSkills}
            variant={skillPoints > 0 ? 'primary' : 'secondary'}
            style={styles.menuButton}
          />

          <Button
            title="インベントリ"
            onPress={handleOpenInventory}
            variant="secondary"
            style={styles.menuButton}
          />

          <Button
            title="倉庫"
            onPress={handleOpenStorage}
            variant="secondary"
            style={styles.menuButton}
          />
        </View>

        <View style={styles.dungeonSection}>
          <Button
            title="ダンジョンへ出発"
            onPress={handleOpenDungeonSelect}
            variant="primary"
          />
        </View>
      </ScrollView>
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
  },
  characterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  menuSection: {
    marginTop: 24,
    gap: 12,
  },
  menuButton: {
    marginBottom: 0,
  },
  dungeonSection: {
    marginTop: 32,
  },
});
