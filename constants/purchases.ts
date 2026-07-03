/**
 * RevenueCat 課金商品定義
 */

import { Platform } from 'react-native';
import * as Application from 'expo-application';

// RevenueCat API Keys
// __DEV__ は開発ビルドでtrue、リリースビルドでfalse
export const REVENUECAT_API_KEY = Platform.select({
  ios: __DEV__
    ? 'test_jpaRcWHADuZqhKJKeZORysDDntX' // Test Store用（開発時）
    : 'appl_bplblGrqopuSEJXJihCEhmuPdHw', // Production用（リリース時）
  android: 'goog_XXXXXXXXXXXX', // Android用（リリース時に本番キーを設定）
}) as string;

// Entitlement IDs（RevenueCatダッシュボードで設定）
export const ENTITLEMENT_IDS = {
  EXPANDED_INVENTORY: 'expanded_inventory',
  EXPANDED_STORAGE: 'expanded_storage',
  EXPANDED_PETS: 'expanded_pets',
  TIER_FILTER_ENABLED: 'tier_filter_enabled',
  PERMANENT_BOOST: 'permanent_boost',
  CHARACTER_SLOTS: 'character_slots',
  SPEED_BOOST: 'speed_boost',
} as const;

// 容量定数
export const INVENTORY_BASE_SIZE = 50;      // インベントリデフォルト
export const INVENTORY_EXPANDED_SIZE = 200; // インベントリ課金後

export const STORAGE_BASE_SIZE = 20;        // 倉庫デフォルト
export const STORAGE_EXPANDED_SIZE = 100;   // 倉庫課金後

export const PET_BASE_SIZE = 50;            // ペット所持枠デフォルト
export const PET_EXPANDED_SIZE = 100;       // ペット所持枠課金後

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

// 商品情報（UI表示用 + Package ID → Entitlement ID マッピング）
export interface PurchaseProduct {
  packageId: string;      // RevenueCat Package ID（ストア非依存）
  entitlementId: string | 'bundle'; // Entitlement ID。'bundle'の場合は全Entitlementが必要
  nameKey: string;        // i18nキー
  descriptionKey: string; // i18nキー
  iconName: string;       // MaterialCommunityIconsの名前
  minVersion?: string;    // この商品を表示する最低アプリバージョン（未指定なら常に表示）
}

export const PURCHASE_PRODUCTS: PurchaseProduct[] = [
  {
    packageId: 'inventory_expansion',
    entitlementId: ENTITLEMENT_IDS.EXPANDED_INVENTORY,
    nameKey: 'shop.inventoryExpansion.name',
    descriptionKey: 'shop.inventoryExpansion.description',
    iconName: 'bag-personal',
  },
  {
    packageId: 'storage_expansion',
    entitlementId: ENTITLEMENT_IDS.EXPANDED_STORAGE,
    nameKey: 'shop.storageExpansion.name',
    descriptionKey: 'shop.storageExpansion.description',
    iconName: 'warehouse',
  },
  {
    packageId: 'pet_expansion',
    entitlementId: ENTITLEMENT_IDS.EXPANDED_PETS,
    nameKey: 'shop.petExpansion.name',
    descriptionKey: 'shop.petExpansion.description',
    iconName: 'paw',
    minVersion: '2.0.0', // v2.0.0未満のリリース済みアプリには表示しない
  },
  {
    packageId: 'tier_filter',
    entitlementId: ENTITLEMENT_IDS.TIER_FILTER_ENABLED,
    nameKey: 'shop.tierFilter.name',
    descriptionKey: 'shop.tierFilter.description',
    iconName: 'filter',
  },
  {
    packageId: 'permanent_boost',
    entitlementId: ENTITLEMENT_IDS.PERMANENT_BOOST,
    nameKey: 'shop.permanentBoost.name',
    descriptionKey: 'shop.permanentBoost.description',
    iconName: 'rocket-launch',
  },
  {
    packageId: 'character_slots',
    entitlementId: ENTITLEMENT_IDS.CHARACTER_SLOTS,
    nameKey: 'shop.characterSlots.name',
    descriptionKey: 'shop.characterSlots.description',
    iconName: 'account-multiple-plus',
  },
  {
    packageId: 'speed_boost',
    entitlementId: ENTITLEMENT_IDS.SPEED_BOOST,
    nameKey: 'shop.speedBoost.name',
    descriptionKey: 'shop.speedBoost.description',
    iconName: 'speedometer',
  },
  {
    packageId: 'premium_bundle',
    entitlementId: 'bundle', // 特別値：全Entitlementを含む
    nameKey: 'shop.premiumBundle.name',
    descriptionKey: 'shop.premiumBundle.description',
    iconName: 'crown',
  },
];

/**
 * セマンティックバージョン比較: current < minimum なら true
 */
function isVersionOlder(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const cur = parse(current);
  const min = parse(minimum);
  for (let i = 0; i < 3; i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

/**
 * このpackageIdの商品を、現在のアプリバージョンで表示してよいか判定する。
 * - PURCHASE_PRODUCTS に無い（＝自分たちの商品でない）package は false
 * - minVersion 指定があり、現在バージョンがそれ未満なら false（旧リリースへの露出を防ぐ）
 *
 * RevenueCatのOfferingはリモート設定のため、商品を追加すると旧バージョンの
 * アプリにも即座に配信されてしまう。この関数でクライアント側のバージョンゲートを行う。
 */
export function isPackageAvailableInCurrentVersion(packageId: string): boolean {
  const product = PURCHASE_PRODUCTS.find((p) => p.packageId === packageId);
  if (!product) return false;
  if (!product.minVersion) return true;
  const current = Application.nativeApplicationVersion ?? '0.0.0';
  return !isVersionOlder(current, product.minVersion);
}
