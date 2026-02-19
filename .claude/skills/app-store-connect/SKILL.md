---
name: app-store-connect
description: |
  App Store Connect APIを使用してアプリのメタデータを管理するスキル。
  以下の操作をサポート：
  - プロモーションテキストのコピー（販売中→審査準備中バージョン）
  - 「このバージョンの最新情報」(whatsNew)の多言語更新

  トリガー条件：
  - 「プロモーションテキストをコピー」「promotional textをコピー」と言われた時
  - 「whatsNewを更新」「リリースノートを更新」「このバージョンの最新情報を更新」と言われた時
  - App Store Connectのメタデータ操作が必要な時
---

# App Store Connect

App Store Connect APIでアプリのメタデータを管理する。

## 前提条件

`.env`に以下が必要：

```
APP_STORE_CONNECT_ISSUER_ID=xxx
APP_STORE_CONNECT_KEY_ID=xxx
APP_STORE_CONNECT_PRIVATE_KEY_PATH=/path/to/AuthKey.p8
APP_STORE_CONNECT_APP_ID=xxx
```

## 操作

### 1. プロモーションテキストのコピー

販売中→審査準備中バージョンへプロモーションテキストをコピー：

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/copyPromotionalText.ts
```

### 2. whatsNewの更新

審査準備中バージョンの「このバージョンの最新情報」を各言語で更新：

1. ユーザーから日本語リリースノートを取得
2. `locales/ja.json`と`locales/en.json`から固有名詞の翻訳を確認
3. `scripts/updateWhatsNew.ts`の`whatsNewByLocale`を編集
4. 実行：

```bash
npx tsx --tsconfig tsconfig.scripts.json scripts/updateWhatsNew.ts
```

## scripts/

- `appStoreConnect.ts` - API接続（JWT生成、リクエスト）
- `copyPromotionalText.ts` - プロモーションテキストコピー
- `updateWhatsNew.ts` - whatsNew更新
