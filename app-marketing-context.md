# App Marketing Context — LootDive（ルートダイブ）

> すべてのASO／マーケティング系スキルが最初に参照する土台ドキュメント。
> 更新日: 2026-06-25

## App Overview
- **App Name:** LootDive（日本語表記: ルートダイブ | ビルド構築ハクスラ周回RPG）
- **App ID (Apple):** 6758569313
- **App Store URL:** https://apps.apple.com/jp/app/lootdive/id6758569313
- **App ID (Google Play):** com.astapi.LootDive（※未配信。バンドルIDは予約済み）
- **Category:** Games（RPG / ロールプレイング）
- **Secondary Category:** 未設定（候補: アクション）
- **Platform:** iOS のみ配信中（Androidビルドは存在するが未公開）
- **Price Model:** 基本無料（広告マネタイズ: Google Mobile Ads + Meta/Pangleメディエーション）
- **Launch Date:** 配信済み（v2.0.0時点）
- **Current Version:** 2.0.0
- **Developer:** astapi games.

## Value Proposition
- **Problem:** 本格的なハクスラ（装備収集・ビルド構築）を遊びたいが、忙しくて操作の重いRPGに時間を割けない。
- **Target Audience:** 装備収集・ビルド構築が好きなハクスラ/ディアブロ系ファン、放置・オートバトルで効率よく遊びたいライト〜ミドルゲーマー。スキマ時間にサクサク周回したい層。
- **Unique Differentiator:** 戦闘は完全オート、プレイヤーの役割は「準備」と「判断」だけ。手軽さと本格ハクスラ要素（ランダムMOD装備・ユニーク装備・パッシブツリー）を両立。
- **Elevator Pitch:** 「準備と判断」だけで遊べる、完全自動戦闘の本格ビルド構築ハクスラ周回RPG。

### 主な特徴（ストア訴求の素材）
- **完全自動戦闘**: ATB風ゲージ制。装備を整えダンジョンを選ぶだけ。
- **20種以上のダンジョン**: 草原〜魔王城・竜の巣穴・終焉の地まで。
- **ハクスラ要素**: ランダムMOD付き装備 / ボス撃破のユニーク装備 / パッシブスキルツリーでビルド構築。
- **エンドコンテンツ**: Uberボス（強化版ボス・最高峰ドロップ）、異次元ラッシュ（200階の無限ダンジョン）。

## Competitors
ユーザー指定: 「オートバトル/放置系RPG全般」を広く競合とみなす。
※具体アプリ名は未特定。`competitor-analysis` スキルで実アプリを同定して埋める（TODO）。

| App | App ID | Strengths | Weaknesses |
|-----|--------|-----------|------------|
| （放置/オートバトル系RPG 全般） | TODO | 自動進行の手軽さ、長期リテンション設計 | 課金圧・インフレ感、ビルドの自由度が浅い場合あり |

> LootDiveの差別化ポイント: 「放置の手軽さ」×「ディアブロ系の本格ビルド/MOD収集」の両立。

## Current ASO State
- **Title:** ルートダイブ | ビルド構築ハクスラ周回RPG
- **Subtitle:** 未確認（ASC APIで取得して埋める / TODO）
- **Keyword Field:** 未確認（TODO）
- **Rating:** 未確認（ASC APIで取得 / TODO）
- **Primary Keywords:** 推定: ハクスラ / オートバトル / 放置RPG / ビルド / 周回 / ダンジョン（要 keyword-research で検証）

## Goals
ユーザー指定の優先ゴール（3つ）:
1. **ダウンロード数の増加** — オーガニック中心。ASO（メタデータ・キーワード・スクショ）が主戦場。
2. **収益（広告/課金）の最大化** — 広告マネタイズ前提。リテンション×表示機会の最大化。
3. **ランキング/露出の向上** — カテゴリ順位・キーワード順位・Apple編集チーム露出狙い。

※具体的な数値ターゲット・期日は未設定（必要に応じて後で追記）。

## Resources
- **Budget:** 基本なし（オーガニック中心。有料UAはほぼ行わない前提）
- **Team:** 個人開発（astapi games.）
- **Tools:**
  - App Store Connect API（自アプリ実データ取得 — `app-store-connect` スキル）
  - 自前キーワードボリューム取得ツール（別プロジェクト `~/projects/appwords`）
  - Firebase Analytics / Crashlytics（計測・クラッシュ）
  - Google Mobile Ads（広告 + Meta/Pangleメディエーション）
- **Constraints:** 有料広告予算なし → オーガニック施策（ASO・無料チャネル・クリエイティブ最適化）に集中。Appeeky等の有料ASOツールは不使用。

## Markets
- **Primary:** 日本（App Store JP）
- **Secondary:** 英語圏・グローバル（プレスキット英語版あり press-kit-en/）
- **Languages:** 日本語 / 英語 / 中国語 / 韓国語 / ドイツ語 / スペイン語 / フランス語（アプリ内i18n 7言語対応）

## Assets（既存マーケ素材）
- プレスキット: `press-kit/`（日）, `press-kit-en/`（英） — スクショ7枚 / プロモ動画 / GIF / アイコン
- プレスリリース: `press-kit/press-release.txt`, `docs/press-release.md`
- リリース告知: `docs/x-release-tweets.md`

---

## 次にやるべきこと（推奨スキル）
1. **`aso-audit`** — まず現状のストアページ健康診断（タイトル/サブタイトル/スクショ/キーワード）
2. **`keyword-research`** — `appwords` のボリュームデータと合わせて狙うキーワードを確定（→ メタデータへ）
3. **`metadata-optimization`** — タイトル/サブタイトル/キーワード欄の最適化（DL・ランキング直結）
4. **`screenshot-optimization`** — 7枚のスクショ構成見直し（コンバージョン＝DL率向上）

> オーガニック中心方針のため、有料UA系（`ua-campaign` / `apple-search-ads`）は後回しでよい。
