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
  requiresTicket?: boolean;
  ticketCount?: number;
  isDisabled?: boolean;
  testID?: string;
  onRankingPress?: () => void;
}

export const DungeonCard = ({
  dungeon,
  onPress,
  isLocked = false,
  isCleared = false,
  unlockRequirement,
  requiresTicket = false,
  ticketCount = 0,
  isDisabled = false,
  testID,
  onRankingPress,
}: DungeonCardProps) => {
  const { t } = useTranslation();
  const isTicketMissing = requiresTicket && ticketCount <= 0;
  const isPressable = !isLocked && !isDisabled;

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.container,
        pressed && isPressable && styles.pressed,
        isLocked && styles.locked,
        !isLocked && isDisabled && styles.disabled,
      ]}
      onPress={isPressable ? onPress : undefined}
      disabled={!isPressable}
    >
      <View style={[styles.iconContainer, isLocked && styles.lockedIcon]}>
        {isLocked ? (
          <Text style={styles.lockIcon}>🔒</Text>
        ) : (
          <Text style={[styles.icon, isLocked && styles.lockedText]}>
            {dungeon.maxFloor === -1 ? '∞' : `${dungeon.maxFloor}F`}
          </Text>
        )}
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isLocked && styles.lockedText]}>
            {t(`dungeons.${dungeon.id}.name`)}
          </Text>
          {isCleared && <Text style={styles.clearMark}>✓</Text>}
          {requiresTicket && (
            <View style={[styles.ticketBadge, isTicketMissing && styles.ticketBadgeMissing]}>
              <Text style={styles.ticketBadgeText}>
                {t('common.ticket')} {ticketCount}
              </Text>
            </View>
          )}
        </View>
        {isLocked && unlockRequirement ? (
          <Text style={styles.unlockRequirement}>{unlockRequirement}</Text>
        ) : (
          <>
            <Text style={[styles.description, isLocked && styles.lockedText]} numberOfLines={2}>
              {t(`dungeons.${dungeon.id}.description`)}
            </Text>
            {isTicketMissing && (
              <Text style={styles.ticketRequirementText}>{t('dungeon.ticketRequired')}</Text>
            )}
            <Text style={[styles.floors, isLocked && styles.lockedText]}>
              {dungeon.maxFloor === -1
                ? t('dungeon.unlimitedFloors')
                : t('dungeon.floors', { count: dungeon.maxFloor })}
            </Text>
          </>
        )}
      </View>
      {onRankingPress && !isLocked && (
        <Pressable
          style={({ pressed }) => [styles.rankingButton, pressed && styles.rankingButtonPressed]}
          onPress={(e) => {
            e.stopPropagation();
            onRankingPress();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.rankingIcon}>🏆</Text>
        </Pressable>
      )}
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
  disabled: {
    opacity: 0.7,
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
    gap: ms(6),
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
  ticketBadge: {
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderRadius: ms(8),
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.6)',
  },
  ticketBadgeMissing: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: 'rgba(244, 67, 54, 0.6)',
  },
  ticketBadgeText: {
    fontSize: fs(10),
    color: '#fff',
    fontWeight: 'bold',
  },
  ticketRequirementText: {
    fontSize: fs(11),
    color: '#F44336',
    marginBottom: ms(4),
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
  rankingButton: {
    padding: ms(8),
    marginRight: ms(4),
  },
  rankingButtonPressed: {
    opacity: 0.6,
  },
  rankingIcon: {
    fontSize: fs(20),
  },
});
