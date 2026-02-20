import { getDatabase } from '../database';
import { DropFilterSettings, DEFAULT_DROP_FILTER } from '@/types';

const DROP_FILTER_KEY = 'drop_filter_settings';
const BATTLE_SPEED_KEY = 'battle_speed';
const LANGUAGE_KEY = 'app_language';
const END_CONTENT_UNLOCK_KEY = 'end_content_unlocked';
const UBER_UNLOCKS_KEY = 'uber_boss_unlocks';
const UBER_TICKETS_KEY = 'uber_boss_tickets';
const RESPEC_TOKENS_KEY = 'respec_tokens';
const DUNGEON_CLEAR_RECORDS_KEY = 'dungeon_clear_records';
const DIMENSIONAL_CORRIDOR_BEST_KEY = 'dimensional_corridor_best';

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

export type BattleSpeedMultiplier = 1 | 2 | 3 | 5 | 10;
export const BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [1, 2, 3, 5, 10];
export const DEFAULT_BATTLE_SPEED: BattleSpeedMultiplier = 1;

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
    const parsed = parseInt(value, 10) as BattleSpeedMultiplier;
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

  async getEndContentUnlocked(): Promise<boolean> {
    const value = await this.get(END_CONTENT_UNLOCK_KEY);
    return value === '1';
  },

  async setEndContentUnlocked(unlocked: boolean): Promise<void> {
    await this.set(END_CONTENT_UNLOCK_KEY, unlocked ? '1' : '0');
  },

  async getUberBossUnlocks(): Promise<Record<string, boolean>> {
    const value = await this.get(UBER_UNLOCKS_KEY);
    if (!value) return {};
    try {
      return JSON.parse(value) as Record<string, boolean>;
    } catch {
      return {};
    }
  },

  async unlockUberBoss(bossId: string): Promise<void> {
    const current = await this.getUberBossUnlocks();
    if (current[bossId]) return;
    current[bossId] = true;
    await this.set(UBER_UNLOCKS_KEY, JSON.stringify(current));
  },

  async getUberTickets(): Promise<Record<string, number>> {
    const value = await this.get(UBER_TICKETS_KEY);
    if (!value) return {};
    try {
      return JSON.parse(value) as Record<string, number>;
    } catch {
      return {};
    }
  },

  async getUberTicketCount(bossId: string): Promise<number> {
    const current = await this.getUberTickets();
    return current[bossId] ?? 0;
  },

  async addUberTicket(bossId: string, count: number = 1): Promise<number> {
    const current = await this.getUberTickets();
    const nextCount = (current[bossId] ?? 0) + count;
    current[bossId] = nextCount;
    await this.set(UBER_TICKETS_KEY, JSON.stringify(current));
    return nextCount;
  },

  async consumeUberTicket(bossId: string, count: number = 1): Promise<boolean> {
    const current = await this.getUberTickets();
    const available = current[bossId] ?? 0;
    if (available < count) return false;
    const nextCount = available - count;
    if (nextCount <= 0) {
      delete current[bossId];
    } else {
      current[bossId] = nextCount;
    }
    await this.set(UBER_TICKETS_KEY, JSON.stringify(current));
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
  async getDungeonClearRecords(): Promise<DungeonClearRecords> {
    const value = await this.get(DUNGEON_CLEAR_RECORDS_KEY);
    if (!value) return {};
    try {
      return JSON.parse(value) as DungeonClearRecords;
    } catch {
      return {};
    }
  },

  async saveDungeonClearRecord(dungeonId: string, bestFloor: number): Promise<void> {
    const current = await this.getDungeonClearRecords();
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

    await this.set(DUNGEON_CLEAR_RECORDS_KEY, JSON.stringify(current));
  },

  async isDungeonCleared(dungeonId: string): Promise<boolean> {
    const records = await this.getDungeonClearRecords();
    return records[dungeonId] !== undefined;
  },

  // 次元回廊の最高記録（キャラクターごと）
  async getDimensionalCorridorBest(characterId: number): Promise<number> {
    const key = `${DIMENSIONAL_CORRIDOR_BEST_KEY}_${characterId}`;
    const value = await this.get(key);
    if (!value) return 0;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  async setDimensionalCorridorBest(characterId: number, floor: number): Promise<boolean> {
    const key = `${DIMENSIONAL_CORRIDOR_BEST_KEY}_${characterId}`;
    const current = await this.getDimensionalCorridorBest(characterId);
    if (floor <= current) return false; // 記録更新なし
    await this.set(key, floor.toString());
    return true; // 記録更新あり
  },
};
