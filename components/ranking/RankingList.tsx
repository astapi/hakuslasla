import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RankingEntryWithRank } from '@/lib/firestore';
import { getCharacterImages } from '@/data/images';
import { CharacterType } from '@/types';
import { ms, fs, s } from '@/utils/scaling';

// ============================================
// Types
// ============================================

interface RankingListProps {
  rankings: RankingEntryWithRank[];
  myDeviceId?: string;
}

interface RankingRowProps {
  entry: RankingEntryWithRank;
  isMe: boolean;
}

// ============================================
// Helper Components
// ============================================

const RankBadge = ({ rank }: { rank: number }) => {
  let bgColor = '#666';
  let textColor = '#fff';

  if (rank === 1) {
    bgColor = '#FFD700';
    textColor = '#000';
  } else if (rank === 2) {
    bgColor = '#C0C0C0';
    textColor = '#000';
  } else if (rank === 3) {
    bgColor = '#CD7F32';
    textColor = '#fff';
  }

  return (
    <View style={[styles.rankBadge, { backgroundColor: bgColor }]}>
      <Text style={[styles.rankText, { color: textColor }]}>{rank}</Text>
    </View>
  );
};

const CharacterImage = ({ type }: { type: CharacterType }) => {
  const images = getCharacterImages(type);
  return (
    <Image
      source={images.standing}
      style={styles.characterImage}
      resizeMode="contain"
    />
  );
};

// ============================================
// RankingRow
// ============================================

const RankingRow = ({ entry, isMe }: RankingRowProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={[styles.row, isMe && styles.rowMe]}
    >
      {/* Main Info */}
      <View style={styles.rowMain}>
        <RankBadge rank={entry.rank} />
        <CharacterImage type={entry.type} />
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
            {isMe && <Text style={styles.meTag}> ({t('ranking.you')})</Text>}
          </Text>
          <Text style={styles.level}>Lv.{entry.stats.level}</Text>
        </View>
        <View style={styles.floorContainer}>
          <Text style={styles.floorLabel}>{t('ranking.floor')}</Text>
          <Text style={styles.floorValue}>{entry.floorReached}</Text>
        </View>
      </View>

      {/* Expanded Stats */}
      {expanded && (
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            {/* 基本ステータス */}
            <StatItem label="HP" value={entry.stats.maxHp} />
            <StatItem label="ATK" value={entry.stats.atk} />
            <StatItem label="DEF" value={entry.stats.def} />
            {/* クリティカル */}
            <StatItem label={t('status.critRate')} value={`${entry.stats.critChance}%`} color="#FF6B6B" />
            <StatItem label={t('status.critDamage')} value={`${entry.stats.critDamage}%`} color="#FF6B6B" />
            {/* 毒 */}
            <StatItem label={t('status.poisonChance')} value={`${entry.stats.poisonChance}%`} color="#9CCC65" />
            <StatItem label={t('status.poisonDamage')} value={`+${entry.stats.poisonDamagePct}%`} color="#9CCC65" />
            <StatItem label={t('status.poisonDamageMore')} value={`+${entry.stats.poisonDamageMore}%`} color="#9CCC65" />
            <StatItem label={t('status.poisonMaxStacks')} value={entry.stats.poisonMaxStacks} color="#9CCC65" />
            <StatItem label={t('status.poisonDamageReduction')} value={`${entry.stats.poisonDamageReduction}%`} color="#9CCC65" />
            <StatItem label={t('status.poisonLifesteal')} value={`${entry.stats.poisonLifesteal}%`} color="#9CCC65" />
            <StatItem label={t('status.noDirectDamage')} value={entry.stats.noDirectDamage ? t('status.on') : t('status.off')} color="#9CCC65" />
            {/* 発火 */}
            <StatItem label={t('status.igniteChance')} value={`${entry.stats.igniteChance}%`} color="#FF7043" />
            <StatItem label={t('status.igniteDamage')} value={`+${entry.stats.igniteDamagePct}%`} color="#FF7043" />
            <StatItem label={t('status.igniteDamageMore')} value={`+${entry.stats.igniteDamageMore}%`} color="#FF7043" />
            <StatItem label={t('status.igniteDuration')} value={`+${entry.stats.igniteDurationPct}%`} color="#FF7043" />
            <StatItem label={t('status.igniteLifesteal')} value={`${entry.stats.igniteLifesteal}%`} color="#FF7043" />
            {/* 回復・防御 */}
            <StatItem label={t('status.hpRegen')} value={`${entry.stats.hpRegen}${t('status.perSecond')}`} color="#4CAF50" />
            <StatItem label={t('status.hpOnHit')} value={entry.stats.hpOnHit} color="#4CAF50" />
            <StatItem label={t('status.hpOnCrit')} value={`+${entry.stats.hpOnCrit}`} color="#FF9800" />
            <StatItem label={t('status.damageReduction')} value={`${entry.stats.damageReduction}%`} color="#4CAF50" />
            {/* 攻撃速度 */}
            <StatItem label={t('status.attackSpeed')} value={`+${entry.stats.attackSpeedPct}%`} color="#4FC3F7" />
            <StatItem label={t('status.attackSpeedMore')} value={`+${entry.stats.attackSpeedMore}%`} color="#4FC3F7" />
            <StatItem label={t('status.finalAttackSpeed')} value={entry.stats.attackSpeed.toFixed(2)} color="#4FC3F7" />
          </View>
        </View>
      )}
    </Pressable>
  );
};

const StatItem = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <View style={styles.statItem}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, color && { color }]}>{value}</Text>
  </View>
);

// ============================================
// RankingList
// ============================================

export const RankingList = ({ rankings, myDeviceId }: RankingListProps) => {
  const { t } = useTranslation();

  if (rankings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('ranking.noData')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rankings}
      keyExtractor={(item) => `${item.deviceId}_${item.localCharId}`}
      renderItem={({ item }) => (
        <RankingRow
          entry={item}
          isMe={myDeviceId === item.deviceId}
        />
      )}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: ms(20),
  },
  row: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: ms(8),
    marginBottom: ms(8),
    overflow: 'hidden',
  },
  rowMe: {
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(12),
  },
  rankBadge: {
    width: ms(28),
    height: ms(28),
    borderRadius: ms(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: ms(8),
  },
  rankText: {
    fontSize: fs(12),
    fontWeight: 'bold',
  },
  characterImage: {
    width: s(36),
    height: s(36),
    marginRight: ms(8),
  },
  nameContainer: {
    flex: 1,
    marginRight: ms(8),
  },
  name: {
    fontSize: fs(14),
    fontWeight: '600',
    color: '#fff',
  },
  meTag: {
    fontSize: fs(11),
    color: '#FFD700',
  },
  level: {
    fontSize: fs(11),
    color: '#aaa',
    marginTop: ms(2),
  },
  floorContainer: {
    alignItems: 'center',
  },
  floorLabel: {
    fontSize: fs(10),
    color: '#888',
  },
  floorValue: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#4FC3F7',
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: ms(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: ms(4),
    paddingRight: ms(16),
  },
  statLabel: {
    fontSize: fs(11),
    color: '#aaa',
  },
  statValue: {
    fontSize: fs(11),
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: ms(40),
  },
  emptyText: {
    fontSize: fs(14),
    color: '#888',
  },
});
