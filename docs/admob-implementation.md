# AdMob広告実装計画

## 概要

Google AdMobを使用してバナー広告とリワード広告を導入する。

### 導入する広告タイプ

| タイプ | 配置場所 | 目的 |
|--------|----------|------|
| バナー広告 | ホーム画面下部 | 安定した収益 |
| リワード広告 | リザルト画面 | ユーザー選択型・報酬2倍 |

---

## 前提条件

- [x] AdMobアカウント作成済み
- [x] アプリ登録済み（未公開として）
- [x] 広告ユニット作成済み
- [x] App ID取得

### AdMob情報（本番用）

```
# iOS
App ID: ca-app-pub-7716085580742961~4043678329
リワード広告ユニットID（ドロップ率UP）: ca-app-pub-7716085580742961/9679992270
リワード広告ユニットID（Tier確率UP）: ca-app-pub-7716085580742961/8366910606

# Android（未設定）
App ID: ca-app-pub-3940256099942544~3347511713（テスト用）
```

### 広告ユニットの命名規則

異なる配置には別の広告ユニットを作成する（分析・収益追跡のため）

| ユニット名 | 用途 |
|-----------|------|
| `reward_drop_boost` | ドロップ率UPブースト |
| `reward_tier_boost` | Tier確率UPブースト |

### テスト用広告ID（Google公式）

開発中はこれらのIDを使用する。本番IDで開発中にクリックするとアカウントBANのリスクあり。

```typescript
// Android
const TEST_AD_IDS = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
};

// iOS
const TEST_AD_IDS_IOS = {
  BANNER: 'ca-app-pub-3940256099942544/2934735716',
  REWARDED: 'ca-app-pub-3940256099942544/1712485313',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/4411468910',
};
```

---

## 実装ステップ

### Phase 1: 環境構築

#### 1.1 ライブラリインストール

```bash
npx expo install react-native-google-mobile-ads
```

#### 1.2 app.json設定

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": "ca-app-pub-xxxxx~xxxxx",
          "iosAppId": "ca-app-pub-xxxxx~xxxxx"
        }
      ]
    ]
  }
}
```

#### 1.3 Development Build作成

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
```

**注意**: `react-native-google-mobile-ads`はネイティブコードを含むため、Expo Goでは動作しない。Development Buildが必須。

---

### Phase 2: 広告設定ファイル作成

#### 2.1 広告ID定数ファイル

`constants/adConfig.ts`

```typescript
import { Platform } from 'react-native';

const isTestMode = __DEV__;

// 本番用ID（リリース前に設定）
const PRODUCTION_AD_IDS = {
  android: {
    banner: 'ca-app-pub-xxxxx/xxxxx',
    rewarded: 'ca-app-pub-xxxxx/xxxxx',
  },
  ios: {
    banner: 'ca-app-pub-xxxxx/xxxxx',
    rewarded: 'ca-app-pub-xxxxx/xxxxx',
  },
};

// テスト用ID（Google公式）
const TEST_AD_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

const platformIds = Platform.OS === 'ios'
  ? (isTestMode ? TEST_AD_IDS.ios : PRODUCTION_AD_IDS.ios)
  : (isTestMode ? TEST_AD_IDS.android : PRODUCTION_AD_IDS.android);

export const AD_UNIT_IDS = {
  BANNER: platformIds.banner,
  REWARDED: platformIds.rewarded,
};
```

#### 2.2 広告初期化

`utils/ads.ts`

```typescript
import mobileAds from 'react-native-google-mobile-ads';

export const initializeAds = async () => {
  try {
    await mobileAds().initialize();
    console.log('AdMob initialized');
  } catch (error) {
    console.error('AdMob initialization failed:', error);
  }
};
```

アプリ起動時（`_layout.tsx`）で呼び出す。

---

### Phase 3: バナー広告実装

#### 3.1 BannerAdコンポーネント

`components/ads/BannerAd.tsx`

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '@/constants/adConfig';

export const AdBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_IDS.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load:', error);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
```

#### 3.2 ホーム画面に配置

`app/home.tsx` の下部メニューの上に配置

```tsx
// ScrollViewとbottomMenuの間に追加
<AdBanner />

<View style={styles.bottomMenu}>
  ...
</View>
```

---

### Phase 4: リワード広告実装

#### 4.1 リワード広告フック

`hooks/useRewardAd.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '@/constants/adConfig';

export const useRewardAd = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rewarded, setRewarded] = useState<RewardedAd | null>(null);

  const loadAd = useCallback(() => {
    setIsLoading(true);
    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS.REWARDED, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setIsLoaded(true);
      setIsLoading(false);
    });

    const unsubscribeFailed = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('Rewarded ad failed to load:', error);
      setIsLoading(false);
    });

    ad.load();
    setRewarded(ad);

    return () => {
      unsubscribeLoaded();
      unsubscribeFailed();
    };
  }, []);

  const showAd = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!rewarded || !isLoaded) {
        resolve(false);
        return;
      }

      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          resolve(true);
        }
      );

      const unsubscribeClosed = rewarded.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeEarned();
          unsubscribeClosed();
          setIsLoaded(false);
          // 次の広告をプリロード
          loadAd();
        }
      );

      rewarded.show();
    });
  }, [rewarded, isLoaded, loadAd]);

  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, [loadAd]);

  return {
    isLoaded,
    isLoading,
    showAd,
    loadAd,
  };
};
```

#### 4.2 リザルト画面に追加

`app/result.tsx`

```tsx
import { useRewardAd } from '@/hooks/useRewardAd';

export default function ResultScreen() {
  const { isLoaded, showAd } = useRewardAd();
  const [rewardClaimed, setRewardClaimed] = useState(false);

  const handleWatchAd = async () => {
    const earned = await showAd();
    if (earned) {
      // 報酬2倍処理
      setRewardClaimed(true);
      // TODO: 経験値やアイテムを2倍にする処理
    }
  };

  return (
    // ...既存のコード

    {!rewardClaimed && (
      <Pressable
        style={[styles.rewardButton, !isLoaded && styles.rewardButtonDisabled]}
        onPress={handleWatchAd}
        disabled={!isLoaded}
      >
        <Text style={styles.rewardButtonText}>
          {isLoaded ? '広告を見て報酬2倍' : '広告を読み込み中...'}
        </Text>
      </Pressable>
    )}
  );
}
```

---

## ファイル構成

```
├── constants/
│   └── adConfig.ts          # 広告ID設定
├── utils/
│   └── ads.ts               # 広告初期化
├── components/
│   └── ads/
│       └── BannerAd.tsx     # バナー広告コンポーネント
├── hooks/
│   └── useRewardAd.ts       # リワード広告フック
└── app/
    ├── _layout.tsx          # 広告初期化呼び出し
    ├── home.tsx             # バナー広告配置
    └── result.tsx           # リワード広告配置
```

---

## 広告配置イメージ

### ホーム画面

```
┌─────────────────────────┐
│  キャラクター情報        │
│  装備リスト             │
│                         │
├─────────────────────────┤
│  [    バナー広告    ]   │  ← 追加
├─────────────────────────┤
│ スキル 持物 倉庫 設定 冒険│
└─────────────────────────┘
```

### リザルト画面

```
┌─────────────────────────┐
│    ダンジョン踏破！      │
│                         │
│    獲得報酬             │
│    +100 EXP            │
│    アイテム一覧         │
│                         │
│ [ 広告を見て報酬2倍 ]   │  ← リワード広告ボタン
│                         │
│ [ ダンジョン選択に戻る ] │
└─────────────────────────┘
```

---

## テスト手順

1. Development Buildをインストール
2. アプリ起動時にAdMob初期化ログを確認
3. ホーム画面でテストバナー広告が表示されることを確認
4. リザルト画面で「広告を見て報酬2倍」ボタンをタップ
5. テストリワード広告が再生されることを確認
6. 広告視聴後に報酬が2倍になることを確認

---

## 本番リリース前チェックリスト

- [ ] AdMobでアプリをGoogle Play/App Storeにリンク
- [ ] 本番用広告ユニットIDに差し替え
- [ ] `__DEV__`フラグで本番/テストIDが切り替わることを確認
- [ ] プライバシーポリシーにAdMobのデータ収集について記載済み
- [ ] App Store/Google Playのデータセーフティセクションを更新

---

## 注意事項

### 開発中の注意

- **本番IDで広告をクリックしない**: アカウントBANのリスク
- **テストIDを使用する**: Google公式のテストIDは安全

### ユーザー体験の配慮

- バナー広告は操作の邪魔にならない位置に配置
- リワード広告は強制せず、ユーザーの選択で視聴
- 広告読み込み中は適切なフィードバック表示

### 収益最適化

- リワード広告は単価が高い傾向
- バナー広告は表示時間で収益が決まる
- 適切なタイミングでの広告表示が重要

---

## TestFlightでのテスト

### 環境の違い

| 環境 | `__DEV__` | 使用される広告ID |
|------|-----------|-----------------|
| Expo Go / Development Build | `true` | テスト用ID |
| TestFlight / Production | `false` | 本番用ID |

TestFlightは**本番環境**として扱われるため、本番用の広告IDが使用される。

### テストデバイスの登録（重要）

本番IDでテストする際、自分のデバイスでテスト広告を表示するために必要。
テストデバイス登録をしないと、広告クリックでアカウントBANのリスクがある。

#### iPhoneの広告ID（IDFA）確認方法

1. 設定 → プライバシーとセキュリティ → トラッキング
2. 「Appからのトラッキング要求を許可」がオンになっていることを確認
3. IDFAを確認する方法:
   - App Storeで「My Device IDFA by AppsFlyer」をインストール
   - アプリを開くとIDFAが表示される（コピー可能）

#### AdMobコンソールでテストデバイスを登録

1. [AdMobコンソール](https://admob.google.com/) にログイン
2. 左メニュー → **設定** → **テストデバイス**
3. **テストデバイスを追加**
4. 入力内容:
   - 名前: 任意（例: `iPhone Test`）
   - プラットフォーム: iOS
   - 広告ID: 取得したIDFA

#### コード側でテストデバイスを指定する方法（オプション）

```typescript
const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS[type], {
  requestNonPersonalizedAdsOnly: true,
  testDeviceIdentifiers: ['YOUR-IDFA-HERE'],
});
```

### 広告が表示されない場合

1. **広告ユニット作成直後**: 反映に数時間かかる場合がある
2. **App IDが正しくない**: `app.config.ts`のiOS App IDを確認
3. **ネイティブ再ビルドが必要**: App ID変更後は`eas build`が必要
4. **テストデバイス未登録**: AdMobコンソールでデバイスを登録

---

## 現在の実装状況

### 実装済みコンポーネント

| ファイル | 説明 |
|---------|------|
| `components/common/RewardAdBoost.tsx` | リワード広告ブーストコンポーネント |
| `components/common/BoostModal.tsx` | リワード広告モーダル版 |
| `stores/useAdBoostStore.ts` | ブースト状態管理 |

### 広告ID設定箇所

```typescript
// components/common/RewardAdBoost.tsx, BoostModal.tsx
const AD_UNIT_IDS = {
  drop_rate: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/9679992270',
  tier_boost: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-7716085580742961/8366910606',
};
```

### app.config.ts設定

```typescript
[
  "react-native-google-mobile-ads",
  {
    androidAppId: "ca-app-pub-3940256099942544~3347511713", // テスト用
    iosAppId: "ca-app-pub-7716085580742961~4043678329",    // 本番用
  },
],
```
