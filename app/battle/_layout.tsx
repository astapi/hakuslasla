import { Stack } from 'expo-router';

export default function BattleLayout() {
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
        title: '戦闘中',
        headerBackVisible: false,
        gestureEnabled: false,
      }}
    />
  );
}
