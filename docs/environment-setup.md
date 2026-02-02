# 環境変数セットアップガイド

## 1. `.env`ファイルの作成

プロジェクトルートに`.env`ファイルを作成します：

```bash
# プロジェクトルートで実行
cp .env.example .env
```

または手動で作成：

```bash
touch .env
```

## 2. `.env`ファイルの編集

`.env`ファイルを開き、以下の内容を記入してください：

```env
# RevenueCat API Keys
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_XXXXXXXXXXXX
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_XXXXXXXXXXXX

# デバッグフラグ（開発時のみ）
EXPO_PUBLIC_SKIP_PURCHASES=false
EXPO_PUBLIC_ALL_ENTITLEMENTS=false
```

### APIキーの取得方法

1. [RevenueCat Dashboard](https://app.revenuecat.com)にログイン
2. プロジェクトを選択
3. 左メニューの「API Keys」をクリック
4. iOS用とAndroid用のPublic App-Specific API Keyをコピー
   - iOS: `appl_`で始まるキー
   - Android: `goog_`で始まるキー

**重要**: `.env`ファイルは**絶対にGitにコミットしないでください**。
`.gitignore`に`.env`が含まれていることを確認してください。

## 3. デバッグフラグの使い方

### `EXPO_PUBLIC_SKIP_PURCHASES`
- `true`: RevenueCat初期化をスキップ（課金機能なしでアプリをテスト）
- `false`: 通常通りRevenueCatを初期化

**使用例**: RevenueCatアカウントがまだない、またはAPIキーが未設定の場合に`true`に設定

### `EXPO_PUBLIC_ALL_ENTITLEMENTS`
- `true`: すべてのEntitlementを有効として扱う（課金なしで全機能テスト）
- `false`: 実際のEntitlementを使用

**使用例**: 課金機能の実装テストで、実際に課金せずに全機能をテストしたい場合

## 4. 開発時の設定例

### RevenueCat未設定（開発初期）
```env
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_XXXXXXXXXXXX
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_XXXXXXXXXXXX
EXPO_PUBLIC_SKIP_PURCHASES=true
EXPO_PUBLIC_ALL_ENTITLEMENTS=true
```

この設定で、課金機能をスキップしつつ、全プレミアム機能を有効にしてテストできます。

### RevenueCat設定済み（サンドボックステスト）
```env
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_YOUR_REAL_KEY
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_YOUR_REAL_KEY
EXPO_PUBLIC_SKIP_PURCHASES=false
EXPO_PUBLIC_ALL_ENTITLEMENTS=false
```

この設定で、実際のRevenueCat統合をテストできます。

## 5. 本番環境の設定（EAS Build）

本番ビルドではEAS Secretsを使用します：

```bash
# iOS APIキーを設定
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_IOS --value "appl_YOUR_REAL_KEY"

# Android APIキーを設定
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID --value "goog_YOUR_REAL_KEY"
```

### 既存のSecretを確認
```bash
eas secret:list
```

### Secretを削除
```bash
eas secret:delete --name EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
```

## 6. 環境変数の確認

アプリ内で環境変数が正しく読み込まれているか確認する方法：

```typescript
// デバッグ用（本番では削除）
console.log('RevenueCat API Key (iOS):', process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS);
console.log('Skip Purchases:', process.env.EXPO_PUBLIC_SKIP_PURCHASES);
```

**注意**: 本番環境ではAPIキーをログ出力しないでください。

## トラブルシューティング

### 環境変数が読み込まれない
1. ファイル名が`.env`であることを確認
2. 変数名が`EXPO_PUBLIC_`で始まっていることを確認
3. アプリを再起動（`npx expo start --clear`）

### APIキーが無効
1. RevenueCat Dashboardでキーが正しいか確認
2. iOS/Android用のキーを間違えていないか確認
3. キーの前後に空白がないか確認

### ビルド時に環境変数が反映されない
- EAS Buildを使用している場合は、EAS Secretsを設定してください
- ローカルビルド（`expo prebuild`）では`.env`が使用されます

## セキュリティ注意事項

1. **.envファイルは絶対にGitにコミットしない**
2. **APIキーをコード内にハードコードしない**
3. **本番用のAPIキーは環境変数またはEAS Secretsで管理**
4. **チームメンバーと共有する場合は、`.env.example`を使用**
