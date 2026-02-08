import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import type { AdBoostType } from '@/stores/useAdBoostStore';

// 広告ユニットID
const AD_UNIT_IDS: Record<AdBoostType, string> = {
  drop_rate: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/9679992270',
  tier_boost: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/8366910606',
};

// 広告の有効期限（30分）
const AD_EXPIRY_MS = 30 * 60 * 1000;

export interface AdState {
  loaded: boolean;
  loading: boolean;
  error: boolean;
}

type AdStateListener = (type: AdBoostType, state: AdState) => void;
type RewardListener = (type: AdBoostType) => void;

/**
 * 広告サービス（シングルトン）
 * - 広告インスタンスの管理
 * - プリロード/表示/リロード
 */
class AdService {
  private ads: Record<AdBoostType, RewardedAd | null> = {
    drop_rate: null,
    tier_boost: null,
  };

  private loadedAt: Record<AdBoostType, number | null> = {
    drop_rate: null,
    tier_boost: null,
  };

  private states: Record<AdBoostType, AdState> = {
    drop_rate: { loaded: false, loading: false, error: false },
    tier_boost: { loaded: false, loading: false, error: false },
  };

  private stateListeners: AdStateListener[] = [];
  private rewardListeners: RewardListener[] = [];
  private cleanupFunctions: Record<AdBoostType, (() => void) | null> = {
    drop_rate: null,
    tier_boost: null,
  };

  /**
   * 状態変更リスナーを登録
   */
  addStateListener(listener: AdStateListener): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  /**
   * 報酬獲得リスナーを登録
   */
  addRewardListener(listener: RewardListener): () => void {
    this.rewardListeners.push(listener);
    return () => {
      this.rewardListeners = this.rewardListeners.filter((l) => l !== listener);
    };
  }

  private notifyStateChange(type: AdBoostType): void {
    const state = this.states[type];
    this.stateListeners.forEach((listener) => listener(type, state));
  }

  private notifyReward(type: AdBoostType): void {
    this.rewardListeners.forEach((listener) => listener(type));
  }

  private setState(type: AdBoostType, partial: Partial<AdState>): void {
    this.states[type] = { ...this.states[type], ...partial };
    this.notifyStateChange(type);
  }

  /**
   * 現在の広告状態を取得
   */
  getState(type: AdBoostType): AdState {
    return this.states[type];
  }

  /**
   * 広告が有効期限切れかチェック
   */
  isExpired(type: AdBoostType): boolean {
    const loadedAt = this.loadedAt[type];
    if (!loadedAt) return true;
    return Date.now() - loadedAt > AD_EXPIRY_MS;
  }

  /**
   * 広告をロード
   */
  load(type: AdBoostType): void {
    // 既にロード中またはロード済み（有効期限内）の場合はスキップ
    if (this.states[type].loading) return;
    if (this.states[type].loaded && !this.isExpired(type)) return;

    // 前のクリーンアップ
    if (this.cleanupFunctions[type]) {
      this.cleanupFunctions[type]!();
      this.cleanupFunctions[type] = null;
    }

    this.setState(type, { loading: true, error: false });

    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS[type], {
      requestNonPersonalizedAdsOnly: true,
    });

    // ロード完了
    const loadedUnsub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      this.loadedAt[type] = Date.now();
      this.setState(type, { loaded: true, loading: false, error: false });
    });

    // エラー
    const errorUnsub = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error(`Ad ${type} failed to load:`, error);
      this.setState(type, { loaded: false, loading: false, error: true });
    });

    // 報酬獲得
    const rewardUnsub = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      this.notifyReward(type);
    });

    // 広告クローズ（次の広告をプリロード）
    const closedUnsub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      this.setState(type, { loaded: false });
      // 次の広告をプリロード
      setTimeout(() => this.load(type), 1000);
    });

    // クリーンアップ関数を保存
    this.cleanupFunctions[type] = () => {
      loadedUnsub();
      errorUnsub();
      rewardUnsub();
      closedUnsub();
    };

    ad.load();
    this.ads[type] = ad;
  }

  /**
   * 広告を表示
   * @returns 表示できたかどうか
   */
  async show(type: AdBoostType): Promise<boolean> {
    const ad = this.ads[type];

    // 有効期限切れの場合は再ロード
    if (this.isExpired(type)) {
      this.load(type);
      return false;
    }

    if (!ad || !this.states[type].loaded) {
      return false;
    }

    try {
      await ad.show();
      return true;
    } catch (error) {
      console.error(`Ad ${type} failed to show:`, error);
      // 失敗した場合は再ロード
      this.load(type);
      return false;
    }
  }

  /**
   * 全広告をプリロード
   */
  preloadAll(): void {
    this.load('drop_rate');
    this.load('tier_boost');
  }

  /**
   * 有効期限切れの広告をリフレッシュ
   */
  refreshExpired(): void {
    if (this.isExpired('drop_rate') && !this.states.drop_rate.loading) {
      this.load('drop_rate');
    }
    if (this.isExpired('tier_boost') && !this.states.tier_boost.loading) {
      this.load('tier_boost');
    }
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.cleanupFunctions.drop_rate) {
      this.cleanupFunctions.drop_rate();
    }
    if (this.cleanupFunctions.tier_boost) {
      this.cleanupFunctions.tier_boost();
    }
    this.ads = { drop_rate: null, tier_boost: null };
    this.loadedAt = { drop_rate: null, tier_boost: null };
    this.states = {
      drop_rate: { loaded: false, loading: false, error: false },
      tier_boost: { loaded: false, loading: false, error: false },
    };
  }
}

// シングルトンインスタンス
export const adService = new AdService();
