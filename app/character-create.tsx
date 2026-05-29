import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { characterRepository } from '@/db';
import { ms, fs } from '@/utils/scaling';
import { CharacterType, ClassAbility } from '@/types';
import { CLASS_INITIAL_STATS, CLASS_ABILITIES } from '@/core/player';
import { characterImages } from '@/data/images';

const CHARACTER_TYPES: CharacterType[] = ['warrior', 'elementalist', 'ranger', 'frostmage', 'tamer'];

export default function CharacterCreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<CharacterType>('warrior');
  const [isCreating, setIsCreating] = useState(false);

  // クラス固有能力を表示用テキストの配列に変換
  const getAbilityTexts = (ability: ClassAbility): string[] => {
    const texts: string[] = [];
    if (ability.igniteChance) texts.push(t('characterCreate.ability.igniteChance', { value: ability.igniteChance }));
    if (ability.criticalChance) texts.push(t('characterCreate.ability.criticalChance', { value: ability.criticalChance }));
    if (ability.attackSpeedPct) texts.push(t('characterCreate.ability.attackSpeedPct', { value: ability.attackSpeedPct }));
    if (ability.poisonChance) texts.push(t('characterCreate.ability.poisonChance', { value: ability.poisonChance }));
    if (ability.chillChance) texts.push(t('characterCreate.ability.chillChance', { value: ability.chillChance }));
    if (ability.petDropRatePct) texts.push(t('characterCreate.ability.petDropRatePct', { value: ability.petDropRatePct }));
    if (ability.petEffectMultiplier) texts.push(t('characterCreate.ability.petEffectMultiplier', { value: ability.petEffectMultiplier }));
    return texts;
  };

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
          {CHARACTER_TYPES.map((type) => {
            const stats = CLASS_INITIAL_STATS[type];
            const abilityTexts = getAbilityTexts(CLASS_ABILITIES[type]);
            return (
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
                  style={[styles.classImage, characterImages[type].standingScale ? { transform: [{ scale: characterImages[type].standingScale! }] } : undefined]}
                  resizeMode="contain"
                />
                <View style={styles.classInfo}>
                  <Text
                    style={[
                      styles.className,
                      selectedType === type && styles.classNameSelected,
                    ]}
                  >
                    {t(`characterCreate.class.${type}`)}
                  </Text>
                  <Text style={styles.classStats}>
                    HP {stats.maxHp} / ATK {stats.atk} / DEF {stats.def}
                  </Text>
                  {abilityTexts.map((text) => (
                    <Text key={text} style={styles.abilityValue}>
                      {text}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
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
    gap: ms(10),
    marginBottom: ms(24),
  },
  classCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(12),
    paddingVertical: ms(8),
    paddingHorizontal: ms(10),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  classCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  classImage: {
    width: ms(52),
    height: ms(60),
    marginRight: ms(14),
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: fs(16),
    color: '#aaa',
    fontWeight: '500',
  },
  classNameSelected: {
    color: '#FFD700',
  },
  classStats: {
    fontSize: fs(12),
    color: '#888',
    marginTop: ms(2),
  },
  abilityValue: {
    fontSize: fs(13),
    color: '#FF6B35',
    fontWeight: '500',
    marginTop: ms(2),
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
