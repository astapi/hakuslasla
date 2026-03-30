import { getDatabase } from '../database';

export interface BadgeRecord {
  badgeId: string;
  earnedAt: string;
}

export const badgeRepository = {
  /**
   * キャラクターのバッジ一覧を取得
   */
  async getBadges(characterId: number): Promise<BadgeRecord[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ badge_id: string; earned_at: string }>(
      'SELECT badge_id, earned_at FROM character_badges WHERE character_id = ?',
      characterId
    );
    return rows.map(r => ({ badgeId: r.badge_id, earnedAt: r.earned_at }));
  },

  /**
   * バッジを持っているか確認
   */
  async hasBadge(characterId: number, badgeId: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM character_badges WHERE character_id = ? AND badge_id = ?',
      characterId,
      badgeId
    );
    return (row?.count ?? 0) > 0;
  },

  /**
   * バッジを付与（既に持っている場合は無視）
   * @returns true if newly awarded, false if already had
   */
  async awardBadge(characterId: number, badgeId: string): Promise<boolean> {
    const db = await getDatabase();
    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO character_badges (character_id, badge_id, seen) VALUES (?, ?, 0)',
        characterId,
        badgeId
      );
      // INSERT OR IGNORE returns changes=0 if already existed
      const result = await db.getFirstAsync<{ changes: number }>(
        'SELECT changes() as changes'
      );
      return (result?.changes ?? 0) > 0;
    } catch {
      return false;
    }
  },

  /**
   * キャラクターのバッジ数を取得
   */
  async getBadgeCount(characterId: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM character_badges WHERE character_id = ?',
      characterId
    );
    return row?.count ?? 0;
  },

  /**
   * 未読バッジ数を取得
   */
  async getUnseenBadgeCount(characterId: number): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM character_badges WHERE character_id = ? AND seen = 0',
      characterId
    );
    return row?.count ?? 0;
  },

  /**
   * バッジを既読にする
   */
  async markBadgesAsSeen(characterId: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE character_badges SET seen = 1 WHERE character_id = ? AND seen = 0',
      characterId
    );
  },

  /**
   * 全バッジ所持チェック（UberUber入場条件用）
   * excludeBadgeIds で指定したバッジは除外してチェック
   */
  async hasAllBadgesExcept(characterId: number, requiredBadgeIds: string[], excludeBadgeIds: string[]): Promise<boolean> {
    const checkIds = requiredBadgeIds.filter(id => !excludeBadgeIds.includes(id));
    if (checkIds.length === 0) return true;

    const db = await getDatabase();
    const placeholders = checkIds.map(() => '?').join(',');
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT badge_id) as count FROM character_badges WHERE character_id = ? AND badge_id IN (${placeholders})`,
      characterId,
      ...checkIds
    );
    return (row?.count ?? 0) >= checkIds.length;
  },
};
