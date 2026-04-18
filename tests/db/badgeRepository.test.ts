/**
 * badgeRepository 未読バッジ機能テスト
 * getUnseenBadgeCount / markBadgesAsSeen のSQL・ロジックを検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// getDatabase をモックしてDB依存を排除
const mockDb = {
  getAllAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  runAsync: vi.fn(),
};

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(() => Promise.resolve(mockDb)),
}));

import { badgeRepository } from '../../db/repositories/badgeRepository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('badgeRepository.getUnseenBadgeCount', () => {
  it('未読バッジ数を返す', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 3 });

    const result = await badgeRepository.getUnseenBadgeCount(1);

    expect(result).toBe(3);
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('seen = 0'),
      1
    );
  });

  it('未読バッジがない場合は0を返す', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

    const result = await badgeRepository.getUnseenBadgeCount(1);

    expect(result).toBe(0);
  });

  it('結果がnullの場合は0を返す', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);

    const result = await badgeRepository.getUnseenBadgeCount(1);

    expect(result).toBe(0);
  });
});

describe('badgeRepository.markBadgesAsSeen', () => {
  it('未読バッジをseen=1に更新する', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    await badgeRepository.markBadgesAsSeen(1);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE character_badges SET seen = 1'),
      1
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('seen = 0'),
      1
    );
  });

  it('character_idで絞り込んでいる', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    await badgeRepository.markBadgesAsSeen(42);

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('character_id = ?'),
      42
    );
  });
});

describe('badgeRepository.awardBadge', () => {
  it('新規バッジ付与時にseen=0を明示してINSERTされる（未読通知表示のため）', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);
    mockDb.getFirstAsync.mockResolvedValue({ changes: 1 });

    const result = await badgeRepository.awardBadge(1, 'badge_uber_goblin_king');

    expect(result).toBe(true);
    // PR #187: seen=0 を明示することで未読通知が確実に表示される
    const insertCall = mockDb.runAsync.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT OR IGNORE');
    expect(insertCall[0]).toContain('seen');
    expect(insertCall[0]).toContain('VALUES (?, ?, 0)');
  });
});
