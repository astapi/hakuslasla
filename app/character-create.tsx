import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { characterRepository } from '@/db';
import { ms, fs } from '@/utils/scaling';
import { CharacterType } from '@/types';
import { CLASS_INITIAL_STATS, CLASS_ABILITIES } from '@/core/player';
import { characterImages } from '@/data/images';

const CHARACTER_TYPES: CharacterType[] = ['warrior', 'elementalist', 'ranger'];

export default function CharacterCreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<CharacterType>('warrior');
  const [isCreating, setIsCreating] = useState(false);

  const classStats = CLASS_INITIAL_STATS[selectedType];
  const classAbility = CLASS_ABILITIES[selectedType];

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await characterRepository.create({ name: name.trim(), type: selectedType });
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
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.label}>{t('characterCreate.nameLabel')}</Text>
        <TextInput
          style={styles.input}
          testID="character-name-input"
          value={name}
          onChangeText={setName}
          placeholder={t('characterCreate.namePlaceholder')}
          placeholderTextColor="#666"
          maxLength={20}
          autoFocus
        />

        {/* クラス選択 */}
        <Text style={styles.label}>{t('characterCreate.classLabel')}</Text>
        <View style={styles.classSelector}>
          {CHARACTER_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.classCard,
                selectedType === type && styles.classCardSelected,
              ]}
              onPress={() => setSelectedType(type)}
              testID={`class-select-${type}`}
            >
              <Image
                source={characterImages[type].standing}
                style={styles.classImage}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.className,
                  selectedType === type && styles.classNameSelected,
                ]}
              >
                {t(`characterCreate.class.${type}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>{t('characterCreate.initialStats')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Level</Text>
              <Text style={styles.statValue}>1</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>HP</Text>
              <Text style={styles.statValue}>{classStats.maxHp}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>ATK</Text>
              <Text style={styles.statValue}>{classStats.atk}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>DEF</Text>
              <Text style={styles.statValue}>{classStats.def}</Text>
            </View>
          </View>

          {/* クラス固有能力 */}
          {(classAbility.igniteChance || classAbility.criticalChance || classAbility.attackSpeedPct || classAbility.poisonChance) && (
            <View style={styles.abilitySection}>
              <Text style={styles.abilityLabel}>{t('characterCreate.classAbility')}</Text>
              {classAbility.igniteChance && (
                <Text style={styles.abilityValue}>
                  {t('characterCreate.ability.igniteChance', { value: classAbility.igniteChance })}
                </Text>
              )}
              {classAbility.criticalChance && (
                <Text style={styles.abilityValue}>
                  {t('characterCreate.ability.criticalChance', { value: classAbility.criticalChance })}
                </Text>
              )}
              {classAbility.attackSpeedPct && (
                <Text style={styles.abilityValue}>
                  {t('characterCreate.ability.attackSpeedPct', { value: classAbility.attackSpeedPct })}
                </Text>
              )}
              {classAbility.poisonChance && (
                <Text style={styles.abilityValue}>
                  {t('characterCreate.ability.poisonChance', { value: classAbility.poisonChance })}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={t('common.cancel')}
          onPress={handleCancel}
          variant="secondary"
          style={styles.cancelButton}
          testID="character-create-cancel"
        />
        <Button
          title={isCreating ? t('common.creating') : t('common.create')}
          onPress={handleCreate}
          variant="primary"
          disabled={!name.trim() || isCreating}
          style={styles.createButton}
          testID="character-create-submit"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
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
  classSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ms(16),
    marginBottom: ms(24),
  },
  classCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(12),
    padding: ms(12),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    flex: 1,
    maxWidth: ms(120),
  },
  classCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  classImage: {
    width: ms(80),
    height: ms(100),
    marginBottom: ms(8),
  },
  className: {
    fontSize: fs(14),
    color: '#aaa',
    fontWeight: '500',
  },
  classNameSelected: {
    color: '#FFD700',
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
  abilitySection: {
    marginTop: ms(16),
    paddingTop: ms(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  abilityLabel: {
    fontSize: fs(12),
    color: '#666',
    marginBottom: ms(4),
  },
  abilityValue: {
    fontSize: fs(14),
    color: '#FF6B35',
    fontWeight: '500',
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
