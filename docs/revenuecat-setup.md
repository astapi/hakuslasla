# RevenueCat セットアップガイド

LootDive に課金機能を導入するための RevenueCat セットアップ手順。

## 目次

1. [RevenueCat アカウント作成](#1-revenuecat-アカウント作成)
2. [App Store Connect 設定（iOS）](#2-app-store-connect-設定ios)
3. [Google Play Console 設定（Android）](#3-google-play-console-設定android)
4. [RevenueCat 商品設定](#4-revenuecat-商品設定)
5. [API Keys の取得](#5-api-keys-の取得)
6. [商品一覧](#6-商品一覧)

---

## 1. RevenueCat アカウント作成

### 1.1 アカウント登録

1. https://app.revenuecat.com にアクセス
2. 「Get Started Free」をクリック
3. メールアドレスまたは GitHub/Google アカウントで登録

### 1.2 プロジェクト作成

1. ダッシュボードで「Create New Project」
2. プロジェクト名: `LootDive`
3. 作成後、Apps を追加していく

---

## 2. App Store Connect 設定（iOS）

### 2.1 アプリの登録

1. [App Store Connect](https://appstoreconnect.apple.com) にログイン
2. 「マイ App」→「+」→「新規 App」
3. 設定値:
   - プラットフォーム: iOS
   - 名前: LootDive
   - プライマリ言語: 日本語
   - バンドル ID: `com.astapi.LootDive`
   - SKU: `lootdive`

### 2.2 App 内課金の商品作成

1. 「マイ App」→ LootDive を選択
2. サイドバー「App 内課金」→「管理」
3. 「+」をクリックして商品を作成

#### キャラクタースロット拡張

| 項目 | 値 |
|------|-----|
| 種類 | 非消費型 |
| 参照名 | キャラクタースロット拡張 |
| 製品 ID | `com.astapi.LootDive.character_slots` |
| 価格 | Tier 5（490円）推奨 |
| ローカリゼーション | 表示名: キャラスロット拡張、説明: キャラクタースロットを5枠に拡張します |

### 2.3 共有シークレットの生成

1. 「マイ App」→ LootDive
2. 「一般」→「App 情報」
3. 「App 用共有シークレット」→「管理」
4. 「生成」をクリックしてシークレットをコピー

### 2.4 サンドボックステスターの作成（開発用）

1. App Store Connect →「ユーザーとアクセス」
2. 「サンドボックス」タブ →「テスター」
3. 「+」でテスターを追加
   - 専用のメールアドレスが必要（Apple ID として未使用のもの）
   - パスワードを設定
4. 実機でテストする際はこのアカウントでサインイン

---

## 3. Google Play Console 設定（Android）

### 3.1 アプリの登録

1. [Google Play Console](https://play.google.com/console) にログイン
2. 「アプリを作成」
3. 設定値:
   - アプリ名: LootDive
   - デフォルトの言語: 日本語
   - アプリまたはゲーム: ゲーム
   - 無料または有料: 無料

### 3.2 アプリ内アイテムの作成

1. サイドバー「収益化」→「商品」→「アプリ内アイテム」
2. 「商品を作成」

#### キャラクタースロット拡張

| 項目 | 値 |
|------|-----|
| 製品 ID | `character_slots` |
| 名前 | キャラスロット拡張 |
| 説明 | キャラクタースロットを5枠に拡張します |
| デフォルト価格 | 490 JPY |

### 3.3 サービスアカウントの作成

RevenueCat が Google Play と連携するために必要。

1. [Google Cloud Console](https://console.cloud.google.com) にアクセス
2. プロジェクトを選択（または新規作成）
3. 「IAM と管理」→「サービスアカウント」
4. 「サービスアカウントを作成」
   - 名前: `revenuecat-integration`
   - ロール: 不要（後で Play Console で設定）
5. 作成したアカウントを選択 →「キー」タブ
6. 「鍵を追加」→「新しい鍵を作成」→ JSON を選択
7. JSON ファイルがダウンロードされる（大切に保管）

### 3.4 Play Console でサービスアカウントを許可

1. Google Play Console →「設定」→「API アクセス」
2. 「サービスアカウントをリンク」
3. 作成したサービスアカウントのメールアドレスを入力
4. 権限: 「財務データを閲覧、管理...」にチェック

### 3.5 内部テストの設定（開発用）

1. サイドバー「テスト」→「内部テスト」
2. 「新しいリリースを作成」
3. テスターを追加（メールアドレスで招待）

---

## 4. RevenueCat 商品設定

### 4.1 App の追加

RevenueCat ダッシュボードで iOS/Android アプリを追加。

#### iOS App の追加

1. プロジェクト →「Apps」→「+ New」
2. 設定値:
   - App name: LootDive iOS
   - Platform: App Store
   - Bundle ID: `com.astapi.LootDive`
3. App Store Connect 連携:
   - 共有シークレットを入力（2.3 で取得したもの）

#### Android App の追加

1. プロジェクト →「Apps」→「+ New」
2. 設定値:
   - App name: LootDive Android
   - Platform: Play Store
   - Package name: `com.astapi.LootDive`
3. Google Play 連携:
   - サービスアカウント JSON をアップロード（3.3 で取得したもの）

### 4.2 Products の作成

ストア商品を RevenueCat に登録。

1. サイドバー「Products」→「+ New」

| Identifier | App Store Product ID | Play Store Product ID |
|------------|---------------------|----------------------|
| `character_slots` | `com.astapi.LootDive.character_slots` | `character_slots` |

### 4.3 Entitlements の作成

購入によって解放される「権利」を定義。

1. サイドバー「Entitlements」→「+ New」
2. 作成する Entitlement:

| Identifier | 説明 | 紐付ける Products |
|------------|------|------------------|
| `character_slots` | キャラスロット拡張権利（5枠） | character_slots |

### 4.4 Offerings の作成

ユーザーに表示する商品パッケージを定義。

1. サイドバー「Offerings」→「+ New」
2. Identifier: `default`
3. 「Packages」を追加:

| Identifier | Product |
|------------|---------|
| `character_slots` | character_slots |

4. 「Make Current」で default をアクティブに設定

---

## 5. API Keys の取得

### 5.1 API Keys の場所

1. RevenueCat ダッシュボード
2. プロジェクト →「API Keys」

### 5.2 取得するキー

| プラットフォーム | キー形式 | 用途 |
|-----------------|---------|------|
| iOS | `appl_XXXXXXXXXXXX` | iOS アプリで使用 |
| Android | `goog_XXXXXXXXXXXX` | Android アプリで使用 |

### 5.3 キーの管理

**開発時**: コード内に直接記載（テスト用）

```typescript
const REVENUECAT_API_KEY_IOS = 'appl_XXXXXXXXXXXX';
const REVENUECAT_API_KEY_ANDROID = 'goog_XXXXXXXXXXXX';
```

**本番時**: 環境変数で管理推奨

```bash
# .env
REVENUECAT_API_KEY_IOS=appl_XXXXXXXXXXXX
REVENUECAT_API_KEY_ANDROID=goog_XXXXXXXXXXXX
```

または EAS Secrets を使用:

```bash
eas secret:create --name REVENUECAT_API_KEY_IOS --value "appl_XXXXXXXXXXXX" --scope project
eas secret:create --name REVENUECAT_API_KEY_ANDROID --value "goog_XXXXXXXXXXXX" --scope project
```

---

## 6. 商品一覧

LootDive で実装予定の課金商品。

### キャラクタースロット（非消費型）

| 商品名 | RevenueCat ID | iOS Product ID | Android Product ID | 価格 |
|--------|---------------|----------------|-------------------|------|
| キャラスロット拡張 | character_slots | com.astapi.LootDive.character_slots | character_slots | 490円 |

### 将来の拡張（未実装）

Monetization.md に記載の機能:

- インベントリ拡張
- 倉庫拡張
- フィルター強化
- 再振りポイント（消費型）
- 広告削除

---

## セットアップ完了チェックリスト

- [ ] RevenueCat アカウント作成
- [ ] App Store Connect でアプリ登録
- [ ] App Store Connect で商品作成（3商品）
- [ ] App Store Connect で共有シークレット生成
- [ ] Google Play Console でアプリ登録
- [ ] Google Play Console で商品作成（3商品）
- [ ] Google Cloud でサービスアカウント作成
- [ ] RevenueCat に iOS App 追加
- [ ] RevenueCat に Android App 追加
- [ ] RevenueCat で Products 作成
- [ ] RevenueCat で Entitlements 作成
- [ ] RevenueCat で Offerings 作成
- [ ] API Keys 取得

---

## 参考リンク

- [RevenueCat 公式ドキュメント](https://docs.revenuecat.com/)
- [react-native-purchases GitHub](https://github.com/RevenueCat/react-native-purchases)
- [App Store Connect ヘルプ](https://help.apple.com/app-store-connect/)
- [Google Play Console ヘルプ](https://support.google.com/googleplay/android-developer/)
