import { fetchRankings, RankingEntryWithRank } from './firestore';

// ============================================
// Cache Configuration
// ============================================

const CACHE_DURATION_MS = 3 * 60 * 60 * 1000; // 3時間

// ============================================
// Cache State
// ============================================

let cachedRankings: RankingEntryWithRank[] | null = null;
let cacheTimestamp = 0;
let cachedSeason: number | null = null; // キャッシュ中のランキングのシーズン

// ============================================
// Cache API
// ============================================

/**
 * ランキングを取得（キャッシュ優先）
 * キャッシュが有効な場合はキャッシュを返す
 * キャッシュが無効な場合はFirestoreから取得してキャッシュ
 * @param season 取得対象シーズン（省略時は現在シーズン）。キャッシュと異なるシーズンなら再取得する。
 */
export const getRankings = async (forceRefresh = false, season?: number): Promise<RankingEntryWithRank[]> => {
  const now = Date.now();

  // シーズンが変わった場合はキャッシュを無効化（別シーズンのデータを返さない）
  const seasonChanged = season !== undefined && cachedSeason !== null && season !== cachedSeason;

  // キャッシュが有効かつ強制更新でなくシーズンも一致する場合はキャッシュを返す
  if (!forceRefresh && !seasonChanged && cachedRankings && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedRankings;
  }

  // Firestoreから取得
  try {
    const rankings = await fetchRankings(season);
    cachedRankings = rankings;
    cacheTimestamp = now;
    cachedSeason = season ?? null;
    return rankings;
  } catch (error) {
    console.error('[RankingCache] Failed to fetch rankings:', error);
    // エラー時はキャッシュがあればそれを返す
    if (cachedRankings) {
      return cachedRankings;
    }
    throw error;
  }
};

/**
 * キャッシュが有効かどうか
 */
export const isCacheValid = (): boolean => {
  return cachedRankings !== null && Date.now() - cacheTimestamp < CACHE_DURATION_MS;
};

/**
 * キャッシュの残り時間（ミリ秒）
 */
export const getCacheRemainingTime = (): number => {
  if (!cachedRankings) return 0;
  const remaining = CACHE_DURATION_MS - (Date.now() - cacheTimestamp);
  return Math.max(0, remaining);
};

/**
 * キャッシュをクリア
 */
export const clearRankingCache = (): void => {
  cachedRankings = null;
  cacheTimestamp = 0;
  cachedSeason = null;
};
