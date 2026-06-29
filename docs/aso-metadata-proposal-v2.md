# ASOメタデータ提案（データ実測版）— v2.0.0提出に同梱

> 作成: 2026-06-25 / 対象: LootDive (App Store ID 6758569313)
> タイトル/サブタイトル/キーワード欄の変更は審査（新バージョン提出）が必要 → **v2.0.0に同梱**。
> 全候補語は appwords CLI（`appwords/scripts/keyword-cli.ts`）でボリューム実測済み。文字数も実測済み。

## 検証で判明した重要事実

1. **英語ローンワードが欧州各国でも圧倒的**：`idle rpg`(US96/DE97/FR96/ES99)、`arpg`(87-92)、`clicker`、`incremental/incrémental`（高需要×低難度）。
2. **ネイティブ翻訳語に死に語が多い**：独 `beutejäger`=0、仏 `pilleur`=1、西 `saqueo`=47。
3. **現メタの死に語**：韓サブタイトルの `핵슬`=**1**（ほぼ無検索）。`방치`(放置)=49 が韓国最高需要。
4. 結論：**独/仏/西は英語ローンワード中心に寄せる**。CJKは各言語の主要スラング（放置/방치/暗黑/砍杀）を優先。

## キーワード欄の方針
- 単語をスペース無しのカンマ区切りに分解（Appleが自動で句を生成・大幅な文字節約）。
- タイトル・サブタイトルで使った語は重複させない（無駄なため）。
- 優先度＝実測ボリューム高い順。100字に収まるよう上位から採用。

---

## 全ロケール最終案

### 🇯🇵 ja
- **Title** (26/30): `ハクスラダンジョン周回ビルドRPG | ルートダイブ`  ※キーワード先頭に並べ替え
- **Subtitle** (19/30): `放置×トレハン×オートバトル×やり込み`  ※放置(91)/やり込み(76)を追加
- **Keywords** (98/100): `放置RPG,ローグライク,アクションRPG,ディアブロ,厳選,idle,loot,build,ハックスラッシュ,装備,スキルツリー,ドロップ,育成,ボス,無限,オフライン,レア,ファンタジー,冒険`

### 🇺🇸🇬🇧🇦🇺🇨🇦 en
- **Title** (28/30): `Loot Dive: Idle ARPG Dungeon`  ※idle/arpg を前面（hack&slashより高需要）
- **Subtitle** (29/30): `Auto-Battle Looter Rogue-lite`
- **Keywords** (95/100): `incremental,action,rpg,roguelike,diablo,clicker,crawler,grind,farm,slayer,offline,boss,gear,afk`

### 🇩🇪 de  ※英語ローンワード中心に転換
- **Title** (28/30): `Loot Dive: Idle ARPG Dungeon`
- **Subtitle** (28/30): `Auto-Battle Looter Hack&Slay`  ※現状は英語。Hack&Slay(独のハクスラ語)に
- **Keywords** (97/100): `clicker,offline,rpg,diablo,roguelike,incremental,crawler,grind,farm,boss,gear,skilltree,afk,beute`

### 🇫🇷 fr
- **Title** (27/30): `Loot Dive: Idle ARPG Donjon`  ※donjon=仏語dungeon
- **Subtitle** (30/30): `Auto-Battle Looter Incrémental`  ※incrémental(97)が高需要
- **Keywords** (99/100): `incrémental,roguelike,clicker,diablo,rogue,lite,action,rpg,hack,slash,grind,farm,boss,crawler,butin`

### 🇪🇸 es
- **Title** (29/30): `Loot Dive: Idle ARPG Mazmorra`  ※mazmorra=西語dungeon(低難度)
- **Subtitle** (28/30): `Auto-Battle Looter Roguelike`  ※roguelike(94/低難度)
- **Keywords** (99/100): `clicker,accion,rpg,roguelike,diablo,incremental,hack,slash,grind,farm,boss,crawler,rol,botin,tesoro`

### 🇰🇷 ko  ※死に語 핵슬 を除去
- **Title** (24/30): `Loot Dive | 루팅 빌드 파밍 RPG`（現状維持）
- **Subtitle** (19/30): `자동전투 방치형 로그라이크 디아블로`  ※핵슬(1)→방치형(34)に差し替え
- **Keywords** (82/100): `방치,수집형,파밍,핵앤슬래시,ARPG,던전,패시브,장비,육성,아이템,보스,무한,크리티컬,스킬트리,트레저,흡혈,강화,오프라인,모험,싱글,레벨업,판타지`

### 🇨🇳 zh-Hans
- **Title** (20/30): `Loot Dive: 暗黑放置刷宝地下城`  ※放置を追加（枠余り活用）
- **Subtitle** (18/30): `放置挂机RPG × 砍杀刷宝肉鸽刷图`  ※砍杀(ハクスラ俗語)/刷宝を追加
- **Keywords** (94/100): `放置RPG,暗黑像素,ARPG,Roguelike,装备,暴击,技能树,被动,无尽,Boss,宝物,冒险,奇幻,离线,单机,育成,强化,掉落,角色扮演,构建,战利品,刷怪,天赋,武器,防具`

---

## 適用手順（v2.0.0提出時）
1. ASCに v2.0.0 の新バージョンを作成（PREPARE_FOR_SUBMISSION）。
2. 各ロケールの appInfoLocalization（name/subtitle）と appStoreVersionLocalization（keywords）を上記で更新。
   → `scripts/applyMetadata.ts`（要作成）でASC API一括反映が可能。
3. 提出・審査。

## ボリューム計測ツール（再利用可）
`cd ~/projects/appwords && npx tsx scripts/keyword-cli.ts <語...> --country jp,us,de,fr,es,kr`
結果はWebアプリと同じDBに保存される。

## 残課題
- スクショ/プレビュー動画の現地語化・最適化（screenshot-optimization）。
- ASC App Analyticsの「流入検索語」で、配信後に実効性を再検証（appCount由来の人気度は代理指標のため）。
