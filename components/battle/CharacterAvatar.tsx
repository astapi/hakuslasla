import { getMonsterImage, characterImages } from '@/data/images';
import { CharacterType, PoisonState, IgniteState } from '@/types';
import { useEffect, memo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { s, ms, fs } from '@/utils/scaling';

interface CharacterAvatarProps {
  isPlayer?: boolean;
  imageId?: string; // モンスターの場合は画像ID
  characterType?: CharacterType; // プレイヤーの場合はキャラクタータイプ
  isAttacking?: boolean; // 攻撃中フラグ
  size?: number; // アバターサイズ
  poisonStacks?: PoisonState[]; // 毒スタック
  igniteState?: IgniteState | null; // 発火状態
}

export const CharacterAvatar = memo(({
  isPlayer = false,
  imageId,
  characterType = 'warrior',
  isAttacking = false,
  size = s(80),
  poisonStacks = [],
  igniteState = null,
}: CharacterAvatarProps) => {
  // 攻撃アニメーション用のSharedValue
  const translateX = useSharedValue(0);

  // 攻撃時のアニメーション
  useEffect(() => {
    if (isAttacking) {
      // プレイヤーは右へ(+)、敵は左へ(-)移動
      const direction = isPlayer ? 1 : -1;
      const moveDistance = 30;

      translateX.value = withSequence(
        // 敵の方向へ移動（100ms）
        withTiming(direction * moveDistance, {
          duration: 100,
          easing: Easing.out(Easing.quad),
        }),
        // 元の位置に戻る（100ms）
        withTiming(0, {
          duration: 100,
          easing: Easing.in(Easing.quad),
        })
      );
    }
    // 注意: isAttacking が false になってもアニメーションはキャンセルしない
    // アニメーションは自然に終了させる
  }, [isAttacking, isPlayer, translateX]);

  // アンマウント時のみアニメーションをキャンセル
  useEffect(() => {
    return () => {
      cancelAnimation(translateX);
    };
  }, [translateX]);

  // アニメーションスタイル
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // 画像ソースを取得
  const imageSource: ImageSourcePropType | undefined = isPlayer
    ? characterImages[characterType].battle
    : imageId
      ? getMonsterImage(imageId)
      : undefined;

  const hasStatusEffects = poisonStacks.length > 0 || igniteState;

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={[styles.avatar, { width: size, height: size }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { width: size, height: size }]}>
            <Text style={styles.avatarPlaceholderText}>?</Text>
          </View>
        )}
      </Animated.View>

      {/* ステータスアイコン（キャラクター画像の下） */}
      <View style={styles.statusContainer}>
        {poisonStacks.length > 0 && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>☠️</Text>
            {poisonStacks.length > 1 && (
              <Text style={styles.statusCount}>×{poisonStacks.length}</Text>
            )}
          </View>
        )}
        {igniteState && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusIcon}>🔥</Text>
          </View>
        )}
      </View>
    </View>
  );
});

CharacterAvatar.displayName = 'CharacterAvatar';

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    // サイズはpropsで指定
  },
  avatarPlaceholder: {
    borderRadius: s(40),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: s(24),
    color: '#aaa',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: ms(4),
    gap: ms(4),
    minHeight: ms(20),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: ms(10),
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
  },
  statusIcon: {
    fontSize: fs(12),
  },
  statusCount: {
    fontSize: fs(10),
    color: '#fff',
    marginLeft: ms(2),
  },
});
