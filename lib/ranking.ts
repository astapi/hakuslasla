import { submitScore, submitUberUberKrakenClear, RankingStats } from './firestore';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { calculatePassiveEffects } from '@/data/passiveTree';
import { combineMods, getAttackSpeedFromMods } from '@/core/modEffects';
import { CLASS_ABILITIES } from '@/core/player';
import { buildCharacterBuildSnapshot, CharacterBuildSnapshot } from '@/utils/buildSnapshot';

type PlayerState = ReturnType<typeof usePlayerStore.getState>;

/**
 * 現在のプレイヤー状態から Firestore 送信用の stats / build を組み立てる。
 * 次元回廊ランキングと UberUberクリア記録で共通利用する。
 * build はデバッグメニューの「ビルドJSON」と同一フォーマット（ペット・Uberスキル等を含む）。
 */
export const buildCurrentRankingPayload = (
  state: PlayerState
): { stats: RankingStats; build: CharacterBuildSnapshot } => {
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
    // チル・フリーズ
    chillChance: combinedMods.chillChance + (classAbility.chillChance ?? 0),
    chillEffectPct: combinedMods.chillEffectPct,
    chillDurationPct: combinedMods.chillDurationPct,
    freezeChance: Math.min(combinedMods.freezeChance, 10),
    freezeDurationPct: combinedMods.freezeDurationPct,
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

  const build = buildCharacterBuildSnapshot({
    level: state.level,
    equipment: state.equipment,
    pets: state.pets,
    activePetInstanceId: state.activePetInstanceId,
    petLevels: state.petLevels,
    unlockedSkills: state.unlockedSkills,
    unlockedUberSkills: state.unlockedUberSkills,
    uberPoints: state.uberPoints,
  });

  return { stats: rankingStats, build };
};

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

  // ローカルで記録更新チェック（キャラのシーズンのキーで記録）
  const isNewRecord = await settingsRepository.setDimensionalCorridorBest(
    state.characterId,
    floorReached,
    state.season
  );

  if (!isNewRecord) {
    console.log('[Ranking] Not a new record, skip submit');
    return false;
  }

  const { stats, build } = buildCurrentRankingPayload(state);

  try {
    await submitScore({
      localCharId: state.characterId,
      name: state.characterName,
      type: state.characterType,
      floorReached,
      stats,
      build,
      season: state.season,
    });
    console.log('[Ranking] Score submitted:', floorReached);
    return true;
  } catch (error) {
    console.error('[Ranking] Failed to submit score:', error);
    return false;
  }
};

/**
 * UberUberクラーケンの初回クリアを Firestore に記録する。
 * 初回クリア判定は呼び出し側（バッジ新規付与）で行うため、ここでは無条件に送信する。
 * @returns 送信に成功した場合は true
 */
export const submitUberUberKrakenClearRecord = async (): Promise<boolean> => {
  const state = usePlayerStore.getState();

  if (!state.characterId) {
    console.log('[UberClear] No character loaded');
    return false;
  }

  const { stats, build } = buildCurrentRankingPayload(state);

  try {
    await submitUberUberKrakenClear({
      localCharId: state.characterId,
      name: state.characterName,
      type: state.characterType,
      level: state.level,
      season: state.season,
      stats,
      build,
    });
    console.log('[UberClear] Clear submitted');
    return true;
  } catch (error) {
    console.error('[UberClear] Failed to submit clear:', error);
    return false;
  }
};
