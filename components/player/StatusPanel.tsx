import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { calculateUberTreeEffects } from '@/data/uberTree';
import { combineMods, getAttackSpeedFromMods } from '@/core/modEffects';
import { CLASS_ABILITIES } from '@/core/player';
import { HPBar } from '../battle/HPBar';
import { ms, fs } from '@/utils/scaling';

interface StatusPanelProps {
  currentHp?: number;
  onDetailsChange?: (open: boolean) => void;
}

export const StatusPanel = ({ currentHp, onDetailsChange }: StatusPanelProps) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const toggleDetails = () => {
    setShowDetails((prev) => !prev);
  };

  // showDetailsが変更されたときに親コンポーネントに通知
  useEffect(() => {
    if (onDetailsChange) {
      onDetailsChange(showDetails);
    }
  }, [showDetails, onDetailsChange]);

  // Zustand Selector パターン: 必要なフィールドのみ購読
  const level = usePlayerStore((state) => state.level);
  const exp = usePlayerStore((state) => state.exp);
  const expToNextLevel = usePlayerStore((state) => state.expToNextLevel);
  const levelCap = usePlayerStore((state) => state.levelCap);

  // getTotalStats の依存関係を個別に購読
  const equipment = usePlayerStore((state) => state.equipment);
  const unlockedSkills = usePlayerStore((state) => state.unlockedSkills);
  const maxHp = usePlayerStore((state) => state.maxHp);
  const atk = usePlayerStore((state) => state.atk);
  const def = usePlayerStore((state) => state.def);
  const characterType = usePlayerStore((state) => state.characterType);

  // useMemo でキャッシュして無限ループを防止
  // 依存配列の値は getTotalStats() 内部で使用されるため必要
  const stats = useMemo(() => {
    const state = usePlayerStore.getState();
    return state.getTotalStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment, unlockedSkills, maxHp, atk, def]);

  // 詳細計算用のデータを取得
  const getStatsBreakdown = () => {
    const state = usePlayerStore.getState();

    // 基礎ステータス（レベル分+装備+フラットMOD）
    let baseAtk = state.atk;
    let baseDef = state.def;
    let baseMaxHp = state.maxHp;

    // 装備MODからのincreased%を集計
    let equipHpIncPct = 0;
    let equipAtkIncPct = 0;
    let equipDefIncPct = 0;

    // 装備ステータス加算
    Object.values(state.equipment).forEach((item) => {
      if (item) {
        baseAtk += item.atk;
        baseDef += item.def;
        if (item.mods) {
          for (const mod of item.mods) {
            if (mod.type === 'atk_bonus') baseAtk += mod.value;
            if (mod.type === 'def_bonus') baseDef += mod.value;
            if (mod.type === 'hp_bonus') baseMaxHp += mod.value;
            if (mod.type === 'hp_increased_pct') equipHpIncPct += mod.value;
            if (mod.type === 'atk_increased_pct') equipAtkIncPct += mod.value;
            if (mod.type === 'def_increased_pct') equipDefIncPct += mod.value;
          }
        }
      }
    });

    // パッシブ効果を取得
    const passiveEffects = calculatePassiveEffects(state.unlockedSkills);
    const equipmentItems = Object.values(state.equipment);
    const baseMods = combineMods(equipmentItems, passiveEffects);

    // クラス固有能力
    const classAbility = CLASS_ABILITIES[state.characterType];

    // Uberツリー効果を加算
    const uberEffects = calculateUberTreeEffects(state.unlockedUberSkills);

    // 合計値を計算（useBattle.ts の modEffects と同じロジック）
    const combinedMods = {
      ...baseMods,
      igniteChance: baseMods.igniteChance + (classAbility.igniteChance ?? 0) + uberEffects.ignite_chance,
      criticalChance: baseMods.criticalChance + (classAbility.criticalChance ?? 0) + uberEffects.critical_chance,
      criticalDamage: baseMods.criticalDamage + uberEffects.critical_damage,
      attackSpeedPct: baseMods.attackSpeedPct + (classAbility.attackSpeedPct ?? 0) + uberEffects.attack_speed_pct,
      attackSpeedMorePct: [...baseMods.attackSpeedMorePct, ...uberEffects.attack_speed_more_pct],
      poisonChance: baseMods.poisonChance + (classAbility.poisonChance ?? 0) + uberEffects.poison_chance,
      poisonDamagePct: baseMods.poisonDamagePct + uberEffects.poison_damage_pct,
      poisonDamageMorePct: [...baseMods.poisonDamageMorePct, ...uberEffects.poison_damage_more_pct],
      igniteDamagePct: baseMods.igniteDamagePct + uberEffects.ignite_damage_pct,
      igniteDamageMorePct: [...baseMods.igniteDamageMorePct, ...uberEffects.ignite_damage_more_pct],
      chillChance: baseMods.chillChance + (classAbility.chillChance ?? 0) + uberEffects.chill_chance,
      chillEffectPct: baseMods.chillEffectPct + uberEffects.chill_effect_pct,
      freezeChance: baseMods.freezeChance + uberEffects.freeze_chance,
      hpRegen: baseMods.hpRegen + uberEffects.hp_regen,
      hpOnHit: baseMods.hpOnHit + uberEffects.hp_on_hit,
      damageReductionPct: baseMods.damageReductionPct + uberEffects.damage_reduction_pct,
    };

    const totalCriticalDamage = 150 + combinedMods.criticalDamage; // 基礎150%
    const totalHpRegen = combinedMods.hpRegen;
    const totalHpRegenPct = combinedMods.hpRegenPct;
    const totalHpOnHit = combinedMods.hpOnHit;
    const totalHpOnCrit = combinedMods.hpOnCrit;

    // 毎秒HP回復量を計算（フラット + %回復）
    // 最終HPを取得（getTotalStats()の結果を使用）
    const finalMaxHp = state.getTotalStats().maxHp;
    const hpRegenPerSecond = totalHpRegen + Math.floor(finalMaxHp * totalHpRegenPct / 100);
    const poisonDamageMoreTotal = combinedMods.poisonDamageMorePct.reduce((sum, v) => sum + v, 0);
    const attackSpeedMoreTotal = combinedMods.attackSpeedMorePct.reduce((sum, v) => sum + v, 0);
    const igniteDamageMoreTotal = combinedMods.igniteDamageMorePct.reduce((sum, v) => sum + v, 0);
    const finalAttackSpeed = getAttackSpeedFromMods(combinedMods);

    return {
      hp: {
        base: baseMaxHp,
        inc: passiveEffects.hp_increased_pct + equipHpIncPct,
        more: passiveEffects.hp_more_pct.reduce((sum, v) => sum + v, 0),
      },
      atk: {
        base: baseAtk,
        inc: passiveEffects.atk_increased_pct + equipAtkIncPct,
        more: passiveEffects.atk_more_pct.reduce((sum, v) => sum + v, 0),
      },
      def: {
        base: baseDef,
        inc: passiveEffects.def_increased_pct + equipDefIncPct,
        more: passiveEffects.def_more_pct.reduce((sum, v) => sum + v, 0),
      },
      criticalChance: combinedMods.criticalChance,
      criticalDamage: totalCriticalDamage,
      poisonChance: combinedMods.poisonChance,
      poisonDamagePct: combinedMods.poisonDamagePct,
      poisonDamageMore: poisonDamageMoreTotal,
      poisonMaxStacks: combinedMods.poisonMaxStacks,
      poisonDamageReduction: combinedMods.poisonDamageReduction,
      poisonLifesteal: combinedMods.poisonLifesteal,
      noDirectDamage: combinedMods.noDirectDamage,
      igniteChance: combinedMods.igniteChance,
      igniteDamagePct: combinedMods.igniteDamagePct,
      igniteDamageMore: igniteDamageMoreTotal,
      igniteDurationPct: combinedMods.igniteDurationPct,
      igniteLifesteal: combinedMods.igniteLifesteal,
      damageReductionPct: combinedMods.damageReductionPct,
      chillChance: combinedMods.chillChance,
      chillEffectPct: combinedMods.chillEffectPct,
      freezeChance: Math.min(combinedMods.freezeChance, 10),
      attackSpeedPct: combinedMods.attackSpeedPct,
      attackSpeedMore: attackSpeedMoreTotal,
      finalAttackSpeed,
      hpRegenPerSecond,
      hpOnHit: totalHpOnHit,
      hpOnCrit: totalHpOnCrit,
    };
  };

  const breakdown = showDetails ? getStatsBreakdown() : null;

  return (
    <Pressable onPress={toggleDetails}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('status.title')}</Text>
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
              <Text style={styles.detailLabel}>{t('status.critRate')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.criticalChance > 0 ? styles.critText : undefined}>
                  {breakdown.criticalChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.critDamage')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.criticalDamage > 150 ? styles.critText : undefined}>
                  {breakdown.criticalDamage}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonChance')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonChance > 0 ? styles.poisonText : undefined}>
                  {breakdown.poisonChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonDamage')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonDamagePct > 0 ? styles.poisonText : undefined}>
                  +{breakdown.poisonDamagePct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonDamageMore')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonDamageMore > 0 ? styles.poisonText : undefined}>
                  +{breakdown.poisonDamageMore}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonMaxStacks')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonMaxStacks > 0 ? styles.poisonText : undefined}>
                  {breakdown.poisonMaxStacks}
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonDamageReduction')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonDamageReduction > 0 ? styles.poisonText : undefined}>
                  {breakdown.poisonDamageReduction}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.poisonLifesteal')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.poisonLifesteal > 0 ? styles.poisonText : undefined}>
                  {breakdown.poisonLifesteal}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.noDirectDamage')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.noDirectDamage ? styles.poisonText : undefined}>
                  {breakdown.noDirectDamage ? t('status.on') : t('status.off')}
                </Text>
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.igniteChance')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.igniteChance > 0 ? styles.igniteText : undefined}>
                  {breakdown.igniteChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.igniteDamage')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.igniteDamagePct > 0 ? styles.igniteText : undefined}>
                  +{breakdown.igniteDamagePct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.igniteDamageMore')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.igniteDamageMore > 0 ? styles.igniteText : undefined}>
                  +{breakdown.igniteDamageMore}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.igniteDuration')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.igniteDurationPct > 0 ? styles.igniteText : undefined}>
                  +{breakdown.igniteDurationPct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.igniteLifesteal')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.igniteLifesteal > 0 ? styles.igniteText : undefined}>
                  {breakdown.igniteLifesteal}%
                </Text>
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.chillChance')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.chillChance > 0 ? styles.chillText : undefined}>
                  {breakdown.chillChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.chillEffect')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.chillEffectPct > 0 ? styles.chillText : undefined}>
                  +{breakdown.chillEffectPct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.freezeChance')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.freezeChance > 0 ? styles.chillText : undefined}>
                  {breakdown.freezeChance}%
                </Text>
              </Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.hpRegen')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.hpRegenPerSecond > 0 ? styles.healText : undefined}>
                  {breakdown.hpRegenPerSecond}{t('status.perSecond')}
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.hpOnHit')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.hpOnHit > 0 ? styles.healText : undefined}>
                  {breakdown.hpOnHit}
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.hpOnCrit')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.hpOnCrit > 0 ? styles.critHealText : undefined}>
                  +{breakdown.hpOnCrit}
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.damageReduction')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.damageReductionPct > 0 ? styles.healText : undefined}>
                  {breakdown.damageReductionPct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.attackSpeed')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.attackSpeedPct > 0 ? styles.critText : undefined}>
                  +{breakdown.attackSpeedPct}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.attackSpeedMore')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.attackSpeedMore > 0 ? styles.critText : undefined}>
                  +{breakdown.attackSpeedMore}%
                </Text>
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('status.finalAttackSpeed')}</Text>
              <Text style={styles.detailValue}>
                <Text style={breakdown.finalAttackSpeed > 1 ? styles.critText : undefined}>
                  {breakdown.finalAttackSpeed.toFixed(2)}
                </Text>
              </Text>
            </View>
          </View>
        )}

        <View style={styles.expContainer}>
          <Text style={styles.expLabel}>EXP</Text>
          <View style={styles.expBarContainer}>
            {level >= levelCap ? (
              <Text style={styles.maxLevelText}>{t('status.max')}</Text>
            ) : (
              <HPBar current={exp} max={expToNextLevel} color="#9C27B0" />
            )}
          </View>
        </View>

        {!showDetails && (
          <Text style={styles.tapHint}>{t('status.tapForDetails')}</Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: ms(12),
    padding: ms(10),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  title: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
  },
  level: {
    fontSize: fs(14),
    color: '#FFD700',
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: ms(8),
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: fs(11),
    color: '#aaa',
    marginBottom: ms(1),
  },
  statValue: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
  },
  // 詳細表示
  detailsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: ms(8),
    padding: ms(8),
    marginBottom: ms(8),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ms(4),
    width: '48%',
  },
  detailLabel: {
    fontSize: fs(12),
    color: '#aaa',
    flex: 1,
    marginRight: ms(6),
  },
  detailValue: {
    fontSize: fs(12),
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
    marginVertical: ms(8),
    width: '100%',
  },
  critText: {
    color: '#FF6B6B',
  },
  poisonText: {
    color: '#9CCC65',
  },
  igniteText: {
    color: '#FF7043',
  },
  chillText: {
    color: '#81D4FA',
  },
  healText: {
    color: '#4CAF50',
  },
  critHealText: {
    color: '#FF9800',
  },
  tapHint: {
    fontSize: fs(9),
    color: '#666',
    textAlign: 'center',
    marginTop: ms(3),
  },
  expContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expLabel: {
    fontSize: fs(11),
    color: '#aaa',
    marginRight: ms(8),
    width: ms(30),
  },
  expBarContainer: {
    flex: 1,
  },
  maxLevelText: {
    fontSize: fs(12),
    fontWeight: 'bold',
    color: '#FFD700',
  },
});
