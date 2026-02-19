import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function BattleLayout() {
  const { t } = useTranslation();
  return (
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
        headerShown: false,
        gestureEnabled: false,
      }}
    />
  );
}
