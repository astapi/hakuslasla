import { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdBoostStore, AdBoostType } from '@/stores/useAdBoostStore';
import { BoostModal } from './BoostModal';
import { ms } from '@/utils/scaling';

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
  const [modalVisible, setModalVisible] = useState(false);

  const boost = type === 'drop_rate' ? dropRateBoost : tierBoost;
  const isActive = boost.active;

  useEffect(() => {
    checkExpiredBoosts();
    const interval = setInterval(checkExpiredBoosts, 1000);
    return () => clearInterval(interval);
  }, [checkExpiredBoosts]);

  const icon: keyof typeof MaterialCommunityIcons.glyphMap =
    type === 'drop_rate' ? 'treasure-chest' : 'star-four-points';

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          isActive && styles.buttonActive,
          pressed && styles.buttonPressed,
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityLabel={type === 'drop_rate' ? 'ドロップ率ブースト' : 'Tierブースト'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={isActive ? colors.gold : colors.muted}
        />
        {isActive && (
          <View style={styles.activeDot} />
        )}
      </Pressable>

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
    width: ms(36),
    height: ms(36),
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
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
