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
  currentShield?: number;
  maxShield?: number;
  blockChance?: number;
  evasion?: number;
}

export const CharacterStatus = memo(({
  name,
  currentHp,
  maxHp,
  level,
  isPlayer = false,
  actionGauge = 0,
  currentShield = 0,
  maxShield = 0,
  blockChance = 0,
  evasion = 0,
}: CharacterStatusProps) => {
  const hasShield = isPlayer && maxShield > 0;
  const cappedBlockChance = Math.min(50, Math.max(0, blockChance));
  const displayEvasion = Math.max(0, Math.floor(evasion));

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
      {hasShield && (
        <View style={styles.subGauge}>
          <Text style={styles.subGaugeLabel}>SH</Text>
          <View style={styles.subGaugeBar}>
            <HPBar current={currentShield} max={maxShield} color="#42A5F5" showText={false} />
          </View>
          <Text style={styles.subGaugeText}>{currentShield}/{maxShield}</Text>
        </View>
      )}
      {isPlayer && cappedBlockChance > 0 && (
        <View style={styles.blockRow}>
          <Text style={styles.blockText}>BLOCK {cappedBlockChance}%</Text>
        </View>
      )}
      {isPlayer && displayEvasion > 0 && (
        <View style={styles.blockRow}>
          <Text style={styles.evasionText}>EVA {displayEvasion}</Text>
        </View>
      )}
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
  subGauge: {
    marginTop: ms(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
  },
  subGaugeLabel: {
    width: ms(18),
    fontSize: fs(10),
    fontWeight: '700',
    color: '#90CAF9',
  },
  subGaugeBar: {
    flex: 1,
  },
  subGaugeText: {
    minWidth: ms(50),
    fontSize: fs(10),
    color: '#B3E5FC',
    textAlign: 'right',
  },
  blockRow: {
    marginTop: ms(3),
    alignItems: 'flex-end',
  },
  blockText: {
    fontSize: fs(10),
    fontWeight: '700',
    color: '#FFD54F',
  },
  evasionText: {
    fontSize: fs(10),
    fontWeight: '700',
    color: '#80CBC4',
  },
});
