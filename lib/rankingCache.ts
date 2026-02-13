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

// ============================================
// Cache API
// ============================================

/**
 * ランキングを取得（キャッシュ優先）
 * キャッシュが有効な場合はキャッシュを返す
 * キャッシュが無効な場合はFirestoreから取得してキャッシュ
 */
export const getRankings = async (forceRefresh = false): Promise<RankingEntryWithRank[]> => {
  const now = Date.now();

  // キャッシュが有効かつ強制更新でない場合はキャッシュを返す
  if (!forceRefresh && cachedRankings && now - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedRankings;
  }

  // Firestoreから取得
  try {
    const rankings = await fetchRankings();
    cachedRankings = rankings;
    cacheTimestamp = now;
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
};
