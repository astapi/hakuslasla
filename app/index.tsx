import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { characterRepository, settingsRepository } from '@/db';
import { Character } from '@/types';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { ms, fs } from '@/utils/scaling';

export default function CharacterSelectScreen() {
  const { t } = useTranslation();
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
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>{t('characterSelect.title')}</Text>
        <Text style={styles.subtitle}>{t('characterSelect.subtitle')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        ) : characters.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('characterSelect.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('characterSelect.emptyHint')}</Text>
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
                  <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('characterSelect.createNew')}
          onPress={handleCreateCharacter}
          variant="primary"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: ms(24),
    alignItems: 'center',
  },
  title: {
    fontSize: fs(28),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  subtitle: {
    fontSize: fs(16),
    color: '#aaa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
    flexGrow: 1,
  },
  loadingText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: ms(32),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: ms(48),
  },
  emptyText: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(8),
  },
  emptySubtext: {
    fontSize: fs(14),
    color: '#aaa',
  },
  characterList: {
    gap: ms(12),
  },
  characterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
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
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(4),
  },
  characterLevel: {
    fontSize: fs(14),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  characterStats: {
    flexDirection: 'row',
    gap: ms(12),
    marginRight: ms(12),
  },
  statText: {
    fontSize: fs(12),
    color: '#aaa',
  },
  deleteButton: {
    padding: ms(8),
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderRadius: ms(6),
  },
  deleteButtonText: {
    fontSize: fs(12),
    color: '#F44336',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
