import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { DropFilterSettings, DEFAULT_DROP_FILTER, EquipmentSlot } from '@/types';
import { settingsRepository, AppLanguage, LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from '@/db/repositories/settingsRepository';
import { changeLanguage } from '@/lib/i18n';
import { ms, fs } from '@/utils/scaling';

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'gloves', 'boots', 'accessory'];

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: 'sword',
  armor: 'shield',
  gloves: 'hand-back-right',
  boots: 'shoe-formal',
  accessory: 'ring',
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [settings, setSettings] = useState<DropFilterSettings>(DEFAULT_DROP_FILTER);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [loaded, savedLanguage] = await Promise.all([
        settingsRepository.getDropFilter(),
        settingsRepository.getLanguage(),
      ]);
      setSettings(loaded);
      setLanguage(savedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (newLanguage: AppLanguage) => {
    setLanguage(newLanguage);
    await settingsRepository.setLanguage(newLanguage);
    changeLanguage(newLanguage);
  };

  const saveSettings = async (newSettings: DropFilterSettings) => {
    setSettings(newSettings);
    await settingsRepository.setDropFilter(newSettings);
  };

  const toggleCategory = (slot: EquipmentSlot) => {
    const newSettings = {
      ...settings,
      categories: {
        ...settings.categories,
        [slot]: !settings.categories[slot],
      },
    };
    saveSettings(newSettings);
  };

  const updateMinModCount = (delta: number) => {
    const newValue = Math.max(0, Math.min(4, settings.minModCount + delta));
    saveSettings({ ...settings, minModCount: newValue });
  };

  const updateMaxTier = (delta: number) => {
    // 0 = フィルタリングなし、1-10 = Tier指定
    const newValue = Math.max(0, Math.min(10, settings.maxTier + delta));
    saveSettings({ ...settings, maxTier: newValue });
  };

  const resetToDefault = () => {
    saveSettings(DEFAULT_DROP_FILTER);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 言語設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language.title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.language.description')}
          </Text>
          <View style={styles.languageOptions}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.languageOption,
                  language === option && styles.languageOptionSelected,
                ]}
                onPress={() => handleLanguageChange(option)}
              >
                <MaterialCommunityIcons
                  name={language === option ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={language === option ? '#4CAF50' : '#666'}
                />
                <Text
                  style={[
                    styles.languageOptionText,
                    language === option && styles.languageOptionTextSelected,
                  ]}
                >
                  {option === 'system'
                    ? t('settings.language.system')
                    : option === 'ja'
                    ? t('settings.language.japanese')
                    : t('settings.language.english')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* カテゴリフィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.categoryFilter.title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.categoryFilter.description')}
          </Text>
          {SLOT_ORDER.map((slot) => (
            <View key={slot} style={styles.filterRow}>
              <View style={styles.filterLabel}>
                <MaterialCommunityIcons
                  name={SLOT_ICONS[slot] as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={20}
                  color="#aaa"
                />
                <Text style={styles.filterLabelText}>{t(`slots.${slot}`)}</Text>
              </View>
              <Switch
                value={settings.categories[slot]}
                onValueChange={() => toggleCategory(slot)}
                trackColor={{ false: '#333', true: '#4CAF50' }}
                thumbColor={settings.categories[slot] ? '#fff' : '#888'}
              />
            </View>
          ))}
        </View>

        {/* MOD数フィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.modCountFilter.title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.modCountFilter.description')}
          </Text>
          <View style={styles.numberInputRow}>
            <Pressable
              style={[styles.numberButton, settings.minModCount === 0 && styles.numberButtonDisabled]}
              onPress={() => updateMinModCount(-1)}
              disabled={settings.minModCount === 0}
            >
              <MaterialCommunityIcons name="minus" size={24} color="#fff" />
            </Pressable>
            <View style={styles.numberDisplay}>
              <Text style={styles.numberValue}>
                {settings.minModCount === 0 ? t('settings.modCountFilter.disabled') : t('settings.modCountFilter.value', { count: settings.minModCount })}
              </Text>
            </View>
            <Pressable
              style={[styles.numberButton, settings.minModCount === 4 && styles.numberButtonDisabled]}
              onPress={() => updateMinModCount(1)}
              disabled={settings.minModCount === 4}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* MOD Tierフィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.tierFilter.title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.tierFilter.description')}
          </Text>
          <View style={styles.numberInputRow}>
            <Pressable
              style={[styles.numberButton, settings.maxTier === 0 && styles.numberButtonDisabled]}
              onPress={() => updateMaxTier(-1)}
              disabled={settings.maxTier === 0}
            >
              <MaterialCommunityIcons name="minus" size={24} color="#fff" />
            </Pressable>
            <View style={styles.numberDisplay}>
              <Text style={styles.numberValue}>
                {settings.maxTier === 0 ? t('settings.tierFilter.disabled') : t('settings.tierFilter.value', { tier: settings.maxTier })}
              </Text>
            </View>
            <Pressable
              style={[styles.numberButton, settings.maxTier === 10 && styles.numberButtonDisabled]}
              onPress={() => updateMaxTier(1)}
              disabled={settings.maxTier === 10}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </Pressable>
          </View>
          {settings.maxTier > 0 && (
            <Text style={styles.tierHint}>
              {t('settings.tierFilter.hint')}
            </Text>
          )}
        </View>

        {/* 現在の設定サマリー */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.currentFilter.title')}</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              {Object.entries(settings.categories)
                .filter(([, enabled]) => enabled)
                .map(([slot]) => t(`slots.${slot}`))
                .join('、') || t('common.none')}
            </Text>
            {settings.minModCount > 0 && (
              <Text style={styles.summaryText}>
                {t('settings.currentFilter.modCount', { count: settings.minModCount })}
              </Text>
            )}
            {settings.maxTier > 0 && (
              <Text style={styles.summaryText}>
                {t('settings.currentFilter.tierBelow', { tier: settings.maxTier })}
              </Text>
            )}
            {settings.minModCount === 0 && settings.maxTier === 0 &&
              Object.values(settings.categories).every(v => v) && (
              <Text style={styles.summaryTextDisabled}>
                {t('settings.currentFilter.noFilter')}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* フッター */}
      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
        <Pressable style={styles.resetButton} onPress={resetToDefault}>
          <Text style={styles.resetButtonText}>{t('common.reset')}</Text>
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
  header: {
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(8),
  },
  headerTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    padding: ms(16),
    paddingBottom: ms(32),
  },
  resetButton: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: ms(6),
  },
  resetButtonText: {
    fontSize: fs(12),
    color: '#F44336',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
  section: {
    marginBottom: ms(24),
    backgroundColor: '#16213e',
    borderRadius: ms(12),
    padding: ms(16),
  },
  sectionTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(4),
  },
  sectionDescription: {
    fontSize: fs(12),
    color: '#888',
    marginBottom: ms(16),
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
  },
  filterLabelText: {
    fontSize: fs(14),
    color: '#fff',
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(16),
  },
  numberButton: {
    width: ms(48),
    height: ms(48),
    backgroundColor: '#4CAF50',
    borderRadius: ms(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonDisabled: {
    backgroundColor: '#333',
  },
  numberDisplay: {
    minWidth: ms(120),
    alignItems: 'center',
  },
  numberValue: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  tierHint: {
    fontSize: fs(11),
    color: '#666',
    textAlign: 'center',
    marginTop: ms(12),
  },
  summaryBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: ms(8),
    padding: ms(12),
    gap: ms(4),
  },
  summaryText: {
    fontSize: fs(13),
    color: '#4CAF50',
  },
  summaryTextDisabled: {
    fontSize: fs(13),
    color: '#666',
  },
  languageOptions: {
    gap: ms(8),
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(12),
    paddingHorizontal: ms(12),
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: ms(8),
    gap: ms(12),
  },
  languageOptionSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  languageOptionText: {
    fontSize: fs(15),
    color: '#aaa',
  },
  languageOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
