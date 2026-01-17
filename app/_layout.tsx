import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { initializeDatabase, settingsRepository } from '@/db';
import { changeLanguage } from '@/lib/i18n';
import '@/lib/i18n';

export default function RootLayout() {
  const { t } = useTranslation();
  const [isDbReady, setIsDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        // 保存された言語設定を読み込んで適用
        const savedLanguage = await settingsRepository.getLanguage();
        changeLanguage(savedLanguage);
        setIsDbReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'DB initialization error');
      }
    };
    init();
  }, []);

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#1a1a2e',
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
          }}
        />
        <Stack.Screen
          name="result"
          options={{
            title: t('result.rewards'),
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="skills"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
