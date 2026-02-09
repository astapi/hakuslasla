/**
 * RevenueCat 課金商品定義
 */

import { Platform } from 'react-native';

// RevenueCat API Keys
// __DEV__ は開発ビルドでtrue、リリースビルドでfalse
export const REVENUECAT_API_KEY = Platform.select({
  ios: __DEV__
    ? 'test_jpaRcWHADuZqhKJKeZORysDDntX' // Test Store用（開発時）
    : 'appl_bplblGrqopuSEJXJihCEhmuPdHw', // Production用（リリース時）
  android: 'goog_XXXXXXXXXXXX', // Android用（リリース時に本番キーを設定）
}) as string;

// Product IDs（ストア別）
export const PRODUCT_IDS = {
  // インベントリ拡張（50→200）
  INVENTORY_EXPANSION: Platform.select({
    ios: 'com.astapi.LootDive.inventory_expansion',
    android: 'inventory_expansion',
  }) as string,

  // 倉庫拡張（20→100）
  STORAGE_EXPANSION: Platform.select({
    ios: 'com.astapi.LootDive.storage_expansion',
    android: 'storage_expansion',
  }) as string,

  // 低Tier除外（T8-T10除外）
  TIER_FILTER: Platform.select({
    ios: 'com.astapi.LootDive.tier_filter',
    android: 'tier_filter',
  }) as string,

  // 常時ブースト
  PERMANENT_BOOST: Platform.select({
    ios: 'com.astapi.LootDive.permanent_boost',
    android: 'permanent_boost',
  }) as string,

  // キャラクタースロット拡張（1→5枠）
  CHARACTER_SLOTS: Platform.select({
    ios: 'com.astapi.LootDive.character_slots',
    android: 'character_slots',
  }) as string,

  // プレミアムバンドル（全権利一括購入）
  PREMIUM_BUNDLE: Platform.select({
    ios: 'com.astapi.LootDive.premium_bundle',
    android: 'premium_bundle',
  }) as string,
} as const;

// Entitlement IDs（RevenueCatダッシュボードで設定）
export const ENTITLEMENT_IDS = {
  EXPANDED_INVENTORY: 'expanded_inventory',
  EXPANDED_STORAGE: 'expanded_storage',
  TIER_FILTER_ENABLED: 'tier_filter_enabled',
  PERMANENT_BOOST: 'permanent_boost',
  CHARACTER_SLOTS: 'character_slots',
} as const;

// 容量定数
export const INVENTORY_BASE_SIZE = 50;      // インベントリデフォルト
export const INVENTORY_EXPANDED_SIZE = 200; // インベントリ課金後

export const STORAGE_BASE_SIZE = 20;        // 倉庫デフォルト
export const STORAGE_EXPANDED_SIZE = 100;   // 倉庫課金後

// キャラクタースロット
export const CHARACTER_BASE_SLOTS = 1;      // デフォルト
export const CHARACTER_EXPANDED_SLOTS = 5;  // 課金後

// Tierフィルター設定
export const TIER_FILTER_SETTINGS = {
  DEFAULT_MIN_TIER: 10,  // デフォルト最低Tier
  DEFAULT_MAX_TIER: 1,   // デフォルト最高Tier
  PREMIUM_MIN_TIER: 7,   // 課金後最低Tier（T8-T10除外）
  PREMIUM_MAX_TIER: 1,   // 課金後最高Tier
} as const;

// 商品情報（UI表示用のみ）
// RevenueCat側でProduct IDとEntitlement IDを統一することを前提とする
export interface PurchaseProduct {
  entitlementId: string | 'bundle'; // Product IDと同じ値を使用。'bundle'の場合は全Entitlementが必要
  nameKey: string;        // i18nキー
  descriptionKey: string; // i18nキー
  iconName: string;       // MaterialCommunityIconsの名前
}

export const PURCHASE_PRODUCTS: PurchaseProduct[] = [
  {
    entitlementId: ENTITLEMENT_IDS.EXPANDED_INVENTORY,
    nameKey: 'shop.inventoryExpansion.name',
    descriptionKey: 'shop.inventoryExpansion.description',
    iconName: 'bag-personal',
  },
  {
    entitlementId: ENTITLEMENT_IDS.EXPANDED_STORAGE,
    nameKey: 'shop.storageExpansion.name',
    descriptionKey: 'shop.storageExpansion.description',
    iconName: 'warehouse',
  },
  {
    entitlementId: ENTITLEMENT_IDS.TIER_FILTER_ENABLED,
    nameKey: 'shop.tierFilter.name',
    descriptionKey: 'shop.tierFilter.description',
    iconName: 'filter',
  },
  {
    entitlementId: ENTITLEMENT_IDS.PERMANENT_BOOST,
    nameKey: 'shop.permanentBoost.name',
    descriptionKey: 'shop.permanentBoost.description',
    iconName: 'rocket-launch',
  },
  {
    entitlementId: ENTITLEMENT_IDS.CHARACTER_SLOTS,
    nameKey: 'shop.characterSlots.name',
    descriptionKey: 'shop.characterSlots.description',
    iconName: 'account-multiple-plus',
  },
  {
    entitlementId: 'bundle', // 特別値：全Entitlementを含む
    nameKey: 'shop.premiumBundle.name',
    descriptionKey: 'shop.premiumBundle.description',
    iconName: 'crown',
  },
];
