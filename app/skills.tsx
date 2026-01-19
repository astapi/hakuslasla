import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PassiveTree } from '@/components/player/PassiveTree';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { ms } from '@/utils/scaling';

export default function SkillsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.passiveTreeContainer}>
        <PassiveTree />
      </View>
      <View style={styles.footer}>
        <Button title={t('common.close')} onPress={handleClose} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
    padding: ms(16),
  },
  passiveTreeContainer: {
    flex: 1,
  },
  footer: {
    paddingTop: ms(16),
  },
});
