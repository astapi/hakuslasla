import { useEffect } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { settingsRepository, type AppLanguage } from '@/db';
import { changeLanguage } from '@/lib/i18n';

const SUPPORTED: AppLanguage[] = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'system'];
const STORE_GOBLIN_KING_SCREENSHOT_PATH =
  '/battle/uber_uber_goblin_king?startFloor=1&staticBattle=1&screenshotBattle=1';

/**
 * スクショ自動化用ディープリンク：言語を切り替えて任意画面へ遷移する。
 *
 *   lootdive://setlang/ko              → 韓国語にして '/' へ
 *   lootdive://setlang/ko?to=/skills   → 韓国語にして '/skills' へ
 *   lootdive://setlang/ko?to=store-goblin-king
 *     → 韓国語にしてストア用ゴブリンキング戦画面へ
 *
 * 設定画面を一切触らずに言語を切り替えられるので、各言語のスクショ撮影を自動化できる。
 * （言語コードは ja/en/zh/ko/es/fr/de/system のみ受理）
 */
export default function SetLangScreen() {
  const { code, to } = useLocalSearchParams<{ code?: string; to?: string }>();

  useEffect(() => {
    const apply = async () => {
      const lang = code as AppLanguage;
      if (lang && SUPPORTED.includes(lang)) {
        try {
          await settingsRepository.setLanguage(lang);
        } catch {
          // DB未準備でも i18n 切替は行う（撮影用途では表示が変われば十分）
        }
        changeLanguage(lang);
      }
      const dest: Href =
        to === 'store-goblin-king'
          ? (`${STORE_GOBLIN_KING_SCREENSHOT_PATH}&lang=${lang || 'system'}` as Href)
          : typeof to === 'string' && to.startsWith('/')
            ? (to as Href)
            : ('/' as Href);
      router.replace(dest);
    };
    apply();
  }, [code, to]);

  return <View style={{ flex: 1, backgroundColor: '#1a1a2e' }} />;
}
