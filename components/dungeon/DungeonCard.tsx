import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DungeonListItem } from '@/types';
import { ms, fs, s } from '@/utils/scaling';

interface DungeonCardProps {
  dungeon: DungeonListItem;
  onPress: () => void;
  isLocked?: boolean;
  isCleared?: boolean;
  unlockRequirement?: string;
}

export const DungeonCard = ({
  dungeon,
  onPress,
  isLocked = false,
  isCleared = false,
  unlockRequirement,
}: DungeonCardProps) => {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !isLocked && styles.pressed,
        isLocked && styles.locked,
      ]}
      onPress={isLocked ? undefined : onPress}
      disabled={isLocked}
    >
      <View style={[styles.iconContainer, isLocked && styles.lockedIcon]}>
        {isLocked ? (
          <Text style={styles.lockIcon}>🔒</Text>
        ) : (
          <Text style={[styles.icon, isLocked && styles.lockedText]}>{dungeon.maxFloor}F</Text>
        )}
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isLocked && styles.lockedText]}>
            {t(`dungeons.${dungeon.id}.name`)}
          </Text>
          {isCleared && <Text style={styles.clearMark}>✓</Text>}
        </View>
        {isLocked && unlockRequirement ? (
          <Text style={styles.unlockRequirement}>{unlockRequirement}</Text>
        ) : (
          <>
            <Text style={[styles.description, isLocked && styles.lockedText]} numberOfLines={2}>
              {t(`dungeons.${dungeon.id}.description`)}
            </Text>
            <Text style={[styles.floors, isLocked && styles.lockedText]}>
              {t('dungeon.floors', { count: dungeon.maxFloor })}
            </Text>
          </>
        )}
      </View>
      <View style={styles.arrowContainer}>
        {!isLocked && <Text style={styles.arrow}>→</Text>}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(12),
    padding: ms(16),
    marginBottom: ms(12),
    alignItems: 'center',
  },
  locked: {
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    opacity: 0.6,
  },
  iconContainer: {
    width: s(60),
    height: s(60),
    borderRadius: s(30),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(16),
  },
  lockedIcon: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  icon: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  lockIcon: {
    fontSize: fs(24),
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  name: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
  },
  clearMark: {
    fontSize: fs(18),
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: ms(8),
  },
  description: {
    fontSize: fs(12),
    color: '#aaa',
    marginBottom: ms(4),
  },
  floors: {
    fontSize: fs(12),
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  unlockRequirement: {
    fontSize: fs(12),
    color: '#888',
    fontStyle: 'italic',
  },
  lockedText: {
    color: '#666',
  },
  arrowContainer: {
    paddingLeft: ms(12),
    width: s(30),
  },
  arrow: {
    fontSize: fs(24),
    color: '#fff',
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
});
