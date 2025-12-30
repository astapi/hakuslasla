import { View, Text, StyleSheet } from 'react-native';
import { HPBar } from './HPBar';

interface CharacterDisplayProps {
  name: string;
  currentHp: number;
  maxHp: number;
  level?: number;
  isPlayer?: boolean;
}

export const CharacterDisplay = ({
  name,
  currentHp,
  maxHp,
  level,
  isPlayer = false,
}: CharacterDisplayProps) => {
  return (
    <View style={[styles.container, isPlayer ? styles.playerContainer : styles.enemyContainer]}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatar}>{isPlayer ? '🧙' : '👹'}</Text>
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
    fontSize: 48,
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
