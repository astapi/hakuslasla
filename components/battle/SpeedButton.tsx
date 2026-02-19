import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { ms, fs } from '@/utils/scaling';
import {
  BattleSpeedMultiplier,
  BATTLE_SPEED_OPTIONS,
  FREE_BATTLE_SPEED_OPTIONS,
  PREMIUM_BATTLE_SPEED_OPTIONS,
} from '@/db/repositories/settingsRepository';
import { hasSpeedBoost } from '@/stores/usePurchaseStore';

interface SpeedButtonProps {
  currentSpeed: BattleSpeedMultiplier;
  onSpeedChange: (speed: BattleSpeedMultiplier) => void;
}

export const SpeedButton: React.FC<SpeedButtonProps> = ({ currentSpeed, onSpeedChange }) => {
  const hasPremiumSpeed = hasSpeedBoost();

  // 利用可能な速度オプションを取得
  const availableOptions = hasPremiumSpeed
    ? BATTLE_SPEED_OPTIONS
    : FREE_BATTLE_SPEED_OPTIONS;

  const handlePress = useCallback(() => {
    const currentIndex = availableOptions.indexOf(currentSpeed);
    // 次の速度に切り替え（ループ）
    const nextIndex = (currentIndex + 1) % availableOptions.length;
    const nextSpeed = availableOptions[nextIndex];
    onSpeedChange(nextSpeed);
  }, [currentSpeed, availableOptions, onSpeedChange]);

  // 課金していない場合で、現在の速度がプレミアム速度の場合は2倍にリセット
  const displaySpeed = !hasPremiumSpeed && PREMIUM_BATTLE_SPEED_OPTIONS.includes(currentSpeed)
    ? 2
    : currentSpeed;

  // 課金していない場合で、保存されている速度がプレミアム速度の場合は自動的にリセット
  React.useEffect(() => {
    if (!hasPremiumSpeed && PREMIUM_BATTLE_SPEED_OPTIONS.includes(currentSpeed)) {
      onSpeedChange(2);
    }
  }, [hasPremiumSpeed, currentSpeed, onSpeedChange]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
      onPress={handlePress}
    >
      <Text style={styles.text}>{displaySpeed}x</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  text: {
    fontSize: fs(12),
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
