import { create } from 'zustand';
import { hasPermanentBoost } from './usePurchaseStore';

/**
 * リワード広告のブースト種類
 */
export type AdBoostType = 'drop_rate' | 'tier_boost';

/**
 * 広告ブースト状態
 */
export interface AdBoostState {
  // ドロップ率ブースト（30分間）
  // - ユニークドロップ率+1%
  // - アイテムドロップ確率1.5倍
  dropRateBoost: {
    active: boolean;
    expiresAt: number | null; // タイムスタンプ (ms)
  };
  // 上位Tierブースト（30分間）
  // - 高品質Tier(T1-T3)の出現確率UP（ウェイト増加）
  // - 通常時: T4,5が最も出やすい
  // - ブースト時: T1-T3のウェイトが2-4倍に増加
  tierBoost: {
    active: boolean;
    expiresAt: number | null;
  };
}

interface AdBoostActions {
  // ドロップ率ブーストを有効化
  activateDropRateBoost: () => void;
  // Tierブーストを有効化
  activateTierBoost: () => void;
  // 期限切れブーストをチェックして無効化
  checkExpiredBoosts: () => void;
  // すべてのブーストをクリア（デバッグ用）
  clearAllBoosts: () => void;
  // ドロップ率ブースト効果を取得（ユニークドロップ率+1%、通常ドロップ率UP）
  getDropRateMultiplier: () => { uniqueBonus: number; dropRateMultiplier: number };
  // Tierブースト状態を取得
  isTierBoosted: () => boolean;
}

const BOOST_DURATION = 30 * 60 * 1000; // 30分（ミリ秒）

const initialState: AdBoostState = {
  dropRateBoost: {
    active: false,
    expiresAt: null,
  },
  tierBoost: {
    active: false,
    expiresAt: null,
  },
};

export const useAdBoostStore = create<AdBoostState & AdBoostActions>()((set, get) => ({
  ...initialState,

  activateDropRateBoost: () => {
    const expiresAt = Date.now() + BOOST_DURATION;
    set({
      dropRateBoost: {
        active: true,
        expiresAt,
      },
    });
  },

  activateTierBoost: () => {
    const expiresAt = Date.now() + BOOST_DURATION;
    set({
      tierBoost: {
        active: true,
        expiresAt,
      },
    });
  },

  checkExpiredBoosts: () => {
    const state = get();
    const now = Date.now();
    let updated = false;

    const newState: Partial<AdBoostState> = {};

    // ドロップ率ブーストの期限チェック
    if (state.dropRateBoost.active && state.dropRateBoost.expiresAt && now >= state.dropRateBoost.expiresAt) {
      newState.dropRateBoost = { active: false, expiresAt: null };
      updated = true;
    }

    // Tierブーストの期限チェック
    if (state.tierBoost.active && state.tierBoost.expiresAt && now >= state.tierBoost.expiresAt) {
      newState.tierBoost = { active: false, expiresAt: null };
      updated = true;
    }

    if (updated) {
      set(newState);
    }
  },

  clearAllBoosts: () => {
    set(initialState);
  },

  // ドロップ率ブースト効果
  getDropRateMultiplier: () => {
    const state = get();
    // 課金: 常時ブースト
    const isPermanent = hasPermanentBoost();
    if (!state.dropRateBoost.active && !isPermanent) {
      return { uniqueBonus: 0, dropRateMultiplier: 1.0 };
    }
    // ユニークドロップ率+1%、通常ドロップ確率1.5倍
    return { uniqueBonus: 1, dropRateMultiplier: 1.5 };
  },

  // Tierブースト状態（ウェイト付き抽選で高品質Tierが出やすくなる）
  isTierBoosted: () => {
    const state = get();
    // 課金: 常時ブースト
    return state.tierBoost.active || hasPermanentBoost();
  },
}));
