import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { DropFilterSettings, DEFAULT_DROP_FILTER, EquipmentSlot } from '@/types';
import {
  settingsRepository,
  AppLanguage,
  LANGUAGE_OPTIONS,
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  BattleSpeedMultiplier,
  BATTLE_SPEED_OPTIONS,
  DEFAULT_BATTLE_SPEED,
  FREE_BATTLE_SPEED_OPTIONS,
  PREMIUM_BATTLE_SPEED_OPTIONS,
} from '@/db/repositories/settingsRepository';
import { hasSpeedBoost } from '@/stores/usePurchaseStore';
import { changeLanguage } from '@/lib/i18n';
import { updateSoundSettings } from '@/lib/sound';
import { ms, fs } from '@/utils/scaling';
import { InviteCodeSection } from '@/components/settings/InviteCodeSection';

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
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [seEnabled, setSeEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const hasPremiumSpeed = hasSpeedBoost();

  // 言語コードからラベルを取得するヘルパー
  const getLanguageLabel = (lang: AppLanguage): string => {
    if (lang === 'system') {
      return t('settings.language.system');
    }
    return LANGUAGE_LABELS[lang];
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [loaded, savedLanguage, savedSpeed, savedBgm, savedSe] = await Promise.all([
        settingsRepository.getDropFilter(),
        settingsRepository.getLanguage(),
        settingsRepository.getBattleSpeed(),
        settingsRepository.getBgmEnabled(),
        settingsRepository.getSeEnabled(),
      ]);
      setSettings(loaded);
      setLanguage(savedLanguage);
      setBgmEnabled(savedBgm);
      setSeEnabled(savedSe);
      // 課金していない場合で、保存されている速度がプレミアム速度の場合は無料枠（1x）にリセット
      if (!hasSpeedBoost() && PREMIUM_BATTLE_SPEED_OPTIONS.includes(savedSpeed)) {
        setBattleSpeed(DEFAULT_BATTLE_SPEED);
        await settingsRepository.setBattleSpeed(DEFAULT_BATTLE_SPEED);
      } else {
        setBattleSpeed(savedSpeed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = async (newLanguage: AppLanguage) => {
    setLanguage(newLanguage);
    await settingsRepository.setLanguage(newLanguage);
    changeLanguage(newLanguage);
  };

  const handleSpeedChange = async (newSpeed: BattleSpeedMultiplier) => {
    setBattleSpeed(newSpeed);
    await settingsRepository.setBattleSpeed(newSpeed);
  };

  // 利用可能な速度オプションを取得
  const availableSpeedOptions = hasPremiumSpeed
    ? BATTLE_SPEED_OPTIONS
    : FREE_BATTLE_SPEED_OPTIONS;

  const handleBgmToggle = async (enabled: boolean) => {
    setBgmEnabled(enabled);
    await settingsRepository.setBgmEnabled(enabled);
    updateSoundSettings(enabled, seEnabled);
  };

  const handleSeToggle = async (enabled: boolean) => {
    setSeEnabled(enabled);
    await settingsRepository.setSeEnabled(enabled);
    updateSoundSettings(bgmEnabled, enabled);
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
          <Pressable
            style={styles.languageSelector}
            onPress={() => setLanguageModalVisible(true)}
          >
            <View style={styles.languageSelectorContent}>
              <MaterialCommunityIcons
                name="translate"
                size={20}
                color={colors.text}
              />
              <Text style={styles.languageSelectorText}>
                {getLanguageLabel(language)}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        {/* 言語選択モーダル */}
        <Modal
          visible={languageModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setLanguageModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('settings.language.title')}</Text>
              <ScrollView style={styles.modalScrollView}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    style={[
                      styles.languageOption,
                      language === option && styles.languageOptionSelected,
                    ]}
                    onPress={() => {
                      handleLanguageChange(option);
                      setLanguageModalVisible(false);
                    }}
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
                      {getLanguageLabel(option)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* 戦闘速度 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.battleSpeed.title')}</Text>
          <Text style={styles.sectionDescription}>
            {t('settings.battleSpeed.description')}
          </Text>
          <View style={styles.speedOptions}>
            {BATTLE_SPEED_OPTIONS.map((speed) => {
              const isAvailable = availableSpeedOptions.includes(speed);
              const isSelected = battleSpeed === speed;
              const isPremium = PREMIUM_BATTLE_SPEED_OPTIONS.includes(speed);
              return (
                <Pressable
                  key={speed}
                  style={[
                    styles.speedOption,
                    isSelected && styles.speedOptionSelected,
                    !isAvailable && styles.speedOptionLocked,
                  ]}
                  onPress={() => isAvailable && handleSpeedChange(speed)}
                  disabled={!isAvailable}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      isSelected && styles.speedOptionTextSelected,
                      !isAvailable && styles.speedOptionTextLocked,
                    ]}
                  >
                    {speed}x
                  </Text>
                  {isPremium && !hasPremiumSpeed && (
                    <MaterialCommunityIcons
                      name="lock"
                      size={12}
                      color="#666"
                      style={styles.lockIcon}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          {!hasPremiumSpeed && (
            <Text style={styles.speedHint}>
              {t('settings.battleSpeed.premiumHint')}
            </Text>
          )}
        </View>

        {/* サウンド設定 */}
        <View style={styles.section}>
          <View style={[styles.filterRow, { borderBottomWidth: 1 }]}>
            <View style={styles.filterLabel}>
              <MaterialCommunityIcons
                name="music"
                size={20}
                color="#aaa"
              />
              <Text style={styles.filterLabelText}>{t('settings.sound.bgm')}</Text>
            </View>
            <Switch
              value={bgmEnabled}
              onValueChange={handleBgmToggle}
              trackColor={{ false: '#333', true: '#4CAF50' }}
              thumbColor={bgmEnabled ? '#fff' : '#888'}
            />
          </View>
          <View style={[styles.filterRow, { borderBottomWidth: 0 }]}>
            <View style={styles.filterLabel}>
              <MaterialCommunityIcons
                name="volume-high"
                size={20}
                color="#aaa"
              />
              <Text style={styles.filterLabelText}>{t('settings.sound.se')}</Text>
            </View>
            <Switch
              value={seEnabled}
              onValueChange={handleSeToggle}
              trackColor={{ false: '#333', true: '#4CAF50' }}
              thumbColor={seEnabled ? '#fff' : '#888'}
            />
          </View>
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

        {/* 招待コード */}
        <InviteCodeSection />
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

const colors = {
  bg: '#15191E',
  bgDeep: '#101418',
  slab: '#1B2026',
  slabEdge: '#2A3037',
  accent: '#232833',
  text: '#C9CDD3',
  textMuted: '#8C929A',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingText: {
    color: colors.textMuted,
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
    color: colors.text,
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
    backgroundColor: colors.slab,
    borderRadius: ms(12),
    padding: ms(16),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: ms(10),
    shadowOffset: { width: 0, height: ms(6) },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: ms(4),
  },
  sectionDescription: {
    fontSize: fs(12),
    color: colors.textMuted,
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
    color: colors.text,
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
    color: colors.text,
  },
  tierHint: {
    fontSize: fs(11),
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: ms(12),
  },
  summaryBox: {
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    padding: ms(12),
    gap: ms(4),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  summaryText: {
    fontSize: fs(13),
    color: colors.text,
  },
  summaryTextDisabled: {
    fontSize: fs(13),
    color: colors.textMuted,
  },
  // 言語セレクター（タップでモーダルを開く）
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ms(14),
    paddingHorizontal: ms(12),
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  languageSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
  },
  languageSelectorText: {
    fontSize: fs(15),
    color: colors.text,
    fontWeight: '500',
  },
  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(24),
  },
  modalContent: {
    backgroundColor: colors.slab,
    borderRadius: ms(16),
    padding: ms(16),
    width: '100%',
    maxWidth: ms(340),
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  modalTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: ms(16),
  },
  modalScrollView: {
    maxHeight: ms(400),
  },
  languageOptions: {
    gap: ms(8),
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(14),
    paddingHorizontal: ms(12),
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    gap: ms(12),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    marginBottom: ms(8),
  },
  languageOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: '#4CAF50',
  },
  languageOptionText: {
    fontSize: fs(15),
    color: colors.textMuted,
  },
  languageOptionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(8),
  },
  speedOption: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(10),
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  speedOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  speedOptionLocked: {
    opacity: 0.5,
  },
  speedOptionText: {
    fontSize: fs(14),
    fontWeight: '600',
    color: colors.textMuted,
  },
  speedOptionTextSelected: {
    color: '#fff',
  },
  speedOptionTextLocked: {
    color: '#666',
  },
  lockIcon: {
    marginLeft: ms(2),
  },
  speedHint: {
    fontSize: fs(11),
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: ms(12),
  },
});
