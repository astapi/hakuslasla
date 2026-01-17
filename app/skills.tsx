import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PassiveTree } from '@/components/player/PassiveTree';
import { Button } from '@/components/common/Button';

export default function SkillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.passiveTreeContainer}>
        <PassiveTree />
      </View>
      <View style={styles.footer}>
        <Button title={t('common.close')} onPress={handleClose} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
  },
  passiveTreeContainer: {
    flex: 1,
  },
  footer: {
    paddingTop: 16,
  },
});
