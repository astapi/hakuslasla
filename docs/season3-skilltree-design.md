# シーズン3 スキルツリー再設計（PoE型）

`docs/season3-tasks.md` §4「S3用スキルツリーの調整」の詳細設計。
**S3ツリー（`data/json/passiveTree_s3.json`）のみを対象**とし、S2ツリー（`passiveTree.json`）には一切影響させない。

---

## 1. コンセプト

Path of Exile 型のツリー構造へ刷新する。

1. **クラス別スタート地点**：クラスごとに別のスタートノードを持つ（現状は全クラス共通 `start` 1点）。
2. **主線（メインライン）＋円形クラスター**：
   - **主線** … HP / ATK / DEF などメインスタッツを伸ばす幹。中央付近を通り、外へ放射状に伸びる。
   - **円形クラスター** … 主線の途中から枝分かれする行き止まりの円環。各クラスの得意分野（毒・発火・チル/フリーズ・クリ等）を強化。
   - 「主線を伸ばす → 円形クラスターへ寄り道（行き止まり）→ 主線に戻ってまた伸ばす → 別のクラスターを取る」という遊び。
3. **全ツリー連結**：すべてのクラスター・クラスがツリー上でつながっており、エレメンタリストが毒クラスターを取りに行くことも可能（遠回りになるだけ）。
4. **Lv80対応**：Lvキャップを最大80（=最大79SP）に拡張する前提でノードを増量。

### クラスと得意分野（`core/player.ts` の `CLASS_ABILITIES` より）

| クラス | 固有能力 | 円形クラスターのテーマ |
|--------|---------|----------------------|
| warrior（戦士） | クリ率+10% / AS+10% | クリティカル + 攻撃速度 |
| elementalist（エレメンタリスト） | 発火率20% | 発火（ignite） |
| ranger（レンジャー） | 毒付与率20% | 毒（poison） |
| frostmage（フロストメイジ） | チル率25% | チル / フリーズ |
| tamer（テイマー） | ペットドロップ+0.5% / ペット効果2倍 | **ペット強化（効果%・ドロップ率）** |

> tamerクラスターは**ペット強化**をテーマとする（ペットバフ効果%・ペットドロップ率%）。これはツリーに新規 `PassiveEffect` フィールドが必要で、`core/petEffects.ts` / `usePlayerStore.getTotalStats()` / `data/pets.ts` のペット倍率・ドロップ計算と連動させる（§3.4）。

---

## 2. 現状の基盤（調査結果）

PoE型に必要な仕組みは**ほぼ既存のまま使える**ことを確認済み。

| 要素 | 現状 | PoE型での扱い |
|------|------|--------------|
| 座標 | 各ノード `position: { x, y }`。`PassiveTree.tsx` が `x/y × GRID_SIZE(56)` で絶対配置。小数座標も使用中（例 `x:-1.5, y:-2.5`） | **そのまま自由配置可**。円形・放射状も座標計算で表現 |
| 接続 | `requiredNodes: NodeRequirement[]`。`string`=AND、`string[]`=OR。OR条件で系統間が環状接続済み | **そのまま環状接続可** |
| 接続線描画 | `requiredNodes` を辿りS字ベジェ描画、OR全ペア描く | 変更不要 |
| 効果集計 | `calculatePassiveEffects()`（シーズン共通）が `effect` を合算 | 新フィールド追加時のみ要修正（S2はそのフィールドを持たないだけ） |
| ズーム/パン | 実装済み（0.3〜2.5倍、初期0.55） | 大型ツリーOK。初期スケール再調整は必要かも |
| スタート | `startNodeId` 単一。UI上の特別扱いは「リスペック不可」のみ | **クラス別化が必要**（後述） |
| ノードサイズ/アイコン | `id` に `key`/`final` を含むか＋`effect` の中身から**推定** | ⚠ 増量で破綻しやすい → `nodeType` 明示フィールド導入を推奨 |
| ノード数 | S2/S3とも173（S3はS2の完全複製） | S3を全面再設計し250〜350へ |

---

## 3. データモデルの変更

### 3.1 `nodeType` の明示（推奨・optional）

現状はidとeffectからサイズ/アイコンを推定しているが、ノード激増で破綻するため `PassiveNodeData` に optional フィールドを追加する。**optional なのでS2ツリー（未設定）は従来の推定ロジックにフォールバックでき、後方互換が保てる。**

```ts
// types/index.ts  PassiveNodeData に追加
nodeType?: 'start' | 'minor' | 'notable' | 'keystone' | 'mastery';
iconType?: IconType;     // アイコンを明示（推定をやめる）
class?: CharacterType;   // クラススタート/クラスター帰属（任意・将来のフィルタ表示用）
```

- `PassiveTree.tsx` の `getNodeSize` / `getIconType` を「`nodeType`/`iconType` があればそれを使い、なければ従来推定」に変更。
- 影響範囲：`PassiveTree.tsx` のみ（描画）。集計ロジックは無関係。

### 3.2 クラス別スタート地点

**方式**：S3ツリーに5つのスタートノードを置き、`PassiveTreeData` にクラス→スタートIDの対応表を持たせる。

```ts
// types/index.ts  PassiveTreeData に追加（optional）
startNodeIds?: Partial<Record<CharacterType, string>>;
// 既存 startNodeId は後方互換用に残す（S2ツリーはこちらだけを使う）
```

S3 JSON の例：
```jsonc
{
  "startNodeId": "start_warrior",          // フォールバック用デフォルト
  "startNodeIds": {
    "warrior": "start_warrior",
    "elementalist": "start_elementalist",
    "ranger": "start_ranger",
    "frostmage": "start_frostmage",
    "tamer": "start_tamer"
  },
  "nodes": [ /* 5つのスタートノード + ... */ ]
}
```

**`data/passiveTree.ts` の変更**
- `setActivePassiveSeason(season)` に加え、ロード中キャラの**クラス**も保持する `setActiveCharacterClass(type)` を追加（または `setActivePassiveContext(season, type)` に統合）。
- `getStartNode()` / 新規 `getStartNodeId()` がクラスに応じたスタートIDを返す。`startNodeIds` 未定義なら従来 `startNodeId`。
- `canRefundNode()` の「スタートは返却不可」判定を、**全クラスのスタートノード集合**に対して行う（他クラスのスタートも幹の通過点になるため返却不可にする）。

**`stores/usePlayerStore.ts` の変更**
- `loadCharacter()`：`setActivePassiveSeason` と並べて、キャラの `type` でクラスを設定。
- **キャラ作成時 / 初期化時**：そのクラスのスタートノードを `unlockedSkills` に初期投入（SP消費なし）。
  - 現状 `unlockedSkills` は `skillRepository` 管理。スタート自動付与をどこで行うか（作成時 or ロード時の補完）を決める。**ロード時に「クラスのスタートが未取得なら自動追加」**が安全（既存キャラ migration 不要）。

**幹の接続**：5スタートは中央に円状配置し、それぞれが中央の共通ハブ（または隣接スタート）へOR条件でつながる。これにより「他クラスの領域へも遠回りで到達可能（全連結）」を満たす。

### 3.3 新規 `PassiveEffect` フィールド（防御機構）

§7 の新防御機構（吸収シールド / ブロック / 被ダメキャップ / チル・フリーズ耐性 等）をツリーに載せる場合、`types/index.ts` の `PassiveEffect` と `calculatePassiveEffects()` に集計を追加する（**S2/S3共通ロジック。S2ノードが該当フィールドを持たなければ実効ゼロ**）。本設計では**ツリー構造を先行**し、新フィールドは別タスク（§7実装）と歩調を合わせる。

### 3.4 ペット強化フィールド（tamerクラスター用）

tamerの円形クラスターは「ペット強化」がテーマ。`PassiveEffect` に以下を追加する想定：

```ts
// types/index.ts  PassiveEffect に追加
pet_effect_pct?: number;     // ペットバフ効果 +X% increased
pet_drop_rate_pct?: number;  // ペットドロップ率 +X%（絶対値%）
```

- `calculatePassiveEffects()` に集計を追加（合算）。
- **連動先**：
  - ペット効果倍率 … `usePlayerStore.getTotalStats()` / `core/petEffects.ts` の `applyPetBuff()`。現状のクラス固有 `petEffectMultiplier`（tamer=2倍）に `pet_effect_pct` を increased% レイヤーとして合成。
  - ドロップ率 … `data/pets.ts` の `tryPetDrop`。クラス固有 `petDropRatePct` に `pet_drop_rate_pct` を加算。
- notable/keystone 案：「ペット効果 X% more」「ペット2体同時運用」など強力な keystone を円の中心に。
- ⚠ これらは**戦闘ロジック側の改修を伴う**ため、ツリー骨格（§5 段階3）より後に実装し、効果フィールド未対応の間はクラスターを暫定で汎用ステ（vamp/guard等）で埋めておくことも可。

---

## 4. ツリーの幾何設計（座標ゾーニング）

中央=スタート群、放射状に主線、外周に円形クラスター。座標は `x`（右+）/`y`（下-が上方向、既存JSONは上方向にマイナスを使用）。

```
                      [上] elementalist 発火クラスター群
                                 ▲
                                 │ 主線(ATK/HP)
   ranger 毒クラスター ◀──────┐  │  ┌──────▶ warrior クリ/速度クラスター
                            │  │  │
                       中央: 5スタート + 共通ハブ
                            │  │  │
   tamer 吸血/防御 ◀────────┘  │  └────────▶ frostmage チル/フリーズ
                                 │ 主線(DEF/HP)
                                 ▼
                      [下] 汎用メインスタッツ / 後半notable
```

### ゾーン割り当て（角度ベース）

| 方角 | スタート | クラスター内容 | 既存系統の流用元 |
|------|---------|--------------|----------------|
| 上（-y） | elementalist | 発火 ignite | （S2に発火系ノードあり） |
| 右上 | warrior | クリ crit + 速度 speed | 既存 crit_* / speed_* |
| 右下 | frostmage | チル chill + フリーズ freeze | 既存 chill/freeze系 |
| 下（+y） | tamer | ペット強化（効果%/ドロップ率） | 新規 pet_*（補助に既存 vamp_*/guard_*） |
| 左 | ranger | 毒 poison | 既存 poison_* |

- **主線**：中央ハブから各方角へ **ATK / DEF / HP のいずれか**のメインスタッツ minor ノードを直線的に並べる。途中の**大きめパッシブ（notable）は効果を大きく**する（increased% を厚め、または more% を配置）。
- **円形クラスター**：主線から横道にそれる円環（8〜12ノード）。**円の中心または最奥に keystone を必ず配置**（PoEのクラスター表現）。行き止まり。クラスターを取りに行く＝主線のSPを割く判断を迫る。
- **クラスター間の渡り**：隣接クラスターの外周ノード同士をOR条件で薄くつなぎ「全連結」を担保（取りに行くと遠回り）。

### 規模の目安（Lv80=79SP前提）

| 区分 | ノード数目安 |
|------|------------|
| スタート | 5 |
| 主線（5方角 × 約12） | 約60 |
| 円形クラスター（5テーマ × notable込み 約30〜40） | 約150〜200 |
| 渡り・キーストーン・汎用 | 約40〜60 |
| **合計** | **約260〜330** |

取得可能79に対し総数260〜330＝取得率24〜30%。十分な取捨選択。

---

## 5. 実装手順（ツリー先行・段階的）

レベルキャップの実コード変更（`MAX_LEVEL`/`levelCap`→80）は**別タスク**。本タスクはツリーを79SP前提で設計するに留める。

**設計方針（確定）**：既存173ノードの効果値を流用ベースにし、座標をPoE型へ再配置する。主線はATK/DEF/HPのいずれか、notableは効果を大きく、横道の円形クラスターにはキーストーンを配置。ゼロからの新規ノード乱造は避け、不足分（発火/チル/フリーズの主線化、ペット強化、クラス別スタート、渡り）を補う。

| 段階 | 内容 | 主な変更 |
|------|------|---------|
| 1 | `nodeType`/`iconType` フィールド追加と描画切替 | `types/index.ts`, `PassiveTree.tsx` |
| 2 | クラス別スタートの仕組み | `types/index.ts`, `data/passiveTree.ts`, `stores/usePlayerStore.ts` |
| 3 | S3ツリーJSONの骨格（5スタート + 中央ハブ + 主線）を構築 | `data/json/passiveTree_s3.json` |
| 4 | 各クラスの円形クラスターを順次実装（poison→crit/speed→chill/freeze→ignite→vamp/guard） | `data/json/passiveTree_s3.json` |
| 5 | クラスター間の渡り・キーストーン配置・バランス値調整 | `data/json/passiveTree_s3.json` |
| 6 | i18n（全ロケールのノード名・説明） | `i18n/` |
| 7 | テスト拡張（S3固有ノード存在・ノード数・スタート解決・全連結性） | `tests/data/passiveTreeSeason.test.ts` |
| 8 | シミュレーションでバランス検証 | `scripts/` |

### 検証
- `npx tsc --noEmit`
- `npx vitest run`（feedback: テストはvitest）
- ツリー整合性チェック（孤立ノード・到達不能ノードがないか）はテストで自動化推奨

---

## 6. 影響ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `types/index.ts` | `PassiveNodeData.nodeType/iconType/class`、`PassiveTreeData.startNodeIds`（すべて optional） |
| `data/passiveTree.ts` | クラス対応のアクティブコンテキスト、`getStartNodeId()`、`canRefundNode` の全スタート対応 |
| `data/json/passiveTree_s3.json` | **全面再設計**（中心成果物） |
| `stores/usePlayerStore.ts` | ロード時にクラス設定＋スタート自動解放 |
| `components/player/PassiveTree.tsx` | `nodeType/iconType` 優先描画、初期スケール調整 |
| `i18n/*` | S3ノードの全ロケール文言 |
| `tests/data/passiveTreeSeason.test.ts` | S3構造の回帰テスト |

---

## 7. リスク・注意点

- **後方互換**：追加フィールドは全て optional。S2ツリー（`passiveTree.json`）は無変更でフォールバック動作する。`calculatePassiveEffects`/`combineMods` はシーズン共通だが、S2ノードが新フィールドを持たないため実効ゼロ。
- **マイグレーション**：S3ツリー変更はS3キャラのみ対象。リリース直後はS3キャラがほぼ存在しない＝マイグレーション不要の見込み（`season3-tasks.md` §4.2）。リリース後の再調整時は過去のV7同様（SP返還＋リスペックトークン付与）の救済を検討。
- **既存キャラのスタート自動解放**：ロード時補完方式なら DBマイグレーション不要。S3キャラの `unlockedSkills` にクラススタートが無ければ追加する処理を入れる。
- **アイコン素材**：`assets/images/passive/` に既存タイプ（atk/hp/def/poison/crit/regen/guard/vamp/speed）あり。発火・チル/フリーズ専用アイコンが必要なら素材追加 or 既存流用を確認。
- **レベルキャップ80化は別タスク**：`core/player.ts` の `MAX_LEVEL`、`usePlayerStore` の `levelCap` ロジック、EXP曲線、`useBattle.ts:1435` の `setLevelCap(60)` 周辺を別途対応。
