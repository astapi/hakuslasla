import badgesData from './json/badges.json';

export interface BadgeCondition {
  type: 'uber_boss_clear' | 'dimensional_floor';
  dungeonId?: string;
  floor?: number;
}

export interface BadgeDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  condition: BadgeCondition;
  icon: string;
}

// バッジ定義をロード
export const BADGES: BadgeDefinition[] = badgesData.badges as BadgeDefinition[];

// バッジIDからバッジ定義を取得
export const getBadgeById = (badgeId: string): BadgeDefinition | undefined => {
  return BADGES.find(b => b.id === badgeId);
};

// 全バッジID一覧
export const ALL_BADGE_IDS = BADGES.map(b => b.id);

// UberUberバッジ以外の全バッジID（UberUber入場条件チェック用）
export const BADGE_IDS_EXCEPT_UBER_UBER = BADGES
  .filter(b => b.id !== 'badge_uber_uber_goblin_king')
  .map(b => b.id);

// Uberボスクリアバッジの取得
export const getUberBossClearBadgeId = (dungeonId: string): string | undefined => {
  const badge = BADGES.find(
    b => b.condition.type === 'uber_boss_clear' && b.condition.dungeonId === dungeonId
  );
  return badge?.id;
};

// 次元回廊バッジの条件フロア
export const DIMENSIONAL_BADGE_FLOOR = 4000;

// 次元回廊バッジID
export const DIMENSIONAL_BADGE_ID = 'badge_dimensional_4000';

// UberUberゴブリンキングバッジID
export const UBER_UBER_BADGE_ID = 'badge_uber_uber_goblin_king';
