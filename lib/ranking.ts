import { submitScore, RankingStats } from './firestore';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { combineMods, getAttackSpeedFromMods } from '@/core/modEffects';
import { CLASS_ABILITIES } from '@/core/player';

/**
 * 次元回廊のランキングスコアを送信（記録更新時のみ）
 * @param floorReached 到達階層
 * @returns 記録更新があった場合はtrue
 */
export const submitDimensionalCorridorScore = async (
  floorReached: number
): Promise<boolean> => {
  const state = usePlayerStore.getState();

  if (!state.characterId) {
    console.log('[Ranking] No character loaded');
    return false;
  }

  // ローカルで記録更新チェック
  const isNewRecord = await settingsRepository.setDimensionalCorridorBest(
    state.characterId,
    floorReached
  );

  if (!isNewRecord) {
    console.log('[Ranking] Not a new record, skip submit');
    return false;
  }

  // ステータス計算
  const stats = state.getTotalStats();
  const passiveEffects = calculatePassiveEffects(state.unlockedSkills);
  const combinedMods = combineMods(Object.values(state.equipment), passiveEffects);
  const classAbility = CLASS_ABILITIES[state.characterType];

  // more%の合計を計算
  const poisonDamageMoreTotal = combinedMods.poisonDamageMorePct.reduce((sum, v) => sum + v, 0);
  const igniteDamageMoreTotal = combinedMods.igniteDamageMorePct.reduce((sum, v) => sum + v, 0);
  const attackSpeedMoreTotal = combinedMods.attackSpeedMorePct.reduce((sum, v) => sum + v, 0);

  const rankingStats: RankingStats = {
    // 基本ステータス
    level: state.level,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    // クリティカル
    critChance: combinedMods.criticalChance + (classAbility.criticalChance ?? 0),
    critDamage: 150 + combinedMods.criticalDamage,
    // 毒
    poisonChance: combinedMods.poisonChance + (classAbility.poisonChance ?? 0),
    poisonDamagePct: combinedMods.poisonDamagePct,
    poisonDamageMore: poisonDamageMoreTotal,
    poisonMaxStacks: combinedMods.poisonMaxStacks,
    poisonDamageReduction: combinedMods.poisonDamageReduction,
    poisonLifesteal: combinedMods.poisonLifesteal,
    noDirectDamage: combinedMods.noDirectDamage,
    // 発火
    igniteChance: combinedMods.igniteChance + (classAbility.igniteChance ?? 0),
    igniteDamagePct: combinedMods.igniteDamagePct,
    igniteDamageMore: igniteDamageMoreTotal,
    igniteDurationPct: combinedMods.igniteDurationPct,
    igniteLifesteal: combinedMods.igniteLifesteal,
    // 回復・防御
    hpRegen: combinedMods.hpRegen + Math.floor(stats.maxHp * combinedMods.hpRegenPct / 100),
    hpOnHit: combinedMods.hpOnHit,
    hpOnCrit: combinedMods.hpOnCrit,
    damageDefer: combinedMods.damageDeferPct,
    // 攻撃速度
    attackSpeedPct: combinedMods.attackSpeedPct + (classAbility.attackSpeedPct ?? 0),
    attackSpeedMore: attackSpeedMoreTotal,
    attackSpeed: getAttackSpeedFromMods({
      ...combinedMods,
      attackSpeedPct: combinedMods.attackSpeedPct + (classAbility.attackSpeedPct ?? 0),
    }),
  };

  const build = {
    level: state.level,
    equipment: state.equipment,
    unlockedSkills: state.unlockedSkills,
  };

  try {
    await submitScore({
      localCharId: state.characterId,
      name: state.characterName,
      type: state.characterType,
      floorReached,
      stats: rankingStats,
      build,
    });
    console.log('[Ranking] Score submitted:', floorReached);
    return true;
  } catch (error) {
    console.error('[Ranking] Failed to submit score:', error);
    return false;
  }
};
