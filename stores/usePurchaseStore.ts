import { create } from 'zustand';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { REVENUECAT_API_KEY, ENTITLEMENT_IDS } from '@/constants/purchases';
import { Analytics } from '@/lib/analytics';

/**
 * 課金状態管理ストア
 * RevenueCatのEntitlementを管理
 */

interface PurchaseState {
  // 初期化状態
  isInitialized: boolean;
  isLoading: boolean;

  // Entitlements（権利）
  entitlements: Set<string>;

  // 利用可能な商品
  availablePackages: PurchasesPackage[];

  // 現在のOffering
  currentOffering: any | null;

  // 顧客情報
  customerInfo: CustomerInfo | null;
}

interface PurchaseActions {
  // RevenueCatを初期化
  initialize: () => Promise<void>;

  // Entitlementを持っているか確認
  hasEntitlement: (entitlementId: string) => boolean;

  // 利用可能な商品を取得
  fetchOfferings: () => Promise<void>;

  // 商品を購入
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>;

  // 購入履歴をリストア
  restorePurchases: () => Promise<{ success: boolean; error?: string }>;

  // 顧客情報を更新（Entitlementsも更新）
  refreshCustomerInfo: () => Promise<void>;

  // クリア
  clear: () => void;
}

const initialState: PurchaseState = {
  isInitialized: false,
  isLoading: false,
  entitlements: new Set(),
  availablePackages: [],
  currentOffering: null,
  customerInfo: null,
};

export const usePurchaseStore = create<PurchaseState & PurchaseActions>()((set, get) => ({
  ...initialState,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      // デバッグモードでは初期化をスキップ（課金なしでテスト可能）
      if (__DEV__ && process.env.EXPO_PUBLIC_SKIP_PURCHASES === 'true') {
        console.log('[Purchase] Skipping RevenueCat initialization in dev mode');
        set({ isInitialized: true });
        return;
      }

      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });

      // デバッグログを有効化（開発時のみ）
      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      // 初期の顧客情報を取得
      await get().refreshCustomerInfo();

      set({ isInitialized: true });
      console.log('[Purchase] RevenueCat initialized successfully');
    } catch (error) {
      console.error('[Purchase] Failed to initialize RevenueCat:', error);
      // 初期化失敗でもアプリは動作させる
      set({ isInitialized: true });
    }
  },

  hasEntitlement: (entitlementId: string) => {
    // デバッグモードでは全て有効
    if (__DEV__ && process.env.EXPO_PUBLIC_ALL_ENTITLEMENTS === 'true') {
      return true;
    }

    return get().entitlements.has(entitlementId);
  },

  fetchOfferings: async () => {
    try {
      set({ isLoading: true });
      const offerings = await Purchases.getOfferings();

      if (offerings.current && offerings.current.availablePackages.length > 0) {
        set({
          availablePackages: offerings.current.availablePackages,
          currentOffering: offerings.current,
        });
        console.log('[Purchase] Loaded offering:', offerings.current.identifier);
        console.log('[Purchase] Available packages:', offerings.current.availablePackages.length);
      } else {
        console.log('[Purchase] No current offering available');
      }
    } catch (error) {
      console.error('[Purchase] Failed to fetch offerings:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  purchasePackage: async (pkg: PurchasesPackage) => {
    try {
      set({ isLoading: true });
      console.log('[Purchase] Purchasing package:', pkg.identifier);

      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Entitlementsを更新
      const newEntitlements = new Set<string>();
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key);
        }
      });

      set({
        customerInfo,
        entitlements: newEntitlements,
      });

      console.log('[Purchase] Purchase successful! Active entitlements:', Array.from(newEntitlements));

      Analytics.logPurchaseCompleted({ package_id: pkg.identifier });

      return { success: true };
    } catch (error: any) {
      console.error('[Purchase] Purchase failed:', error);

      // ユーザーキャンセルの場合は特別扱い
      if (error.userCancelled) {
        return { success: false, error: 'cancelled' };
      }

      return { success: false, error: error.message || 'unknown_error' };
    } finally {
      set({ isLoading: false });
    }
  },

  restorePurchases: async () => {
    try {
      set({ isLoading: true });
      const customerInfo = await Purchases.restorePurchases();

      // Entitlementsを更新
      const newEntitlements = new Set<string>();
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key);
        }
      });

      set({
        customerInfo,
        entitlements: newEntitlements,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[Purchase] Restore failed:', error);
      return { success: false, error: error.message || 'unknown_error' };
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCustomerInfo: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();

      // Entitlementsを抽出
      const newEntitlements = new Set<string>();
      Object.keys(customerInfo.entitlements.active).forEach((key) => {
        if (customerInfo.entitlements.active[key].isActive) {
          newEntitlements.add(key);
        }
      });

      set({
        customerInfo,
        entitlements: newEntitlements,
      });

      console.log('[Purchase] Active entitlements:', Array.from(newEntitlements));
    } catch (error) {
      console.error('[Purchase] Failed to refresh customer info:', error);
    }
  },

  clear: () => {
    set(initialState);
  },
}));

// ヘルパー関数: 特定のEntitlementを持っているか確認
export const hasEntitlement = (entitlementId: string): boolean => {
  return usePurchaseStore.getState().hasEntitlement(entitlementId);
};

// インベントリ拡張を持っているか
export const hasInventoryExpansion = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.EXPANDED_INVENTORY);
};

// 倉庫拡張を持っているか
export const hasStorageExpansion = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.EXPANDED_STORAGE);
};

// Tierフィルターを持っているか
export const hasTierFilter = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.TIER_FILTER_ENABLED);
};

// 常時ブーストを持っているか
export const hasPermanentBoost = (): boolean => {
  return hasEntitlement(ENTITLEMENT_IDS.PERMANENT_BOOST);
};

// キャラクタースロット数を取得
export const getCharacterSlotCount = (): number => {
  const state = usePurchaseStore.getState();
  // デフォルト1枠、課金で5枠
  return state.hasEntitlement(ENTITLEMENT_IDS.CHARACTER_SLOTS) ? 5 : 1;
};
