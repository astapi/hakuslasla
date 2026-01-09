import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { MAX_LEVEL } from '@/core';
import { HPBar } from '../battle/HPBar';

interface StatusPanelProps {
  currentHp?: number;
}

export const StatusPanel = ({ currentHp }: StatusPanelProps) => {
  const [showDetails, setShowDetails] = useState(false);

  // 装備・スキル変更時に再レンダリングするため、関連する state を購読
  const {
    level,
    exp,
    expToNextLevel,
    skillPoints,
    maxHp,
    atk,
    def,
    equipment,
    unlockedSkills,
    getTotalStats,
  } = usePlayerStore();
  // 購読のためだけに使用（値の変更を検知して再レンダリング）
  void equipment;
  void unlockedSkills;
  void maxHp;
  void atk;
  void def;

  const stats = getTotalStats();

  // 詳細計算用のデータを取得
  const getStatsBreakdown = () => {
    const state = usePlayerStore.getState();

    // 基礎ステータス（レベル分+装備+フラットMOD）
    let baseAtk = state.atk;
    let baseDef = state.def;
    let baseMaxHp = state.maxHp;

    // 装備MODからの戦闘効果を集計
    let modCriticalChance = 0;
    let modCriticalDamage = 0;
    let modPoisonChance = 0;

    // 装備ステータス加算
    Object.values(state.equipment).forEach((item) => {
      if (item) {
        baseAtk += item.atk;
        baseDef += item.def;
        if (item.mods) {
          for (const mod of item.mods) {
            if (mod.type === 'atk_bonus') baseAtk += mod.value;
            if (mod.type === 'def_bonus') baseDef += mod.value;
            if (mod.type === 'critical_chance') modCriticalChance += mod.value;
            if (mod.type === 'critical_damage') modCriticalDamage += mod.value;
            if (mod.type === 'poison_chance') modPoisonChance += mod.value;
          }
        }
      }
    });

    // パッシブ効果を取得
    const passiveEffects = calculatePassiveEffects(state.unlockedSkills);

    // 合計値を計算
    const totalCriticalChance = passiveEffects.critical_chance + modCriticalChance;
    const totalCriticalDamage = 150 + passiveEffects.critical_damage + modCriticalDamage; // 基礎150%
    const totalPoisonChance = passiveEffects.poison_chance + modPoisonChance;

    return {
      hp: {
        base: baseMaxHp,
        inc: passiveEffects.hp_increased_pct,
        more: passiveEffects.hp_more_pct.reduce((sum, v) => sum + v, 0),
      },
      atk: {
        base: baseAtk,
        inc: passiveEffects.atk_increased_pct,
        more: passiveEffects.atk_more_pct.reduce((sum, v) => sum + v, 0),
      },
      def: {
        base: baseDef,
        inc: passiveEffects.def_increased_pct,
        more: passiveEffects.def_more_pct.reduce((sum, v) => sum + v, 0),
      },
      criticalChance: totalCriticalChance,
      criticalDamage: totalCriticalDamage,
      poisonChance: totalPoisonChance,
    };
  };

  const breakdown = showDetails ? getStatsBreakdown() : null;

  return (
    <Pressable onPress={() => setShowDetails(!showDetails)}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>ステータス</Text>
          <Text style={styles.level}>Lv.{level}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>HP</Text>
            <Text style={styles.statValue}>{stats.maxHp}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ATK</Text>
            <Text style={styles.statValue}>{stats.atk}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DEF</Text>
            <Text style={styles.statValue}>{stats.def}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>SP</Text>
            <Text style={styles.statValue}>{skillPoints}</Text>
          </View>
        </View>

        {/* 詳細表示 */}
        {showDetails && breakdown && (
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>HP</Text>
              <Text style={styles.detailValue}>
                {breakdown.hp.base}
                {breakdown.hp.inc > 0 && <Text style={styles.incText}> +{breakdown.hp.inc}%inc</Text>}
                {breakdown.hp.more > 0 && <Text style={styles.moreText}> +{breakdown.hp.more}%more</Text>}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ATK</Text>
              <Text style={styles.detailValue}>
                {breakdown.atk.base}
                {breakdown.atk.inc > 0 && <Text style={styles.incText}> +{breakdown.atk.inc}%inc</Text>}
                {breakdown.atk.more > 0 && <Text style={styles.moreText}> +{breakdown.atk.more}%more</Text>}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>DEF</Text>
              <Text style={styles.detailValue}>
                {breakdown.def.base}
                {breakdown.def.inc > 0 && <Text style={styles.incText}> +{breakdown.def.inc}%inc</Text>}
                {breakdown.def.more > 0 && <Text style={styles.moreText}> +{breakdown.def.more}%more</Text>}
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>クリ率</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.criticalChance > 0 ? styles.critText : undefined}>
                  {breakdown.criticalChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>クリダメ</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.criticalDamage > 150 ? styles.critText : undefined}>
                  {breakdown.criticalDamage}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>毒付与</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonChance > 0 ? styles.poisonText : undefined}>
                  {breakdown.poisonChance}%
                </Text>
              </Text>
            </View>
          </View>
        )}

        <View style={styles.expContainer}>
          <Text style={styles.expLabel}>EXP</Text>
          <View style={styles.expBarContainer}>
            {level >= MAX_LEVEL ? (
              <Text style={styles.maxLevelText}>MAX</Text>
            ) : (
              <HPBar current={exp} max={expToNextLevel} color="#9C27B0" />
            )}
          </View>
        </View>

        {!showDetails && (
          <Text style={styles.tapHint}>タップで詳細表示</Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  level: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  // 詳細表示
  detailsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#aaa',
    width: 40,
  },
  detailValue: {
    fontSize: 13,
    color: '#fff',
    flex: 1,
    textAlign: 'right',
  },
  incText: {
    color: '#4FC3F7',
  },
  moreText: {
    color: '#FFD700',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
  },
  critText: {
    color: '#FF6B6B',
  },
  poisonText: {
    color: '#9CCC65',
  },
  tapHint: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  expContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expLabel: {
    fontSize: 12,
    color: '#aaa',
    marginRight: 8,
    width: 30,
  },
  expBarContainer: {
    flex: 1,
  },
  maxLevelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
  },
});
