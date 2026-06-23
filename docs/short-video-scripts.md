# LootDive プロモーション動画 台本

YouTube Shorts / TikTok 向け。Remotion（React）で実装する前提。

---

## 共通仕様

| 項目 | 値 |
|------|-----|
| フォーマット | 縦型 9:16（1080 x 1920px） |
| フレームレート | 30fps |
| 最大尺 | 60秒以内（Shorts上限） |
| テキスト | 日本語版・英語版を切り替え可能にする（Remotion の props で制御） |
| フォント | 日本語: Noto Sans JP Bold / 英語: Inter Bold |
| カラー | ゲームのダークテーマ準拠（BG: #1a1a2e, Gold: #FFD700, Green: #4CAF50, Red: #F44336） |

### 必要な共通アセット

- ゲームプレイ録画（iPhone画面収録、縦型）
- アプリアイコン画像
- App Store バッジ画像
- BGM（ゲーム内BGMまたはフリー素材、15-30秒ループ）
- SE（装備チェンジ音、レベルアップ音、ドロップ音など）
- スクリーンショット各種（戦闘画面、装備画面、スキルツリー、ダンジョン選択）

---

## 動画 1:「まだ自分で戦ってるの？」（フック型・15秒）

**コンセプト**: 短く強いフックで興味を引く。最も拡散しやすいフォーマット。

### 台本

| 秒数 | フレーム | シーン | 画面内容 | テキストオーバーレイ | 備考 |
|------|---------|--------|----------|---------------------|------|
| 0-2s | 0-60 | Hook | 黒背景にテキストがバウンドしながら登場 | 「まだ自分で戦ってるの？」 | spring アニメーション。フォントサイズ大（64px）。画面中央 |
| 2-4s | 60-120 | 対比 | 画面を縦に2分割。上: 他ゲーの忙しい操作イメージ（テキストアニメ）、下: LootDive の自動戦闘画面 | 上:「従来のRPG 😰」下:「LootDive 😎」 | wipe トランジションで切り替え |
| 4-8s | 120-240 | ゲームプレイ | 自動戦闘のゲームプレイ録画。ゲージが溜まって攻撃が発動する瞬間 | 「戦闘は完全オート」 | 画面収録を中央に配置、周囲はダーク背景 |
| 8-11s | 240-330 | ドロップ | レア装備がドロップする瞬間のゲームプレイ | 「装備集めに全集中」 | ドロップ時にパーティクルエフェクト（CSS） |
| 11-14s | 330-420 | CTA | アプリアイコン + タイトルロゴ + App Store バッジ | 「LootDive｜無料」 | fade in + scale アニメーション |
| 14-15s | 420-450 | End | 背景フェードアウト | — | — |

### Remotion 実装メモ

```
Composition: "HookShort"
durationInFrames: 450 (15s @ 30fps)
width: 1080, height: 1920

シーン構成:
<Series>
  <Series.Sequence durationInFrames={60}>  <HookText />
  <Series.Sequence durationInFrames={60}>  <ComparisonSplit />
  <Series.Sequence durationInFrames={120}> <GameplayClip scene="battle" />
  <Series.Sequence durationInFrames={90}>  <GameplayClip scene="drop" />
  <Series.Sequence durationInFrames={90}>  <CTAScreen />
  <Series.Sequence durationInFrames={30}>  <FadeOut />
</Series>
```

---

## 動画 2:「30秒でわかる LootDive」（紹介型・30秒）

**コンセプト**: ゲームの魅力を網羅的に紹介。最もスタンダードなプロモ動画。

### 台本

| 秒数 | フレーム | シーン | 画面内容 | テキストオーバーレイ | 備考 |
|------|---------|--------|----------|---------------------|------|
| 0-2s | 0-60 | Hook | ダーク背景にタイトルロゴがglowしながら登場 | 「LootDive」 | glow エフェクト（box-shadow アニメーション） |
| 2-4s | 60-120 | キャッチ | テキストが1行ずつフェードイン | 「戦闘はオート。」「やることは"準備"だけ。」 | 1行目 → 0.8s後に2行目 |
| 4-8s | 120-240 | 戦闘 | 自動戦闘のゲームプレイ（ゲージ蓄積→攻撃→敵撃破） | 「ATB風ゲージ制バトル」 | テキストは画面下部に半透明背景付き |
| 8-12s | 240-360 | 装備 | 装備画面の操作。MOD付き装備を比較している様子 | 「ランダムMODで無限の組み合わせ」 | テキストアニメ: typewriter風 |
| 12-16s | 360-480 | スキル | パッシブスキルツリー画面。ノードを解放する操作 | 「自分だけのビルドを構築」 | ノード解放時にpulseエフェクト |
| 16-20s | 480-600 | ダンジョン | ダンジョン選択画面 → 難易度の高いダンジョンを選択 | 「17種以上のダンジョン」 | スクロールアニメーション |
| 20-24s | 600-720 | ボス | ボス戦のゲームプレイ。Uberボスとの激しい戦闘 | 「Uberボスに挑め」 | 画面を少し揺らすシェイクエフェクト |
| 24-27s | 720-810 | 実績 | テキストカウントアップアニメーション | 「200階の異次元ラッシュ」「どこまで登れる？」 | 数字が0→200にカウントアップ |
| 27-30s | 810-900 | CTA | アイコン + ロゴ + App Storeバッジ + QRコード | 「基本無料｜今すぐダウンロード」 | QRコードはApp Storeリンク |

### Remotion 実装メモ

```
Composition: "IntroShort"
durationInFrames: 900 (30s @ 30fps)
width: 1080, height: 1920

シーン構成:
<Series>
  <Series.Sequence durationInFrames={60}>   <TitleReveal />
  <Series.Sequence durationInFrames={60}>   <CatchCopy />
  <Series.Sequence durationInFrames={120}>  <GameplayClip scene="battle" />
  <Series.Sequence durationInFrames={120}>  <GameplayClip scene="equipment" />
  <Series.Sequence durationInFrames={120}>  <GameplayClip scene="skillTree" />
  <Series.Sequence durationInFrames={120}>  <GameplayClip scene="dungeonSelect" />
  <Series.Sequence durationInFrames={120}>  <GameplayClip scene="uberBoss" />
  <Series.Sequence durationInFrames={90}>   <CountUpScene />
  <Series.Sequence durationInFrames={90}>   <CTAScreen />
</Series>

トランジション: linearTiming + slidingDoor or wipe（各シーン間）
```

---

## 動画 3:「装備ガチャが止まらない」（中毒性訴求・20秒）

**コンセプト**: ハクスラのドロップ中毒性にフォーカス。ゲーマー層に刺さる。

### 台本

| 秒数 | フレーム | シーン | 画面内容 | テキストオーバーレイ | 備考 |
|------|---------|--------|----------|---------------------|------|
| 0-2s | 0-60 | Hook | ドロップ音SE + テキスト | 「この音がやめられない」 | SE: ドロップ効果音。テキスト: shake → 安定 |
| 2-6s | 60-180 | ドロップ連打 | ダンジョンクリア→リザルト画面。装備がどんどんドロップ | 「MOD厳選の沼へようこそ」 | 連続ドロップのカット。テンポ良く切り替え |
| 6-10s | 180-300 | 比較 | 同じ武器でもMODが違う2つを並べて表示 | 「同じ武器でも性能が全然違う」 | 左右に装備カードを並べ、差分をハイライト |
| 10-14s | 300-420 | ビルド | スキルツリー + 装備を組み合わせたビルド画面 | 「最強ビルドを組め」 | パッシブツリーのノードが光りながら接続 |
| 14-17s | 420-510 | Uber | Uberボス撃破 → ユニーク装備ドロップ | 「ボス限定ユニーク装備」 | 金色のグロー演出 |
| 17-20s | 510-600 | CTA | アプリアイコン + ダウンロードCTA | 「LootDive｜無料で沼れ」 | — |

---

## 動画 4:「忙しい人のためのRPG」（ターゲット訴求・20秒）

**コンセプト**: 「忙しくてゲームできない」社会人層に刺さる訴求。

### 台本

| 秒数 | フレーム | シーン | 画面内容 | テキストオーバーレイ | 備考 |
|------|---------|--------|----------|---------------------|------|
| 0-3s | 0-90 | 共感 | 時計アイコン + テキスト。背景ダーク | 「ゲームする時間、ありますか？」 | 時計がtick-tockアニメーション |
| 3-5s | 90-150 | 解決 | テキストがスライドイン | 「あります。」 | 力強いspring アニメーション。フォント大きめ |
| 5-9s | 150-270 | 説明 | 3ステップを順番に表示 | 「1. 装備を整える」「2. ダンジョンを選ぶ」「3. あとは見てるだけ」 | 各ステップ1.3秒ずつ。アイコン付き |
| 9-13s | 270-390 | プレイ | 実際のゲームプレイ。装備→ダンジョン選択→戦闘開始の流れ | — | 画面収録をそのまま使用 |
| 13-17s | 390-510 | 深さ | スキルツリー・装備MODの画面を高速で切り替え | 「でも、やり込み要素は本格派」 | 0.5秒間隔で画面切り替え |
| 17-20s | 510-600 | CTA | アプリアイコン + ロゴ | 「通勤中に、寝る前に。」「LootDive」 | — |

---

## 動画 5: 英語版「Gear Up. Dive In.」（海外向け・15秒）

**コンセプト**: 海外市場向け。シンプルで映像重視。

### 台本

| 秒数 | フレーム | シーン | 画面内容 | テキストオーバーレイ | 備考 |
|------|---------|--------|----------|---------------------|------|
| 0-2s | 0-60 | Hook | テキストのみ。ダーク背景 | "You don't fight." | spring。大きなフォント |
| 2-4s | 60-120 | Hook2 | テキスト追加 | "You prepare." | フェードイン |
| 4-8s | 120-240 | Gameplay | 自動戦闘のハイライト。テンポ良いカット | "Auto-Battle Hack & Slash" | 下部テキスト |
| 8-11s | 240-330 | Loot | 装備ドロップ・MOD比較の高速カット | "Random MODs. Infinite Builds." | — |
| 11-14s | 330-420 | Boss | Uberボス戦のクライマックス | "200 Floors. Uber Bosses." | シェイクエフェクト |
| 14-15s | 420-450 | CTA | アイコン + "LootDive" + App Store badge | "Free on the App Store" | — |

---

## Remotion プロジェクト構成案

```
remotion-promo/
├── src/
│   ├── Root.tsx                    # 全Composition定義
│   ├── compositions/
│   │   ├── HookShort.tsx           # 動画1
│   │   ├── IntroShort.tsx          # 動画2
│   │   ├── LootAddiction.tsx       # 動画3
│   │   ├── BusyPersonRPG.tsx       # 動画4
│   │   └── EnglishShort.tsx        # 動画5
│   ├── components/
│   │   ├── GameplayClip.tsx        # ゲームプレイ映像埋め込み
│   │   ├── TextReveal.tsx          # テキスト登場アニメーション
│   │   ├── CTAScreen.tsx           # CTA画面（共通）
│   │   ├── ComparisonSplit.tsx     # 画面分割比較
│   │   ├── CountUp.tsx             # 数字カウントアップ
│   │   ├── ShakeEffect.tsx         # 画面シェイク
│   │   └── GlowEffect.tsx         # 光るエフェクト
│   ├── styles/
│   │   └── theme.ts               # ゲームのカラーテーマ定数
│   └── assets/
│       ├── gameplay/               # 画面収録動画（.mp4）
│       ├── screenshots/            # スクリーンショット
│       ├── audio/                  # BGM・SE
│       ├── icon.png                # アプリアイコン
│       └── appstore-badge.svg      # App Store バッジ
├── package.json
├── remotion.config.ts
└── tsconfig.json
```

---

## 制作の優先順位

| 優先度 | 動画 | 理由 |
|--------|------|------|
| 1 | 動画2「30秒でわかる LootDive」 | 最も汎用的。YouTube Shorts / TikTok / X すべてで使える |
| 2 | 動画1「まだ自分で戦ってるの？」 | 15秒で手軽。TikTok のフック率が高い |
| 3 | 動画5 英語版 | 海外メディア送付時に添付。Product Hunt にも使える |
| 4 | 動画4「忙しい人のためのRPG」 | ターゲット層への訴求力が高い |
| 5 | 動画3「装備ガチャが止まらない」 | ゲーマー層特化。コア層獲得向け |

---

## 素材収録チェックリスト

Remotion で動画を組む前に、以下のゲームプレイ録画が必要:

- [ ] 自動戦闘シーン（ゲージ蓄積 → 攻撃発動、15秒程度）
- [ ] レア装備ドロップの瞬間（複数回）
- [ ] 装備画面でのMOD比較操作
- [ ] パッシブスキルツリーのノード解放操作
- [ ] ダンジョン選択画面のスクロール
- [ ] Uberボス戦（戦闘開始 → 撃破まで、または激しい場面のハイライト）
- [ ] ダンジョンクリア → リザルト画面の流れ
- [ ] ホーム → ダンジョン選択 → 戦闘開始の一連の流れ（動画4用）

**録画設定**: iPhone の画面収録機能を使用。縦画面のまま収録。
