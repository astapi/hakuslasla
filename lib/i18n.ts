import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ja from '@/locales/ja.json';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';
import ko from '@/locales/ko.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';

const resources = {
  ja: { translation: ja },
  en: { translation: en },
  zh: { translation: zh },
  ko: { translation: ko },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
};

// サポートしている言語コード
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// デバイスの言語を取得（例: 'ja-JP' → 'ja'）
export const getDeviceLanguage = (): SupportedLanguage => {
  const lang = Localization.getLocales()[0]?.languageCode ?? 'en';
  // サポートしている言語かどうかをチェック
  if (SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
    return lang as SupportedLanguage;
  }
  // 中国語の場合、簡体字として扱う
  if (lang === 'zh-Hans' || lang === 'zh-CN') {
    return 'zh';
  }
  return 'en';
};

const deviceLanguage = getDeviceLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

/**
 * 言語を変更する
 * @param language 言語コードまたは 'system'
 */
export const changeLanguage = (
  language: 'ja' | 'en' | 'zh' | 'ko' | 'es' | 'fr' | 'de' | 'system'
): void => {
  if (language === 'system') {
    i18n.changeLanguage(getDeviceLanguage());
  } else {
    i18n.changeLanguage(language);
  }
};

/**
 * 現在の言語を取得
 */
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

export default i18n;
