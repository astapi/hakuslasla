import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { usePurchaseStore } from '@/stores/usePurchaseStore';
import { ENTITLEMENT_IDS } from '@/constants/purchases';
import { useAdState } from '@/hooks/useAdStore';
import { BoostModal } from './BoostModal';
import { ms, isTablet } from '@/utils/scaling';
import i18n from '@/lib/i18n';

// アニメーション表示時間（ミリ秒）
const ANIMATION_DURATION = 4000;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// タブレット用スケーリング
const iconSize = isTablet ? 26 : 16;
const buttonSize = isTablet ? 44 : 36;

const colors = {
  bg: 'rgba(35, 40, 51, 0.8)',
  border: '#2A3037',
  gold: '#FFD700',
  muted: '#8C929A',
  success: '#4CAF50',
};

interface BoostIconButtonProps {
  type: AdBoostType;
}

export const BoostIconButton = ({ type }: BoostIconButtonProps) => {
  const { dropRateBoost, tierBoost, checkExpiredBoosts } = useAdBoostStore();
  const hasPermanentBoost = usePurchaseStore((state) =>
    state.hasEntitlement(ENTITLEMENT_IDS.PERMANENT_BOOST)
  );
  const { loaded } = useAdState(type);
  const [modalVisible, setModalVisible] = useState(false);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;

  // 広告視聴可能時（loaded && !isActive）にパルスアニメーション
  const canPulse = loaded && !isActive;
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  // 画面フォーカス時にアニメーション開始、数秒後に停止
  useFocusEffect(
    useCallback(() => {
      if (canPulse) {
        setIsPulsing(true);
        const timer = setTimeout(() => {
          setIsPulsing(false);
        }, ANIMATION_DURATION);
        return () => clearTimeout(timer);
      }
    }, [canPulse])
  );

  useEffect(() => {
    if (isPulsing) {
      // パルスアニメーション（スケール）- 控えめに
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // 無限ループ
        false
      );
      // グローアニメーション（透明度）- 控えめに
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 200 });
    }

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(glowOpacity);
    };
  }, [isPulsing, pulseScale, glowOpacity]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  useEffect(() => {
    checkExpiredBoosts();
    const interval = setInterval(checkExpiredBoosts, 1000);
    return () => clearInterval(interval);
  }, [checkExpiredBoosts]);

  const icon: keyof typeof MaterialCommunityIcons.glyphMap =
    type === 'drop_rate' ? 'treasure-chest' : 'star-four-points';

  // 常時ブースト購入済みの場合、広告リワード系ボタンは表示しない
  if (hasPermanentBoost) {
    return null;
  }

  // 広告がロードされていない場合、かつブーストが有効でない場合は非表示
  // ブーストが有効な場合は残り時間表示のためボタンを表示
  if (!loaded && !isActive) {
    return null;
  }

  return (
    <>
      <AnimatedPressable
        style={[
          styles.button,
          isActive && styles.buttonActive,
          animatedButtonStyle,
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={type === 'drop_rate' ? i18n.t('boost.dropRateBoostLabel') : i18n.t('boost.tierBoostLabel')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {/* グローエフェクト */}
        {isPulsing && (
          <Animated.View style={[styles.glowEffect, animatedGlowStyle]} />
        )}
        <MaterialCommunityIcons
          name={icon}
          size={iconSize}
          color={isActive ? colors.gold : isPulsing ? colors.gold : colors.muted}
        />
        {isActive && (
          <View style={styles.activeDot} />
        )}
      </AnimatedPressable>

      <BoostModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        type={type}
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: ms(buttonSize),
    height: ms(buttonSize),
    borderRadius: ms(8),
    backgroundColor: 'rgba(30, 34, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  glowEffect: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ms(8),
    backgroundColor: colors.gold,
  },
  activeDot: {
    position: 'absolute',
    top: ms(4),
    right: ms(4),
    width: ms(6),
    height: ms(6),
    borderRadius: ms(3),
    backgroundColor: colors.success,
  },
});
