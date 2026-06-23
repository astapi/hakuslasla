import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { initializeDatabase, settingsRepository } from '@/db';
import { isTablet } from '@/utils/scaling';
import { changeLanguage } from '@/lib/i18n';
import { Analytics, CrashlyticsHelper } from '@/lib/analytics';
import { consumePendingInviteLink, parseInviteLink, setPendingInviteLink } from '@/lib/inviteLink';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import { adService } from '@/services/adService';
import { initRemoteConfig, checkAppStatus, type AppStatus } from '@/lib/remoteConfig';
import { ForceUpdateModal } from '@/components/common/ForceUpdateModal';

// スプラッシュ画面を自動で非表示にしない
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const [isDbReady, setIsDbReady] = useState(false);
  const [needsLanguageSetup, setNeedsLanguageSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>({ type: 'ok' });
  const isDbReadyRef = useRef(false);
  const needsLanguageSetupRef = useRef(false);
  const hasCheckedInitialUrlRef = useRef(false);

  const handleIncomingUrl = useCallback((url: string, coldStart: boolean) => {
    const inviteLink = parseInviteLink(url);
    if (!inviteLink) {
      return;
    }

    setPendingInviteLink(inviteLink);
    Analytics.logInviteLinkOpened({
      source: inviteLink.source,
      cold_start: coldStart,
    });

    if (isDbReadyRef.current && !needsLanguageSetupRef.current) {
      router.push('/settings');
      setPendingInviteLink(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();

        // 言語設定が一度も行われていないか確認（初回起動判定）
        const hasLanguageBeenSet = await settingsRepository.hasLanguageBeenSet();

        if (hasLanguageBeenSet) {
          // 保存された言語設定を読み込んで適用
          const savedLanguage = await settingsRepository.getLanguage();
          changeLanguage(savedLanguage);
        } else {
          // 初回起動時は言語選択画面へ
          setNeedsLanguageSetup(true);
        }

        // RevenueCatを初期化
        await usePurchaseStore.getState().initialize();

        // 広告をバックグラウンドでプリロード
        adService.preloadAll();

        // Remote Config初期化 & アプリ状態チェック
        try {
          await initRemoteConfig();
          setAppStatus(checkAppStatus());
        } catch (e) {
          // Remote Configの失敗はアプリ起動をブロックしない
          CrashlyticsHelper.recordError(
            e instanceof Error ? e : new Error('Remote Config init failed'),
            'Remote Config initialization failed'
          );
        }

        setIsDbReady(true);
      } catch (e) {
        const error = e instanceof Error ? e : new Error('DB initialization error');
        CrashlyticsHelper.recordError(error, 'App initialization failed');
        setError(error.message);
      }
    };
    init();
  }, []);

  useEffect(() => {
    isDbReadyRef.current = isDbReady;
  }, [isDbReady]);

  useEffect(() => {
    needsLanguageSetupRef.current = needsLanguageSetup;
  }, [needsLanguageSetup]);

  useEffect(() => {
    if (hasCheckedInitialUrlRef.current) {
      return;
    }
    hasCheckedInitialUrlRef.current = true;

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleIncomingUrl(url, true);
        }
      })
      .catch((linkError) => {
        const nextError = linkError instanceof Error ? linkError : new Error('Initial URL read failed');
        CrashlyticsHelper.recordError(nextError, 'Initial URL read failed');
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingUrl(url, false);
    });

    return () => {
      subscription.remove();
    };
  }, [handleIncomingUrl]);

  // 初回起動時に言語選択画面へリダイレクト
  useEffect(() => {
    if (isDbReady && needsLanguageSetup) {
      router.replace('/language-select');
    }
  }, [isDbReady, needsLanguageSetup]);

  useEffect(() => {
    if (!isDbReady || needsLanguageSetup) {
      return;
    }

    const pendingInvite = consumePendingInviteLink();
    if (!pendingInvite) {
      return;
    }

    router.push('/settings');
  }, [isDbReady, needsLanguageSetup]);

  // DB準備完了後にスプラッシュを非表示
  const onLayoutRootView = useCallback(async () => {
    if (isDbReady || error) {
      await SplashScreen.hideAsync();
    }
  }, [isDbReady, error]);

  if (error) {
    return (
      <View style={styles.loadingContainer} onLayout={onLayoutRootView}>
        <Text style={styles.errorText}>{error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  // DB準備中はスプラッシュ画面が表示されているので何も描画しない
  if (!isDbReady) {
    return null;
  }

  if (appStatus.type !== 'ok') {
    return (
      <View style={styles.appRoot} onLayout={onLayoutRootView}>
        <ForceUpdateModal status={appStatus} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.appRoot} onLayout={onLayoutRootView}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#15191E',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#15191E',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: t('characterSelect.subtitle'),
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="character-create"
          options={{
            title: t('characterCreate.nameLabel'),
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="home"
          options={{
            title: t('characterSelect.title'),
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="dungeon-select"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="inventory"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="storage"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="battle"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="result"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="skills"
          options={{
            headerShown: false,
            presentation: isTablet ? 'fullScreenModal' : 'modal',
          }}
        />
        <Stack.Screen
          name="pets"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="encyclopedia"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="encyclopedia-detail"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="shop"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ranking"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="news"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="language-select"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#15191E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 16,
  },
});
