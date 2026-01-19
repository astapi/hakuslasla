import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function BattleLayout() {
  const { t } = useTranslation();
  return (
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
        title: t('battle.inProgress'),
        headerBackVisible: false,
        gestureEnabled: false,
      }}
    />
  );
}
