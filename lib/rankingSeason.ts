/**
 * ランキングシーズン管理
 *
 * RANKING_RESET_VERSIONS にバージョンを追加するだけで新シーズンが開始される。
 * 新シーズンでは Firestore コレクション名とローカル記録キーが切り替わり、
 * ランキングとスタート階層が自動的にリセットされる。
 */

import Constants from 'expo-constants';

/**
 * ランキングリセットが発生するバージョン一覧（昇順）
 * 例: ['1.3.0'] → v1.3.0 以降は Season 2
 * 例: ['1.3.0', '1.5.0'] → v1.5.0 以降は Season 3
 */
export const RANKING_RESET_VERSIONS: string[] = ['1.3.0', '2.0.0'];

/**
 * semver比較: a < b → -1, a == b → 0, a > b → 1
 */
export function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

/**
 * 指定バージョンとリセットバージョン一覧からシーズン番号を計算する
 */
export function calculateSeason(appVersion: string, resetVersions: string[]): number {
  let season = 1;
  for (const resetVersion of resetVersions) {
    if (semverCompare(appVersion, resetVersion) >= 0) {
      season++;
    }
  }
  return season;
}

/**
 * 現在のアプリバージョンに基づくシーズン番号を返す
 */
export function getCurrentSeason(): number {
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  return calculateSeason(appVersion, RANKING_RESET_VERSIONS);
}

/**
 * シーズンに対応するFirestoreコレクション名を返す
 * Season 1: 'dimensional_rankings'（後方互換）
 * Season 2+: 'dimensional_rankings_s{N}'
 */
export function getRankingCollectionName(season?: number): string {
  const s = season ?? getCurrentSeason();
  return s === 1 ? 'dimensional_rankings' : `dimensional_rankings_s${s}`;
}

/**
 * シーズンに対応するローカル記録キーのサフィックスを返す
 * Season 1: ''（後方互換）
 * Season 2+: '_s{N}'
 */
export function getSeasonKeySuffix(season?: number): string {
  const s = season ?? getCurrentSeason();
  return s === 1 ? '' : `_s${s}`;
}
