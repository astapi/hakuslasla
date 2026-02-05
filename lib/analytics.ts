import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';

// ============================================
// Analytics Events (リリースビルドのみ送信)
// ============================================

export const Analytics = {
  logDungeonStart: (params: {
    dungeon_id: string;
    dungeon_name: string;
    player_level: number;
    is_uber: boolean;
  }) => {
    if (__DEV__) return;
    analytics().logEvent('dungeon_start', params);
  },

  logDungeonClear: (params: {
    dungeon_id: string;
    floors_cleared: number;
    max_floor: number;
  }) => {
    if (__DEV__) return;
    analytics().logEvent('dungeon_clear', params);
  },

  logBattleDefeat: (params: {
    dungeon_id: string;
    floor_reached: number;
    max_floor: number;
    player_level: number;
  }) => {
    if (__DEV__) return;
    analytics().logEvent('battle_defeat', params);
  },

  logPurchaseCompleted: (params: { package_id: string }) => {
    if (__DEV__) return;
    analytics().logEvent('purchase_completed', params);
  },
};

// ============================================
// Crashlytics Helpers (リリースビルドのみ送信)
// ============================================

export const CrashlyticsHelper = {
  setUserId: (userId: string) => {
    if (__DEV__) return;
    crashlytics().setUserId(userId);
  },

  recordError: (error: Error, context?: string) => {
    if (__DEV__) return;
    if (context) {
      crashlytics().log(context);
    }
    crashlytics().recordError(error);
  },

  log: (message: string) => {
    if (__DEV__) return;
    crashlytics().log(message);
  },
};
