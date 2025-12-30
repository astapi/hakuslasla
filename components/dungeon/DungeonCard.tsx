import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Dungeon } from '@/types';

interface DungeonCardProps {
  dungeon: Dungeon;
  onPress: () => void;
}

export const DungeonCard = ({ dungeon, onPress }: DungeonCardProps) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{dungeon.maxFloor}F</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{dungeon.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {dungeon.description}
        </Text>
        <Text style={styles.floors}>全{dungeon.maxFloor}階</Text>
      </View>
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>→</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  floors: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  arrowContainer: {
    paddingLeft: 12,
  },
  arrow: {
    fontSize: 24,
    color: '#fff',
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
