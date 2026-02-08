import { useState, useEffect, useCallback } from 'react';
import { adService, AdState } from '@/services/adService';
import { AdBoostType, useAdBoostStore } from '@/stores/useAdBoostStore';

/**
 * 広告の状態をReactコンポーネントで使用するためのhook
 */
export function useAdStore() {
  const [dropRateAdState, setDropRateAdState] = useState<AdState>(
    adService.getState('drop_rate')
  );
  const [tierBoostAdState, setTierBoostAdState] = useState<AdState>(
    adService.getState('tier_boost')
  );

  const { activateDropRateBoost, activateTierBoost } = useAdBoostStore();

  // 状態変更を監視
  useEffect(() => {
    const unsubState = adService.addStateListener((type, state) => {
      if (type === 'drop_rate') {
        setDropRateAdState({ ...state });
      } else {
        setTierBoostAdState({ ...state });
      }
    });

    // 報酬獲得時にブーストを有効化
    const unsubReward = adService.addRewardListener((type) => {
      if (type === 'drop_rate') {
        activateDropRateBoost();
      } else {
        activateTierBoost();
      }
    });

    return () => {
      unsubState();
      unsubReward();
    };
  }, [activateDropRateBoost, activateTierBoost]);

  // 広告をプリロード
  const preloadAll = useCallback(() => {
    adService.preloadAll();
  }, []);

  // 特定の広告をロード
  const loadAd = useCallback((type: AdBoostType) => {
    adService.load(type);
  }, []);

  // 広告を表示
  const showAd = useCallback(async (type: AdBoostType): Promise<boolean> => {
    return adService.show(type);
  }, []);

  // 有効期限切れをリフレッシュ
  const refreshExpired = useCallback(() => {
    adService.refreshExpired();
  }, []);

  return {
    dropRateAdState,
    tierBoostAdState,
    preloadAll,
    loadAd,
    showAd,
    refreshExpired,
  };
}

/**
 * 特定のタイプの広告状態のみを取得するhook
 */
export function useAdState(type: AdBoostType) {
  const { dropRateAdState, tierBoostAdState, showAd, loadAd } = useAdStore();

  const adState = type === 'drop_rate' ? dropRateAdState : tierBoostAdState;

  const show = useCallback(async (): Promise<boolean> => {
    return showAd(type);
  }, [showAd, type]);

  const reload = useCallback(() => {
    loadAd(type);
  }, [loadAd, type]);

  return {
    ...adState,
    show,
    reload,
  };
}
