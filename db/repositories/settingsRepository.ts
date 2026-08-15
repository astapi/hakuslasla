import { getDatabase } from '../database';
import { DropFilterSettings, DEFAULT_DROP_FILTER } from '@/types';
import { getSeasonKeySuffix } from '@/lib/rankingSeason';

const DROP_FILTER_KEY = 'drop_filter_settings';
const BATTLE_SPEED_KEY = 'battle_speed';
const LANGUAGE_KEY = 'app_language';
const BGM_ENABLED_KEY = 'bgm_enabled';
const SE_ENABLED_KEY = 'se_enabled';
const END_CONTENT_UNLOCK_KEY = 'end_content_unlocked';
const UBER_UNLOCKS_KEY = 'uber_boss_unlocks';
const UBER_TICKETS_KEY = 'uber_boss_tickets';
const ENGRAVE_STONES_KEY = 'engrave_stones';
const RESPEC_TOKENS_KEY = 'respec_tokens';
const DUNGEON_CLEAR_RECORDS_KEY = 'dungeon_clear_records';
const DIMENSIONAL_CORRIDOR_BEST_KEY = 'dimensional_corridor_best';
const BOOST_TOOLTIP_SHOWN_KEY = 'boost_tooltip_shown';
const MOD_FILTER_TOOLTIP_SHOWN_KEY = 'mod_filter_tooltip_shown';
const STORE_REVIEW_REQUESTED_KEY = 'store_review_requested';
const INVITE_SPEED_BOOST_KEY = 'invite_speed_boost';
const MY_INVITE_CODE_KEY = 'my_invite_code';
const NEWS_LAST_READ_KEY = 'news_last_read_date';
const END_CONTENT_TOOLTIP_SHOWN_KEY = 'end_content_tooltip_shown';
const UBER_TREE_TOOLTIP_SHOWN_KEY = 'uber_tree_tooltip_shown';
const DIMENSIONAL_CORRIDOR_TOOLTIP_SHOWN_KEY = 'dimensional_corridor_tooltip_shown';

function seasonKey(baseKey: string, season?: number): string {
  return `${baseKey}${getSeasonKeySuffix(season)}`;
}

// ダンジョンクリア記録の型
export type DungeonClearRecord = {
  clearedAt: string;
  bestFloor: number;
};
export type DungeonClearRecords = Record<string, DungeonClearRecord>;

export type AppLanguage = 'ja' | 'en' | 'zh' | 'ko' | 'es' | 'fr' | 'de' | 'system';
export const LANGUAGE_OPTIONS: AppLanguage[] = ['system', 'ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'];
export const DEFAULT_LANGUAGE: AppLanguage = 'system';

// 言語コードからネイティブ表記へのマッピング
export const LANGUAGE_LABELS: Record<Exclude<AppLanguage, 'system'>, string> = {
  ja: '日本語',
  en: 'English',
  zh: '简体中文',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export type BattleSpeedMultiplier = 1 | 2 | 3;
export const BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [1, 2, 3];
export const DEFAULT_BATTLE_SPEED: BattleSpeedMultiplier = 1;

// 無料で使える倍速オプション
export const FREE_BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [1, 2];
// 課金で使える倍速オプション（3倍）
export const PREMIUM_BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [3];

export const settingsRepository = {
  async get(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM game_settings WHERE key = ?',
      key
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO game_settings (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      key,
      value
    );
  },

  async delete(key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM game_settings WHERE key = ?',
      key
    );
  },

  // 便利なヘルパー
  async getLastCharacterId(): Promise<number | null> {
    const value = await this.get('last_character_id');
    return value ? parseInt(value, 10) : null;
  },

  async setLastCharacterId(characterId: number): Promise<void> {
    await this.set('last_character_id', characterId.toString());
  },

  // ドロップフィルター設定
  async getDropFilter(): Promise<DropFilterSettings> {
    const value = await this.get(DROP_FILTER_KEY);
    if (!value) {
      return DEFAULT_DROP_FILTER;
    }
    try {
      return JSON.parse(value) as DropFilterSettings;
    } catch {
      return DEFAULT_DROP_FILTER;
    }
  },

  async setDropFilter(settings: DropFilterSettings): Promise<void> {
    await this.set(DROP_FILTER_KEY, JSON.stringify(settings));
  },

  // 戦闘速度設定
  async getBattleSpeed(): Promise<BattleSpeedMultiplier> {
    const value = await this.get(BATTLE_SPEED_KEY);
    if (!value) {
      return DEFAULT_BATTLE_SPEED;
    }
    const parsed = parseFloat(value) as BattleSpeedMultiplier;
    if (BATTLE_SPEED_OPTIONS.includes(parsed)) {
      return parsed;
    }
    return DEFAULT_BATTLE_SPEED;
  },

  async setBattleSpeed(speed: BattleSpeedMultiplier): Promise<void> {
    await this.set(BATTLE_SPEED_KEY, speed.toString());
  },

  // 言語設定
  async getLanguage(): Promise<AppLanguage> {
    const value = await this.get(LANGUAGE_KEY);
    if (!value) {
      return DEFAULT_LANGUAGE;
    }
    if (LANGUAGE_OPTIONS.includes(value as AppLanguage)) {
      return value as AppLanguage;
    }
    return DEFAULT_LANGUAGE;
  },

  async setLanguage(language: AppLanguage): Promise<void> {
    await this.set(LANGUAGE_KEY, language);
  },

  // BGM設定
  async getBgmEnabled(): Promise<boolean> {
    const value = await this.get(BGM_ENABLED_KEY);
    // デフォルトはON
    return value !== '0';
  },

  async setBgmEnabled(enabled: boolean): Promise<void> {
    await this.set(BGM_ENABLED_KEY, enabled ? '1' : '0');
  },

  // SE設定
  async getSeEnabled(): Promise<boolean> {
    const value = await this.get(SE_ENABLED_KEY);
    // デフォルトはON
    return value !== '0';
  },

  async setSeEnabled(enabled: boolean): Promise<void> {
    await this.set(SE_ENABLED_KEY, enabled ? '1' : '0');
  },

  // 言語が一度でも設定されたかどうか（初回起動判定用）
  async hasLanguageBeenSet(): Promise<boolean> {
    const value = await this.get(LANGUAGE_KEY);
    return value !== null;
  },

  async getEndContentUnlocked(season?: number): Promise<boolean> {
    const value = await this.get(seasonKey(END_CONTENT_UNLOCK_KEY, season));
    return value === '1';
  },

  async setEndContentUnlocked(unlocked: boolean, season?: number): Promise<void> {
    await this.set(seasonKey(END_CONTENT_UNLOCK_KEY, season), unlocked ? '1' : '0');
  },

  async getUberBossUnlocks(season?: number): Promise<Record<string, boolean>> {
    const value = await this.get(seasonKey(UBER_UNLOCKS_KEY, season));
    if (!value) return {};
    try {
      return JSON.parse(value) as Record<string, boolean>;
    } catch {
      return {};
    }
  },

  async unlockUberBoss(bossId: string, season?: number): Promise<void> {
    const current = await this.getUberBossUnlocks(season);
    if (current[bossId]) return;
    current[bossId] = true;
    await this.set(seasonKey(UBER_UNLOCKS_KEY, season), JSON.stringify(current));
  },

  async getUberTickets(season?: number): Promise<Record<string, number>> {
    const value = await this.get(seasonKey(UBER_TICKETS_KEY, season));
    if (!value) return {};
    try {
      return JSON.parse(value) as Record<string, number>;
    } catch {
      return {};
    }
  },

  async getUberTicketCount(bossId: string, season?: number): Promise<number> {
    const current = await this.getUberTickets(season);
    return current[bossId] ?? 0;
  },

  async addUberTicket(bossId: string, count: number = 1, season?: number): Promise<number> {
    const current = await this.getUberTickets(season);
    const nextCount = (current[bossId] ?? 0) + count;
    current[bossId] = nextCount;
    await this.set(seasonKey(UBER_TICKETS_KEY, season), JSON.stringify(current));
    return nextCount;
  },

  async consumeUberTicket(bossId: string, count: number = 1, season?: number): Promise<boolean> {
    const current = await this.getUberTickets(season);
    const available = current[bossId] ?? 0;
    if (available < count) return false;
    const nextCount = available - count;
    if (nextCount <= 0) {
      delete current[bossId];
    } else {
      current[bossId] = nextCount;
    }
    await this.set(seasonKey(UBER_TICKETS_KEY, season), JSON.stringify(current));
    return true;
  },

  // 刻印（クラフト通貨）: MOD種別ID -> 所持数。シーズン非依存（クラフト素材は永続）。
  async getEngraveStones(): Promise<Record<string, number>> {
    const value = await this.get(ENGRAVE_STONES_KEY);
    if (!value) return {};
    try {
      return JSON.parse(value) as Record<string, number>;
    } catch {
      return {};
    }
  },

  async getEngraveStoneCount(engraveId: string): Promise<number> {
    const current = await this.getEngraveStones();
    return current[engraveId] ?? 0;
  },

  async addEngraveStone(engraveId: string, count: number = 1): Promise<number> {
    const current = await this.getEngraveStones();
    const nextCount = (current[engraveId] ?? 0) + count;
    current[engraveId] = nextCount;
    await this.set(ENGRAVE_STONES_KEY, JSON.stringify(current));
    return nextCount;
  },

  async consumeEngraveStone(engraveId: string, count: number = 1): Promise<boolean> {
    const current = await this.getEngraveStones();
    const available = current[engraveId] ?? 0;
    if (available < count) return false;
    const nextCount = available - count;
    if (nextCount <= 0) {
      delete current[engraveId];
    } else {
      current[engraveId] = nextCount;
    }
    await this.set(ENGRAVE_STONES_KEY, JSON.stringify(current));
    return true;
  },

  // リスペックトークン
  async getRespecTokens(): Promise<number> {
    const value = await this.get(RESPEC_TOKENS_KEY);
    if (!value) return 0;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  async addRespecTokens(count: number = 1): Promise<number> {
    const current = await this.getRespecTokens();
    const nextCount = current + count;
    await this.set(RESPEC_TOKENS_KEY, nextCount.toString());
    return nextCount;
  },

  async consumeRespecTokens(count: number = 1): Promise<boolean> {
    const current = await this.getRespecTokens();
    if (current < count) return false;
    const nextCount = current - count;
    await this.set(RESPEC_TOKENS_KEY, nextCount.toString());
    return true;
  },

  // ダンジョンクリア記録
  async getDungeonClearRecords(season?: number): Promise<DungeonClearRecords> {
    const value = await this.get(seasonKey(DUNGEON_CLEAR_RECORDS_KEY, season));
    if (!value) return {};
    try {
      return JSON.parse(value) as DungeonClearRecords;
    } catch {
      return {};
    }
  },

  async saveDungeonClearRecord(dungeonId: string, bestFloor: number, season?: number): Promise<void> {
    const current = await this.getDungeonClearRecords(season);
    const existing = current[dungeonId];

    // 既にクリア済みの場合、最高到達階層を更新
    if (existing) {
      current[dungeonId] = {
        ...existing,
        bestFloor: Math.max(existing.bestFloor, bestFloor),
      };
    } else {
      current[dungeonId] = {
        clearedAt: new Date().toISOString(),
        bestFloor,
      };
    }

    await this.set(seasonKey(DUNGEON_CLEAR_RECORDS_KEY, season), JSON.stringify(current));
  },

  async isDungeonCleared(dungeonId: string, season?: number): Promise<boolean> {
    const records = await this.getDungeonClearRecords(season);
    return records[dungeonId] !== undefined;
  },

  // 次元回廊の最高記録（キャラクターごと・シーズンごと）
  // season を渡すとそのシーズンのキーを使う（省略時は getCurrentSeason()）。
  // 旧シーズンのキャラはそのシーズンのキーで記録を引き継ぐ。
  async getDimensionalCorridorBest(characterId: number, season?: number): Promise<number> {
    const suffix = getSeasonKeySuffix(season);
    const key = `${DIMENSIONAL_CORRIDOR_BEST_KEY}${suffix}_${characterId}`;
    const value = await this.get(key);
    if (!value) return 0;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  async setDimensionalCorridorBest(characterId: number, floor: number, season?: number): Promise<boolean> {
    const suffix = getSeasonKeySuffix(season);
    const key = `${DIMENSIONAL_CORRIDOR_BEST_KEY}${suffix}_${characterId}`;
    const current = await this.getDimensionalCorridorBest(characterId, season);
    if (floor <= current) return false; // 記録更新なし
    await this.set(key, floor.toString());
    return true; // 記録更新あり
  },

  // ブーストツールチップ表示済みフラグ
  async hasBoostTooltipBeenShown(): Promise<boolean> {
    const value = await this.get(BOOST_TOOLTIP_SHOWN_KEY);
    return value === '1';
  },

  async setBoostTooltipShown(): Promise<void> {
    await this.set(BOOST_TOOLTIP_SHOWN_KEY, '1');
  },

  // MODフィルターツールチップ表示済みフラグ
  async hasModFilterTooltipBeenShown(): Promise<boolean> {
    const value = await this.get(MOD_FILTER_TOOLTIP_SHOWN_KEY);
    return value === '1';
  },

  async setModFilterTooltipShown(): Promise<void> {
    await this.set(MOD_FILTER_TOOLTIP_SHOWN_KEY, '1');
  },

  // ストアレビューリクエスト済みフラグ（ダンジョンIDごとに管理）
  async hasStoreReviewBeenRequestedFor(dungeonId: string): Promise<boolean> {
    const value = await this.get(`${STORE_REVIEW_REQUESTED_KEY}_${dungeonId}`);
    return value === '1';
  },

  async setStoreReviewRequestedFor(dungeonId: string): Promise<void> {
    await this.set(`${STORE_REVIEW_REQUESTED_KEY}_${dungeonId}`, '1');
  },

  // 招待コードによる倍速ブースト
  async getInviteSpeedBoost(): Promise<boolean> {
    const value = await this.get(INVITE_SPEED_BOOST_KEY);
    return value === '1';
  },

  async setInviteSpeedBoost(enabled: boolean): Promise<void> {
    await this.set(INVITE_SPEED_BOOST_KEY, enabled ? '1' : '0');
  },

  // 自分の招待コード（ローカルキャッシュ）
  async getMyInviteCode(): Promise<string | null> {
    return this.get(MY_INVITE_CODE_KEY);
  },

  async setMyInviteCode(code: string): Promise<void> {
    await this.set(MY_INVITE_CODE_KEY, code);
  },

  // お知らせ既読日時
  async getNewsLastReadDate(): Promise<string | null> {
    return this.get(NEWS_LAST_READ_KEY);
  },

  async setNewsLastReadDate(isoDate: string): Promise<void> {
    await this.set(NEWS_LAST_READ_KEY, isoDate);
  },

  // エンドコンテンツ解放ツールチップ表示済みフラグ
  async hasEndContentTooltipBeenShown(): Promise<boolean> {
    const value = await this.get(END_CONTENT_TOOLTIP_SHOWN_KEY);
    return value === '1';
  },

  async setEndContentTooltipShown(): Promise<void> {
    await this.set(END_CONTENT_TOOLTIP_SHOWN_KEY, '1');
  },

  // Uberツリー解放ツールチップ表示済みフラグ
  async hasUberTreeTooltipBeenShown(): Promise<boolean> {
    const value = await this.get(UBER_TREE_TOOLTIP_SHOWN_KEY);
    return value === '1';
  },

  async setUberTreeTooltipShown(): Promise<void> {
    await this.set(UBER_TREE_TOOLTIP_SHOWN_KEY, '1');
  },

  // 次元回廊解放ツールチップ表示済みフラグ
  async hasDimensionalCorridorTooltipBeenShown(): Promise<boolean> {
    const value = await this.get(DIMENSIONAL_CORRIDOR_TOOLTIP_SHOWN_KEY);
    return value === '1';
  },

  async setDimensionalCorridorTooltipShown(): Promise<void> {
    await this.set(DIMENSIONAL_CORRIDOR_TOOLTIP_SHOWN_KEY, '1');
  },
};
