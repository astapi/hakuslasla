import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { ms, fs } from '@/utils/scaling';

const colors = {
  bg: '#2A3037',
  border: '#4CAF50',
  text: '#FFFFFF',
  textMuted: '#C9CDD3',
  accent: '#4CAF50',
};

interface ModFilterTooltipProps {
  visible: boolean;
  onDismiss: () => void;
}

export const ModFilterTooltip = ({ visible, onDismiss }: ModFilterTooltipProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // 少し遅延してからフェードイン
      opacity.value = withDelay(
        800,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      );
      translateY.value = withDelay(
        800,
        withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) })
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setIsRendered)(false);
        }
      });
      translateY.value = withTiming(10, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleDismiss = async () => {
    await settingsRepository.setModFilterTooltipShown();
    onDismiss();
  };

  const handleGoToSettings = async () => {
    await settingsRepository.setModFilterTooltipShown();
    onDismiss();
    router.push('/settings');
  };

  if (!isRendered) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="filter-cog" size={ms(20)} color={colors.accent} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{t('modFilter.tooltipTitle')}</Text>
            <Text style={styles.description}>{t('modFilter.tooltipDescription')}</Text>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={ms(18)} color={colors.textMuted} />
          </Pressable>
        </View>
        <Pressable style={styles.button} onPress={handleGoToSettings}>
          <Text style={styles.buttonText}>{t('modFilter.goToSettings')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={ms(16)} color={colors.accent} />
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: ms(100),
    left: ms(16),
    right: ms(16),
    zIndex: 100,
  },
  content: {
    backgroundColor: colors.bg,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: colors.border,
    padding: ms(12),
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: ms(8),
    shadowOffset: { width: 0, height: ms(4) },
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ms(12),
  },
  textContainer: {
    flex: 1,
    marginRight: ms(8),
  },
  title: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: ms(2),
  },
  description: {
    fontSize: fs(12),
    color: colors.textMuted,
    lineHeight: fs(16),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ms(12),
    paddingVertical: ms(10),
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  buttonText: {
    fontSize: fs(13),
    fontWeight: 'bold',
    color: colors.accent,
    marginRight: ms(4),
  },
});
