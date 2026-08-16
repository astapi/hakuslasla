# Aptoide AppCoins SDK 統合設計書

## 背景

2026年3月31日、AptoideがiOS版（AppArena）を日本でリリース。
Apple App Store以外のiOS代替ストアとしてアプリを配信可能になった。
本アプリをAptoide経由でも配信するため、AppCoins SDKによる課金実装を追加し、RevenueCat（App Store/Google Play）と分岐する設計が必要。

## 概要

| 項目 | App Store / Google Play | Aptoide (AppArena) |
|------|------------------------|---------------------|
| 課金SDK | RevenueCat (`react-native-purchases`) | AppCoins SDK (Swift native) |
| 対応OS | iOS / Android | iOS 17.4+ |
| 判定方法 | デフォルト | `AppcSDK.isAvailable()` で検出 |
| 手数料 | Apple 30% / Google 30% | Aptoide（要確認） |
| 商品管理 | RevenueCat Dashboard | Aptoide Connect Console |

## 現行の課金アーキテクチャ

```
app/_layout.tsx (初期化)
  └── usePurchaseStore.initialize()
        └── Purchases.configure(apiKey)  ← RevenueCat

app/shop.tsx (ショップUI)
  └── usePurchaseStore.purchasePackage(pkg)
        └── Purchases.purchasePackage(pkg) ← RevenueCat

constants/purchases.ts
  └── ENTITLEMENT_IDS, PURCHASE_PRODUCTS（商品定義）

stores/usePurchaseStore.ts
  └── Zustand store（entitlements, packages, customerInfo）
```

### 現行の商品一覧

| Package ID | Entitlement ID | 内容 |
|-----------|---------------|------|
| `inventory_expansion` | `expanded_inventory` | インベントリ 50→200 |
| `storage_expansion` | `expanded_storage` | 倉庫 20→100 |
| `tier_filter` | `tier_filter_enabled` | Tierフィルター |
| `permanent_boost` | `permanent_boost` | ドロップ率1.5倍常時 |
| `character_slots` | `character_slots` | キャラスロット 1→5 |
| `speed_boost` | `speed_boost` | 3倍速戦闘 |
| `premium_bundle` | bundle（全含む） | プレミアムバンドル |

---

## AppCoins SDK 技術仕様

### SDK情報

- **リポジトリ**: `https://github.com/Catappult/appcoins-sdk-ios.git`
- **インストール**: Swift Package Manager
- **インポート**: `import AppCoinsSDK`
- **対応**: iOS 17.4以降、App Store以外からインストールされた場合のみ有効

### 必要な設定（Xcode / ネイティブ側）

#### 1. Keychain Entitlements
- Signing & Capabilities → Keychain Sharing追加
- Keychain Group: `com.aptoide.appcoins-wallet`

#### 2. URL Scheme
- URL Types追加
- URL Scheme: `$(PRODUCT_BUNDLE_IDENTIFIER).iap`
- Role: `Editor`

#### 3. Info.plist
- `MKSellsDigitalGoods`: `YES`

#### 4. ビルド設定（テスト用）
- Marketplaces: `com.aptoide.ios.store`

### SDK API一覧

#### 初期化

```swift
// すべてのアプリケーションエントリーポイントで呼び出し必須
AppcSDK.initialize()

// URLリダイレクト処理（支払い完了後のコールバック）
AppcSDK.handle(redirectURL: url) -> Bool

// SDK利用可能チェック（Aptoide経由インストールかどうか）
await AppcSDK.isAvailable() -> Bool
```

#### 商品取得

```swift
// 全商品取得
let products = try await Product.products()

// 特定商品取得
let products = try await Product.products(for: ["sku1", "sku2"])
```

**Productプロパティ:**

| プロパティ | 型 | 説明 |
|-----------|------|------|
| `sku` | String | 商品識別子 |
| `title` | String | 表示名 |
| `description` | String? | 説明 |
| `priceCurrency` | String | 通貨コード |
| `priceValue` | String | 数値価格 |
| `priceLabel` | String | フォーマット済み価格 |
| `priceSymbol` | String | 通貨記号 |

#### 購入

```swift
let result = await product.purchase(payload: "User123")

switch result {
    case .success(let verificationResult):
        switch verificationResult {
            case .verified(let purchase):
                // ローカル署名検証済み → アイテム付与 → 消費
                try await purchase.finish()
            case .unverified(let purchase, let error):
                // 検証失敗 → ビジネスロジックで判断
        }
    case .pending:
        // 保留中
    case .userCancelled:
        // ユーザーキャンセル
    case .failed(let error):
        // エラー
}
```

#### 未完了購入の復元（アプリ起動時に必須）

```swift
// 重要: 毎回起動時に呼び出す必要がある
// 消費されない購入は24時間後に自動返金される
let unfinished = try await Purchase.unfinished()
for purchase in unfinished {
    giveItemToUser(sku: purchase.sku)
    try await purchase.finish()
}
```

#### 購入履歴

```swift
let all = try await Purchase.all()           // 全履歴
let latest = try await Purchase.latest(sku:)  // SKU別最新
let unfinished = try await Purchase.unfinished() // 未完了
```

#### Purchase Intent（外部からの購入要求）

```swift
// URL形式: {bundle-id}.iap://wallet.appcoins.io/purchase?product={sku}&oemid={oemid}
for await intent in Purchase.updates {
    let result = await intent.confirm()
    // resultを通常の購入と同様に処理
}
```

#### エラー型

```swift
enum AppCoinsSDKError {
    case networkError         // ネットワークエラー
    case systemError          // 内部システムエラー
    case notEntitled          // エンタイトルメント設定不足
    case productUnavailable   // 商品利用不可
    case purchaseNotAllowed   // 購入不可
    case unknown              // 不明
}
```

### サンドボックステスト

1. `Sandbox.getTestingWalletAddress()` でテストウォレットアドレスを取得
2. Aptoide Connect Console の Sandbox メニューにアドレスを登録
3. チェックアウト時「Sandbox」を選択して購入テスト
4. ウォレットアドレスは30日で自動無効化（手動で再有効化可能）

**SDK有効/無効の切り替え（テスト用）:**
```
{bundle-id}.iap://wallet.appcoins.io/default?value=true   // AppCoins有効
{bundle-id}.iap://wallet.appcoins.io/default?value=false   // Apple Billing使用
```

---

## 分岐実装の設計

### アーキテクチャ

```
usePurchaseStore.initialize()
  ├── AppcSDK.isAvailable() == true
  │     └── AppCoinsModule（Expo Native Module）で初期化
  └── AppcSDK.isAvailable() == false
        └── RevenueCat で初期化（現行どおり）

usePurchaseStore.purchasePackage()
  ├── isAptoideStore == true
  │     └── AppCoinsModule.purchase(sku, payload)
  └── isAptoideStore == false
        └── Purchases.purchasePackage(pkg)（現行どおり）
```

### Step 1: Expo Native Module 作成

React Native用のAppCoins SDKラッパーが存在しないため、Expo Modules APIでSwift SDKをブリッジする。

```
modules/
  expo-appcoins/
    ├── expo-module.config.json
    ├── ios/
    │   ├── ExpoAppCoinsModule.swift     # ネイティブモジュール本体
    │   └── Package.swift                # AppCoins SDK依存定義
    └── src/
        └── index.ts                     # TypeScript API
```

**公開するAPI:**

```typescript
// modules/expo-appcoins/src/index.ts
export interface AppCoinsProduct {
  sku: string;
  title: string;
  description: string | null;
  priceCurrency: string;
  priceValue: string;
  priceLabel: string;
  priceSymbol: string;
}

export interface AppCoinsPurchase {
  sku: string;
  // 検証済みかどうか
  verified: boolean;
}

export interface AppCoinsPurchaseResult {
  status: 'success' | 'pending' | 'userCancelled' | 'failed';
  purchase?: AppCoinsPurchase;
  error?: string;
}

// SDK初期化（AppDelegateで呼び出し）
export function initialize(): void;

// URLリダイレクト処理
export function handleRedirectURL(url: string): boolean;

// Aptoide経由インストールか判定
export async function isAvailable(): Promise<boolean>;

// 商品取得
export async function getProducts(skus?: string[]): Promise<AppCoinsProduct[]>;

// 購入実行
export async function purchase(sku: string, payload: string): Promise<AppCoinsPurchaseResult>;

// 購入消費（finish）
export async function finishPurchase(sku: string): Promise<void>;

// 未完了購入取得
export async function getUnfinishedPurchases(): Promise<AppCoinsPurchase[]>;

// 全購入履歴取得
export async function getAllPurchases(): Promise<AppCoinsPurchase[]>;

// テスト用ウォレットアドレス取得
export async function getTestingWalletAddress(): Promise<string>;
```

### Step 2: usePurchaseStore の分岐

```typescript
// stores/usePurchaseStore.ts（変更イメージ）

import * as AppCoins from '@/modules/expo-appcoins';

interface PurchaseState {
  // ...既存のstate...
  storeType: 'revenuecat' | 'appcoins';  // 追加
}

const initialize = async () => {
  // Aptoideストア経由か判定
  const isAptoide = await AppCoins.isAvailable();

  if (isAptoide) {
    AppCoins.initialize();
    // 未完了購入の復元
    const unfinished = await AppCoins.getUnfinishedPurchases();
    for (const purchase of unfinished) {
      // アイテム付与 → 消費
      await AppCoins.finishPurchase(purchase.sku);
    }
    set({ storeType: 'appcoins', isInitialized: true });
  } else {
    // 現行のRevenueCat初期化
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    set({ storeType: 'revenuecat', isInitialized: true });
  }
};

const purchasePackage = async (pkg) => {
  if (get().storeType === 'appcoins') {
    const result = await AppCoins.purchase(pkg.sku, userId);
    if (result.status === 'success' && result.purchase?.verified) {
      await AppCoins.finishPurchase(result.purchase.sku);
      // Entitlementを手動で管理（RevenueCatサーバーを使わない）
      entitlements.add(skuToEntitlementMap[result.purchase.sku]);
    }
    return result;
  } else {
    // 現行のRevenueCat処理
    return await Purchases.purchasePackage(pkg);
  }
};
```

### Step 3: Entitlement管理の分岐

RevenueCatはサーバー側でEntitlementを管理するが、AppCoinsではローカル管理が必要。

```
RevenueCat:
  購入 → RevenueCatサーバーがEntitlement付与 → getCustomerInfo()で確認

AppCoins:
  購入 → ローカルDB（expo-sqlite）にEntitlement記録 → 起動時にunfinished()で復元
```

**ローカルEntitlement管理テーブル（案）:**

```sql
CREATE TABLE IF NOT EXISTS appcoins_entitlements (
  sku TEXT PRIMARY KEY,
  entitlement_id TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0
);
```

### Step 4: 商品SKUマッピング

Aptoide Connect Consoleで登録するSKUと、現行のRevenueCat Package IDの対応表。

| Entitlement ID | RevenueCat Package ID | AppCoins SKU（案） |
|---------------|----------------------|-------------------|
| `expanded_inventory` | `inventory_expansion` | `inventory_expansion` |
| `expanded_storage` | `storage_expansion` | `storage_expansion` |
| `tier_filter_enabled` | `tier_filter` | `tier_filter` |
| `permanent_boost` | `permanent_boost` | `permanent_boost` |
| `character_slots` | `character_slots` | `character_slots` |
| `speed_boost` | `speed_boost` | `speed_boost` |
| bundle（全含む） | `premium_bundle` | `premium_bundle` |

### Step 5: ネイティブ側の初期化（AppDelegate）

Expo の AppDelegate に AppCoins SDK の初期化処理を追加する必要がある。
Expo Config Plugin で `AppDelegate.swift` にコードを注入する方法が推奨。

```typescript
// plugins/withAppCoins.ts（Expo Config Plugin）
const withAppCoins: ConfigPlugin = (config) => {
  // 1. AppDelegate に AppcSDK.initialize() 追加
  // 2. URL Scheme 追加
  // 3. Keychain Entitlements 追加
  // 4. Info.plist に MKSellsDigitalGoods 追加
  return config;
};
```

---

## ビルド分岐の検討

### 方法A: 単一バイナリ（推奨）

- 1つのビルドにRevenueCatとAppCoins両方を含める
- `AppcSDK.isAvailable()` でランタイム判定
- メリット: ビルド管理がシンプル
- デメリット: バイナリサイズ増加

### 方法B: EAS Buildプロファイル分岐

```json
// eas.json
{
  "build": {
    "production-appstore": {
      "env": { "STORE_TYPE": "appstore" }
    },
    "production-aptoide": {
      "env": { "STORE_TYPE": "aptoide" }
    }
  }
}
```

- ストアごとに別ビルド
- メリット: 不要なSDKを含めない
- デメリット: ビルド管理が複雑化

### 推奨: 方法A

AppCoins SDKは `isAvailable()` でランタイム判定するため、単一バイナリが自然。
ただし、App Store審査で代替課金SDKが含まれていることが問題にならないか要確認。

---

## 実装時のチェックリスト

### Aptoide Connect Console

- [ ] 開発者アカウント作成
- [ ] アプリ登録・審査提出
- [ ] 課金商品（7つ）を登録
- [ ] サンドボックス環境セットアップ

### Expo Native Module

- [ ] `expo-appcoins` モジュール作成
- [ ] Swift SDKのブリッジ実装
- [ ] TypeScript型定義
- [ ] Expo Config Plugin（AppDelegate, Entitlements, Info.plist）

### アプリ側

- [ ] `usePurchaseStore` の分岐実装
- [ ] ローカルEntitlement管理（SQLiteテーブル追加）
- [ ] `app/shop.tsx` の分岐対応（価格表示等）
- [ ] 未完了購入の復元処理（起動時）
- [ ] Purchase Intent対応（外部からの購入要求）
- [ ] エラーハンドリング

### テスト

- [ ] サンドボックスでの購入テスト
- [ ] SDK有効/無効切り替えテスト
- [ ] RevenueCat側への影響がないことの確認
- [ ] 未完了購入の復元テスト

---

## 参考リンク

- [AppCoins SDK統合ドキュメント（日本語）](https://docs.connect.aptoide.com/docs/in-app-purchases-integration-sdk-jp)
- [iOS Sandbox環境](https://docs.connect.aptoide.com/docs/ios-sandbox-environment-jp)
- [AppCoins SDK iOS リポジトリ](https://github.com/Catappult/appcoins-sdk-ios)
- [Aptoide iOS](https://en.aptoide.com/ios/)
- [Aptoide Connect（開発者コンソール）](https://connect.aptoide.com/)
- [Expo Modules API](https://docs.expo.dev/modules/overview/)
