import { ImageBackground, ImageSourcePropType, View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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
  backgroundImage?: ImageSourcePropType;
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
  backgroundImage,
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
      {backgroundImage && (
        <ImageBackground
          source={backgroundImage}
          style={styles.cardBackground}
          imageStyle={styles.cardBackgroundImage}
          resizeMode="cover"
        >
          <View style={styles.cardBackgroundTint} />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="cardBackgroundFade" x1="0%" y1="0%" x2="58%" y2="0%">
                <Stop offset="0%" stopColor="#0A1016" stopOpacity="1" />
                <Stop offset="42%" stopColor="#0A1016" stopOpacity="0.62" />
                <Stop offset="100%" stopColor="#0A1016" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardBackgroundFade)" />
          </Svg>
        </ImageBackground>
      )}
      <View style={[styles.iconContainer, isLocked && styles.lockedIcon]}>
        <View style={styles.floorRingOuter} pointerEvents="none" />
        <View style={styles.floorRingInner} pointerEvents="none" />
        <View style={[styles.floorGem, styles.floorGemTop]} pointerEvents="none" />
        <View style={[styles.floorGem, styles.floorGemRight]} pointerEvents="none" />
        <View style={[styles.floorGem, styles.floorGemBottom]} pointerEvents="none" />
        <View style={[styles.floorGem, styles.floorGemLeft]} pointerEvents="none" />
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
    backgroundColor: 'rgba(10, 16, 22, 0.78)',
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: 'rgba(196, 210, 221, 0.22)',
    padding: ms(12),
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: '50%',
  },
  cardBackgroundImage: {
    opacity: 0.56,
  },
  cardBackgroundTint: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 14, 0.2)',
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
    backgroundColor: 'rgba(4, 9, 14, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(16),
    position: 'relative',
  },
  floorRingOuter: {
    position: 'absolute',
    width: s(58),
    height: s(58),
    borderRadius: s(29),
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 95, 0.62)',
  },
  floorRingInner: {
    position: 'absolute',
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    borderWidth: 1,
    borderColor: 'rgba(196, 210, 221, 0.18)',
  },
  floorGem: {
    position: 'absolute',
    width: s(6),
    height: s(6),
    backgroundColor: '#2A2F34',
    borderWidth: 1,
    borderColor: 'rgba(198, 161, 95, 0.7)',
    transform: [{ rotate: '45deg' }],
  },
  floorGemTop: {
    top: s(0),
  },
  floorGemRight: {
    right: s(0),
  },
  floorGemBottom: {
    bottom: s(0),
  },
  floorGemLeft: {
    left: s(0),
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
    flexWrap: 'wrap',
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
