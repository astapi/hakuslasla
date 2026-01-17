import { getMonsterImage, playerImages } from '@/data/images';
import { useEffect } from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ActionGauge } from './ActionGauge';
import { HPBar } from './HPBar';
import { ms, fs, s } from '@/utils/scaling';

interface CharacterDisplayProps {
  name: string;
  currentHp: number;
  maxHp: number;
  level?: number;
  isPlayer?: boolean;
  imageId?: string; // モンスターの場合は画像ID
  isAttacking?: boolean; // 攻撃中フラグ
  actionGauge?: number; // 行動ゲージ (0-100)
}

export const CharacterDisplay = ({
  name,
  currentHp,
  maxHp,
  level,
  isPlayer = false,
  imageId,
  isAttacking = false,
  actionGauge = 0,
}: CharacterDisplayProps) => {
  // 攻撃アニメーション用のSharedValue
  const translateX = useSharedValue(0);

  // 攻撃時のアニメーション
  useEffect(() => {
    if (isAttacking) {
      // プレイヤーは右へ(+)、敵は左へ(-)移動
      const direction = isPlayer ? 1 : -1;
      const moveDistance = 25;

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
  }, [isAttacking, isPlayer, translateX]);

  // アニメーションスタイル
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // 画像ソースを取得
  const imageSource: ImageSourcePropType | undefined = isPlayer
    ? playerImages.battle
    : imageId
      ? getMonsterImage(imageId)
      : undefined;

  return (
    <View style={[styles.container, isPlayer ? styles.playerContainer : styles.enemyContainer]}>
      <Animated.View style={[styles.avatarContainer, animatedStyle]}>
        {imageSource ? (
          <Image source={imageSource} style={styles.avatar} resizeMode="contain" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>?</Text>
          </View>
        )}
      </Animated.View>
      <View style={styles.infoContainer}>
        <ActionGauge value={actionGauge} color={isPlayer ? '#FFD700' : '#FF6B6B'} />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {level !== undefined && <Text style={styles.level}>Lv.{level}</Text>}
        </View>
        <HPBar current={currentHp} max={maxHp} color={isPlayer ? '#4CAF50' : '#F44336'} />
        
      </View>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: ms(12),
    borderRadius: ms(12),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  playerContainer: {
    marginRight: ms(8),
  },
  enemyContainer: {
    marginLeft: ms(8),
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: ms(8),
  },
  avatar: {
    width: s(68),
    height: s(68),
  },
  avatarPlaceholder: {
    width: s(68),
    height: s(68),
    borderRadius: s(32),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: fs(24),
    color: '#aaa',
  },
  infoContainer: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  name: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
  },
  level: {
    fontSize: fs(12),
    color: '#aaa',
  },
});
