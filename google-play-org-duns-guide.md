# Google Play 組織アカウント登録 & 住所非公開 完全メモ

> 個人事業主が Google Play を「組織アカウント」で出すための DUNS 取得と、
> 自宅住所を公開しないためのバーチャルオフィス活用まとめ。
> 調査日: 2026-07-24

---

## 0. 前提と目的

- **iOS（App Store）**は個人事業主なら **Individual（個人）登録**でOK。DUNSは不要。
- **Android（Google Play）**を**組織アカウント**で出したい理由：
  → **新規の個人アカウントに課される「20人テスター × 14日間の公開前テスト」要件を回避したい**から。
- 組織アカウント登録には **DUNSナンバー**が必須。
- ただし、Google Play は**収益化アプリの住所を全世界に公開する**ため、自宅住所対策（バーチャルオフィス）も必要。

---

## 1. 個人アカウント vs 組織アカウント（Google Play）

| | 個人（Personal） | 組織（Organization） |
|---|---|---|
| DUNS | 不要 | **必須** |
| 20人テスター×14日 要件 | **あり**（2023/11/13以降作成のアカウント） | **免除**（いきなり本番公開可） |
| 公開される情報 | 法的名義（本名）＋国 ほか | 組織名（屋号）＋住所 |
| 屋号での表示 | ✕ | ○ |
| 制限カテゴリ（金融/健康/VPN等） | 不可のことが多い | 実質必須 |

**→ テスター20人を集められないので「組織アカウント」を選択。**

---

## 2. DUNSナンバー

- **個人事業主でも取得可能**（法人でなくてもOK）。
- 取得ルート：

| ルート | 費用 | 日数 |
|---|---|---|
| 無料（D&B 直接） | 0円 | 公称30日／実際40日かかった例も |
| **有料（東京商工リサーチ / TSR）** | **3,300円** | **約1週間（8営業日）** |

- **屋号は「英語表記（ローマ字）」でDUNSに登録される。**
  日本語屋号しかないと突き合わせで不一致になるので注意。

---

## 3. 住所公開の真実（ストア別）★最重要

### iOS（App Store）
- EUの **DSA（デジタルサービス法）の "trader（事業者）" 開示**として住所が公開される。
- **住所などの trader情報が公開表示されるのは「EU27カ国のいずれかに配信している場合のみ」**（Apple公式に明記・確認済み）。
- → **EUに配信しなければ住所は公開されない。** 現状 iOS しか出しておらず EU 非配信なので、住所は公開されていない。
- ⚠️ **注意（公開とは別の手続き）**：EUに配信していなくても **App Store Connect 上での「trader status の申告」自体は必要**。
  ただしこれは「自分は trader に当たらない」等を宣言するだけで、**この申告で住所が公開されるわけではない**（公開はあくまで EU配信が条件）。

### Google Play ← ここが落とし穴
- **収益化アプリ（有料 or アプリ内購入）は、Google Play 上に完全な住所を表示する必要がある。**（Google公式ヘルプに明記）
- このルールの**トリガーは「収益化」で、EU配信とは無関係・全世界対象**。
- **実機確認済み**：ある開発者（HO SYSTEM LLC）のアプリで、
  **日本 (gl=JP) / 米国 (gl=US) / ドイツ (gl=DE) すべてのロケールで住所がフル表示**されていた。
  - 表示場所：**各アプリの詳細ページ →「アプリのサポート／デベロッパーについて」欄を展開**
  - ※ 開発者一覧ページ（`/store/apps/dev?id=...`）には出ない。ここだけ見ると「住所ない」と誤認する。
- その開発者の住所は **西新宿3-3-13（＝GMOオフィスサポートのバーチャルオフィス住所）**だった。
  → プロの個人開発者も、まさにバーチャルオフィスで自宅を隠している。

### まとめ

| ストア | EU非配信で住所を隠せる？ |
|---|---|
| iOS（App Store） | ✅ 隠せる（trader開示はEU限定） |
| **Google Play** | ❌ **隠せない**（収益化が全世界トリガー） |

**→ 我々のアプリは課金コンテンツありなので、Google Play では EU 非配信でも住所が公開される。バーチャルオフィスが必要。**

---

## 4. 対策：バーチャルオフィス

自宅を出さないため、**DUNS と Google の登録住所をバーチャルオフィス（VO）にする。**

| サービス | 月額 | 特徴 |
|---|---|---|
| **GMOオフィスサポート** | **660円〜**（転送なし）／転送あり ≒1,650円 | Google Play・DUNS用途の実績多数。入会金0。住所例＝西新宿3-3-13 |
| **レゾナンス** | 990円〜 | 法人登記・郵便転送・専用電話オプションが豊富。電話番号も欲しいなら◎ |
| バーチャルオフィス1 | 翌年基本料0円〜 | 渋谷・千代田。初期コスト重視 |
| Mr.バーチャルオフィス | 270円〜 | 最安級。実績・範囲は要確認 |

**おすすめ**
- 安さ＆実績重視 → **GMOオフィスサポート**
- 公開用の電話番号もまとめたい → **レゾナンス**（Playの連絡先欄には電話番号も公開されるため）

**契約時の確認**
- **郵便物転送プラン**を選ぶ（DUNS/Google関連の郵送物を受け取れるように）
- 屋号は**日本語＋英語表記**の両方を用意

---

## 5. ⚠️ 手順（順序が命）

> **先に Play Console へ自宅住所を登録すると、後から公開住所を変えるには
> Googleサポートへの個別申請が必要で、時間がかかる・受け付けられないこともある。**

```
① バーチャルオフィス契約
② TSR経由で DUNS の登録住所を VO住所に更新
③ D&B データベースへの反映を待つ（数日〜1週間）
   ※ D&B 公式 lookup で反映を確認できる
④ 反映後に Play Console 組織アカウントを登録（同じ住所・屋号で）
```

- **合計 約2週間**を見込む。
- **絶対に先に Play Console 登録を進めない。**

---

## 6. 「一致させるもの」整理

| 項目 | 一致は必須？ |
|---|---|
| **住所：DUNS ⇄ Google** | ✅ 必須（両方VO住所） |
| 住所：開業届 ⇄ DUNS/Google | ⭕ 望ましいが登録時点では必須でない（後で確定申告前に変更でOKの実例あり） |
| **屋号（英語表記）：開業届 ⇄ DUNS** | ✅ そろえておくのが安全 |

- **開業届の住所は自宅のままスタートしてOK。** 確定申告前に VO へ移せば足りる実例あり。
- 逆に、**屋号（特に英語表記）は最初からそろえる**。

---

## 7. To-Do（次にやること）

- [ ] 屋号を決める（日本語＋英語表記）
- [ ] バーチャルオフィスを契約（GMO or レゾナンス、転送ありプラン）
- [ ] TSR で DUNS を取得（住所＝VO、英語屋号で）
- [ ] D&B lookup で反映確認
- [ ] Play Console 組織アカウント登録（同じ住所・屋号）
- [ ] （確定申告前まで）開業届の事業所住所を VO に変更

---

## 8. ⚠️ 調査中に判明した「誤解しやすいポイント」（正直な訂正記録）

今回の調査では、いくつか一度出した結論を後で訂正した。同じ轍を踏まないための記録。

1. **「住所公開はEU限定」は誤り。**
   → DSA/trader の記事（主に Apple・EU向け）を読んで「EUに出さなければ住所は出ない」と一度結論づけたが、
   **実機確認（JP/US/DEすべてで住所表示）**の結果、Google Play の住所公開トリガーは
   **「収益化（有料/アプリ内購入）」で全世界対象**だった。これは主に**筆者（AI）の推論ミス**。
   → iOS は EU限定で正しい。**Google Play は別軸**。ここを混同しない。

2. **「開業届の住所も必ず一致させる」は言いすぎだった。**
   → 一致が必須なのは **DUNS ⇄ Google の住所**。開業届の住所は**登録時点で不一致でもOK**の実例あり
   （自宅で登録 → 確定申告前に VO へ変更）。必須は**屋号の英語表記**の方。

3. **「開発者一覧ページに住所がない＝非公開」は誤読。**
   → 住所は**各アプリ詳細ページの「アプリのサポート」欄**に出る。一覧ページには元々無い。

---

## 参考リンク・情報源

### ✅ 公式（信頼度：高）
- Apple 公式：EU DSA trader 要件（**EU非配信なら trader情報不要**＝iOSの根拠）
  https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
- Google Play ヘルプ：デベロッパーアカウント作成に必要な情報
  https://support.google.com/googleplay/android-developer/answer/13628312?hl=ja
- Google Play ヘルプ：アカウント情報の表示・管理（**販売アカウントは完全な住所を表示**＝Google Playの根拠）
  https://support.google.com/googleplay/android-developer/answer/13634081?hl=ja
- Google Play コミュニティ：無料アプリのみなら物理住所は必要か
  https://support.google.com/googleplay/android-developer/thread/342999155

### ✅ 実例ブログ（信頼度：高・実際に手順を追った記録）
- **バーチャルオフィスで Play Console の公開住所を隠す【DUNS住所変更の順序が命】**（tokiyuta）※本ガイドの「順序」の根拠
  https://note.com/gentle_prawn80/n/nbbd8c337ddcf
- Complete Guide for Sole Proprietors to Obtain a Google Play Organization Account（tokiyuta）
  https://note.com/gentle_prawn80/n/nb24b634a2d16
- 個人事業主が Google Play に組織アカウントとして登録してみた（zac-lab）
  https://zac-lab.com/posts/20250514/
- 【Google Play】個人事業主で組織アカウントを作成する方法（teammoko）※屋号の英語表記の根拠
  https://teammoko.jp/googleplay_account_makeorg
- Googleに住所公開されたくなくて個人事業主として開業しました（toriaezuugoku）
  https://toriaezuugoku.com/googleplay/
- Google Play Console デベロッパーアカウントの確認対応で個人事業主になる（zenn / hidenori3）
  https://zenn.dev/hidenori3/articles/a0b29488c738e4
- Google確認の勢いで個人事業主を開業した話（note / ギガビット）
  https://note.com/gigabit_million/n/n9ae2c315ed16
- Google Playの住所公開に開業届で対応する（趣味グラマのブログ）
  https://blog.mrym.tv/2024/08/
- Google Play Developerの登録は「個人」と「組織」どちらが正解？（mozuun）
  https://mozuun.com/blog/google-play-developer-individual-or-organization/

### ⚠️ 読み間違えやすい／注意が必要な情報源
- **英語の "trader status" 系記事**（makaka.org, median.co 等）
  → 内容自体は正しいが、**Apple・EU の DSA の話**。これを Google Play にそのまま当てはめると
  「EU非配信なら住所出ない」と誤解する。**Google Play の住所は収益化トリガー（全世界）で別物**。
- **PhoneArena「Google Play to require public physical address for monetized app developers」**
  https://www.phonearena.com/news/Google-Play-to-require-public-physical-address-for-monetized-app-developers_id60839
  → 結論（収益化＝住所公開）は正しいが、**元は2014年の古い記事**。最新は必ず公式で裏取りすること。
- **DUNS代行系の記事**（globallinkconsulting 等）
  → 取得日数などが記事により「1〜2週間」「最大30日」とバラつく。**無料ルートは長め**と理解しておく。

> 注：実例ブログは各人の体験談のため、**細部（費用・日数・手順）は時期や個人差でズレる**。
> 迷ったら Google/Apple 公式と D&B 公式 lookup を最終根拠にすること。
