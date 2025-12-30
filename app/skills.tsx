import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SkillTree } from '@/components/player/SkillTree';
import { Button } from '@/components/common/Button';

export default function SkillsScreen() {
  const router = useRouter();

  const handleClose = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.skillTreeContainer}>
        <SkillTree />
      </View>
      <View style={styles.footer}>
        <Button title="閉じる" onPress={handleClose} variant="secondary" />
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
  skillTreeContainer: {
    flex: 1,
  },
  footer: {
    paddingTop: 16,
  },
});
