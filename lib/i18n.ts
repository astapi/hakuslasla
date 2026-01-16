import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ja from '@/locales/ja.json';
import en from '@/locales/en.json';

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

// デバイスの言語を取得（例: 'ja-JP' → 'ja'）
export const getDeviceLanguage = (): string => {
  const lang = Localization.getLocales()[0]?.languageCode ?? 'en';
  // サポートしている言語かどうかをチェック
  return lang === 'ja' ? 'ja' : 'en';
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
 * @param language 'ja' | 'en' | 'system'
 */
export const changeLanguage = (language: 'ja' | 'en' | 'system'): void => {
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
