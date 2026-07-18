import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from '@react-native-firebase/firestore';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { CharacterType, Equipment } from '@/types';
import { getRankingCollectionName } from './rankingSeason';

// ============================================
// Types
// ============================================

export interface RankingStats {
  // 基本ステータス
  level: number;
  maxHp: number;
  atk: number;
  def: number;
  // クリティカル
  critChance: number;
  critDamage: number;
  // 毒
  poisonChance: number;
  poisonDamagePct: number;
  poisonDamageMore: number;
  poisonMaxStacks: number;
  poisonDamageReduction: number;
  poisonLifesteal: number;
  noDirectDamage: boolean;
  // チル・フリーズ
  chillChance: number;
  chillEffectPct: number;
  chillDurationPct: number;
  freezeChance: number;
  freezeDurationPct: number;
  // 発火
  igniteChance: number;
  igniteDamagePct: number;
  igniteDamageMore: number;
  igniteDurationPct: number;
  igniteLifesteal: number;
  // 回復・防御
  hpRegen: number;
  hpOnHit: number;
  hpOnCrit: number;
  damageDefer: number;
  // 攻撃速度
  attackSpeedPct: number;
  attackSpeedMore: number;
  attackSpeed: number;
}

export interface RankingBuild {
  level: number;
  equipment: Equipment;
  unlockedSkills: string[];
  // Uberツリーの解放ノード。ビルド分析ツール（tools/build-explorer）で
  // パッシブツリーと同様にヒートマップ表示するために記録する。
  // 過去に記録されたドキュメントには存在しないため optional。
  unlockedUberSkills?: string[];
}

export interface RankingEntry {
  deviceId: string;
  localCharId: number;
  name: string;
  type: CharacterType;
  floorReached: number;
  updatedAt: Timestamp;
  stats: RankingStats;
  build?: RankingBuild;
}

export interface RankingEntryWithRank extends RankingEntry {
  rank: number;
}

// ============================================
// Constants
// ============================================

// season を省略した場合は getRankingCollectionName 内で getCurrentSeason() が使われる（後方互換）
const getCollectionName = (season?: number) => getRankingCollectionName(season);

// ============================================
// Device ID
// ============================================

let cachedDeviceId: string | null = null;

export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;

  if (Platform.OS === 'ios') {
    cachedDeviceId = await Application.getIosIdForVendorAsync() || 'unknown';
  } else if (Platform.OS === 'android') {
    cachedDeviceId = Application.getAndroidId() || 'unknown';
  } else {
    cachedDeviceId = 'unknown';
  }

  return cachedDeviceId;
};

// ============================================
// Ranking API
// ============================================

/**
 * ランキングを取得（上位50件）
 */
export const fetchRankings = async (season?: number): Promise<RankingEntryWithRank[]> => {
  const db = getFirestore();
  const rankingRef = collection(db, getCollectionName(season));
  const q = query(rankingRef, orderBy('floorReached', 'desc'), limit(50));
  const snapshot = await getDocs(q);

  const entries: RankingEntry[] = snapshot.docs.map((docSnap: { data: () => unknown }) => ({
    ...(docSnap.data() as RankingEntry),
  }));

  // 同率順位を計算
  return entries.map((entry, index, arr) => {
    let rank = index + 1;
    if (index > 0 && arr[index - 1].floorReached === entry.floorReached) {
      // 前の人と同じ階層なら同じ順位
      const prevEntry = arr[index - 1] as RankingEntryWithRank;
      rank = prevEntry.rank;
    }
    return { ...entry, rank };
  });
};

/**
 * ランキングにスコアを送信（記録更新時のみ呼ぶこと）
 */
export const submitScore = async (params: {
  localCharId: number;
  name: string;
  type: CharacterType;
  floorReached: number;
  stats: RankingStats;
  build: RankingBuild;
  season?: number;
}): Promise<void> => {
  // 開発環境では送信しない
  if (__DEV__) {
    console.log('[Ranking] DEV mode - skip submit:', params);
    return;
  }

  const deviceId = await getDeviceId();
  const docId = `${deviceId}_${params.localCharId}`;

  const entry: Omit<RankingEntry, 'updatedAt' | 'build'> & { updatedAt: FieldValue; build: RankingBuild } = {
    deviceId,
    localCharId: params.localCharId,
    name: params.name,
    type: params.type,
    floorReached: params.floorReached,
    stats: params.stats,
    build: params.build,
    updatedAt: serverTimestamp(),
  };

  const db = getFirestore();
  const docRef = doc(db, getCollectionName(params.season), docId);
  await setDoc(docRef, entry);
};

// ============================================
// UberUberクラーケン クリア記録
// ============================================

/**
 * UberUberクラーケンのクリア記録コレクション名
 * ランキングと違いシーズンでリセットしない実績なので単一コレクションに集約し、
 * 判別用に season フィールドをドキュメントへ持たせる。
 */
export const UBER_UBER_KRAKEN_CLEARS_COLLECTION = 'uber_uber_kraken_clears';

export interface UberClearEntry {
  deviceId: string;
  localCharId: number;
  name: string;
  type: CharacterType;
  dungeonId: string;
  level: number;
  season: number;
  updatedAt: Timestamp;
  stats: RankingStats;
  build: RankingBuild;
}

/**
 * UberUberクラーケンの初回クリアを記録（初回クリア時のみ呼ぶこと）
 * docId = `${deviceId}_${localCharId}` で1キャラ1ドキュメント。
 */
export const submitUberUberKrakenClear = async (params: {
  localCharId: number;
  name: string;
  type: CharacterType;
  level: number;
  season: number;
  stats: RankingStats;
  build: RankingBuild;
}): Promise<void> => {
  // 開発環境では送信しない
  if (__DEV__) {
    console.log('[UberClear] DEV mode - skip submit:', params);
    return;
  }

  const deviceId = await getDeviceId();
  const docId = `${deviceId}_${params.localCharId}`;

  const entry: Omit<UberClearEntry, 'updatedAt'> & { updatedAt: FieldValue } = {
    deviceId,
    localCharId: params.localCharId,
    name: params.name,
    type: params.type,
    dungeonId: 'uber_uber_kraken',
    level: params.level,
    season: params.season,
    stats: params.stats,
    build: params.build,
    updatedAt: serverTimestamp(),
  };

  const db = getFirestore();
  const docRef = doc(db, UBER_UBER_KRAKEN_CLEARS_COLLECTION, docId);
  await setDoc(docRef, entry);
};

/**
 * 自分のランキングエントリを取得
 */
export const getMyRankingEntry = async (localCharId: number, season?: number): Promise<RankingEntry | null> => {
  const deviceId = await getDeviceId();
  const docId = `${deviceId}_${localCharId}`;

  const db = getFirestore();
  const docRef = doc(db, getCollectionName(season), docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docSnap.data() as RankingEntry;
};
