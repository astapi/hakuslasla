# クラッシュ調査: Reanimated StaticPropsRegistry / CGColor

- **日時**: 2026-03-20 18:40 JST
- **バージョン**: 1.2.2 (Build 19)
- **Crashlytics Issue**: `ca1e1e1d31d1d3de4fb18a010417fa83`
- **プラットフォーム**: iOS
- **発生バージョン**: v1.2.1 以降

## クラッシュ概要

2つのスレッドで同時にクラッシュが発生。

### クラッシュスレッド: `com.facebook.react.runtime.JavaScript`

```
0  LootDive    <deduplicated_symbol> (std::terminate)
1  LootDive    reanimated::css::StaticPropsRegistry::set(Runtime&, int, Value const&)
                → StaticPropsRegistry.cpp:15
2  LootDive    reanimated::ReanimatedModuleProxy::setViewStyle(Runtime&, Value const&, Value const&)
                → shared_ptr.h:634
3  LootDive    __hostFunction_ReanimatedModuleProxySpec_setViewStyle
                → jsi.h:1633
```

Reanimatedの `StaticPropsRegistry::set` でC++例外が発生。ビューのスタイル（非アニメーション="静的"プロパティ）を設定しようとして失敗。

### メインスレッド: テキスト描画中のEXC_BAD_ACCESS

```
0  CoreFoundation    CF_IS_OBJC + 248
1  CoreGraphics      CGColorSpaceCopyFlexGTCInfo + 20
2  CoreGraphics      CGColorSpaceContainsFlexGTCInfo + 96
3  CoreGraphics      CGColorGetContentHeadroom + 44
4  CoreGraphics      CGColorCompare + 204
...
15 React             -[RCTTextLayoutManager drawAttributedString:paragraphAttributes:frame:drawHighlightPath:]
16 React             -[RCTParagraphTextView drawRect:]
```

テキスト描画時に無効な `CGColor`（nilカラースペース）へアクセスしてクラッシュ。

## 原因分析

### 1. Reanimated 4.1.x のカラー処理バグ（根本原因）

`Animated.View` を使うと、アニメーション対象でないプロパティ（背景色、ボーダー色など）も `StaticPropsRegistry` 経由で管理される。4.1.x ではカラー値の処理に複数のバグがあり、不正な `CGColor` がネイティブ側に渡され、メインスレッドのテキスト描画時にクラッシュする。

すべてのカラー値はハードコードされており、JS側で undefined/null になるパスはない。問題はReanimatedのネイティブ側カラー処理にある。

### 2. PR #153 の `isExiting` による Animated.View 強制アンマウント（誘発要因）

PR #153（`83bb325`）で、戦闘→結果画面遷移時の `handleRawEvent` クラッシュを防ぐため、`isExiting` フラグによる Image の事前アンマウントを導入した。しかしこの実装は `CharacterAvatar` 全体（`Animated.View` を含む）をアンマウントしていた。

```
t=0ms     戦闘終了
t=1700ms  isExiting=true → CharacterAvatar 全体をアンマウント
          → Animated.View が消える
          → StaticPropsRegistry がスタイル更新処理中の場合、無効なviewTagへアクセスしてクラッシュ
t=2000ms  router.replace → 画面遷移
```

これにより、Reanimated 4.1.x の潜在バグが**遷移のたびに**トリガーされやすくなった。

### v1.2.0 → v1.2.1 のコード変更調査

v1.2.1 で変更された Reanimated 関連コンポーネントは以下の1件のみ:

- **CharacterAvatar.tsx（#138）**: `battleScale` による画像サイズの動的計算を追加

```diff
- style={[styles.avatar, { width: size, height: size }]}
+ style={[styles.avatar, { width: scaledSize, height: scaledSize }]}
```

Reanimated のバージョン（4.1.6）、package-lock.json ともに変更なし。コード変更に明確な原因はなく、以下の複合要因と考えられる:

| 要因 | 詳細 |
|---|---|
| Reanimated 4.1.x の潜在バグ | カラー処理のバグは全バージョンに存在 |
| v1.2.0 でも発生していた可能性 | ただし頻度が低く Crashlytics に記録されなかった |
| v1.2.2 の `isExiting`（#153） | 戦闘終了時に Animated.View を遷移前に強制アンマウントすることで競合頻度が上昇 |
| iOS 側の変化 | `CGColorGetContentHeadroom`（iOS 18 新API）が無効 CGColor に厳格に反応 |

### 該当コンポーネント

| コンポーネント | ファイル | Animated使用箇所 |
|---|---|---|
| CharacterAvatar | `components/battle/CharacterAvatar.tsx` | `Animated.View` + translateX（子に Text あり） |
| ChestDrop | `app/battle/[dungeonId].tsx` | `Animated.View` + 複数transform（子に Image） |
| BoostIconButton | `components/common/BoostIconButton.tsx` | `AnimatedPressable` + scale |
| ModFilterTooltip | `components/common/ModFilterTooltip.tsx` | `Animated.View` + opacity/translateY（子に Text） |
| BoostTooltip | `components/common/BoostTooltip.tsx` | `Animated.View` + opacity/translateY（子に Text） |
| PassiveTree | `components/player/PassiveTree.tsx` | `Animated.View` + transform（子に SVG/Text） |

## 環境

| パッケージ | バージョン |
|---|---|
| expo | ~54.0.30 |
| react-native | 0.81.5 |
| react-native-reanimated（installed） | 4.1.6 |
| react-native-reanimated（Expo SDK 54推奨） | ~4.1.1 |

## 修正内容

### 修正1: `isExiting` による Animated.View 強制アンマウントの廃止

PR #153 の `isExiting` は `CharacterAvatar` 全体をアンマウントしていたが、`Animated.View` をマウント維持したまま Image のみ非表示にするよう変更。

**変更ファイル:**
- `components/battle/CharacterAvatar.tsx`: `hideImage` prop を追加
- `app/battle/[dungeonId].tsx`: `isExiting` 時のレンダリング方式を変更

**変更前（#153 の対策）:**
```
isExiting=true → CharacterAvatar 全体をアンマウント
              → Animated.View が消える
              → StaticPropsRegistry が無効なviewTagにアクセスしてクラッシュ
```

**変更後:**
```
isExiting=true → CharacterAvatar の hideImage=true
              → Animated.View はマウント維持、中の Image だけ非表示
              → StaticPropsRegistry は有効なviewTagを参照（クラッシュしない）
```

| 対象 | 変更前 | 変更後 |
|---|---|---|
| CharacterAvatar | `isExiting` で全体アンマウント | `hideImage` prop で Image のみ非表示、Animated.View は維持 |
| ImageBackground | `isExiting` でアンマウント→フォールバックView | 常にマウント維持（画像は既にロード済みで onLoad 再発火しない） |
| ChestDrop | `isExiting` で全体アンマウント | `isExiting` でアンマウント（Image のみで構成、Animated.View のアンマウントは許容） |

### 修正2（推奨）: Reanimated 4.2.3 へアップデート

根本原因である Reanimated 4.1.x のカラー処理バグを解消するため、4.2.3 へのアップデートを推奨。

#### 4.2.0 で修正されたカラー関連バグ（抜粋）

| PR | 修正内容 |
|---|---|
| [#8393](https://github.com/software-mansion/react-native-reanimated/pull/8393) | CSSで正しいカラープロセッサを使用 |
| [#8398](https://github.com/software-mansion/react-native-reanimated/pull/8398) | 透明色の補間を正しく実装 |
| [#8544](https://github.com/software-mansion/react-native-reanimated/pull/8544) | DynamicColorIOS の nullable チェック追加 |
| [#8542](https://github.com/software-mansion/react-native-reanimated/pull/8542) | CSSトランジションでの透明色の不正な動作を修正 |
| [#8617](https://github.com/software-mansion/react-native-reanimated/pull/8617) | DynamicColorIOS の処理ロジックを processColor へ移動 |
| [#8670](https://github.com/software-mansion/react-native-reanimated/pull/8670) | PlatformColor の処理を processColor へ移動 |
| [#8688](https://github.com/software-mansion/react-native-reanimated/pull/8688) | Android での透明色クラッシュを修正 |
| [#8672](https://github.com/software-mansion/react-native-reanimated/pull/8672) | SVG fill に 'none' を渡した場合のクラッシュ修正 |

#### 4.2.2 で修正された追加バグ

| PR | 修正内容 |
|---|---|
| [#8956](https://github.com/software-mansion/react-native-reanimated/pull/8956) | FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS でカラーアルファ値が不正 |
| [#8958](https://github.com/software-mansion/react-native-reanimated/pull/8958) | FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS 機能フラグでクラッシュ |

#### アップデート時のリスク評価

| リスク | 影響度 | 詳細 |
|---|---|---|
| Expo互換性チェックで警告 | 低 | `bundledNativeModules.json` は `~4.1.1`。`npx expo install` でダウングレードされる可能性あり |
| FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS | 低 | 4.2.0の新機能。4.2.2で修正済み。4.2.3なら問題なし |
| RN 0.78 サポート廃止 | なし | 本プロジェクトは RN 0.81.5 |
| CSS Transform 内部リファクタ | 低 | シンプルな transform のみ使用（translateX/Y, scale, rotateZ） |
| EASビルド | 要対応 | ネイティブモジュール変更のため再ビルド必須 |

#### 適用手順

```bash
# 1. アップデート
npm install react-native-reanimated@~4.2.3

# 2. package.json を確認（~4.2.3 に固定されていること）
# 注: npx expo install を使うと ~4.1.1 に戻されるので使わない

# 3. iOS ネイティブの再ビルド
npx expo prebuild --clean
# または EAS Build を再実行

# 4. テスト
# - 戦闘画面（CharacterAvatar のアニメーション）
# - 戦闘→結果画面の遷移（hideImage による Image 非表示）
# - BoostIconButton のパルスアニメーション
# - ModFilterTooltip / BoostTooltip のフェードイン・アウト
# - PassiveTree のピンチ・パンジェスチャー
```

## 関連する過去の修正

- **PR #122** (`96f0de1`): `Reanimated アニメーションのアンマウント時クラッシュを修正`
  - `cancelAnimation` によるアンマウント時のクリーンアップを追加（v1.2.0）
- **PR #153** (`83bb325`): `Reanimated handleRawEvent 画像onLoadクラッシュを修正`
  - `isExiting` フラグで Image を事前アンマウントする回避策を導入（v1.2.2）
  - **この対策が Animated.View の強制アンマウントを引き起こし、StaticPropsRegistry クラッシュを誘発していた**
  - → 本修正で `hideImage` prop に変更し、Animated.View はマウント維持するよう改善

## 参考リンク

- [Reanimated Releases](https://github.com/software-mansion/react-native-reanimated/releases)
- [Reanimated iOS Release Crash #7745](https://github.com/software-mansion/react-native-reanimated/issues/7745)
- [Expo #38559 - Bump reanimated to fix crash](https://github.com/expo/expo/issues/38559)
