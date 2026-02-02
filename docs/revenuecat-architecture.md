# RevenueCat 課金システム アーキテクチャ設計

## 概要

このドキュメントでは、LootDiveアプリのRevenueCat課金実装における設計思想とアーキテクチャを説明します。

## 設計の核心: Product IDとEntitlement IDの統一

### 問題意識

当初の実装では、iOS/Android別のProduct IDをハードコードし、コード側でProduct ID → Entitlement IDのマッピングを管理していました。

**問題点:**
- iOS/AndroidのProduct IDをコードにハードコーディング
- `PRODUCT_IDS`と`ENTITLEMENT_IDS`の二重管理
- RevenueCatの商品追加時に3箇所（iOS Product ID、Android Product ID、Entitlement ID）を更新する必要がある
- メンテナンス性が低い

### 解決策

**RevenueCat側でProduct IDとEntitlement IDを同じ名前にする**

```
商品の定義（RevenueCat Test Store/Production）:
- Product ID: expanded_inventory
- Entitlement ID: expanded_inventory
```

この設計により：
- コード側でマッピング不要
- `pkg.product.identifier`をそのままEntitlement IDとして使用
- iOS/Androidの差異をRevenueCatが吸収
- 商品追加時はRevenueCat側のみ更新すればOK

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
  const productId = pkg.product.identifier;
  const entitlementId = productId; // Product ID = Entitlement ID

  // UI表示用の情報を取得（オプション）
  const productInfo = PURCHASE_PRODUCTS.find(p => p.entitlementId === entitlementId);

  return {
    iconName: productInfo?.iconName || 'star',
    name: productInfo ? t(productInfo.nameKey) : pkg.product.title,
    description: productInfo ? t(productInfo.descriptionKey) : pkg.product.description,
    entitlementId: entitlementId,
  };
};
```

**設計ポイント:**
- `PURCHASE_PRODUCTS`は**UI表示用のメタデータ**のみ
- 定義がない商品でもRevenueCatの情報で表示可能
- フォールバック機構で柔軟性を確保

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
- Product ID: `premium_bundle`
- Entitlements: 上記5つ全てを付与

**コード側:**
- `entitlementId: 'bundle'` という特殊値を使用
- 全Entitlement保有をチェックして「購入済み」判定

## ファイル構成

```
constants/
  └── purchases.ts          # Entitlement定義、容量定数、UI表示用メタデータ

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

### Product IDのマッピングエラー

**原因:** RevenueCatのProduct IDとコードの期待値が不一致

**解決策:**
- RevenueCat側でProduct IDとEntitlement IDを統一
- マッピング不要な設計に変更

## ベストプラクティス

### 1. Entitlementベースの設計

❌ **悪い例:** Product IDで機能制御
```typescript
if (productId === 'inventory_expansion') {
  // ...
}
```

✅ **良い例:** Entitlementで機能制御
```typescript
if (hasEntitlement('expanded_inventory')) {
  // ...
}
```

### 2. UIとロジックの分離

- `PURCHASE_PRODUCTS`: UI表示用メタデータのみ
- Entitlement判定: ビジネスロジック層で実装

### 3. フォールバック機構

```typescript
// 定義がない商品でも表示可能
name: productInfo ? t(productInfo.nameKey) : pkg.product.title
```

### 4. エラーハンドリング

```typescript
try {
  await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
} catch (error) {
  console.error('[Purchase] Failed to initialize:', error);
  // 初期化失敗でもアプリは動作させる
  set({ isInitialized: true });
}
```

### 5. ログ出力

```typescript
console.log('[Purchase] Active entitlements:', Array.from(newEntitlements));
```

開発時のデバッグに不可欠。本番環境でも問題分析に役立つ。

## RevenueCat設定のポイント

### 1. Product IDとEntitlement IDの統一

**必須:** 各商品でProduct IDとEntitlement IDを同じ名前にする

```
商品: インベントリ拡張
- Product ID: expanded_inventory
- Entitlement ID: expanded_inventory
```

### 2. バンドル商品の設定

**Product ID:** `premium_bundle`（単一）
**Entitlements:** 複数のEntitlementを付与
- `expanded_inventory`
- `expanded_storage`
- `tier_filter_enabled`
- `permanent_boost`
- `character_slots`

### 3. Product Type

全て **Non-consumable**（買い切り型）で設定

## まとめ

### 設計の特徴

1. **シンプル:** Product IDとEntitlement IDの統一でマッピング不要
2. **柔軟:** 新商品はRevenueCat側のみで追加可能
3. **リアクティブ:** Zustandで状態変化を自動検知
4. **堅牢:** フォールバック機構とエラーハンドリング
5. **デバッグ可能:** 環境変数で開発時のテストが容易

### 今後の拡張

新しい課金機能を追加する場合：

1. **RevenueCat側:**
   - Product IDとEntitlement IDを同じ名前で商品作成

2. **コード側:**
   - `ENTITLEMENT_IDS`に定数追加
   - `PURCHASE_PRODUCTS`にUI表示情報追加（オプション）
   - ヘルパー関数追加（例: `hasNewFeature()`）
   - 機能実装箇所でEntitlementチェック

3箇所の更新で完了。iOS/AndroidのProduct IDハードコーディングは不要。
