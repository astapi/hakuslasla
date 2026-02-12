# RevenueCat 課金システム アーキテクチャ設計

## 概要

このドキュメントでは、LootDiveアプリのRevenueCat課金実装における設計思想とアーキテクチャを説明します。

## 設計の核心: Package ID → Entitlement ID マッピング

### RevenueCatの概念整理

RevenueCatには以下の概念があります：

| 概念 | 説明 | 例 |
|------|------|-----|
| **Product ID** | ストア固有の商品ID。ストアごとに異なる | iOS: `com.astapi.LootDive.tier_filter`<br>Test Store: `tier_filter` |
| **Package ID** | RevenueCatで設定するパッケージ識別子。**ストア非依存** | `tier_filter` |
| **Entitlement ID** | 購入によって付与される「権利」の識別子 | `tier_filter_enabled` |

### 重要なポイント

**Product IDはストアによって異なる：**
```
同じ商品でも：
- Test Store: tier_filter
- App Store: com.astapi.LootDive.tier_filter
- Google Play: (別のID)
```

**Package IDはストア非依存：**
```
どのストアでも同じ値が返る：
- pkg.identifier → "tier_filter"
```

### なぜProduct IDをハードコードしないのか

❌ **悪い設計:** Product IDで判定
```typescript
// ストアによって異なる値が返るため、環境依存のバグが発生する
const productId = pkg.product.identifier;
// Test Store: "tier_filter"
// App Store: "com.astapi.LootDive.tier_filter"
```

✅ **良い設計:** Package IDで判定
```typescript
// ストアに関係なく同じ値が返る
const packageId = pkg.identifier;
// どのストアでも: "tier_filter"
```

### 解決策: アプリ側でPackage ID → Entitlement IDマッピング

RevenueCat SDKでは、PackageからEntitlement IDを直接取得できません（[RevenueCat Community参照](https://community.revenuecat.com/general-questions-7/how-to-get-the-entitlement-name-from-a-package-3106)）。

そのため、アプリ側でマッピングを管理します：

```typescript
// constants/purchases.ts
export const PURCHASE_PRODUCTS: PurchaseProduct[] = [
  {
    packageId: 'tier_filter',           // RevenueCat Package ID
    entitlementId: 'tier_filter_enabled', // Entitlement ID
    nameKey: 'shop.tierFilter.name',
    // ...
  },
];
```

## Package ID → Entitlement ID マッピング一覧

| Package ID | Entitlement ID | 機能 |
|------------|----------------|------|
| `inventory_expansion` | `expanded_inventory` | インベントリ拡張 |
| `storage_expansion` | `expanded_storage` | 倉庫拡張 |
| `tier_filter` | `tier_filter_enabled` | 低Tier除外 |
| `permanent_boost` | `permanent_boost` | 常時ブースト |
| `character_slots` | `character_slots` | キャラスロット拡張 |
| `premium_bundle` | `bundle` (特殊) | プレミアムバンドル |

## アーキテクチャ

### 状態管理: Zustand (stores/usePurchaseStore.ts)

```typescript
interface PurchaseState {
  isInitialized: boolean;
  isLoading: boolean;
  entitlements: Set<string>;          // ユーザーが保有するEntitlements
  availablePackages: PurchasesPackage[]; // RevenueCatから取得した商品リスト
  currentOffering: any | null;
  customerInfo: CustomerInfo | null;
}
```

**重要な設計判断:**
- `entitlements`を`Set<string>`で管理
- UIコンポーネントは`entitlements`を直接監視
- `entitlements`の変更で自動的に再レンダリング

### 初期化フロー

```
アプリ起動 (app/_layout.tsx)
  ↓
DB初期化
  ↓
RevenueCat初期化 (usePurchaseStore.initialize())
  ↓
顧客情報取得 (refreshCustomerInfo())
  ↓
Entitlements抽出・保存
  ↓
アプリ準備完了
```

**設計ポイント:**
- アプリ起動時にRevenueCatを初期化
- ショップ画面だけでなく、アプリ全体でEntitlementを使用可能
- 初期化失敗でもアプリは動作（エラーハンドリング）

### ショップUIの実装 (app/shop.tsx)

#### 商品表示のロジック

```typescript
const getPackageDisplayInfo = (pkg: PurchasesPackage) => {
  const packageId = pkg.identifier; // ストア非依存のPackage ID

  // Package ID → Entitlement ID のマッピングを取得
  const productInfo = PURCHASE_PRODUCTS.find(p => p.packageId === packageId);

  // マッピングからEntitlement IDを取得（なければPackage IDをフォールバック）
  const entitlementId = productInfo?.entitlementId || packageId;

  return {
    iconName: productInfo?.iconName || 'star',
    name: productInfo ? t(productInfo.nameKey) : pkg.product.title,
    description: productInfo ? t(productInfo.descriptionKey) : pkg.product.description,
    entitlementId: entitlementId,
  };
};
```

**設計ポイント:**
- `pkg.identifier`（Package ID）を使用。`pkg.product.identifier`（Product ID）は使わない
- `PURCHASE_PRODUCTS`でPackage ID → Entitlement IDをマッピング
- 定義がない商品でもRevenueCatの情報で表示可能（フォールバック）

#### 購入済み判定

```typescript
// 通常商品
const isPurchased = hasEntitlement(displayInfo.entitlementId);

// バンドル商品（特殊ケース）
const isBundlePurchased = () => {
  return (
    hasEntitlement('expanded_inventory') &&
    hasEntitlement('expanded_storage') &&
    hasEntitlement('tier_filter_enabled') &&
    hasEntitlement('permanent_boost') &&
    hasEntitlement('character_slots')
  );
};
```

#### 状態の即時更新

```typescript
// entitlementsをローカルで監視
const { entitlements } = usePurchaseStore();

const hasEntitlement = useCallback(
  (entitlementId: string) => {
    return entitlements.has(entitlementId);
  },
  [entitlements] // 依存配列に追加
);
```

**設計ポイント:**
- Zustandストアの`entitlements`を直接監視
- 購入完了後、`entitlements`が更新されると自動的に再レンダリング
- アラート表示前にUIが更新される

#### 画面表示時の更新

```typescript
useFocusEffect(
  useCallback(() => {
    if (isInitialized) {
      refreshCustomerInfo();
    }
  }, [isInitialized, refreshCustomerInfo])
);
```

**設計ポイント:**
- 画面が表示されるたびに顧客情報を更新
- 他の画面で購入した場合でも反映される
- RevenueCatサーバーとの同期を保証

## データフロー

### 購入フロー

```
ユーザーが商品タップ
  ↓
purchasePackage(pkg) 実行
  ↓
RevenueCat SDK が購入処理
  ↓
customerInfo を取得
  ↓
entitlements を抽出・更新
  ↓
Zustand状態更新
  ↓
UIが自動的に再レンダリング（購入済みバッジ表示）
  ↓
成功アラート表示
```

### リストア（復元）フロー

```
ユーザーが「購入を復元」タップ
  ↓
restorePurchases() 実行
  ↓
RevenueCat が過去の購入履歴を取得
  ↓
customerInfo を取得
  ↓
entitlements を抽出・更新
  ↓
UIが更新
  ↓
成功アラート表示
```

## 機能とEntitlementの対応

| 機能 | Entitlement ID | デフォルト | 課金後 |
|------|---------------|-----------|--------|
| インベントリ容量 | `expanded_inventory` | 50 | 200 |
| 倉庫容量 | `expanded_storage` | 20 | 100 |
| Tierフィルター | `tier_filter_enabled` | T10-T1 | T7-T1 |
| 常時ブースト | `permanent_boost` | OFF | ON |
| キャラスロット | `character_slots` | 1枠 | 5枠 |
| **バンドル** | `bundle` (特殊) | - | 上記全て |

### バンドル商品の設計

**RevenueCat側:**
- Package ID: `premium_bundle`
- Entitlements: 上記5つ全てを付与

**コード側:**
- `entitlementId: 'bundle'` という特殊値を使用
- 全Entitlement保有をチェックして「購入済み」判定

## ファイル構成

```
constants/
  └── purchases.ts          # Package ID→Entitlementマッピング、容量定数

stores/
  └── usePurchaseStore.ts   # 課金状態管理、RevenueCat連携

app/
  ├── _layout.tsx           # アプリ起動時のRevenueCat初期化
  └── shop.tsx              # ショップUI

db/repositories/
  └── storageRepository.ts  # 倉庫容量制限の実装例

data/
  └── items.ts              # Tierフィルターの実装例

stores/
  ├── usePlayerStore.ts     # インベントリ容量の実装例
  └── useAdBoostStore.ts    # 常時ブーストの実装例
```

## 各機能の実装パターン

### パターン1: 容量制限

```typescript
// stores/usePlayerStore.ts
getInventoryMaxSize: () => {
  return hasInventoryExpansion()
    ? INVENTORY_EXPANDED_SIZE
    : INVENTORY_BASE_SIZE;
}
```

### パターン2: フィルター機能

```typescript
// data/items.ts
if (hasTierFilter() && tierRange.minTier > TIER_FILTER_SETTINGS.PREMIUM_MIN_TIER) {
  tierRange = {
    ...tierRange,
    minTier: Math.min(tierRange.minTier, TIER_FILTER_SETTINGS.PREMIUM_MIN_TIER),
  };
}
```

### パターン3: 常時有効化

```typescript
// stores/useAdBoostStore.ts
getDropRateMultiplier: () => {
  const state = get();
  const isPermanent = hasPermanentBoost();
  if (!state.dropRateBoost.active && !isPermanent) {
    return { uniqueBonus: 0, dropRateMultiplier: 1.0 };
  }
  return { uniqueBonus: 1, dropRateMultiplier: 1.5 };
}
```

### パターン4: スロット数

```typescript
// stores/usePurchaseStore.ts (ヘルパー関数)
export const getCharacterSlotCount = (): number => {
  const state = usePurchaseStore.getState();
  return state.hasEntitlement(ENTITLEMENT_IDS.CHARACTER_SLOTS) ? 5 : 1;
};
```

## デバッグモード

開発時のテスト用環境変数：

```bash
# RevenueCat初期化をスキップ（課金なしでテスト）
EXPO_PUBLIC_SKIP_PURCHASES=true

# 全Entitlementを有効化（機能テスト）
EXPO_PUBLIC_ALL_ENTITLEMENTS=true
```

```typescript
// usePurchaseStore.ts
hasEntitlement: (entitlementId: string) => {
  // デバッグモードでは全て有効
  if (__DEV__ && process.env.EXPO_PUBLIC_ALL_ENTITLEMENTS === 'true') {
    return true;
  }
  return get().entitlements.has(entitlementId);
}
```

## トラブルシューティング

### 購入後にUIが更新されない

**原因:** Zustandの状態変更を検知できていない

**解決策:**
```typescript
// ❌ ストアの関数を直接取得
const { hasEntitlement } = usePurchaseStore();

// ✅ entitlementsを監視
const { entitlements } = usePurchaseStore();
const hasEntitlement = useCallback(
  (id: string) => entitlements.has(id),
  [entitlements]
);
```

### リロード後に購入状態が反映されない

**原因:** 初期化が遅い、または画面表示時の更新がない

**解決策:**
- アプリ起動時にRevenueCatを初期化 (`app/_layout.tsx`)
- ショップ画面に`useFocusEffect`で更新処理を追加

### 購入済みが正しく表示されない

**原因:** Package IDとEntitlement IDのマッピング不一致

**解決策:**
1. ログでPackage IDを確認: `console.log(pkg.identifier)`
2. `PURCHASE_PRODUCTS`の`packageId`が一致しているか確認
3. RevenueCat Dashboardで設定されているEntitlement IDを確認

**注意:** `pkg.product.identifier`（Product ID）はストアによって異なるため使用しない

## ベストプラクティス

### 1. Entitlementベースの設計

❌ **悪い例:** Product IDで機能制御
```typescript
if (productId === 'com.astapi.LootDive.inventory_expansion') {
  // ストア依存のコード
}
```

✅ **良い例:** Entitlementで機能制御
```typescript
if (hasEntitlement('expanded_inventory')) {
  // ストア非依存
}
```

### 2. Package IDを使用（Product IDは使わない）

❌ **悪い例:** Product IDで判定
```typescript
const productId = pkg.product.identifier; // ストアによって異なる
```

✅ **良い例:** Package IDで判定
```typescript
const packageId = pkg.identifier; // ストア非依存
```

### 3. UIとロジックの分離

- `PURCHASE_PRODUCTS`: Package ID → Entitlement IDマッピング + UI表示用メタデータ
- Entitlement判定: ビジネスロジック層で実装

### 4. フォールバック機構

```typescript
// 定義がない商品でも表示可能
name: productInfo ? t(productInfo.nameKey) : pkg.product.title
```

### 5. エラーハンドリング

```typescript
try {
  await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
} catch (error) {
  console.error('[Purchase] Failed to initialize:', error);
  // 初期化失敗でもアプリは動作させる
  set({ isInitialized: true });
}
```

### 6. ログ出力

```typescript
console.log('[Purchase] Active entitlements:', Array.from(newEntitlements));
```

開発時のデバッグに不可欠。本番環境でも問題分析に役立つ。

## RevenueCat設定のポイント

### 1. Package設定

RevenueCat Dashboardで各Packageを作成し、ストアごとのProductを紐付ける：

```
Package: tier_filter
  ├── Test Store: tier_filter
  ├── App Store: com.astapi.LootDive.tier_filter
  └── Google Play: (Android用Product ID)
```

### 2. Entitlement設定

各Entitlementを作成し、対応するProductを紐付ける：

```
Entitlement: tier_filter_enabled
  └── Products: tier_filter (全ストア共通)
```

### 3. バンドル商品の設定

**Package ID:** `premium_bundle`
**Entitlements:** 複数のEntitlementを付与
- `expanded_inventory`
- `expanded_storage`
- `tier_filter_enabled`
- `permanent_boost`
- `character_slots`

### 4. Product Type

全て **Non-consumable**（買い切り型）で設定

## まとめ

### 設計の特徴

1. **ストア非依存:** Package IDを使用し、Product IDのハードコードを回避
2. **明示的マッピング:** Package ID → Entitlement IDを`PURCHASE_PRODUCTS`で管理
3. **リアクティブ:** Zustandで状態変化を自動検知
4. **堅牢:** フォールバック機構とエラーハンドリング
5. **デバッグ可能:** 環境変数で開発時のテストが容易

### 今後の拡張

新しい課金機能を追加する場合：

1. **RevenueCat側:**
   - Package作成（各ストアのProductを紐付け）
   - Entitlement作成（Productに紐付け）

2. **コード側:**
   - `ENTITLEMENT_IDS`に定数追加
   - `PURCHASE_PRODUCTS`にマッピング追加（packageId, entitlementId, UI情報）
   - ヘルパー関数追加（例: `hasNewFeature()`）
   - 機能実装箇所でEntitlementチェック

Product IDのハードコーディングは不要。Package IDとEntitlement IDのマッピングのみ管理。
