import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { settingsRepository, LANGUAGE_LABELS, AppLanguage } from '@/db';
import { changeLanguage, getDeviceLanguage } from '@/lib/i18n';
import { consumePendingInviteLink } from '@/lib/inviteLink';

// 言語オプション（systemを除く）
const LANGUAGE_OPTIONS: Exclude<AppLanguage, 'system'>[] = [
  'ja',
  'en',
  'zh',
  'ko',
  'es',
  'fr',
  'de',
];

export default function LanguageSelectScreen() {
  const insets = useSafeAreaInsets();
  const deviceLanguage = getDeviceLanguage();
  const [selectedLanguage, setSelectedLanguage] =
    useState<Exclude<AppLanguage, 'system'>>(deviceLanguage);

  const handleSelectLanguage = async () => {
    // 言語を保存して適用
    await settingsRepository.setLanguage(selectedLanguage);
    changeLanguage(selectedLanguage);
    const pendingInvite = consumePendingInviteLink();
    if (pendingInvite) {
      router.replace(
        pendingInvite.code
          ? {
              pathname: '/settings',
              params: { inviteCode: pendingInvite.code },
            }
          : '/settings'
      );
      return;
    }
    router.replace('/');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Language</Text>
        <Text style={styles.subtitle}>言語を選択してください</Text>
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
      >
        {LANGUAGE_OPTIONS.map((lang) => {
          const isSelected = selectedLanguage === lang;
          const isDeviceLanguage = deviceLanguage === lang;

          return (
            <TouchableOpacity
              key={lang}
              style={[styles.languageItem, isSelected && styles.selectedItem]}
              onPress={() => setSelectedLanguage(lang)}
              activeOpacity={0.7}
            >
              <View style={styles.languageInfo}>
                <Text
                  style={[styles.languageLabel, isSelected && styles.selectedText]}
                >
                  {LANGUAGE_LABELS[lang]}
                </Text>
                {isDeviceLanguage && (
                  <Text style={styles.deviceLabel}>Device</Text>
                )}
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleSelectLanguage}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
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
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E2328',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a2a1f',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageLabel: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  selectedText: {
    color: '#4CAF50',
  },
  deviceLabel: {
    fontSize: 12,
    color: '#888',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
