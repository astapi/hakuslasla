# 刻印クラフトとユニーク装備のバランス検証

**日付**: 2026-08-20
**対象**: v2.1.0（UberUber魔王 / 刻印クラフト）以降の装備バランス
**関連**: [uber-equipment-improvement-proposal.md](./uber-equipment-improvement-proposal.md), [uber-balance-status-2026-01-27.md](./uber-balance-status-2026-01-27.md), [mod-system.md](./mod-system.md)

---

## 1. これまでの経緯（v2.0.x → v2.1.0）

直近のリリースで積み上がった変更のうち、本ドキュメントに関係するもの。

| コミット | 内容 |
|---|---|
| `da68ee0` `f260e21` `8ed29b0` | UberUberボス（クラーケン / 盗賊の頭）と専用ユニーク・新MODを追加 |
| `02a4fc3` | UberUberクラーケン初回クリアを Firestore に記録し Discord 通知 |
| `ef6058a` | UberUberクラーケンのバランス調整 |
| `d8da1d5` (v2.1.0) | **UberUber魔王** + **刻印クラフト** + パッシブリスペックのバグ修正 |
| `52b0e81` | UberUber魔王のクリア記録も Discord 通知の対象に |

### v2.1.0 で何をしたか

**UberUber魔王**: 全Uber/UberUberボス撃破が挑戦条件の撃破制限時間型ボス。
HP 1,300,000 / ATK 4,200 / DEF 2,000 / 毎秒回復10,000、猶予50秒後は敵の攻撃倍率が
毎秒+4%ずつ際限なく上昇する（滅びの刻限）。フリーズ耐性50%で拘束によるエンレイジ無効化を封じた。
実クリア者のS3ビルド（パッシブが正当な170件）でシミュレートし、6件が突破する水準に調整。

**刻印クラフト**: レア装備に狙ったMODを1つ確定で彫り込むクラフト。
**「ドロップ厳選（運）を確定に置き換え、レア装備に活路を与える」**のが設計意図。

**パッシブリスペックのバグ修正**: `canRefundNode` が直接の子しか検証しておらず、
返却で「スタートから到達できない浮島ノード」を作れていた。
記録済みS3クリアデータ251件中81件（32%）がルール上成立しない構成だったことが判明。
→ この件があるため、**過去のクリア記録を使った検証は「パッシブが正当なもの」に絞る必要がある**。

---

## 2. 刻印クラフトの現行仕様（実装の実態）

実装: `data/engraveMods.ts`, `core/engrave.ts`, `app/craft.tsx`

| 項目 | 仕様 |
|---|---|
| 対象 | レア/通常装備のみ。**ユニークには彫れない**（`isUniqueItem` で弾く） |
| 回数 | 1装備につき1つまで（`hasEngravedMod`） |
| 数値 | **素のT1相当で固定**（単一ランク） |
| MOD数 | 3つ以下なら追加 / 4つなら置換対象を選択 / 同種MODがあれば上書き |
| スロット制限 | **レアのMOD制限に準拠**（`canEngraveOnSlot`） |
| 対象外 | 毒系・全 `_more_pct`・cap系（各chance / クリ率 / ブロック率） |
| ドロップ | 終焉以降のエンドコンテンツで ボス100% / 通常敵4% |

### 刻印12種と、ドロップT1との比較

```
刻印MOD                     刻印値   ドロップT1上限
hp_on_hit                     80    なし（刻印限定）
evasion_increased_pct         15    なし（刻印限定）
hp_regen_to_atk_pct           25    なし（刻印限定）
ignite_damage_pct             90    91-100 (staff武器)
atk_increased_pct             30    29-30 素 / weapon 43-45  ← 武器では刻印が下位
critical_damage              100    95-100
hp_bonus                     300    276-300
def_increased_pct             30    29-30 素 / armor 43-45   ← 鎧では刻印が下位
attack_speed_pct              30    29-30（glovesのみ）
hp_regen                      50    46-50
damage_reduction_pct           5    5（armorのみ）
evasion                       32    29-32（gloves/boots/accessory）
```

**設計上の帰結: 刻印はレアの天井を上げない。**
刻印値＝素T1上限なので、刻印は「運で当たるはずだった最良ロール」を確定させるだけ。
レアの上限は今も昔も「T1×4」であり、刻印はそこへ到達する確度を上げるにすぎない。

刻印がレアに**新しい強さ**を持ち込むのは、以下の3種（ドロップに出ない刻印限定MOD）だけ。

- `hp_on_hit` 80
- `evasion_increased_pct` 15
- `hp_regen_to_atk_pct` 25

### 見つかった仕様の歪み（要検討）

`atk_bonus` / `def_bonus` / `atk_increased_pct` / `def_increased_pct` の4種は
`slotTiers` を持ち、武器/鎧では素より高い値でロールする。ところが刻印値は素T1基準で固定のため:

- 武器に `atk_increased_pct` を刻印 → **30**（ドロップなら T1で 43-45）
- 鎧に `def_increased_pct` を刻印 → **30**（ドロップなら T1で 43-45）

**主力スロットで刻印がドロップに負ける**という逆転が起きている。
「厳選を確定に置き換える」という設計意図からすると、ここは意図した挙動とは考えにくい。

---

## 3. 検証①: 「Uniqueが強すぎる問題」

### 3.1 ユニーク専用MODが23種ある

レアには**絶対に付かない**MOD種別が23種存在し、うち刻印で解禁されたのは3種のみ。

| MOD | 和名 | 採用ユニーク数 | 刻印 |
|---|---|---|---|
| `hp_on_hit` | HIT回復 | 16種 | ★解禁 |
| `evasion_increased_pct` | EVA% | 6種 | ★解禁 |
| `hp_regen_to_atk_pct` | 回復変換 | 2種 | ★解禁 |
| `poison_damage_pct` | 毒ダメ | 5種 | — |
| `poison_damage_more_pct` | 毒ダメmore | 3種 | — |
| `ignite_resist_pct` | 灼熱耐性 | 3種 | — |
| `attack_speed_more_pct` | 速度more | 2種 | — |
| `time_atk_inc_pct` / `time_def_inc_pct` | ATK/DEF 5秒毎 | 各2種 | — |
| `evasion_more_pct` | EVA more | 2種 | — |
| `critical_follow_up_attack` | クリ時追撃 | 2種 | — |
| `shield_on_evade_streak_hit_pct` | 回避盾 | 2種 | — |
| `follow_up_attack_pct` | 双撃の刃 | 1種 | — |
| `atk_inc_pct` / `hp_on_crit` / `hp_on_taken_hit` / `ignite_lifesteal` / `freeze_chance` / `poison_damage_reduction` / `time_hp_regen` / `king_slam` / `royal_roar` / `warlord_enrage` | — | 各1種 | — |

とくに **全 `_more_pct` 系（乗算）がユニーク専用**である点が決定的。
加算MODをどれだけ積んでも乗算枠は埋まらないため、レアには構造的に届かない上限がある。

### 3.2 スロット制限がユニークにだけ適用されていない

レアのMOD制限は `mods.json` の `slots` で定義されるが、ユニークの `fixedMods` はこれを無視する。
刻印は制限を尊重するため、**この非対称は刻印では埋まらない**。

| MOD | レアの制限 | 制限を無視しているユニーク |
|---|---|---|
| `attack_speed_pct` | glovesのみ | 15種（`uber_endblade`, `uber_goblin_blade`, `uber_bandit_coat` ほか） |
| `damage_reduction_pct` | armorのみ | 3種（`uber_demon_blade`, `uber_fortress_grip`, `uber_fortress_bulwark`） |
| `evasion` | gloves/boots/accessoryのみ | 1種（`uber_uber_kraken_mantle`） |

実例: `uber_endblade`（Uber 終焉の刃）は**武器なのに攻撃速度+20%**を持つ。
レアの武器では原理的に不可能で、刻印でも彫れない。

### 3.3 実測: クリア者のユニーク装着率

UberUberクラーケンのクリア記録 S3分368件（`tools/build-explorer/data/builds.json`）より。

| スロット | ユニーク装着率 |
|---|---|
| accessory | **91.0%** (335/368) |
| boots | 68.5% (252/368) |
| armor | 66.3% (244/368) |
| gloves | 60.9% (224/368) |
| weapon | 48.4% (178/368) |

- 5スロット全てユニーク: 101人（27.4%）
- 1枠でも非ユニーク: 267人（72.6%）

**accessory は事実上ユニーク一択**。一方 weapon は半数がレア（`apocalypse_blade` 105件 /
`apocalypse_staff` 58件）で、ベースATK 220 がユニーク（150-190）を上回るため生き残っている。
使われているレアは `titan_gauntlets` 109 / `end_armor` 96 / `end_walker_boots` 81 と、
**各スロットのベース値最上位に一極集中**しており、レア側は「ベース値で選ぶ」以外の選択肢がない。

### 3.4 実例: UberUber魔王クリア者2名の装備遷移

現時点のUberUber魔王クリア者は2名（いずれもテイマー Lv80）。
クラーケン初クリア時 → 魔王クリア時の装備を比較した。

**ソルト**: 5スロット全てを Uber装備に総取替え（ユニーク 1枠 → 5枠）

| スロット | クラーケン期 | 魔王期 |
|---|---|---|
| 武器 | 聖剣 (ATK120) | Uber 終焉の刃 (ATK190) |
| 鎧 | 終末の鎧 (DEF180) | Uber 終焉の甲冑 (DEF360) |
| 手袋 | 混沌の篭手 | Uber 終焉の掌 |
| 靴 | 終末を歩む者のブーツ | Uber 終焉の歩み |
| 装飾 | 終焉の王冠 | Uber クラーケンの眼 |

装備MOD合算の変化: `atk_bonus` -165 / `def_bonus` -141 / `critical_chance` -74 が消え、
`hp_bonus` **+1380** / `hp_on_hit` +140 / 毒ダメ +50% / 速度 +20%・more +15% が入った。
実効攻撃速度 1.22 → 1.68。ATKは 8775 → 6405 に下がっているが、
**クリ依存の加算ビルドから、乗算とDoTと耐久で殴るユニークビルドへ移行している**。

**まこぴー**: 鎧・手袋・靴はレアのまま据え置き、武器と装飾のみ変更。
`follow_up_attack_pct`（双撃100%）を手放して `critical_chance` +60 を取り、ATK 1889 → 3272。

2人が真逆の解（クリ0の毒DoT型 / クリ93%の直撃型）に到達している点は、
ユニーク側の選択肢が機能している証拠でもある。

---

## 4. 検証②: レア＋刻印はどこまで届くか

### 4.1 検証方法

`tools/build-explorer/craftedRareVsUnique.ts` で、実在の勝者ビルドを2通り組んで
UberUber魔王に long-sim（600秒上限 / 8試行）した。

- **Unique版**: 記録どおりのユニーク装備
- **Crafted-Rare版**: 「固有効果ユニーク」だけ残し、他スロットを
  **T1×3ロール + 刻印T1×1** の"作れる上限のレア"に置換

固有効果ユニーク（レアで再現不能なため残す）:
`uber_uber_double_strike_ring` / `uber_end_evasion_crown` / `uber_goblin_evasion_cloak` /
`uber_uber_kraken_mantle` / `uber_endblade` / `uber_uber_goblin_stomp`

```bash
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx tools/build-explorer/craftedRareVsUnique.ts "ウォリアーS3" 8
```

### 4.2 結果

| ビルド | 版 | HP | ATK | DEF | 結果 |
|---|---|---|---|---|---|
| ウォリアーS3 (Lv80) | Unique | 6407 | 7316 | 2187 | 勝率100% **撃破200s** |
| 〃 | Crafted-Rare | 6407 | 6075 | 1904 | 勝率100% **撃破212s** |
| テイマー (Lv71) | Unique | 5048 | 6035 | 2169 | 敗北（残HP100%） |
| 〃 | Crafted-Rare | 5165 | **7377** | **2669** | 敗北（残HP92%） |
| ウォリアー (Lv80) | Unique | 3576 | 2839 | 1400 | 敗北（残HP100%） |
| 〃 | Crafted-Rare | **4263** | **3352** | 1314 | 敗北（残HP100%） |

（毒レンジャーS3はユニーク3枠が全て固有効果ユニーク、残り2枠は元からレアのため置換対象0。差分なし）

### 4.3 わかったこと

**a) 一般ユニークは、刻印レアに素のステータスで負けている。**
テイマー・ウォリアーのケースでは、`uber_goblin_grip` `uber_vampire_fang` `uber_bandit_steps`
`uber_endplate` `crown_of_end` `uber_goblin_plate` `uber_demon_blade` を
刻印レアに置き換えた方が **ATK・HP・DEFいずれも上**になった。
これらの「汎用ユニーク」は既に刻印レアに追い抜かれている。

**b) それでも勝敗を分けるのは固有効果ユニーク。**
唯一クリアしているウォリアーS3では Unique版が 200s、Crafted-Rare版が 212s と
**Unique版が6%速い**。差を生んでいるのは置換した `uber_endgrasp` / `uber_endplate` の
`hp_on_hit` `critical_damage` `time_def_inc_pct` `damage_reduction_pct` の組み合わせであり、
残した `uber_endblade`（武器に攻撃速度+20% / `time_atk_inc_pct`）は両版共通。
**つまり "強すぎるユニーク" の正体は、ステータスではなくユニーク専用MODの方**。

**c) 刻印の効きどころは限定的。**
検証で使った刻印は `hp_on_hit`（武器・鎧・手袋）と `atk_increased_pct`（装飾）が中心。
`hp_on_hit` 80 は確かに効くが、ユニークは同じMODを 70〜200 で持つうえに
乗算MODや時間バフを併せ持つため、**1装備1刻印では追いつききらない**。

---

## 5. 議論と結論

### 結論

1. **「ユニークが強すぎる」は正確には「ユニーク"専用MOD"が強すぎる」。**
   ベースステータスと加算MODの土俵では、刻印レアは既にほとんどのユニークを上回る。
   問題は乗算（`_more_pct`）・時間バフ（`time_*`）・追撃系がユニーク専用に閉じていること。

2. **刻印はレアの天井を上げていない。**
   刻印値＝素T1上限という設計により、刻印は"確度"の改善であって"上限"の改善ではない。
   レアの上限は依然 T1×4 のまま。ユニークとの差は縮まっていない。

3. **一方で刻印は「厳選コスト」を確実に潰した。**
   accessory 91% というユニーク一択状態は、レア側が厳選前提だったことの裏返しでもある。
   刻印により、少なくとも「T1×4のレアを現実的に組める」ようになった意義は大きい。

4. **武器・鎧の刻印が `slotTiers` を無視して素T1固定なのは、ほぼ確実に不具合寄りの仕様。**
   主力スロットで刻印がドロップに負けるのは設計意図と矛盾する。

### 対応の選択肢（未決）

**A. `slotTiers` 対応の刻印値（優先度: 高 / 影響: 小）**
`atk_increased_pct` / `def_increased_pct` / `atk_bonus` / `def_bonus` の刻印値を
彫る先のスロットの T1上限に合わせる。武器 45 / 鎧 45。
- 利点: 明確な歪みの解消。既存バランスへの影響が読みやすい
- 欠点: レアの天井は上がらないので「ユニークが強すぎる」問題自体は動かない

**B. 刻印限定MODの拡充（優先度: 中 / 影響: 中）**
現在3種しかない刻印限定MODを増やし、ユニーク専用MODの一部をレア側に開放する。
候補: `time_atk_inc_pct` / `time_def_inc_pct` を低い値（例: 3〜5）で刻印限定に。
- 利点: レアに「ユニークにしかない効果」の入口ができ、ビルドの幅が広がる
- 欠点: ユニークの独自性が薄まる。乗算系を開けると際限がなくなる恐れ

**C. 汎用ユニークの底上げ（優先度: 中 / 影響: 大）**
刻印レアに負けている汎用ユニーク（`uber_goblin_grip` `uber_vampire_fang`
`uber_bandit_steps` `crown_of_end` など）のベース値・MOD値を引き上げる。
- 利点: 「ボスを倒して得たユニークが最新の到達点」という進行感が保たれる
- 欠点: インフレ方向。過去に調整済みの装備を再度触ることになる

**D. 何もしない（現状維持）**
汎用ユニークが刻印レアに追い抜かれている状態を「進行の順序」として許容する。
- 利点: 序盤〜中盤のユニークが"通過点"になり、刻印が終盤の主役になる。
  実際 weapon はユニーク48%・レア52%で拮抗しており、健全とも読める
- 欠点: ボス報酬の価値が下がり、UberUberボスに挑む動機が「専用ユニーク」だけになる

**推奨**: まず **A** を単独で入れて影響を測る。B/C はUberUber魔王のクリア者数が
増えて（現在2名）母数が揃ってから、実データで判断する。

### 未検証・要注意事項

- **母数不足**: UberUber魔王のクリア者は2名のみ。§3.4 は個別事例であって傾向ではない。
- **シミュレーションの近似**: `craftedRareVsUnique.ts` は乗算系のズレを相殺するため、
  記録ステータスに対する合成ステータスの**変化率**を掛けて推定している。絶対値は参考値。
- **パッシブ汚染**: `d8da1d5` 以前の記録には浮島パッシブを含む不正な構成が32%混入している。
  検証には `loadValidDeltaS3Builds()`（連結性チェック済み）を使うこと。
- **ペット未考慮**: `computePlayerStats` はペット効果を含んでいない。
- **刻印ドロップ量の実測がない**: ボス100% / 通常敵4% が実際にどれだけの刻印を供給し、
  プレイヤーが「T1×4レア」を何本組めるのかを、まだ実データで確認していない。

---

## 6. 再現手順

```bash
# クリア記録の取得（Firestore・認証不要）
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchUberUberDemonLordClears.ts
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchUberUberDemonLordClears.ts --collection uber_uber_kraken_clears
# → local-data/*.json（.gitignore 済み）

# ビルド分析用データの取得とHTML生成
npm run builds

# Unique vs 刻印レア のシミュレーション比較
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx tools/build-explorer/craftedRareVsUnique.ts "ウォリアーS3" 8
TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx tools/build-explorer/craftedRareVsUnique.ts "テイマー" 8

# 刻印のテスト
npx vitest run tests/core/engrave.test.ts
```

### 参照ファイル

| 目的 | ファイル |
|---|---|
| 刻印定義（値・スロット制限・ドロップ率） | `data/engraveMods.ts` |
| 刻印の適用ロジック | `core/engrave.ts` |
| 刻印UI | `app/craft.tsx` |
| 刻印ドロップ | `hooks/useBattle.ts:1186` |
| MODのティア値・スロット制限 | `data/json/mods.json` |
| ユニークの `fixedMods` | `data/json/items.json` |
| MOD効果の合成 | `core/modEffects.ts` |
| 比較シミュレーション | `tools/build-explorer/craftedRareVsUnique.ts` |
