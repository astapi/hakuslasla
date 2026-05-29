import { getMonsterImage, monsterBattleScales } from '@/data/images';
import { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { s } from '@/utils/scaling';

interface PetAvatarProps {
  imageId: string;
  size?: number;
}

/**
 * 戦闘画面のプレイヤー左下に表示する小型ペット画像。
 * モンスター画像は基本左向きなので scaleX: -1 で右向きに反転表示する。
 */
export const PetAvatar = memo(({ imageId, size = s(40) }: PetAvatarProps) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(translateY);
    };
  }, [translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scaleX: -1 }],
  }));

  const scale = monsterBattleScales[imageId] ?? 1;
  const scaledSize = size * scale;

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        <Image
          source={getMonsterImage(imageId)}
          style={{ width: scaledSize, height: scaledSize }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
});

PetAvatar.displayName = 'PetAvatar';

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
