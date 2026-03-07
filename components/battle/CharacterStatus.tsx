import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionGauge } from './ActionGauge';
import { HPBar } from './HPBar';
import { ms, fs } from '@/utils/scaling';

/**
 * 名前の長さに応じて動的にフォントサイズを計算
 */
const getDynamicNameFontSize = (name: string): number => {
  const length = name.length;
  const baseSize = fs(14);

  if (length <= 10) {
    return baseSize;
  } else if (length <= 12) {
    return Math.floor(baseSize * 0.9);
  } else {
    return Math.floor(baseSize * 0.8);
  }
};

interface CharacterStatusProps {
  name: string;
  currentHp: number;
  maxHp: number;
  level?: number;
  isPlayer?: boolean;
  actionGauge?: number;
}

export const CharacterStatus = memo(({
  name,
  currentHp,
  maxHp,
  level,
  isPlayer = false,
  actionGauge = 0,
}: CharacterStatusProps) => {
  return (
    <View style={[styles.container, isPlayer ? styles.playerContainer : styles.enemyContainer]}>
      {/* アクションゲージ（一番上） */}
      <ActionGauge value={actionGauge} color={isPlayer ? '#FFD700' : '#FF6B6B'} />

      {/* 名前とレベル */}
      <View style={styles.nameRow}>
        <Text
          style={[styles.name, { fontSize: getDynamicNameFontSize(name) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {name}
        </Text>
        {level !== undefined && <Text style={styles.level}>Lv.{level}</Text>}
      </View>

      {/* HPバー */}
      <HPBar current={currentHp} max={maxHp} color={isPlayer ? '#4CAF50' : '#F44336'} />
    </View>
  );
});

CharacterStatus.displayName = 'CharacterStatus';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: ms(10),
    borderRadius: ms(10),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  playerContainer: {
    marginRight: ms(6),
  },
  enemyContainer: {
    marginLeft: ms(6),
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: ms(6),
    marginBottom: ms(4),
  },
  name: {
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: ms(6),
  },
  level: {
    fontSize: fs(12),
    color: '#aaa',
  },
});
