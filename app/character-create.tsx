import { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { characterRepository } from '@/db';
import { ms, fs } from '@/utils/scaling';

export default function CharacterCreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await characterRepository.create({ name: name.trim() });
      router.back();
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Text style={styles.label}>{t('characterCreate.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('characterCreate.namePlaceholder')}
          placeholderTextColor="#666"
          maxLength={20}
          autoFocus
        />

        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>{t('characterCreate.initialStats')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Level</Text>
              <Text style={styles.statValue}>1</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statValue}>100</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ATK</Text>
              <Text style={styles.statValue}>10</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DEF</Text>
              <Text style={styles.statValue}>5</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title={t('common.cancel')}
          onPress={handleCancel}
          variant="secondary"
          style={styles.cancelButton}
        />
        <Button
          title={isCreating ? t('common.creating') : t('common.create')}
          onPress={handleCreate}
          variant="primary"
          disabled={!name.trim() || isCreating}
          style={styles.createButton}
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
  content: {
    flex: 1,
    padding: ms(16),
  },
  label: {
    fontSize: fs(14),
    color: '#aaa',
    marginBottom: ms(8),
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(8),
    padding: ms(16),
    fontSize: fs(18),
    color: '#fff',
    marginBottom: ms(24),
  },
  previewSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(12),
    padding: ms(16),
  },
  previewTitle: {
    fontSize: fs(14),
    color: '#aaa',
    marginBottom: ms(12),
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fs(12),
    color: '#666',
    marginBottom: ms(4),
  },
  statValue: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    padding: ms(16),
    paddingBottom: ms(32),
    gap: ms(12),
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 1,
  },
});
