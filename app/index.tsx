import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { characterRepository, settingsRepository } from '@/db';
import { Character } from '@/types';
import { usePlayerStore } from '@/stores/usePlayerStore';

export default function CharacterSelectScreen() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadCharacter = usePlayerStore((state) => state.loadCharacter);

  const fetchCharacters = useCallback(async () => {
    setIsLoading(true);
    try {
      const chars = await characterRepository.getAll();
      setCharacters(chars);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCharacters();
    }, [fetchCharacters])
  );

  const handleSelectCharacter = async (character: Character) => {
    await settingsRepository.setLastCharacterId(character.id);
    await loadCharacter(character.id);
    router.replace('/home');
  };

  const handleCreateCharacter = () => {
    router.push('/character-create');
  };

  const handleDeleteCharacter = async (id: number) => {
    await characterRepository.delete(id);
    await fetchCharacters();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ハクスラダンジョン</Text>
        <Text style={styles.subtitle}>キャラクターを選択</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <Text style={styles.loadingText}>読み込み中...</Text>
        ) : characters.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>キャラクターがいません</Text>
            <Text style={styles.emptySubtext}>新しいキャラクターを作成してください</Text>
          </View>
        ) : (
          <View style={styles.characterList}>
            {characters.map((character) => (
              <Pressable
                key={character.id}
                style={({ pressed }) => [
                  styles.characterCard,
                  pressed && styles.characterCardPressed,
                ]}
                onPress={() => handleSelectCharacter(character)}
              >
                <View style={styles.characterInfo}>
                  <Text style={styles.characterName}>{character.name}</Text>
                  <Text style={styles.characterLevel}>Lv.{character.level}</Text>
                </View>
                <View style={styles.characterStats}>
                  <Text style={styles.statText}>HP {character.maxHp}</Text>
                  <Text style={styles.statText}>ATK {character.atk}</Text>
                  <Text style={styles.statText}>DEF {character.def}</Text>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteCharacter(character.id);
                  }}
                >
                  <Text style={styles.deleteButtonText}>削除</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="新しいキャラクターを作成"
          onPress={handleCreateCharacter}
          variant="primary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  loadingText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
  },
  characterList: {
    gap: 12,
  },
  characterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  characterCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  characterInfo: {
    flex: 1,
  },
  characterName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  characterLevel: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  characterStats: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: '#aaa',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#F44336',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
