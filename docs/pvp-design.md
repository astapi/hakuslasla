# 非同期PvP 設計

**日付**: 2026-08-20
**状態**: P0（`core/combat/` 抽出）/ P1（`core/pvpEngine.ts` 対称エンジン）実装済み。P2以降が未着手
**方針**: モンスター戦エンジンとPvPエンジンを分離し、PvPは自分も相手も同じフォーマットで戦う対称エンジンを新規に用意する。不正対策は無料枠で可能な範囲で入れる。
**参加条件**: なし。進行度に関係なくいつでも参加可能とする。
**報酬**: なし。ランキングのみ。アイテム・経験値などの報酬は一切出さない。
**対戦回数**: 1日10戦まで（挑戦側のみカウント。無料枠のコスト調整目的）。
**参戦単位**: キャラ単位。レートもバケットもキャラごと（現行の `deviceId_localCharId` と同じ粒度）。

**関連**: [battle-system.md](./battle-system.md), [core-logic.md](./core-logic.md), [engrave-and-unique-balance-2026-08-20.md](./engrave-and-unique-balance-2026-08-20.md), **[pvp-p1-engine-spec.md](./pvp-p1-engine-spec.md)**（P1実装仕様・battleEngine監査結果）

---

## 1. 全体像

```
A が対戦に潜る
  → レート帯バケットから B のビルドが自動で割り当てられる（プレイヤーは選べない）
  → 端末内で PvPエンジンが決定的に戦闘を実行（即座に結果表示）
  → 「申告」を1件 Firestore に書く { A, B, seed, 主張結果, rulesetVersion }
  → ローカル審判が同じ seed で再現し、一致した申告だけ Elo に反映
  → 審判がバケットとレートを書き直す
```

サーバー（Cloud Functions / Blaze プラン）を使わず、Firestore 無料枠と
ローカル実行の審判プロセスだけで成立させる。

---

## 2. アーキテクチャ：エンジン分離

### 2.1 層の切り分け

```
core/
├── types.ts             共有  Stats / GaugeCombatant / CombinedModEffects(72)
├── modEffects.ts        共有  装備・パッシブ → CombinedModEffects
├── battle.ts            共有  calculateDamage / calculateFinalStats（無改造）
├── combat/              ★新規・共有  副作用ルールを「側」に依存しない形へ抽出
│   ├── damage.ts              通常攻撃・クリ・ブロック・シールド
│   ├── dot.ts                 毒・発火
│   └── status.ts              チル・フリーズ
│
├── battleEngine.ts      PvE専用  ★一切変更しない（既存バランス保護）
├── bossBehaviors.ts     PvE専用  ボススクリプト・エンレイジ等
│
└── pvpEngine.ts         ★新規・PvP専用  対称エンジン
```

`battleEngine.ts`（1300行超）と `bossBehaviors.ts` には**手を入れない**。
PvP は `core/combat/` の共有ルールを使って独自にティックを回す。

### 2.2 なぜ「共有ルール層」の抽出が要るか

PvPエンジンで毒・発火・チルを再実装すると、PvEと式がドリフトして
「PvEとPvPで毒の挙動が違う」という最悪の保守負債になる。
一方で `combatEffects.ts` の現行関数は**式は中立だが state のフィールド参照が固定**されている。

```ts
// 現状：mods は中立だが、書き込み先が state.enemy に固定されている
export function tryApplyPoison(
  state: GaugeBattleState, damage: number, mods: CombinedModEffects,
  config: BattleConfig, rng: () => number
)  // → state.enemyPoisonStacks に push
```

そこで「どちら側に効くか」だけを引数化した中立形へ**純粋抽出**する。

```ts
// 抽出後：side ビューを渡す。式は一切変えない
interface CombatSide {
  self: CombatantState;      // HP/シールド/自分に乗っている状態異常
  opponent: CombatantState;
  mods: CombinedModEffects;
}
export function tryApplyPoison(side: CombatSide, damage: number, config, rng)
```

- PvE は `{ self: player, opponent: enemy }` を渡すだけ。**振る舞いは不変**
- PvP は攻撃側・防御側を入れ替えて同じ関数を2方向に使う

**安全網**: `tests/core/` に333件のテスト、加えて `scripts/verifyBattleEngineConsistency.ts` と
`scripts/runSimulation.ts` / `tools/build-explorer/simBuild.ts` がある。
抽出前後で同一シードの戦闘ログが完全一致することを確認できるため、
「式を変えていない」ことを機械的に保証できる。

### 2.3 既存 state の対称性監査

PvPエンジンが必要とする状態のうち、現行 `GaugeBattleState` で**片側にしか無いもの**。

| 状態 | player側 | enemy側 | PvPでの扱い |
|---|---|---|---|
| poisonStacks | ✅ | ✅ | そのまま両側 |
| chillState | ✅ | ✅ | そのまま両側 |
| freezeState | ✅ | ✅ | そのまま両側 |
| **igniteState** | ❌ | ✅ | **両側化が必要** |
| **shield / maxShield** | ✅ | ❌ | **両側化が必要** |
| **woundStacks（重傷）** | ❌ | ✅ | **両側化が必要** |
| attackCount | ✅ | bossEffects側 | 両側化が必要 |

`GaugeCombatant` は `{currentHp, maxHp, atk, def, accuracy?, attackSpeed, gauge}` と
既に完全中立なので、そのまま両側に使える。
`calculateDamage(atk, def, additionalReduction)` も中立。**土台は既に対称。**

---

## 3. PvPエンジンの設計

### 3.1 状態モデル

```ts
interface PvpCombatant {
  // 素の戦闘力
  currentHp: number; maxHp: number; atk: number; def: number;
  attackSpeed: number; accuracy: number; gauge: number;
  mods: CombinedModEffects;          // 72フィールドをそのまま両側が持つ

  // 自分に乗っている状態（全て両側対称）
  shield: number; maxShield: number;
  poisonStacks: PoisonStack[];
  igniteState: IgniteState | null;
  chillState: ChillState | null;
  freezeState: FreezeState | null;
  woundStacks: number;

  // カウンタ系（king_slam / royal_roar / 双撃 などの発動条件）
  attackCount: number;
  consecutiveEvades: number;
  deferredDamages: DeferredDamage[];
}

interface PvpBattleState {
  sides: [PvpCombatant, PvpCombatant];   // [0]=挑戦者 [1]=防衛者
  elapsedTicks: number;
  isFinished: boolean;
  winner: 0 | 1 | 'draw' | null;
}
```

ボス関連（`BossEffectState` 37フィールド）は**PvPでは一切使わない**。
ただし UberUberユニークの固定MOD（`king_slam` / `royal_roar` / `warlord_enrage` /
`follow_up_attack_pct` / `critical_follow_up_attack`）は**プレイヤーMOD**なので、
PvPでも両側で機能させる必要がある。

### 3.2 行動順の決定性（重要）

ゲージが同一ティックで両者100に達したときの順序が決まっていないと、再現検証が成立しない。

**採用ルール**:
1. 攻撃速度が高い方が先
2. 同値なら **seed から導出したコイントス**で決める

「挑戦者が先」にすると先攻有利が固定化するため採らない。
seed 由来なら決定的かつ期待値として公平。

### 3.3 PvP専用ダメージ係数（必須）

現行のダメージ式をそのまま持ち込むと**試合が一瞬で終わる**。
実データ（UberUber魔王クリア者の2ビルド）での試算:

```
ソルト   HP6803 ATK6405 DEF2223 AS1.68
まこぴー HP4241 ATK3272 DEF2224 AS1.46

素のまま:  ソルト → まこぴー  1発1175ダメージ / 4発で撃破 / 2.4秒
```

PvE は「HP数千のプレイヤー vs HP130万のボス」前提で調整されており、
プレイヤー同士では HP と ATK が同じ桁になるため成立しない。
2.4秒では毒スタックが積まれる前、`time_atk_inc_pct`（5秒毎）が1回も乗る前、
`warlord_enrage` が発動する前に終わり、**ビルドの中身が結果に出ない**。

**方式: ダメージに係数を掛ける（初期値 ×0.15）。HPには一切触らない。**

#### 実装：共有コードは無改造で済む

係数を**ATK側に掛けて** `calculateDamage()` をそのまま呼ぶ。

```ts
// PvPエンジン内。core/battle.ts には一切手を入れない
const damage = calculateDamage(attacker.atk * ruleset.damageScale, defender.def, reduction);
```

ダメージは整数のまま扱う。小数で保持する必要はない。

| ミラーマッチ | 1発 | 決着 |
|---|---|---|
| Lv1 素手 (HP120/ATK10/DEF5) | 1 | 120発 / 120秒 |
| Lv20 序盤装備 | 16 | 19発 / 18秒 |
| Lv40 中盤 | 56 | 17発 / 15秒 |
| Lv60 終焉手前 | 107 | 21発 / 16秒 |
| Lv80 実測平均 (HP4573/ATK4348/DEF2208) | 120 | 39発 / 26秒 |
| Lv80 ソルト | 176 | 39発 / 23秒 |

#### 整数のままで問題ない理由

`calculateDamage` の `Math.max(1, ...)` が発火するのは
**`atk × (1 - 軽減) < 6.67` のときだけ**で、これは勝敗が既に決している組み合わせに限られる。

```
Lv80 同格: 4348 × 0.185 = 804   → クランプまで余裕100倍以上
Lv20 同格:  120 × 0.990 = 119   → 発火しない
```

競り合う試合では一度も効かないため、**小数で保持する意味がない**。

唯一 Lv1 素手同士のミラーが 120発／120秒と長くなるが、
§3.4(c) のサドンデスが45秒で決着させるため実害はない。
そもそも装備なしでPvPに潜った側の問題であり、設計側で吸収する必要はない。

**副次的な利点**: ダメージが整数で完結するため、
§4.1 の決定性の議論が浮動小数の扱いに依存しなくなり、リプレイ検証がより堅くなる。

#### 表示

ダメージもHPも整数なので、内部値をそのまま表示すればよい。表示用の変換は不要。

**係数は通常攻撃・毒・発火すべてに等しく掛ける。DoTに別係数は設けない。**
係数を分けることは「どのアーキタイプが勝つべきか」を設計側で決めることに等しい。
各アーキタイプの強弱はPvEで既に調整済みの数値がそのまま反映されるべきであり、
PvPで恣意的に補正しない。

### 3.4 決めるべきルール差分

PvE の前提のうち、PvPでそのまま使えないもの。

#### (a) 命中と回避 ★決定済み

PvEでは**プレイヤーの攻撃は必ず当たり**、敵の攻撃だけが命中判定を受ける。
そもそも**プレイヤーには `accuracy` ステータスが存在しない**（敵のみが持つ）。

命中率の式は `accuracy / (accuracy + evasion)`（5〜95%にクランプ）。
プレイヤーの accuracy を式の既定値 100 のまま扱うと、回避ビルドが一方的に有利になる。

**回避の理論到達値は 1828**（S3パッシブの回避ノード19個で flat382 / increased110% / more12%、
加えて回避ユニーク6種と刻印 `evasion` 32 / `evasion_increased_pct` 15）。

| プレイヤーの accuracy | 回避1828への命中率 |
|---|---|
| 100（式の既定値） | **5%** ←クランプ下限。実効HP20倍 |
| 450 | 20% |
| **500（敵の最大値）** | **21%** |
| 900 | 33% |

**決定: PvP中のプレイヤーに accuracy = 500 を一律付与する。**

- 500 は**敵モンスターの accuracy 最大値**（実データの分布は 410〜500、大半が450〜470）。
  任意の数字ではなく既存データに根拠がある
- 敵の accuracy はもともとプレイヤーの回避値に対して調整された数字なので、
  **PvEのバランスをそのまま継承できる**
- 値は `PvpRuleset.playerAccuracy` として外に出し、調整可能にする

> 以前検討した「回避率に上限（50%）を設ける」案は**採らない**。
> accuracy は既に式の第一級パラメータであり、そこを動かす方が新しいクランプ処理を足すより筋がよい。

**副作用**: 命中率は95%でクランプされるため、**回避0の相手にも5%外す**。
PvEの必中とは挙動が変わるが、シード再現可能なのでリプレイ検証には影響しない。
PvPの揺らぎとしてはむしろ自然なため、そのまま許容する。

**回避ミラーはサドンデス前提になる** — accuracy を上げても解決しない

| accuracy | 回避ミラー（両者1828）の決着 |
|---|---|
| 450 | 130秒 |
| 500 | 124秒 |
| 900 | 79秒 |

39発必要なところ命中21%なので約190回殴る必要があり、**どの値でもサドンデスに突入する**。
つまり回避ビルド同士では §3.4(c) のサドンデスが通常の決着経路になる。

さらに、回避とDEFは**乗算で重なる**点にも注意する。

```
DEF2208 の軽減81.5%     → 実効HP 5.4倍
回避1828 vs 命中500     → 実効HP 4.8倍
両方積むと              → 実効HP 約26倍
```

#### (b) 状態異常の両側化 ★決定済み

- **発火（ignite）**: 両側化。**伝染は無効**（1対1で伝染先が無い）
- **シールド**: 両側化。`hp_to_shield` / `shield_on_evade_streak_hit_pct` /
  `shield_on_10_attacks_pct` が両側で機能する
- **重傷（wound）**: 両側化
- **チル/フリーズ**: 既に両側にstateがあるのでそのまま使う

> PvPで死に効果になるMOD・パッシブ（伝染前提のものなど）が出るのは当然のこととして許容する。
> 対戦環境ごとに効く効果が変わるのは通常のことであり、設計側で吸収しない。

**フリーズ拘束について: 試験導入時は現行のまま持ち込む。**

PvPで両側に効かせると、拘束率は次のようになる（発生率は `freezeChanceCap` により10%上限、
基礎持続1.5秒、フリーズ中は再フリーズ不可、攻撃速度1.5/秒想定）。

| 持続+% | 実持続 | 拘束率 |
|---|---|---|
| +0% | 1.5秒 | 18% |
| +70%（実クリア者の中央値） | 2.6秒 | 28% |
| +164%（実測最大） | 4.0秒 | 37% |

実クリア者の52%（191/368人）がフリーズを保有している。

ただし**カウンターは既にゲーム内に存在する**ため、PvP専用の緩和措置は入れない。

| ノード | 効果 |
|---|---|
| `frz_b2_n` 氷結 | フリーズ耐性 +10% |
| `frz_b2_k` 凍結の極み | フリーズ耐性 +20% |
| `frz_b3_n` 永久凍土 | フリーズ耐性 +15%、8秒ごとに状態異常を解除 |
| `sustain_4_leech1` 凍傷吸収 | フリーズ耐性 +5% |

合計50%まで積める（エンジン側の上限は90%）。
フリーズに困るならパッシブで対策する、という既存の構造をそのままPvPにも適用する。

#### (c) 決着条件（サドンデス）

両者が硬いビルドだと決着しないため、UberUber魔王の「滅びの刻限」と同じ方式を使う。

```
0〜45秒     : 通常
45秒〜      : 両者の被ダメージ倍率が毎秒 +5%（際限なく上昇）
90秒でも未決着: 残HP割合が高い方の勝ち。完全同値なら防衛側の勝ち
```

回避ビルド同士など、サドンデスが主要な決着経路になる組み合わせは普通に発生する。
それ自体は問題ない（倍率は両者に等しく掛かるため、勝つのは実効HPと火力に優れた側になる）。

数値（45秒 / +5%/秒 / 90秒）は暫定値。
ダメージ係数や accuracy と同様、§8 の P2 で実ビルド368件の決着時間分布を見て詰める。

#### (d) ボス的なプレイヤーMOD ★決定済み

`king_slam` / `royal_roar` / `warlord_enrage` / `follow_up_attack_pct` /
`critical_follow_up_attack` はUberUberユニークの固定MOD（＝プレイヤーの効果）だが、
実装が `bossEffects`（敵側の仕組み）を経由している。

**PvPエンジンに両側で機能する形で実装する。**
配線の工数は実装時に測る。

### 3.5 PvP補正は「エンジン外の設定」にする

`PvpRuleset` として係数を1箇所に集約し、バージョン番号を持たせる。

```ts
interface PvpRuleset {
  version: number;              // 変更するたびにインクリメント
  damageScale: number;          // 0.15  全ダメージに一律で掛ける
  playerAccuracy: number;       // 500  敵の最大accuracyと同値
  freezeResistPct: number;      // 50
  suddenDeathStartSec: number;  // 45
  suddenDeathRampPctPerSec: number; // 5
  timeLimitSec: number;         // 90
}
```

`version` は申告に含める。審判は**申告に記録されたバージョンのルールで再現**するため、
係数を調整しても過去の試合が検証不能にならない。

---

## 4. 決定性とリプレイ

### 4.1 決定性は既に成立している

`core/` を調査した結果、三角関数 / `Math.exp` は使われておらず、戦闘計算はほぼ四則演算と `Math.floor / min / max` のみ。

> **訂正（2026-08-21 監査）**: `core/battleEngine.ts:716` に `Math.pow(1.2, enemyWoundStacks)`（重撃の重傷倍率）が**1箇所だけ存在する**。
> `Math.pow` は ECMA-262 で実装依存の近似が許されるため、PvPエンジンでは**反復乗算に置き換える**（スタックは0〜5の整数）。
> 詳細は [pvp-p1-engine-spec.md §6-A](./pvp-p1-engine-spec.md)。PvEエンジンは無改造なので影響なし。
IEEE754倍精度でこれらは**完全に規定**されているため、**Hermes（端末）と Node V8（審判）で
ビット単位で一致**する。浮動小数の差異による検証失敗は起きない。

RNG も `createBattleEngine` の `config.rng` から供給され、`combatEffects.ts` の全関数に引数として渡っている。

> **補足（2026-08-21 監査）**: 呼び出し箇所は12箇所あり、**全判定が `chance > 0` で短絡する**ため消費本数がビルドに依存する。
> 単一ストリームを両側で共有すると相手のビルドが自分のロールを変えるので、PvPでは**側ごとに独立したRNGストリーム**（seedから派生）を持たせる。
> また `createRng(0)` は常に0を返すため **seed=0 を禁止**する。詳細は [pvp-p1-engine-spec.md §5, §6-G](./pvp-p1-engine-spec.md)。

> 注意: `core/equipmentSets.ts` は `Math.random()` を直接使っているが、
> これはドロップ生成であり戦闘には影響しない。

### 4.2 リプレイはシードだけで復元

戦闘ログを保存する必要はない。
`(ビルドA, ビルドB, seed, rulesetVersion)` から全イベントが再生成できる。
→ **Firestore の保存量とegressを大幅に節約でき、かつ再生画面がタダで手に入る。**

---

## 5. サーバーレス構成（無料枠）

### 5.1 素直に作った場合の限界

| 動作 | コスト |
|---|---|
| 対戦相手を検索（レート近傍10件） | 10 read |
| 戦績を書く | 1 write |
| 自分のレート更新 | 1 write |
| 相手のレート更新 | 1 write |

→ 1試合あたり **10 read + 3 write**。読み取りが先に詰まり **1日約5,000試合が上限**。
さらに現行ルールは `allow write: if true` なので、**レートを直接書き換えられる**。

### 5.2 採用構成：バケット配布 + 申告 + ローカル審判

```
[クライアント]
  ① レート帯バケットdocを1つ読む（50人分のビルド入り・セッション中キャッシュ）
     → その中から対戦相手を自動抽選。プレイヤーは相手を選べない
  ② ローカルでPvPエンジンを実行 → 即座に結果とリプレイを表示
  ③ 申告docを1件書く { challengerUid, defenderUid, seed, claimedWinner, rulesetVersion }

[審判 : GitHub Actions cron（毎時） または 既存の launchd]
  ④ 申告docを読む
  ⑤ 同じ seed・同じ rulesetVersion で再シミュレート
  ⑥ 主張と一致 かつ ビルドが正当 な申告だけ採用 → Elo 計算
  ⑦ pvp_ratings と pvp_pool_* を書き直す → 処理済み申告を削除
```

| | 1試合あたりのクライアント側コスト | 1日の上限 |
|---|---|---|
| 素直な実装 | 10 read + 3 write | 約5,000試合 |
| **本構成** | **0.1 read + 1 write** | **約18,000試合** |

（Firestore Sparkプラン: 読み取り50,000/日、書き込み20,000/日、削除20,000/日、ストレージ1GiB、egress 10GiB/月）

審判が書くのは1日あたり「レート更新 ≒ アクティブ人数」＋「バケット十数件」なので、
2,000試合/日でも審判側の書き込みは200〜300程度に収まる。

### 5.3 審判の置き場所

| 方式 | コスト | 備考 |
|---|---|---|
| **GitHub Actions cron（毎時）** | 無料枠内（private 2,000分/月に対し毎時実行で約720分/月） | **推奨。**Macの起動に依存しない |
| launchd（Mac常駐） | 完全無料 | `scripts/notify-uber-kraken-launchd.sh` と同じ方式。既に運用実績あり |

いずれもサービスアカウント鍵をシークレットに置いて Firestore REST / Admin SDK を叩く。

### 5.4 レート確定が遅延することについて

審判がバッチで確定するため、レートは最大1時間遅れる。
クライアントは**暫定レートをローカルSQLiteに保持して即時表示**し、
次回同期時に審判の確定値で上書きすればよい。非同期PvPでは体感上の問題にならない。

---

## 6. データモデルとセキュリティルール

### 6.1 コレクション

| コレクション | doc ID | 内容 | 書き手 |
|---|---|---|---|
| `pvp_pool_{season}_{bracket}` | レート帯ごと1件 | 対戦相手プール（約50ビルド） | 審判のみ |
| `pvp_claims/{uid}_{seq}` | 申告 | `{challengerUid, defenderUid, seed, claimedWinner, claimedTicks, rulesetVersion, appVersion, createdAt}` | 本人のみ・審判が削除 |
| `pvp_ratings/{uid}` | プレイヤー | `{rating, wins, losses, defenseWins, season, buildRef, updatedAt}` | 審判のみ |

### 6.2 匿名認証の導入（無料・必須級）

現状は Firebase Auth 未使用で、identity は `deviceId`、ルールは全コレクション `allow write: if true`。
このままだと**審判を入れても他人名義の申告を量産できる**。

**Firebase Auth の匿名認証は Spark プランで無料**（課金されるのは電話番号認証のみ）。
これを入れると `request.auth.uid` が使えるようになり、初めてまともなルールが書ける。

```
match /pvp_claims/{claimId} {
  allow read: if false;                                  // 審判のみ（Admin SDKはルールを迂回）
  allow create: if request.auth != null
                && claimId.split('_')[0] == request.auth.uid
                && request.resource.data.challengerUid == request.auth.uid;
  allow update, delete: if false;                        // 書いたら書き換えられない
}
match /pvp_ratings/{uid} { allow read: if true;  allow write: if false; }  // 審判のみ
match /pvp_pool_{bracket} { allow read: if true; allow write: if false; }  // 審判のみ
```

既存の `deviceId` は匿名認証 uid とのマッピングを1回作って移行する。

### 6.3 ビルドの正当性検証（審判側）

再シミュレーションだけでは「改造ビルド」を弾けない。審判は申告採用前にビルドを検証する。

1. **装備**: `items.json` に存在するIDか / MOD値が `mods.json` のティア範囲内か /
   刻印は1装備1つまで・ユニークに刻印が無いか（`core/engrave.ts` の規則をそのまま使う）
2. **パッシブ**: `isConnectedFromStart()` でスタートから全ノードに到達可能か。
   **消費ポイントがレベルから導かれる上限を超えていないか**
3. **Uberツリー**: 撃破記録から導かれるポイント上限内か

> これは推測ではなく実績のある必要性である。v2.1.0 (`d8da1d5`) のリスペックバグ調査で、
> 記録済みS3クリアデータ251件のうち**81件（32%）がルール上成立しない構成**だったことが判明している。
> PvPでは意図的な改造の動機がさらに強いため、この検証は必須。

### 6.4 ストレージとバケットのサイズ

現行のクリア記録は1件あたり約 **8.75KB**（`build.equipment` の全MOD＋パッシブノード列）。
50件をそのままバケットに詰めると 437KB で、Firestore の **1MB/doc 上限に近い**。

→ PvP用に**圧縮したビルドスナップショット**を別途定義する（装備MODを配列化、
パッシブノードIDを短縮）。1件2〜3KB に落として 50件で100〜150KB を目標とする。

egress は 200 DAU × 150KB/日 ≒ 30MB/日（月900MB）で、10GiB/月 の枠に十分収まる。

---

## 7. レーティング

### 7.1 方式

Elo。K値は試合数で逓減（〜30戦: K=40 / 〜100戦: K=20 / 以降: K=10）。
**ただし初期レートは一律1500にしない**（次節）。

### 7.2 報酬を出さないことの帰結

**PvPの報酬はランキングのみとする。**アイテム・経験値・通貨は一切出さない。

- 参加条件が無いため、報酬をPvE進行に効くものにすると
  「序盤はPvPを回した方が早い」という逆転が起きる。それを構造的に回避できる
- 不正のリターンが「順位」だけになるため、
  §5.2 の審判による検証で守るべき対象がランキング1点に絞られる
- **ランキングがPvPの唯一の価値**になるため、順位の正しさが最も重要な品質になる

### 7.3 全員1500スタート

**初期レートは一律1500。** ビルドの強さから開始レートを決めるような仕組みは入れない。

- レーティングは**対戦結果から決まるべき**もので、
  ビルドから計算できるならPvPを行う意味がない
- ダミーへの火力ではビルド相性を測れない。
  毒・回避・クリの相性差がある以上、同じ「強さ」でも勝率は大きく変わる
- 強豪が適正帯に上がるまで約30戦かかるが、**ラダーとして普通のこと**。
  §7.1 の初期K=40がその収束を早める役割を果たす（必要ならKをさらに上げて調整する）

### 7.4 防衛側はレート変動なし ★決定

**レートが動くのは攻撃側だけ。防衛側は勝っても負けてもレートが変わらない。**

- オフライン中に、自分の関知しないところでレートが減っているのは体感が悪い
- 非同期PvPで最も不満が出やすい部分を構造的に排除できる

**レートの意味**: 「自分から挑んだ試合の成績」になる。

**volume grinding は起きない**（§7.5 で相手を自動割り当てにするため）。
相手を選べないなら期待勝率は50%に収束するので、
試行回数を稼いでもレートは上がらない。防御側の据え置きと矛盾しない。

### 7.5 バケットとマッチング

レート帯を200刻みでバケット化し、各バケットに直近アクティブな最大50ビルドを審判が詰める。
自分のバケット＋隣接1つから**自動で抽選する。プレイヤーは相手を選べない。**

- 相手を選べないことで、相性のよい相手を狙い撃ちしてレートを稼ぐ余地がなくなる
- 人口が薄い帯では隣接バケットへフォールバック
- 同一相手の連続再戦を避けるため、直近に戦った相手を除外（審判側でも検証可能）
- シーズン制（既存のランキングと同じくシーズンで分ける）

---

## 8. 段階的な進め方

| フェーズ | 内容 | 検証 |
|---|---|---|
| **P0** ✅ 2026-08-21 | `core/combat/` への純粋抽出（PvE挙動は不変） | coreテスト295件＋ゴールデンログ240戦闘の完全一致（`scripts/pvp/recordGoldenBattleLogs.ts --verify`） |
| **P1** ✅ 2026-08-21 | `core/pvpEngine.ts` の対称エンジンとオフライン対戦（ローカルのビルド同士） | coreテスト375件（既存295＋新規80）。決定性・対称性・draw/timeout・mods非変異。実ビルド368件の総当たり67,528試合を実行し、ルール欠陥2件を修正（§10 P1実施結果） |
| **P2** | PvP係数・回避上限・サドンデスのバランス調整 | 実クリア者ビルド368件を総当たりさせ、勝率と決着時間の分布を見る |
| **P3** | Firestore（バケット・申告・匿名認証）とオンライン化。レートはローカル暫定値のみ | 無料枠の実消費を実測 |
| **P4** | 審判（GitHub Actions）と Elo 確定、ランキング画面 | 改造申告を意図的に投げて弾かれることを確認 |

P2 で既存の `tools/build-explorer/` の資産（368件の実ビルド、`simBuild.ts` の
ステータス合成パイプライン）がそのまま使える。**バランス調整を実データで回せるのが強み。**

---

## 9. 将来構想：シーズン4で命中・回避を対称にする

§3.4(a) の「PvP中だけ accuracy=500 を一律付与」は**試験導入**の位置づけ。
本命はシーズン4で、**プレイヤーにも accuracy、敵にも evasion** を正式に持たせて
命中・回避を両側のステータスにすることを検討する。

### 得られるもう一つの利点

エンジンが**自然に対称になる**。命中・回避が通常の 双方向ステータスになれば、
§2 で挙げたPvPエンジンの非対称性の一角が消える。
加えて accuracy という新しいビルド軸とMOD種別が増え、コンテンツにもなる。

### リスク

**(1) 「外れる」演出はオートバトルと相性が悪い**
プレイヤーは操作で取り返せないため、自分の攻撃が外れる体験は
アクションゲームより体感が悪くなりやすい。

**(2) 税金ステータス化**
全モンスターに回避を持たせると accuracy は「取らないと損」な必須枠になり、
選択肢ではなくコストになる。装備・パッシブの予算を食うだけで面白さを生まない。

**(3) 既存エンドコンテンツの再調整が必要** ★最重要

| 敵の回避 | 命中率 | プレイヤーDPS |
|---|---|---|
| 0 | 95%（クランプ） | **-5%** |
| 50 | 91% | -9% |
| 100 | 83% | -17% |
| 200 | 71% | -29% |

UberUber魔王は撃破制限時間型（毎秒回復1万 / 50秒後から攻撃倍率+4%/秒）であり、
v2.1.0 の調整で**正当なS3ビルド170件中6件のみが突破、次点は残HP20〜50%で惜敗**という
極めて狭い水準に置かれている。**DPS -5% で突破者はほぼ消える。**

### 提案する手当て

**回避0の相手には命中判定をスキップして必中にする。**

```
if (defender.evasion === 0) → 必中（rollしない）
else                        → accuracy / (accuracy + evasion) で判定
```

- 既存の全モンスターは evasion 未設定 = 0 なので、**PvEの挙動は1ビットも変わらない**
- 95%クランプによる一律 -5% が発生しない
- 回避を持たせた敵にだけ命中判定が発生するため、
  **accuracy は「税金」ではなく「特定の敵へのカウンター」**になる

そのうえで敵の回避は**選択的に配る**（素早い/軽装のアーキタイプのみ）。
既存のエンドコンテンツボスには当面付けない。

---

## 10. 次のセッションでやること

設計は一通り固まった。**次は実装フェーズに入る。**

### 最初の作業: P0（`core/combat/` の純粋抽出）

`combatEffects.ts` の関数から「どちら側に効くか」を引数化し、
PvE / PvP の両方から使える中立形にする（§2.2）。式は一切変えない。

```bash
# 着手前に安全網を確認
npx vitest run tests/core/          # 333件
npx tsx scripts/verifyBattleEngineConsistency.ts
```

**方針（2026-08-21決定）**: 工数を理由に縮小しない。毒・発火・チル・フリーズを含む完全版で進める。

#### 実施結果（2026-08-21・完了）

**作ったファイル**

| ファイル | 内容 |
|---|---|
| `core/combat/types.ts` | 中立ビュー型 `CombatantView` / `StatusView` と `createEmptyStatusView()` |
| `core/combat/damage.ts` | `executeAttack` / `calculateIncomingDamage` / `calculateHitChance` / `rollHit` / `calculateLifesteal` / `calculateHpRegen` |
| `core/combat/dot.ts` | 毒・発火の付与と処理、`isPoisoned` / `isIgnited` |
| `core/combat/status.ts` | チル・フリーズの付与と処理 |
| `core/combat/index.ts` | 再エクスポート |
| `scripts/pvp/recordGoldenBattleLogs.ts` | ゴールデン戦闘ログの採取・検証 |
| `scripts/pvp/golden/battleLogs.json` | ベースライン（240戦闘 / 39,386イベント） |
| `tests/core/combat/{damage,dot,status}.test.ts` | 中立関数の新規テスト45件 |

`core/combatEffects.ts` は**シグネチャを完全に維持**したまま、中立関数へ委譲して
BattleEvent を組み立てるだけの薄いラッパに置き換えた（751行 → 約540行）。
`core/battleEngine.ts` / `core/bossBehaviors.ts` / `core/battle.ts` は**未変更**。

**検証コマンド**

```bash
npx vitest run tests/core/                        # 295件パス（既存250 + 新規45）
npx tsx scripts/verifyBattleEngineConsistency.ts  # OK
TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/recordGoldenBattleLogs.ts --verify
#   → 240戦闘 / 39,386イベント 完全一致
#   totalHash: 615edd3d9c8ad62e95cee734aa536f12c067d5cf9c0590a883892387ea53c653
```

ゴールデンログは 敵10体（通常/Uber/UberUber）× MODセット8種（空・毒・発火・チル/フリーズ・
クリ追撃・シールド/回避・Uberツリー・DoTのみ）× シード3種。
イベント28種類（`player_attack` から `warlord_enrage` まで）を網羅している。
ベースラインの再採取は `--record`。

**設計判断**

1. **中立関数は `BattleEvent` を組み立てない。数値結果と状態だけを返す。**
   イベント型名（`player_attack` / `enemy_attack` / `target:'enemy'`）がPvE固有の語彙であり、
   中立層に持ち込むと `side` や `eventType` を引き回すことになって層の意味が濁るため。
   イベント生成は `combatEffects.ts`（PvE）と将来の `pvpEngine.ts`（PvP）がそれぞれ行う。

2. **引数は `CombatSide` ではなくスカラにした。**
   §2.2 の `CombatSide { self, opponent, mods }` 案は採らず、
   `tryApplyPoison(targetPoisonStackCount, baseDamage, mods, config, rng)` のように
   「関数が本当に必要とする値だけ」を渡す形にした。
   引数が state の形に依存しないため、PvPの `PvpCombatant` がどんな形でもそのまま使える。
   `CombatantView` / `StatusView` は**エンジン側が状態を組み立てるときの共通語彙**として残してある。

3. **`core/index.ts` からは名前空間として再エクスポートする。**
   `tryApplyPoison` など4つが `combatEffects` と同名のため、
   `import * as combat from './combat'; export { combat };` の形にして衝突を避けた。
   直接使う側は `import { ... } from '../core/combat'` でよい。

**副次的な修正**: `scripts/verifyBattleEngineConsistency.ts` が
`deferred_damage` イベントをUI側ミラーに反映しておらず、
**リファクタ前から既に失敗していた**（`damageDeferPct` 追加以降の腐り）。
1ケース追加して復旧させた。エンジン側のロジックは触っていない。

### P1: `core/pvpEngine.ts` 対称エンジン（2026-08-21・完了）

実装仕様は [pvp-p1-engine-spec.md](./pvp-p1-engine-spec.md)、決定事項の一覧はその §10。

**作ったファイル**

| ファイル | 内容 |
|---|---|
| `core/pvp/ruleset.ts` | `PvpRuleset` 型と `PVP_RULESET_V1`（`version: 1`）。`getPvpRuleset(version)` で過去バージョンを引ける。`Object.freeze` 済み |
| `core/pvp/types.ts` | `PvpCombatant` / `PvpBattleState` / `PvpBattleInput` / `PvpBuildSnapshot` / `PvpEvent` / `PvpResult` |
| `core/pvp/rng.ts` | seed → 3ストリーム派生（側0 / 側1 / 行動順コイン）。`assertValidPvpSeed` が seed=0 を弾く |
| `core/pvpEngine.ts` | 対称エンジン本体。`createPvpEngine(input)` / `runPvpBattle(input)` |
| `core/index.ts` | 上記の再エクスポート（追記） |
| `core/combat/status.ts` | `tryApplyChill` / `tryApplyFreeze` に**後方互換の耐性引数**を追加（既定0でPvE挙動不変） |
| `tests/core/pvp/{pvpEngine,rng,ruleset,determinismGuards}.test.ts` + `helpers.ts` | 新規80件 |
| `scripts/pvp/runPvpMatrix.ts` | 実ビルド総当たり（`--sample N` / `--full` / `--replay A B seed`） |

**検証コマンドと結果**

```bash
npx vitest run tests/core/                        # 375件パス（既存295 + 新規80）
TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/recordGoldenBattleLogs.ts --verify
#   → 240戦闘 / 39,386イベント 完全一致（PvE回帰ゼロ）
#   totalHash: 615edd3d9c8ad62e95cee734aa536f12c067d5cf9c0590a883892387ea53c653
npx tsx scripts/verifyBattleEngineConsistency.ts  # OK
npx tsc --noEmit                                  # 既存の scripts/upload*.ts 3件以外エラーなし
npm run lint                                      # 新規エラー・警告なし
TSX_TSCONFIG_PATH=tsconfig.scripts.json npx tsx scripts/pvp/runPvpMatrix.ts --full
```

**実ビルド368件の総当たり（67,528試合 / rulesetVersion=1・確定値）**

```
実行時間   : 25.1秒（0.372 ms/試合）
side0 勝率 : 49.80%     side1 勝率: 50.18%     draw: 0.02%（12試合）
KO 率      : 89.18%     時間切れ率: 10.80%（7,293試合）
  うち残HP割合が完全同値 = 防衛側の不戦勝: 76試合（全体の 0.11%）
KO限定の side0 勝率: 50.17%   ← 先攻有利が存在しないことの確認
平均       : 37.00秒   中央値: 24.60秒   p10: 3.43秒   p90: 90.00秒（上限）
```

決着時間の分布

```
  0-5s   16.64% ████████
  5-10s  13.85% ███████
 10-15s   9.35% █████
 15-20s   6.24% ███
 20-30s   7.73% ████
 30-45s   6.41% ███
 45-60s   9.66% █████
 60-90s  30.13% ███████████████
```

アーキタイプ別勝率（観測のみ。§3.3 によりこれを理由に係数は変えない）

| アーキタイプ | 分類されたビルド数 | 勝率 |
|---|---|---|
| ignite | 34 | 59.7% |
| chillFreeze | 50 | 58.5% |
| other | 6 | 56.1% |
| noDirectDamage | 155 | 54.0% |
| poison | 17 | 46.5% |
| evasion | 8 | 43.8% |
| crit | 16 | 43.4% |
| heavyStrike | 29 | 40.2% |
| shield（hpToShield） | 53 | 32.7% |

※ 分類は `runPvpMatrix.ts` の `classifyArchetype()` による**排他的**な単純分類
（`heavyStrike → noDirectDamage → hpToShield → evasion → poison → ignite → chillFreeze → crit → other`
の順で最初に当たったもの）。MODを重複して持つビルドは上位のラベルに吸われるため、
フラグの素の保有数とは一致しない（例: `hpToShield` を持つビルドは141件だが、
そのうち `noDirectDamage` も持つものは noDirectDamage に分類される）。

#### P1初版で見つかった2つのルール欠陥と、その修正（2026-08-21）

初版のエンジンで総当たりを回したところ、**バランス調整では直せないルール自体の欠陥**が2件出た。
`rulesetVersion` は未リリースのため v1 のまま修正した。

**欠陥1: 時間切れ判定にシールドが入っていなかった**

`finalHpPct` を `currentHp / maxHp` で計算していたため、
**両者ともシールドで全ダメージを吸収しきってHPが1も減らないまま90秒経過**すると
「完全同値 → 防衛側の不戦勝」になっていた。S3ビルドの38%が `hpToShield` を持つため
これが**全体の8.2%（5,525試合）**を占め、side0/side1 の勝率が 46.9% / 53.1% に歪んでいた。

→ `finalHpPct = (currentHp + shield) / (maxHp + maxShield)` に変更。
`PvpResult` に `finalShield: [number, number]` を追加した。

**欠陥2: サドンデス倍率がスイングにしか掛かっていなかった**

§3.4(c) は「両者の**被ダメージ倍率**」と規定しているのに、実装は通常攻撃のスイングにしか
掛けていなかった。毒・発火主体のビルドはサドンデスで一切加速せず、時間切れに張り付いていた。

→ 毒・発火・遅延ダメージの消化・反撃にも同じ倍率を掛ける（`suddenDeathAppliesToDot: true`、
false で初版の挙動に戻せる）。適用点は各ダメージの最終値に対して `Math.floor(dmg * mult)` で整数維持。
**DoTに別係数は設けない**（§3.3）。

> 遅延ダメージだけは適用点を動かした。従来は「最終ダメージ算出後・遅延分割前」に倍率を掛けていたが、
> 消化時にも掛けると倍率が2乗になる（90秒時点で 3.25² ≈ 10.6倍）。
> そこで **遅延分は素の値でキューに積み、消化する瞬間に倍率を掛ける** 形にした。
> 倍率1のとき（＝45秒まで）は分割結果が従来と1ビットも変わらないことを確認済み。
> 反撃はそもそもサドンデスが掛かっていなかったので、あわせて掛けるようにした（漏れの修正）。

**修正前後の比較（同一の368ビルド / 同一シード / 67,528試合）**

| 指標 | 修正前 | 修正後 | 差分 |
|---|---:|---:|---|
| side0 勝率 | 46.90% | **49.80%** | +2.90pt（ほぼ50%に是正） |
| side1 勝率 | 53.09% | **50.18%** | -2.91pt |
| draw | 6 (0.01%) | 12 (0.02%) | +6 |
| KO率 | 77.29% | **89.18%** | +11.89pt |
| 時間切れ率 | 22.70% | **10.80%** | **-11.90pt** |
| うち完全同値（不戦勝） | 5,525 (8.2%) | **76 (0.11%)** | **-5,449** |
| KO限定 side0勝率 | 50.87% | 50.17% | 先攻有利なしを維持 |
| 平均決着時間 | 40.02s | **37.00s** | -3.02s |
| 中央値 | 24.60s | 24.60s | 変化なし |

| 決着時間バケット | 修正前 | 修正後 | 差分 |
|---|---:|---:|---|
| 0-5s | 16.64% | 16.64% | ±0 |
| 5-10s | 13.85% | 13.85% | ±0 |
| 10-15s | 9.35% | 9.35% | ±0 |
| 15-20s | 6.24% | 6.24% | ±0 |
| 20-30s | 7.73% | 7.73% | ±0 |
| 30-45s | 6.41% | 6.41% | ±0 |
| 45-60s | 5.42% | **9.66%** | +4.24pt |
| 60-90s | 34.37% | **30.13%** | -4.24pt |

45秒までの分布が1試合も動いていないのは、サドンデス倍率が1のあいだ挙動が完全に同一であることの裏付け。
変化はすべて45秒以降に集中している。

| アーキタイプ別勝率 | 修正前 | 修正後 | 差分 |
|---|---:|---:|---|
| ignite | 52.60% | **59.72%** | +7.12pt |
| chillFreeze | 57.30% | 58.53% | +1.23pt |
| other | 53.86% | 56.09% | +2.23pt |
| noDirectDamage | 53.24% | 54.00% | +0.76pt |
| poison | 46.53% | 46.45% | -0.08pt |
| evasion | 43.53% | 43.80% | +0.27pt |
| crit | 46.01% | **43.38%** | -2.63pt |
| heavyStrike | 42.41% | 40.24% | -2.17pt |
| shield（hpToShield） | 38.95% | **32.69%** | -6.26pt |

- `shield` の -6.3pt は、**シールドで耐えるだけで不戦勝を拾えていた分が消えた**もの。
  これが本来の実力値。
- `ignite` の +7.1pt は、サドンデスがDoTにも掛かるようになった分。発火は毒より
  ティック間隔が短く（既定300ms）サドンデスの恩恵を受けやすい。
- `poison` がほぼ動かないのは、毒が「行動したときに相手の毒が1ティック進む」方式で
  発生頻度が攻撃速度に縛られるため。

**設計判断（P1で新たに決めたこと）**

1. **RNGは側ごと独立2本 + 行動順コイン1本**。攻撃側ストリーム = クリ→毒→発火→チル→フリーズ、
   防御側ストリーム = 命中→ブロック。命中とブロックを防御側に置いたのは、どちらも防御側の
   ステータス（`evasion` / `blockChance`）で決まる判定であり、こうすると
   **攻撃側のビルド変更が回避結果を動かさない**ため。この割り当ては `rulesetVersion` に紐づく。

2. **状態異常耐性は確率減算型に統一**（`chance * (1 - min(90, resist)/100)`）。
   PvEに混在していたロール型は採らない。RNG消費が1本減り、消費本数が耐性値に依存しなくなる。
   `core/combat/status.ts` には**省略可能引数**として足したので、PvEの挙動は1ビットも変わっていない
   （ゴールデンログの totalHash が変化しないことで機械的に確認済み）。

3. **`igniteResistPct` をPvPで有効化した**。PvEでは合成されるのに誰も読まない死に効果だったが、
   発火が両側化して初めて意味を持つMODなので、毒耐性と同形のダメージ軽減として実装した。

4. **イベントの `side` は「主体＝状態が変化した側」で統一**。`attack` だけが攻撃側で、
   それ以外は効果を受けた側。この規約のおかげで「sidesを入れ替えると `side` が反転するだけ」になり、
   対称性テストがイベント列の完全一致で書ける。

5. **1行動 = 命中1回 + ブロック1回**。メイン攻撃と全追撃（クリ追撃 / Uber追撃 / 双撃 / king_slam）を
   1スイングとして合算してから被ダメージ加工を1回通す。追撃ごとに適用すると
   `repeatHitDamageReductionPct` が同一行動内で誤発火して防御側が不当に有利になるため。

6. **状態異常の付与は命中判定に依存させない**。ゲートすると防御側の回避が攻撃側ストリームの
   消費本数を変えてしまい、1で避けた結合が復活する。ライフスティール・重傷付与だけは
   「スイングが通ったとき」に限定した。★P2の検討対象。

7. **発火フェーズはダメージパスと回復パスを分離**した。発火は「ダメージは自分・吸収回復は相手」なので
   側ごとに逐次処理すると処理順で HP のクランプ結果が変わる。パスを分けて順序非依存にし、
   sides入れ替えでの勝者反転が構造的に成立するようにした。

8. **`Math.pow(1.2, stacks)` は反復乗算に置換**（`woundMultiplier()`）。定数テーブルは使わない。
   `Math.pow` / `**` / `Math.random` / `Date` の混入は静的テスト
   （`tests/core/pvp/determinismGuards.test.ts`）で検出するようにした。

9. **反撃（`retaliateDefPct`）にも `damageScale` を掛けた**。DEF由来なので §3.3 の列挙には無いが、
   掛けないと反撃だけが素の火力で通ってしまう。`damageScaleAppliesToRetaliate` として
   ルールセットで切り替え可能にしてある。サドンデス倍率も同様に掛ける。

10. **サドンデス倍率は「被ダメージ倍率」なので全ダメージに掛ける**
    （通常攻撃・追撃・king_slam・反撃・毒・発火・遅延ダメージの消化）。
    ただし**吸収回復（ライフスティール）には掛けない**。スイングのライフスティールが
    サドンデス前の値から計算されているのと揃えるため。掛けるとサドンデスの意図と逆に働く。

**P2 で見るべき点（修正後の実測から）**

1. **時間切れ10.8%をさらに削るか**。修正で 22.7% → 10.8% まで落ちたが、まだ1割ある。
   完全同値の不戦勝は 0.11% まで消えたので、残りは「本当に決着しなかった試合」。
   サドンデスの開始秒（45s）と上昇率（+5%/秒）を振って分布を見る。

2. **分布は依然としてバイモーダル**。16.6%が5秒以内、30.1%が90秒に張り付く。
   `damageScale` を上げると左の山が、下げると右の山が太る。単一の係数では両方は潰せないので、
   **`damageScale` は据え置き、サドンデスを早める/強める方向**で右の山を削るのが筋。
   0-5秒の左の山は「実力差がそのまま出ている」だけの可能性もあるので、
   勝敗ペアのステータス差と相関を取ってから触ること。

3. **`shield` アーキタイプ 32.7% が最低**。不戦勝の下駄が外れた実力値。
   `hpToShield` は最大HPを30%に圧縮する代わりに**回復8系統がすべて止まる**（キルスイッチ）ため、
   長期戦になるPvPでは構造的に不利。PvE用の設計がPvPで裏目に出ている典型。
   §3.3 の「アーキタイプ別の勝率を理由に係数をいじらない」に従い、係数では触らない。
   気になるならPvEも含めた `hpToShield` の設計自体を見直す話になる。

4. **`ignite` 59.7% が最高**。サドンデスがDoTに掛かるようになった結果。
   発火のティック間隔（既定300ms、`igniteIntensify` で150ms）が毒（行動ごと）より
   はるかに密なので、倍率の恩恵を受ける回数が多い。
   サドンデスの上昇率を下げると自動的に緩和される。1と一緒に見る。

5. **状態異常の付与を命中判定でゲートするか**（設計判断6）。
   現状は外した攻撃でも毒・発火・チル・フリーズが乗る。回避ビルドに対して
   DoTビルドが構造的に強くなる要因なので、P2で数字を見て判断する。
   ただしゲートすると防御側のビルドが攻撃側のRNG消費を変えるため、
   実装するなら「ロールは消費してから捨てる」形にすること。

6. `damageScale` / `playerAccuracy` の実測根拠はまだ取れていない。
   1〜4 を片付けてから、係数を振って分布を再取得する。

### 実装が終わってから決めること（P2）

暫定値のまま置いてあるパラメータ。実ビルド368件の総当たり（67,528試合）で分布を見て決める。

| パラメータ | 暫定値 |
|---|---|
| `damageScale` | 0.15 |
| `playerAccuracy` | 500 |
| サドンデス開始 | 45秒 |
| サドンデス上昇率 | +5%/秒 |
| 制限時間 | 90秒 |

見るのは**決着時間の分布**と**時間切れ率**の2つ。
アーキタイプ別の勝率は観測するが、それを理由に係数をいじらない（§3.3）。

### 残っている小さな未決

- ~~**1日の対戦回数上限**~~ → **1日10戦で決定**（2026-08-21）。DAU2000 で書き込み20,000/日の枠ちょうど
- **防衛ビルドの鮮度**: 長期未ログイン者の古いビルドをプールからいつ外すか
- **審判の単一障害点**: GitHub Actions が止まると申告が溜まる。
  申告docのTTLと、溜まり具合の監視が要る
- ~~**キャラ単位かアカウント単位か**~~ → **キャラ単位で決定**（2026-08-21）。現行の `deviceId_localCharId` 粒度を踏襲

### 別件：刻印バランスの対応案A（未着手）

[engrave-and-unique-balance-2026-08-20.md](./engrave-and-unique-balance-2026-08-20.md) の
**対応案A（優先度: 高）**が未決のまま。

`atk_increased_pct` / `def_increased_pct` の刻印値が素T1基準の30固定のため、
`slotTiers` を持つ武器（T1 43-45）・鎧（T1 43-45）では
**刻印がドロップに負ける**という歪みがある。
影響範囲が小さいので、PvP実装とは独立に片付けられる。

### コミット状況

本セッションの成果物はすべて**未コミット**。

```
?? docs/pvp-design.md
?? docs/engrave-and-unique-balance-2026-08-20.md
?? scripts/fetchUberUberDemonLordClears.ts
 M .gitignore                      # local-data/ を追加
```

---

## 11. 参照

| 目的 | ファイル |
|---|---|
| PvEエンジン（変更しない） | `core/battleEngine.ts`, `core/bossBehaviors.ts` |
| 共有したい戦闘ルール | `core/combatEffects.ts`, `core/battle.ts`, `core/gaugeBattle.ts` |
| MOD合成（72フィールド） | `core/modEffects.ts`, `core/types.ts` |
| パッシブ連結性チェック（ビルド検証に流用） | `data/passiveTree.ts` の `isConnectedFromStart()` |
| 刻印の規則（ビルド検証に流用） | `core/engrave.ts`, `data/engraveMods.ts` |
| 既存のFirestore書き込み・ランキング | `lib/firestore.ts`, `lib/ranking.ts`, `firestore.rules` |
| バランス検証の土台（実ビルド368件） | `tools/build-explorer/simBuild.ts`, `tools/build-explorer/data/builds.json` |
| 審判の実行方式の前例 | `scripts/notify-uber-kraken-launchd.sh` |
