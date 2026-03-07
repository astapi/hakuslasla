import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
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
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { ms, fs, isTablet } from '@/utils/scaling';

const colors = {
  bg: '#2A3037',
  border: '#FFD700',
  text: '#FFFFFF',
  textMuted: '#C9CDD3',
  gold: '#FFD700',
};

interface BoostTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  anchorX?: number; // 吹き出しの矢印を向ける位置（オプション）
}

export const BoostTooltip = ({ visible, onDismiss, anchorX }: BoostTooltipProps) => {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);
  const [isRendered, setIsRendered] = useState(false);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // 少し遅延してからフェードイン
      opacity.value = withDelay(
        500,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
      );
      translateY.value = withDelay(
        500,
        withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) })
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setIsRendered)(false);
        }
      });
      translateY.value = withTiming(-10, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleDismiss = async () => {
    await settingsRepository.setBoostTooltipShown();
    onDismiss();
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    setTooltipWidth(event.nativeEvent.layout.width);
  };

  if (!isRendered) {
    return null;
  }

  // 矢印の位置を計算（左端からのオフセット）
  // ブーストボタンの中心を指すように調整
  // ボタン1: left(0) + buttonSize(36)/2 = 18
  // ボタン2: left(0) + buttonSize(36) + gap(8) + buttonSize(36)/2 = 62
  // 2つのボタンの中間あたりを指す: 約40
  const arrowOffset = isTablet ? 26 : 22;

  return (
    <Animated.View style={[styles.container, animatedStyle]} onLayout={handleLayout}>
      <Pressable onPress={handleDismiss} style={styles.pressable}>
        {/* 上向き矢印 */}
        <View style={[styles.arrow, { left: arrowOffset }]} />

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="gift" size={ms(20)} color={colors.gold} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{t('boost.tooltipTitle')}</Text>
            <Text style={styles.description}>{t('boost.tooltipDescription')}</Text>
          </View>
          <MaterialCommunityIcons name="close" size={ms(16)} color={colors.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: ms(7),
    left: ms(16),
    right: ms(16),
    zIndex: 100,
  },
  pressable: {
    flex: 1,
  },
  arrow: {
    position: 'absolute',
    top: ms(-8),
    width: 0,
    height: 0,
    borderLeftWidth: ms(8),
    borderRightWidth: ms(8),
    borderBottomWidth: ms(8),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
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
  iconContainer: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
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
});
