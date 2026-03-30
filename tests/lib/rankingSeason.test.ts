import { describe, it, expect, vi } from 'vitest';

// expo-constants をモック（Node環境では利用不可のため）
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.2.4' } },
}));

import {
  semverCompare,
  calculateSeason,
  getCurrentSeason,
  getRankingCollectionName,
  getSeasonKeySuffix,
} from '../../lib/rankingSeason';

describe('lib/rankingSeason', () => {
  // ============================================
  // semverCompare
  // ============================================
  describe('semverCompare', () => {
    it('同じバージョンは0を返す', () => {
      expect(semverCompare('1.0.0', '1.0.0')).toBe(0);
      expect(semverCompare('1.2.4', '1.2.4')).toBe(0);
      expect(semverCompare('0.0.0', '0.0.0')).toBe(0);
    });

    it('メジャーバージョンで比較する', () => {
      expect(semverCompare('2.0.0', '1.0.0')).toBe(1);
      expect(semverCompare('1.0.0', '2.0.0')).toBe(-1);
    });

    it('マイナーバージョンで比較する', () => {
      expect(semverCompare('1.3.0', '1.2.0')).toBe(1);
      expect(semverCompare('1.2.0', '1.3.0')).toBe(-1);
    });

    it('パッチバージョンで比較する', () => {
      expect(semverCompare('1.2.4', '1.2.3')).toBe(1);
      expect(semverCompare('1.2.3', '1.2.4')).toBe(-1);
    });

    it('桁が異なるバージョンを正しく比較する', () => {
      expect(semverCompare('1.10.0', '1.9.0')).toBe(1);
      expect(semverCompare('1.9.0', '1.10.0')).toBe(-1);
      expect(semverCompare('10.0.0', '9.0.0')).toBe(1);
    });

    it('パーツが省略されている場合は0として扱う', () => {
      expect(semverCompare('1.0', '1.0.0')).toBe(0);
      expect(semverCompare('1', '1.0.0')).toBe(0);
    });
  });

  // ============================================
  // calculateSeason
  // ============================================
  describe('calculateSeason', () => {
    it('リセットバージョンが空ならSeason 1', () => {
      expect(calculateSeason('1.2.4', [])).toBe(1);
      expect(calculateSeason('99.0.0', [])).toBe(1);
    });

    it('リセットバージョン未満ならSeason 1', () => {
      expect(calculateSeason('1.2.4', ['1.3.0'])).toBe(1);
      expect(calculateSeason('1.2.9', ['1.3.0'])).toBe(1);
    });

    it('リセットバージョンと同じならSeason 2', () => {
      expect(calculateSeason('1.3.0', ['1.3.0'])).toBe(2);
    });

    it('リセットバージョンを超えたらSeason 2', () => {
      expect(calculateSeason('1.3.1', ['1.3.0'])).toBe(2);
      expect(calculateSeason('2.0.0', ['1.3.0'])).toBe(2);
    });

    it('複数のリセットバージョンで正しくシーズンが増える', () => {
      const resets = ['1.3.0', '1.5.0', '2.0.0'];
      expect(calculateSeason('1.2.4', resets)).toBe(1);
      expect(calculateSeason('1.3.0', resets)).toBe(2);
      expect(calculateSeason('1.4.9', resets)).toBe(2);
      expect(calculateSeason('1.5.0', resets)).toBe(3);
      expect(calculateSeason('1.9.9', resets)).toBe(3);
      expect(calculateSeason('2.0.0', resets)).toBe(4);
      expect(calculateSeason('3.0.0', resets)).toBe(4);
    });
  });

  // ============================================
  // getCurrentSeason（モック版 v1.2.4, RANKING_RESET_VERSIONS=[]）
  // ============================================
  describe('getCurrentSeason', () => {
    it('RANKING_RESET_VERSIONSが空の場合Season 1を返す', () => {
      // モックでversion='1.2.4'、RANKING_RESET_VERSIONS=[]
      expect(getCurrentSeason()).toBe(1);
    });
  });

  // ============================================
  // getRankingCollectionName
  // ============================================
  describe('getRankingCollectionName', () => {
    it('Season 1は後方互換のコレクション名を返す', () => {
      expect(getRankingCollectionName(1)).toBe('dimensional_rankings');
    });

    it('Season 2以降はサフィックス付きのコレクション名を返す', () => {
      expect(getRankingCollectionName(2)).toBe('dimensional_rankings_s2');
      expect(getRankingCollectionName(3)).toBe('dimensional_rankings_s3');
      expect(getRankingCollectionName(10)).toBe('dimensional_rankings_s10');
    });
  });

  // ============================================
  // getSeasonKeySuffix
  // ============================================
  describe('getSeasonKeySuffix', () => {
    it('Season 1は空文字を返す（後方互換）', () => {
      expect(getSeasonKeySuffix(1)).toBe('');
    });

    it('Season 2以降はサフィックスを返す', () => {
      expect(getSeasonKeySuffix(2)).toBe('_s2');
      expect(getSeasonKeySuffix(3)).toBe('_s3');
      expect(getSeasonKeySuffix(10)).toBe('_s10');
    });
  });

  // ============================================
  // 後方互換性の統合テスト
  // ============================================
  describe('後方互換性', () => {
    it('Season 1のコレクション名とキーサフィックスは既存形式と一致する', () => {
      const collectionName = getRankingCollectionName(1);
      const keySuffix = getSeasonKeySuffix(1);

      // 既存のキー形式: dimensional_corridor_best_{characterId}
      const existingKey = `dimensional_corridor_best${keySuffix}_5`;
      expect(existingKey).toBe('dimensional_corridor_best_5');
      expect(collectionName).toBe('dimensional_rankings');
    });

    it('Season 2のキーはSeason 1と異なる', () => {
      const s1Key = `dimensional_corridor_best${getSeasonKeySuffix(1)}_5`;
      const s2Key = `dimensional_corridor_best${getSeasonKeySuffix(2)}_5`;

      expect(s1Key).toBe('dimensional_corridor_best_5');
      expect(s2Key).toBe('dimensional_corridor_best_s2_5');
      expect(s1Key).not.toBe(s2Key);
    });
  });
});
