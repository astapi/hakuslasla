import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import { HPBar } from './HPBar';
import { playerImages, getMonsterImage } from '@/data/images';

interface CharacterDisplayProps {
  name: string;
  currentHp: number;
  maxHp: number;
  level?: number;
  isPlayer?: boolean;
  imageId?: string; // モンスターの場合は画像ID
}

export const CharacterDisplay = ({
  name,
  currentHp,
  maxHp,
  level,
  isPlayer = false,
  imageId,
}: CharacterDisplayProps) => {
  // 画像ソースを取得
  const imageSource: ImageSourcePropType | undefined = isPlayer
    ? playerImages.battle
    : imageId
      ? getMonsterImage(imageId)
      : undefined;

  return (
    <View style={[styles.container, isPlayer ? styles.playerContainer : styles.enemyContainer]}>
      <View style={styles.avatarContainer}>
        {imageSource ? (
          <Image source={imageSource} style={styles.avatar} resizeMode="contain" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>?</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
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
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  playerContainer: {
    marginRight: 8,
  },
  enemyContainer: {
    marginLeft: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    color: '#aaa',
  },
  infoContainer: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  level: {
    fontSize: 12,
    color: '#aaa',
  },
});
