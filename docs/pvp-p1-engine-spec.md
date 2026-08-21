# PvP P1: 対称エンジン `core/pvpEngine.ts` 実装仕様メモ

**日付**: 2026-08-21
**対象**: [pvp-design.md](./pvp-design.md) §8 の P1
**方法**: `core/battleEngine.ts`(1409行) / `core/bossBehaviors.ts` / `core/combatEffects.ts` /
`core/types.ts` / `core/modEffects.ts` / `core/gaugeBattle.ts` / `core/endContent.ts` / `core/battle.ts` を全読して抽出。
すべて行番号付き（P0着手前の行番号）。推測箇所には ★要検証 と明記する。

---

## 0. 先に判明した「設計書の記述と実装が食い違う点」

| 設計書の記述 | 実際 |
|---|---|
| §2.1 `CombinedModEffects(72)` | **73フィールド**（`core/types.ts:205-305`） |
| §4.1「`Math.pow` / `**` が一切使われていない」 | **`core/battleEngine.ts:716` に `Math.pow(1.2, enemyWoundStacks)` がある**（重撃の重傷倍率）。§6-A 参照 |
| §3.4(d)「`king_slam` 等が `bossEffects` 経由で実装されている」 | 正確には**プレイヤー側は `battleEngine.ts` にインライン実装**されており `bossEffects` は経由しない。`bossEffects` を経由するのは同名の**敵スキル**（ゴブリンキングの `goblin_kings_slam` 等）。ただし `battleEngine.ts:984` でプレイヤーのフリーズ付与時に `bossEffects.goblinSlamCounter` をリセットしており、ここだけ配線が交差している。§3-D 参照 |
| §2.3 の対称性監査表 | 表にない**片側専用 state が他に9個**ある（`playerLastHitDamageTick` / `playerLastAutoCleanseTick` / `playerLastShieldDamageTick` / `igniteApplyCount` / `warlordEnrageActivated` / `enemyWoundActionCounter` / `deferredDamages` / `poisonStackAccumulator` / エンジンローカルの `consecutiveEvades`・`pendingEnemyChillAfterFreeze`・`regenCounter`・`enemyRegenCounter`）。§3 の表参照 |
| §4.1「RNG は `config.rng` 1箇所からしか使われていない」 | 呼び出し**箇所**は12箇所ある（§5）。より重要なのは**RNG消費が MOD 値に依存して短絡する**こと（§5.2）。単一ストリームを両側で共有すると相手のビルドが自分のロールを変える |

---

## 1. ゲージ進行の式

### 1.1 1ティックあたりのゲージ増加量

```
core/battleEngine.ts:399
  gaugePerTick = config.baseGaugePerSecond / config.ticksPerSecond
               = 200 / 30 = 6.6666...            (DEFAULT_BATTLE_CONFIG: core/types.ts:500-501,520-521)

core/battleEngine.ts:397-398
  playerAS = playerAttackSpeedBase * bossEffects.playerAttackSpeedMult
  enemyAS  = enemyAttackSpeedBase  * bossEffects.enemyAttackSpeedMult

core/battleEngine.ts:468-483   チル/フリーズの反映
  playerASFinal = playerAS
  if (playerFreezeState)      playerASFinal = 0                                  // :472-473
  else if (playerChillState)  playerASFinal *= playerChillState.speedMultiplier  // :474-476
  （敵側 :479-483 も完全に同形）

core/battleEngine.ts:486-489   加算（遷移中はスキップ）
  if (!isTransitioning) {
    player.gauge += playerASFinal * gaugePerTick
    enemy.gauge  += enemyASFinal  * gaugePerTick
  }
```

- `playerAttackSpeedBase`: `core/battleEngine.ts:242-246`
  `getAttackSpeedFromMods(mods) * playerSpeedMultiplier`、`heavyStrike` なら `* 0.8`
- `getAttackSpeedFromMods`: `core/modEffects.ts:520-522` → `calculateAttackSpeed(1.0, attackSpeedPct, attackSpeedMorePct)`
  `core/modEffects.ts:501-515`: `max(0.1, base * (1 + inc/100) * (1 + Σmore/100))`
- `enemyAttackSpeedBase`: `core/battleEngine.ts:247` `(enemy.attackSpeed ?? 1) * enemySpeedMultiplier`
- `core/gaugeBattle.ts:119-137` の `getGaugeIncreasePerTick` / `getTicksToAction` は**エンジンから呼ばれていないデッドコード**（同じ式の再掲）

### 1.2 行動判定の閾値

```
core/battleEngine.ts:651   while (!isTransitioning && player.gauge >= 100 && playerActions < 5)
core/battleEngine.ts:739     player.gauge = Math.max(0, player.gauge - 100)
core/battleEngine.ts:1049  while (!isTransitioning && enemy.gauge  >= 100 && enemyActions  < 5)
core/battleEngine.ts:1165    enemy.gauge  = Math.max(0, enemy.gauge - 100)
```

- 閾値100、消費は **-100（減算）**でありリセットではない。余剰は次に持ち越す
- 1ティックあたり最大5行動（`playerActions < 5` / `enemyActions < 5`）
- AS 1.0 → 6.667/tick → 15tick(=0.5秒)で1行動。AS 1.68 → 11.2/tick → 約9tickで1行動

### 1.3 同一ティックで両者が100に達したときの現行の処理順

**プレイヤーが常に無条件で先。** 構造上そうなっている:

```
core/battleEngine.ts:650-1040   プレイヤー行動ループ
core/battleEngine.ts:1042-1044  if (state.isFinished) break;     ← ここが決定的
core/battleEngine.ts:1048-1378  敵行動ループ
```

`:1004-1013` でプレイヤーが敵を倒すと `isFinished = true` になり、`:1042` の `break` で
**敵はそのティックの反撃機会を完全に失う**。同ティック相打ちは発生しない。

→ PvP でこれをそのまま持ち込むと「側0が常に勝つ」。設計書 §3.2 の
「AS高い方が先 → 同値ならシード由来コイントス」を必ず実装する（§2.3）。

---

## 2. ティック内の処理順序と、PvPでの対称化案

### 2.1 現行の順序（`core/battleEngine.ts:370-1383` の1ループ）

| # | 行 | 処理 | 側 |
|---|---|---|---|
| 1 | :373 | `elapsedTicks += 1` | 共通 |
| 2 | :374-395 | 時間バフ算出（`timeStacks` / `timeAtkIncPct` / `timeDefIncPct` / `timeHpRegen` / `hpRegenToAtkPct`）→ `effectivePlayerAtk` / `effectivePlayerDef` | P |
| 3 | :397-399 | AS と `gaugePerTick` 算出 | 両 |
| 4 | :402-406 | **敵**チル持続処理 | E |
| 5 | :407-430 | **敵**フリーズ持続処理 → 解除時チル移行 | E |
| 6 | :433-437 | **P**チル持続処理 | P |
| 7 | :438-442 | **P**フリーズ持続処理（チル移行なし＝非対称） | P |
| 8 | :444-465 | 自動解除（永久凍土 `autoCleanseIntervalMs`） | P |
| 9 | :468-483 | チル/フリーズを AS に反映 | 両 |
| 10 | :486-489 | **ゲージ加算（両者同時）** | 両 |
| 11 | :492-531 | 1秒ごと: HP回復 → シールド再構築 | P |
| 12 | :533-564 | 1秒ごと: 遅延ダメージ消化（死亡判定 `:553-562`） | P |
| 13 | :568-594 | 1秒ごと: 敵HP回復（エンドコンテンツ） | E |
| 14 | :597-646 | **敵の発火**ダメージ（死亡判定 `:632-641`） | E |
| 15 | :650-1040 | **プレイヤー行動ループ**（最大5、内訳は §2.2） | P |
| 16 | :1042 | `isFinished` なら break | — |
| 17 | :1048-1378 | **敵行動ループ**（最大5、内訳は §2.2） | E |
| 18 | :1380 | `isFinished` なら break | — |

### 2.2 行動ループ内の順序

**プレイヤー行動1回（`:651-1040`）**

| 行 | 処理 |
|---|---|
| :655-685 | **敵の毒**ダメージ処理（＝毒は「攻撃側が行動したとき、相手に乗っている毒が1ティック進む」）+ `poisonLifesteal` 回復 + 死亡判定 |
| :687-691 | `effectiveMods` 生成（`criticalChance` / `poisonChance` に `bossEffects` 倍率を掛ける） |
| :693-704 | `executePlayerAttack()`（`combatEffects.ts:44-101`） |
| :707-719 | `chillFreezeMult`（`:708-711`）× `woundMult = Math.pow(1.2, woundStacks)`（`:715-717`）= `combinedMult` |
| :722-738 | ダメージスケール適用・イベント差し替え |
| :739 | ゲージ -100 |
| :743-752 | `uberCriticalFollowUp`（ATK100%追撃） |
| :755-765 | `playerAttackCount += 1` → `shieldOn10AttacksPct`（10回ごと） |
| :768-779 | `followUpAttackPct`（双撃の指輪） |
| :782-796 | `kingSlam`（5回ごと ATK×3） |
| :799-811 | `royalRoar`（3回ごと自己毒/チル解除） |
| :814-823 | 重傷スタック付与（上限5） |
| :826-842 | 重撃 100%吸収 |
| :845-860 | ライフスティール（重撃でない場合のみ） |
| :863-873 | `critLifestealPct` |
| :876-921 | `hpOnHit` の追加発動 ×3（クリ追撃 / Uber追撃 / 双撃追撃） |
| :923-940 | 毒付与（`tryApplyPoison` + `poisonMultiStack` 端数蓄積） |
| :944-964 | 発火付与（`tryApplyIgnite` + `igniteIntensify`、`lastTickMs` 継承） |
| :967-971 | チル付与 |
| :974-987 | フリーズ付与（敵フリーズ耐性ロール） |
| :990-1002 | demon_mark 反射（**敵専用**） |
| :1004-1013 | 敵死亡判定 |
| :1015-1039 | ボス閾値効果・攻撃後効果（**敵専用**） |

**敵行動1回（`:1049-1378`）**

| 行 | 処理 |
|---|---|
| :1051-1091 | ボス pre effects（毒付与/浄化/フリーズ/ゲージリセット。**敵専用**） |
| :1093-1125 | **プレイヤーの毒**ダメージ処理（`poisonResistPct` 適用）+ 死亡判定 |
| :1127-1142 | 敵ダメージ算出（`calculateEnemyDamage`）+ エンレイジ + 各種倍率 + 命中判定 + ブロック判定 |
| :1146-1162 | `damageDeferPct` による分割 |
| :1164-1172 | `applyPlayerDamage` → イベント |
| :1171 | `applyEnemyAttackAftermath`（`consecutiveEvades` / `hpOnTakenHit` / `shieldOnEvadeStreakHitPct`） |
| :1175-1185 | `retaliateDefPct` 反撃 |
| :1188-1199 | 重傷スタック減衰（敵行動4回で-1） |
| :1202-1234 | 触手乱打（**敵専用**） |
| :1237-1271 | 敵によるチル/フリーズ付与（**敵専用**） |
| :1274-1309 | 盗賊の追撃（**敵専用**） |
| :1311-1343 | 敵 hpOnHit（**敵専用**） |
| :1346-1364 | `warlordEnrage` 発動判定（**プレイヤーMODなのに敵行動ループ内**） |
| :1366-1375 | プレイヤー死亡判定 |
| :1377 | `applyEnemyAttackPostEffects`（**敵専用**） |

### 2.3 PvP での対称化提案

**方針: 「共通フェーズ」と「側ごとフェーズ」に分け、側ごとフェーズは必ず `for (const s of order)` で回す。**
`order` はフェーズによって固定 `[0,1]` か、行動順 `resolveActionOrder()` かを明示的に選ぶ。

```
tick(state):
  P0  state.elapsedTicks += 1
      suddenDeathMult = computeSuddenDeath(elapsedTicks, ruleset)      // §3-K
  P1  for s in [0,1]: deriveTimeBuffs(s)          // effectiveAtk/effectiveDef を両側算出
  P2  for s in [0,1]: processChill(s); processFreeze(s)  // フリーズ→チル移行も両側で
  P3  for s in [0,1]: autoCleanse(s)
  P4  for s in [0,1]: accumulateGauge(s)          // 同時。順序非依存（読み書きが自分だけ）
  P5  for s in [0,1]: perSecond(s)                // hpRegen → shieldRecharge → deferredDamage
      resolveDeaths()                             // ★両側同時死亡は draw
  P6  for s in [0,1]: processIgniteOn(s)          // 自分に乗っている発火が減る
      resolveDeaths()
  P7  order = resolveActionOrder(state, seedCoin)
      for s of order:
        while (side[s].gauge >= 100 && actions < 5):
          takeAction(s, 1-s)                      // 内部で相手の毒進行 → 攻撃 → 付与
          if (resolveDeaths()) break outer
```

**対称化のポイント（現行の非対称を潰す）**

1. **P2 のフリーズ→チル移行**: 現行は敵側だけ移行する（`:417-429`）。プレイヤー側（`:438-442`）は
   `processFreezeState(..., null, ...)` と第2引数に `null` を渡していて移行しない。
   **PvP では両側とも `pendingChillAfterFreeze` を持たせる**（`combatEffects.ts:721-751` はもともと中立）。
2. **P5/P6 の死亡解決を「フェーズ末尾」にまとめる**。現行は `:553` `:632` `:674` `:1115` で
   即 `break` するため先に処理された側が有利。PvP では両側処理後にまとめて判定し、
   **両者HP≤0 なら `winner='draw'`**。
3. **毒の進行タイミングは現行の形をそのまま両側化できる**。
   PvE は「プレイヤー行動時に敵の毒が進む」(`:655`) /「敵行動時にプレイヤーの毒が進む」(`:1093`) であり、
   すでに「**行動する側が、相手に乗っている毒を1ティック進める**」という対称形になっている。
   `takeAction(attacker, defender)` の先頭で `processPoisonOn(defender)` を呼べば式は一切変わらない。
4. **発火はティック単位（P6）**。現行 `:597-646` が敵側のみなので、両側ループに変えるだけ。
5. **`warlordEnrage` を P7 の行動ループから出す**。現行は「敵が行動したとき」にしか判定されない
   （`:1346-1364`）ため、敵の攻撃速度が遅いと発動が遅れる。PvP では **P1（毎ティック）で両側判定**すべき。
   ★これは PvE と挙動が変わるが、PvE エンジンは無改造なので影響なし。
6. **`suddenDeathMult` の適用点**は PvE の `bossEffects.playerDamageTakenMult`（`:1141`）と同位置、
   すなわち「最終ダメージ算出後、遅延分割の前」に両側等しく掛ける。

---

## 3. `combatEffects.ts` に無いインラインルール一覧

`combatEffects.ts` にあるのは 攻撃(`:44`) / 毒(`:124,182`) / 発火(`:257,327`) / HP回復(`:409`) /
ライフスティール計算(`:449`) / 敵ダメージ(`:500`) / 命中(`:521,528`) / チル(`:565,612`) / フリーズ(`:657,721`) のみ。
以下はすべて `battleEngine.ts` にインライン実装されている。

### A. シールド

| # | 行 | 式 | 参照 mods | 参照 state | PvP両側化 |
|---|---|---|---|---|---|
| A1 | `:98-103` `restorePlayerShield` | `shield = min(maxShield, shield + amount)` / 戻り値は実回復量 | — | `playerShield`, `playerMaxShield` | **必要** |
| A2 | `:249`,`modEffects.ts:524-538` `calculateBattleHpAndShield` | `base = hpToShield ? maxHp : 0`<br>`maxShield = floor((base + shield) * (1+shieldIncreasedPct/100) * (1+Σ shieldMorePct/100))`<br>`maxHp = hpToShield ? max(1, floor(maxHp*0.3)) : maxHp` | `hpToShield`, `shield`, `shieldIncreasedPct`, `shieldMorePct` | 初期化時 | **必要** |
| A3 | `:144-152` シールド被弾 | `shieldDamage = min(shield, remaining)`; `shield -= shieldDamage`; `remaining -= shieldDamage`<br>`if (shieldDamage>0) playerLastShieldDamageTick = elapsedTicks` | — | `playerShield`, `playerLastShieldDamageTick` | **必要** |
| A4 | `:145` DoTのシールド貫通 | `bypassShield = !shieldBlocksDot`（呼び出し側 `:546`,`:1106`） | `shieldBlocksDot` | — | **必要** |
| A5 | `:515-531` シールド再構築 | 1秒ごと。`delayTicks = ceil(shieldRechargeDelayMs/1000 * tps)`<br>`canRecharge = lastShieldDamageTick===null \|\| elapsed - last >= delayTicks`<br>回復量 `floor(playerMaxShield * shieldRechargePct/100)` | `shieldRechargePct`, `shieldRechargeDelayMs` | `playerShield`, `playerMaxShield`, `playerLastShieldDamageTick` | **必要** |
| A6 | `:194-211` 連続回避後の被弾 | `recoverPct = min(100, consecutiveEvades * shieldOnEvadeStreakHitPct)`<br>回復 `floor(playerMaxShield * recoverPct/100)` | `shieldOnEvadeStreakHitPct` | エンジンローカル `consecutiveEvades`, `playerMaxShield` | **必要** |
| A7 | `:756-765` 10回攻撃ごと | `playerAttackCount % 10 === 0` かつ `playerMaxShield > 0` → `floor(playerMaxShield * shieldOn10AttacksPct/100)` | `shieldOn10AttacksPct` | `playerAttackCount`, `playerMaxShield` | **必要** |
| A8 | `:1172`,`:1231`,`:1308` | イベントに `playerShield` を後付け（UI用） | — | `playerShield` | 任意 |

> **`hpToShield` は回復の全面キルスイッチでもある**。`:498`(HP regen)、`:623`(発火吸収)、`:662`(毒吸収)、
> `:826`(重撃吸収)、`:845`(ライフスティール)、`:863`(クリ吸収)、`:876`/`:892`/`:908`(hpOnHit) の
> **8箇所すべてが `!mods.hpToShield` でガードされている**。両側化時にこの8箇所を漏らさないこと。

### B. ブロック・被ダメージ加工（`applyPlayerDamage` `:110-157`）

| # | 行 | 式 | 参照 mods | 参照 state | PvP両側化 |
|---|---|---|---|---|---|
| B1 | `:105-108` `rollPlayerBlock` | `blockChance = min(50, max(0, mods.blockChance))`; `blockChance>0 && rng()*100 < blockChance` | `blockChance` | — | **必要** |
| B2 | `:122-130` 連続被弾軽減 | `lastHitTick!==null && elapsed - lastHitTick <= ticksPerSecond && repeatHitDamageReductionPct>0`<br>→ `remaining = floor(remaining * (1 - min(80,max(0,pct))/100))` | `repeatHitDamageReductionPct` | `playerLastHitDamageTick` | **必要** |
| B3 | `:132-138` 低HP軽減 | `currentHp <= maxHp*0.3` → `remaining = floor(remaining * (1 - min(80,max(0,pct))/100))` | `lowHpDamageReductionPct` | `player.currentHp/maxHp` | **必要** |
| B4 | `:141` | `playerLastHitDamageTick = elapsedTicks`（`options.hit` のときのみ、ブロックされても更新） | — | 同上 | **必要** |
| B5 | `:154-155` | `hpDamage = min(currentHp, remaining)`; `currentHp = max(0, currentHp - remaining)` | — | — | **必要** |

> B2/B3 の適用順は **連続被弾 → 低HP** の順で、両方 `Math.floor` するため順序が結果に影響する。PvPでも同順を維持。
> `options.hit` が真のときだけ B1〜B4 が走る。DoT・遅延ダメージ・反射は `hit` を渡さない（`:545`,`:992`,`:1105`）。

### C. 連続回避 `consecutiveEvades`（`applyEnemyAttackAftermath` `:159-214`）

```
:165-168  回避した          → consecutiveEvades += 1; return（以降の処理なし）
:170      ブロックした      → return（カウンタを触らない）
:172-176  ダメージ0だった   → consecutiveEvades = 0; return
:178-181  死亡した          → consecutiveEvades = 0; return
:183-192  hpOnTakenHit      → currentHp = min(maxHp, currentHp + hpOnTakenHit) + hp_regen イベント
:194-211  A6 シールド回復
:213      consecutiveEvades = 0
```

- `consecutiveEvades` は **`GaugeBattleState` ではなくエンジンローカル**（`:96`, `:344`）。PvP では `PvpCombatant` に持たせる
- 呼び出し箇所: `:1171`(通常攻撃) / `:1230`(触手乱打) / `:1307`(盗賊追撃)
- 参照 mods: `hpOnTakenHit`, `shieldOnEvadeStreakHitPct` → **両側化必要**

### D. `playerAttackCount` を使うもの / 「ボス的なプレイヤーMOD」（設計書 §3.4(d)）

`playerAttackCount` は `core/types.ts:386`、インクリメントは `battleEngine.ts:755` の1箇所のみ
（メイン攻撃1回につき+1。追撃・双撃・キングスラムでは増えない）。

| # | 行 | MOD | 式 | 実装場所の実態 | PvP |
|---|---|---|---|---|---|
| D1 | `:756-765` | `shieldOn10AttacksPct` | `playerAttackCount % 10 === 0` | インライン | 両側化 |
| D2 | `:782-796` | `kingSlam` | `playerAttackCount % 5 === 0 && !noDirectDamage`<br>`floor(calculateDamage(atk*3, def, reduction) * combinedMult)` | **インライン。`bossEffects` 非経由** | 両側化 |
| D3 | `:799-811` | `royalRoar` | `playerAttackCount % 3 === 0` → **自分の** `playerPoisonStacks=[]`, `playerChillState=null`<br>（コメントは「毒・発火・チル」だが**発火は解除していない**＝プレイヤーに発火stateが無いため） | インライン | 両側化。PvPで発火が両側化したら `igniteState=null` も入れるか要判断 |
| D4 | `:768-779` | `followUpAttackPct` | `ringAtk = atk * pct/100`<br>`floor(calculateDamage(ringAtk, def, reduction) * combinedMult)`。クリ非依存・毎攻撃 | インライン | 両側化 |
| D5 | `combatEffects.ts:87-98` | `criticalFollowUpAttack` | クリ時のみ `floor(calculateDamage(atk*0.5, def, reduction))`。**`combinedMult` は `battleEngine.ts:723` で後掛け** | 抽出済み | そのまま両側 |
| D6 | `:743-752` | `uberCriticalFollowUp` | クリ時 `floor(calculateDamage(atk, def, reduction) * combinedMult)` | インライン | 両側化 |
| D7 | `:1346-1364` | `warlordEnrage` | `!warlordEnrageActivated && currentHp>0 && currentHp <= maxHp*0.3`<br>→ `attackSpeedPct += 20`; `hpOnHit += 300`; `playerAttackSpeedBase` 再計算（`heavyStrike ? 0.8 : 1` 込み） | **敵行動ループ内**。`mods` を破壊的に変更（§6-D） | 両側化。P1フェーズへ移動を推奨 |

**`bossEffects` がプレイヤーMODに干渉している唯一の箇所**:
- `:689-690` `effectiveMods.criticalChance *= bossEffects.playerCritChanceMult`、`poisonChance *= playerPoisonChanceMult`
- `:984` プレイヤーがフリーズを与えると `bossEffects.goblinSlamCounter = 0`（＝**敵**のキングスラムカウンタ）

→ PvP ではどちらも不要。`bossEffects` は一切持ち込まない。

### E. 重傷 wound（重撃）

| 行 | 内容 | 参照 |
|---|---|---|
| `:244-246` | 初期化時 `heavyStrike` なら `playerAttackSpeedBase *= 0.8` | mods.`heavyStrike` |
| `:715-717` | `woundMult = Math.pow(1.2, enemyWoundStacks)`（`heavyStrike && stacks>0` のとき） | state.`enemyWoundStacks` |
| `:719` | `combinedMult = chillFreezeMult * woundMult` |  |
| `:814-823` | 付与: `heavyStrike && totalDamage>0 && stacks<5` → `stacks += 1` + `wound_applied` | state.`enemyWoundStacks` |
| `:1188-1199` | 減衰: **敵行動時**に `enemyWoundActionCounter += 1`、4で `stacks -= 1` してカウンタ0 | state.`enemyWoundActionCounter` |
| `:826-842` | `heavyStrike && !hpToShield` → `(totalDamage + uberFollowUpDamage)` の100%をHP吸収（`maxHp` 上限、`playerHealingMult` 適用） |  |
| `:845` | `heavyStrike` のときは通常ライフスティールを**行わない**（排他） |  |

- **PvP両側化必要**。`woundStacks` / `woundActionCounter` を `PvpCombatant`（「自分に乗っている重傷」）に持たせる
- 減衰条件「敵行動4回」は対称化すると「**重傷を負っている側が行動するたびに+1**」が自然（現行の意味と一致）
- `Math.pow` は §6-A の通り置換すること

### F. 遅延ダメージ `deferredDamages`

| 行 | 式 |
|---|---|
| `:1146` | `deferPct = Math.min(50, mods.damageDeferPct)` |
| `:1150-1159` | `deferredTotal = floor(totalEnemyDamage * deferPct/100)`<br>`finalEnemyDamage = totalEnemyDamage - deferredTotal`<br>`if (deferredTotal>0) push({ damagePerTick: max(1, floor(deferredTotal/4)), remainingTicks: 4 })` |
| `:533-564` | 消化: **1秒ごと**（`regenCounter` ループ内）。全キューの `damagePerTick` を合算して1回のダメージにし、各要素の `remainingTicks -= 1`、0になったら除去。`bypassShield: !shieldBlocksDot`。死亡時 `byDeferredDamage: true` |

- `remainingTicks: 4` の "tick" は**秒**（1秒ごとの消化）。名前が紛らわしい
- 同一処理が `:1211-1220`(触手乱打) と `:1288-1297`(盗賊追撃) にコピペされている ＝ PvPでは1関数に集約
- 参照 mods: `damageDeferPct`, `shieldBlocksDot` / state: `deferredDamages`
- **PvP両側化必要**

### G. 時間経過バフ（`:374-395`）

```
timeStacks      = Math.floor(elapsedTicks / (ticksPerSecond * 5))     // 5秒ごと
timeAtkIncPct   = mods.timeAtkIncPct * timeStacks
timeDefIncPct   = mods.timeDefIncPct * timeStacks
timeHpRegenBonus= mods.timeHpRegen   * timeStacks

regenToAtkBonus = 0
if (mods.hpRegenToAtkPct > 0):
    baseRegen  = mods.hpRegen + timeHpRegenBonus
    pctRegen   = floor(player.maxHp * mods.hpRegenPct / 100)
    regenToAtkBonus = floor((baseRegen + pctRegen) * mods.hpRegenToAtkPct / 100)

effectivePlayerAtk = max(1, floor(player.atk * (1 + timeAtkIncPct/100)) + regenToAtkBonus)
effectivePlayerDef = max(0, floor(player.def * (1 + timeDefIncPct/100)))
```

- `timeHpRegenBonus` は `:495-497` で `regenMods = {...mods, hpRegen: mods.hpRegen + timeHpRegenBonus}` として HP回復に反映
- **注意**: `regenToAtkBonus` の `pctRegen` は `player.maxHp` を使う（`hpToShield` 後の圧縮HP）
- 参照 mods: `timeAtkIncPct`, `timeDefIncPct`, `timeHpRegen`, `hpRegenToAtkPct`, `hpRegen`, `hpRegenPct`
- **PvP両側化必要**。設計書 §3.3 が指摘する通り、この効果が乗るまで試合が続くかが `damageScale` の主目的

### H. 毒スタック蓄積 `poisonStackAccumulator`（`:923-940`）

```
baseDamage = calculateDamage(effectivePlayerAtk, enemy.def, totalEnemyDamageReduction)   // :923
poisonResult = tryApplyPoison(state, baseDamage, effectiveMods, config, rng)             // :924
if (poisonResult.poisonStack):
    multiStack = mods.poisonMultiStack                       // 既定1、猛毒覚醒で1.5
    if (multiStack > 1):
        poisonStackAccumulator += multiStack                 // :929
        stacksToApply = floor(poisonStackAccumulator)        // :931
        poisonStackAccumulator -= stacksToApply              // :932
        for s in 0..stacksToApply-1: push({...poisonStack})  // :933-935  ★同一オブジェクトのコピー
    else:
        push(poisonStack)                                     // :937
```

- **`tryApplyPoison` 内のスタック上限判定（`combatEffects.ts:132-135`）を通過した後で複数積むため、
  `poisonMultiStack` は上限 `basePoisonMaxStacks + poisonMaxStacks` を超過できる**。仕様かバグかは ★要判断
  → **決定（P1）**: PvE の挙動をそのまま両側化する（超過を許す）。式を変えない原則を優先。§10 D-11
- `poisonStackAccumulator` は非整数（0.5 が残る）。決定性は保たれるが浮動小数を state に持つ点に注意
- **PvP両側化必要**

### I. 発火の伝染 `igniteSpread` — PvPでは無効

分岐箇所は3つ。**すべて `battleEngine.ts` の外**にある:

| 行 | 内容 |
|---|---|
| `core/gaugeBattle.ts:244` | `initialIgniteForThisBattle = playerMods.igniteSpread ? spreadIgniteState : null` |
| `core/gaugeBattle.ts:284-294` | 勝利後、`igniteSpread && finalIgniteState` なら `lastTickMs: 0` で次戦へ持ち越し |
| `core/battleEngine.ts:69, 275, 294-305` | `config.initialIgniteState` を `state.enemyIgniteState` に設定し `ignite_spread` イベント発行 |

→ **PvP エンジンは `gaugeBattle.ts` を一切呼ばない**ので、`igniteSpread` は自動的に何もしない。
明示的な分岐を書く必要はない（＝設計書 §3.4(b) の「死に効果として許容」がそのまま成立）。

### J. 自動解除 / 各種耐性

| # | 行 | 式 | 参照 mods | 参照 state | PvP |
|---|---|---|---|---|---|
| J1 | `:444-465` 永久凍土 | `intervalTicks = ceil(autoCleanseIntervalMs/1000 * tps)`<br>`lastCleanse===null \|\| elapsed - lastCleanse >= intervalTicks`<br>かつ **毒/チル/フリーズのいずれかを持っているときだけ**発動し `playerLastAutoCleanseTick` を更新<br>→ `playerPoisonStacks=[]`, `playerChillState=null`, `playerFreezeState=null` | `autoCleanseIntervalMs` | `playerLastAutoCleanseTick` | **両側化必要**。PvPで発火両側化するなら発火も消すか ★要判断 → **決定: 発火も解除する**（`autoCleanseCleansesIgnite: true`）。§10 D-5 |
| J2 | `:1076-1081` フリーズ耐性(ボス由来) | `resisted = freezeResistPct>0 && rng()*100 < min(90, freezeResistPct)`（**ロール型**） | `freezeResistPct` | — | 両側化。判定形式を J4 と統一するか ★要判断 → **決定: J4/J5 の確率減算型に統一**（`statusResistMode: 'chanceReduction'`）。§10 D-3 |
| J3 | `:977-986` 敵フリーズ耐性 | `resisted = bossEffects.enemyFreezeResistPct>0 && rng()*100 < resistPct`（**ロール型**）。成功時は `enemyChillState=null` + `pendingEnemyChillAfterFreeze` 設定 + `goblinSlamCounter=0` | — | bossEffects部分は捨て、`freezeResistPct` に差し替え |
| J4 | `:1240-1241` クラーケンのフリーズ付与 | `rng()*100 < chance * (1 - min(90,max(0,freezeResistPct))/100)`（**確率減算型**） | `freezeResistPct` | — | 敵専用。ただし**耐性の適用形式が J2 と違う**点は PvP 設計時に統一必須 |
| J5 | `:1254-1255` クラーケンのチル付与 | `rng()*100 < chance * (1 - min(90,max(0,chillResistPct))/100)` | `chillResistPct` | — | 敵専用。`chillResistPct` は PvP で**新規に配線が必要**（`tryApplyChill` に耐性引数が無い） |
| J6 | `:1064-1065` 毒耐性(付与時) | `resisted = poisonResistPct>0 && rng()*100 < min(90, poisonResistPct)` | `poisonResistPct` | — | **敵の毒付与専用**。PvP では J7 と二重適用になるので ★要判断 → **決定: ダメージ軽減のみ**（`poisonResistAppliesTo: 'damage'`）。付与ロールはしない。§10 D-4 |
| J7 | `:1098-1100` 毒耐性(ダメージ時) | `reducedPoisonDamage = floor(poisonDamage * (1 - min(90,max(0,poisonResistPct))/100))` | `poisonResistPct` | `playerPoisonStacks` | **両側化必要** |

> **重要**: `chillResistPct` / `freezeResistPct` は `combatEffects.tryApplyChill` / `tryApplyFreeze` の
> **引数に無い**。現行はボス側の付与ロジックにのみ手書きで入っている。
> PvP で「相手が自分にチル/フリーズを撃つ」を実装するには、
> **防御側の `chillResistPct` / `freezeResistPct` を通す新しい配線が必須**。
> 設計書 §3.4(b) が「カウンターは既に存在する」としているのは J4/J5 形式（確率減算型）の想定。
> こちらの方が J2 のロール型より RNG 消費が1回少なく決定性検証が楽なので、**確率減算型に統一を推奨**。

### K. その他インライン

| # | 行 | 内容 | 参照 | PvP |
|---|---|---|---|---|
| K1 | `:707-711` | `chillFreezeMult`: `chillFreezeDamageMult>1 && (相手がチルorフリーズ)` → 倍率適用 | `chillFreezeDamageMult` | 両側化 |
| K2 | `:1175-1185` | 反撃: 被ダメ(HP+シールド)>0 → `floor(effectivePlayerDef * retaliateDefPct/100)` を相手HPから直接減算（**DEF減衰・シールド・命中を無視**） | `retaliateDefPct` | 両側化 |
| K3 | `:845-860` | ライフスティール: `!hpToShield && !heavyStrike && scaledMainDamage>0 && currentHp<maxHp`。追撃分は対象外 | `hpOnHit`,`lifestealPct`,`hpOnCrit` (`combatEffects.ts:449-470`) | 両側化 |
| K4 | `:876-921` | `hpOnHit` 追加発動3種（クリ追撃 / Uber追撃 / 双撃追撃）。それぞれ `floor(hpOnHit * playerHealingMult)` | `hpOnHit` | 両側化（`playerHealingMult` は 1 固定に） |
| K5 | `:863-873` | `critLifestealPct`: `floor(totalDamage * pct/100 * playerHealingMult)` | `critLifestealPct` | 両側化 |
| K6 | `:597-646` | 発火の敵耐性スケール `enemyIgniteDamageMult` とイベント値の書き換え（`:614-619`） | — | 敵専用。PvPでは `igniteResistPct` に差し替えるか ★要判断 → **決定: 差し替えて有効化**（`igniteResistEnabled: true`、毒と同形の軽減）。§10 D-6 |
| K7 | `:722-737` | イベント `data.damage` を「値が一致するもの」で探して差し替える実装。**同一ダメージ値だと誤爆する** | — | PvP では index で書くこと |
| K8 | `:944-964` | 発火の `lastTickMs` 継承: `existingLastTickMs ?? finalIgniteState.lastTickMs` | — | 両側化 |
| K9 | `:929-935`,`:934` | 毒スタックの `{...poisonResult.poisonStack}` コピー（参照共有回避） | — | 同様に |

### L. 除外リスト（敵側固有。PvP に持ち込まない）

| 行 | 内容 |
|---|---|
| `core/bossBehaviors.ts` 全体 (`:1-439`) | `BossEffectState`(37フィールド `:29-67`) / `createBossIntroEvents` `:132-208` / `applyEnemyHpThresholdEffects` `:210-263` / `applyPlayerAttackPostEffects` `:265-303` / `applyEnemyAttackPreEffects` `:305-425` / `applyEnemyAttackPostEffects` `:427-439` |
| `battleEngine.ts:231, 236-247` | `isEndContentDungeon` によるプレイヤー/敵の ATK/DEF/AS 倍率 |
| `:307-327` | ボス intro イベント・初期毒・`initBossEffects` |
| `:364-368` | `enemyDamageReductionBase` / `enemyRegenBase` / `enemyHpOnHitBase` |
| `:568-594` | 敵HP自動回復（`demon_crown` で2倍） |
| `:597-646` の `enemyIgniteDamageMult` 部分 | 敵の発火耐性 |
| `:689-690` | `bossEffects.playerCritChanceMult` / `playerPoisonChanceMult` |
| `:693-695` | `enemyDamageReductionTempPct` / `enemyDamageReductionStackPct` |
| `:984` | `bossEffects.goblinSlamCounter = 0` |
| `:990-1002` | `demon_mark` 反射 5% |
| `:1015-1039` | `applyEnemyHpThresholdEffects` / `applyPlayerAttackPostEffects` |
| `:1051-1091` | ボス pre effects（毒付与 / `cleansePoisonIgnite` / フリーズ / `resetPlayerGauge`） |
| `:1134-1141` | `getEnemyEnrageAtkMult`（滅びの刻限）/ `enemyAttackMult` / `enemyNextAttackMult` / `playerDamageTakenMult` ※サドンデスは PvP 独自に再実装 |
| `:1202-1234` | 触手乱打 |
| `:1237-1271` | 敵によるチル/フリーズ付与 ※式は J4/J5 として PvP に流用 |
| `:1274-1309` | 盗賊の頭の追撃 |
| `:1311-1343` | 敵 hpOnHit / `vampire_night_feast` / `vampirePact` |
| `:1377` | `applyEnemyAttackPostEffects` |
| `core/endContent.ts:165-251` | 全ボス倍率関数・`DEMON_LORD_ENRAGE` |
| `core/endContent.ts:1-22, 156-163` | `getBossSkillName` の `require('@/lib/i18n')`（§6-F） |
| `core/gaugeBattle.ts:207-332` | `runGaugeDungeon`（伝染・フロア遷移） |
| `battleEngine.ts:77, 352-354, 486, 651, 1049` | `isTransitioning`（フロア遷移用。PvPでは不要） |

---

## 4. `CombinedModEffects` 全73フィールド分類

> 設計書は「72」としているが実測73（`core/types.ts:205-305`）。
> 「両側」= そのまま両側で機能させる / 「合成時消費」= エンジンではなくビルド合成段で消費済み /
> 「死に効果」= PvP で意味を持たない / 「要判断」= 実装方針の決定が必要。

| # | 行 | フィールド | 分類 | 根拠・備考 |
|---|---|---|---|---|
| 1 | 205 | `hpRegen` | 両側 | `:498` `combatEffects.ts:414` |
| 2 | 206 | `hpRegenPct` | 両側 | `combatEffects.ts:415`。`:384` でも参照 |
| 3 | 209 | `poisonChance` | 両側 | `combatEffects.ts:138` |
| 4 | 210 | `poisonDamagePct` | 両側 | `modEffects.ts:572` |
| 5 | 211 | `poisonDamageMorePct` | 両側 | 同上 |
| 6 | 212 | `poisonMaxStacks` | 両側 | `combatEffects.ts:132` |
| 7 | 213 | `poisonDamageReduction` | 両側 | `combatEffects.ts:511-513`。**相手が毒状態のとき自分の被ダメが減る**＝両側で意味あり |
| 8 | 214 | `poisonLifesteal` | 両側 | `combatEffects.ts:200-202` + `:662-672` |
| 9 | 215 | `noDirectDamage` | 両側 | `combatEffects.ts:64`, `:743,769,784` |
| 10 | 218 | `igniteChance` | 両側 | `combatEffects.ts:265`。**`igniteState` 両側化が前提** |
| 11 | 219 | `igniteDamagePct` | 両側 | `modEffects.ts:621` |
| 12 | 220 | `igniteDamageMorePct` | 両側 | `modEffects.ts:622` |
| 13 | 221 | `igniteDurationPct` | 両側 | `combatEffects.ts:276` |
| 14 | 222 | `igniteTickSpeedPct` | 両側 | `combatEffects.ts:283` |
| 15 | 223 | `igniteLifesteal` | 両側 | `combatEffects.ts:371-373` + `:623-630` |
| 16 | 224 | `igniteDamageReduction` | 両側 | `combatEffects.ts:514-516` |
| 17 | 225 | `igniteSpread` | **死に効果** | `gaugeBattle.ts:244,284`。PvPは1対1で伝染先が無い。設計書 §3.4(b) で許容済み |
| 18 | 226 | `igniteStackingDamage` | 両側 | `modEffects.ts:616-619`。`igniteApplyCount`(`:947`)の両側化が必要 |
| 19 | 229 | `criticalChance` | 両側 | `combatEffects.ts:55` |
| 20 | 230 | `criticalDamage` | 両側 | `combatEffects.ts:57` |
| 21 | 231 | `hpOnCrit` | 両側 | `combatEffects.ts:465-467` |
| 22 | 232 | `critLifestealPct` | 両側 | `:863-873` インライン |
| 23 | 233 | `criticalFollowUpAttack` | 両側 | `combatEffects.ts:87-98` |
| 24 | 234 | `followUpAttackPct` | 両側 | `:768-779` インライン（設計書 §3.4(d) 対象） |
| 25 | 235 | `kingSlam` | 両側 | `:782-796` インライン（同上） |
| 26 | 236 | `royalRoar` | 両側 | `:799-811` インライン（同上）。発火解除は要判断 |
| 27 | 239 | `damageDeferPct` | 両側 | `:1146-1159` + `:533-564`。`deferredDamages` 両側化必要 |
| 28 | 240 | `damageReductionPct` | 両側 | `combatEffects.ts:508` |
| 29 | 241 | `evasion` | 両側 | `combatEffects.ts:521-534`。設計書 §3.4(a) で `playerAccuracy=500` 付与 |
| 30 | 242 | `evasionIncreasedPct` | **合成時消費** | `modEffects.ts:477-482` で `evasion` に畳み込み済み。エンジンからは読まれない |
| 31 | 243 | `evasionMorePct` | **合成時消費** | 同上 |
| 32 | 244 | `shieldOnEvadeStreakHitPct` | 両側 | `:194-211`。`consecutiveEvades` + `maxShield` 両側化必要 |
| 33 | 245 | `hpOnTakenHit` | 両側 | `:183-192` |
| 34 | 246 | `hpOnHit` | 両側 | `combatEffects.ts:457` + `:876,892,908`。`warlordEnrage` が +300 する |
| 35 | 247 | `lifestealPct` | 両側 | `combatEffects.ts:460-462`。ペットバフ由来（`petEffects.ts:24`） |
| 36 | 248 | `retaliateDefPct` | 両側 | `:1175-1185`。DEF減衰・シールド・命中を無視する直接ダメージ |
| 37 | 251 | `shield` | 両側 | `modEffects.ts:529` |
| 38 | 252 | `shieldIncreasedPct` | 両側 | `modEffects.ts:530` |
| 39 | 253 | `shieldMorePct` | 両側 | `modEffects.ts:531-532` |
| 40 | 254 | `hpToShield` | 両側 | `modEffects.ts:528,535` + **回復8箇所のキルスイッチ**（§3-A の注） |
| 41 | 255 | `shieldOn10AttacksPct` | 両側 | `:756-765` |
| 42 | 256 | `shieldRechargeDelayMs` | 両側 | `:520-524` |
| 43 | 257 | `shieldRechargePct` | 両側 | `:516,528` |
| 44 | 258 | `shieldBlocksDot` | 両側 | `:546, 1106` |
| 45 | 261 | `petEffectPct` | **合成時消費 / 死に効果** | エンジン未参照。`hooks/useBattle.ts:873` / `tools/build-explorer/simBuild.ts` の合成段で消費。PvPは合成済み `mods` をスナップショットするので不要 |
| 46 | 262 | `petDropRatePct` | **死に効果** | ドロップ専用。戦闘に一切影響しない |
| 47 | 265 | `blockChance` | 両側 | `:105-108`（`min(50,…)`） |
| 48 | 266 | `chillResistPct` | **要判断** | 現行は敵のチル付与（`:1255`）でのみ使用。`tryApplyChill` に耐性引数が無い ＝ **PvPで新規配線必須**（§3-J） |
| 49 | 267 | `freezeResistPct` | **要判断** | `:1077`(ロール型) と `:1241`(確率減算型) で**適用形式が2種混在**。PvPでどちらに統一するか決める必要 |
| 50 | 268 | `poisonResistPct` | **要判断** | `:1065`(付与ロール) と `:1099`(ダメージ軽減) の**二重適用**。PvPで両方残すか片方にするか決める |
| 51 | 269 | `repeatHitDamageReductionPct` | 両側 | `:122-130`。`playerLastHitDamageTick` 両側化必要 |
| 52 | 270 | `lowHpDamageReductionPct` | 両側 | `:132-138` |
| 53 | 271 | `autoCleanseIntervalMs` | 両側 | `:444-465`。`playerLastAutoCleanseTick` 両側化必要 |
| 54 | 274 | `hpRegenToAtkPct` | 両側 | `:382-386` |
| 55 | 277 | `attackSpeedPct` | 両側 | `modEffects.ts:521`。**`warlordEnrage` が `:1353` で破壊的に +20 する** |
| 56 | 278 | `attackSpeedMorePct` | 両側 | 同上 |
| 57 | 281 | `chillChance` | 両側 | `combatEffects.ts:571` |
| 58 | 282 | `chillEffectPct` | 両側 | `combatEffects.ts:576-580, 687-691` |
| 59 | 283 | `chillDurationPct` | 両側 | `combatEffects.ts:583-585, 692-694` |
| 60 | 286 | `freezeChance` | 両側 | `combatEffects.ts:669-673` |
| 61 | 287 | `freezeDurationPct` | 両側 | `combatEffects.ts:678-680` |
| 62 | 288 | `freezeChanceCapPct` | 両側 | `combatEffects.ts:671`。ペットバフ由来 |
| 63 | 291 | `heavyStrike` | 両側 | `:244,715,814,826,845,1188,1358`（7箇所） |
| 64 | 292 | `defHpToAtk` | **合成時消費** | エンジン未参照。`stores/usePlayerStore.ts:605` で `atk += def + floor(maxHp/2)` としてステータスに畳み込む。PvPはスナップショットの `atk` に含める |
| 65 | 293 | `uberCriticalFollowUp` | 両側 | `:743-752` |
| 66 | 294 | `poisonMultiStack` | 両側 | `:927-935`。`poisonStackAccumulator` 両側化必要 |
| 67 | 295 | `igniteIntensify` | 両側 | `:950-956` |
| 68 | 296 | `chillFreezeDamageMult` | 両側 | `:708-711` |
| 69 | 297 | `igniteResistPct` | **死に効果（現行バグ）** | `modEffects.ts:183,259-261` で合成されるが **`core/` のどこからも読まれていない**。PvPで発火が両側化して初めて意味を持てる。「実装する / 放置する」を ★要判断 → **決定: 実装する**。§10 D-6 |
| 70 | 300 | `timeAtkIncPct` | 両側 | `:377` |
| 71 | 301 | `timeDefIncPct` | 両側 | `:378` |
| 72 | 302 | `timeHpRegen` | 両側 | `:379, 495-497` |
| 73 | 305 | `warlordEnrage` | 両側 | `:1346-1364`。判定タイミングを P1 に移すことを推奨（§2.3-5） |

**集計**: 両側=61 / 合成時消費=4 (#30,#31,#45,#64) / 死に効果=3 (#17,#46,#69) / 要判断=3 (#48,#49,#50)
※ #45 は合成時消費かつ PvP では死に効果なので二重計上。

---

## 5. RNG 呼び出し箇所（全12箇所）

### 5.1 一覧

| # | 場所 | 用途 | 条件（短絡） |
|---|---|---|---|
| R1 | `battleEngine.ts:107`（`rollPlayerBlock`） | ブロック判定 | `blockChance > 0` |
| R2 | `combatEffects.ts:55`（`executePlayerAttack`） | クリティカル判定 | `mods.criticalChance > 0` |
| R3 | `combatEffects.ts:138`（`tryApplyPoison`） | 毒付与判定 | スタック上限未満 かつ `poisonChance > 0` |
| R4 | `combatEffects.ts:265`（`tryApplyIgnite`） | 発火付与判定 | `igniteChance > 0` |
| R5 | `combatEffects.ts:571`（`tryApplyChill`） | チル付与判定 | `chillChance > 0` |
| R6 | `combatEffects.ts:673`（`tryApplyFreeze`） | フリーズ付与判定 | 未フリーズ かつ `effectiveChance > 0` |
| R7 | `combatEffects.ts:533`（`rollEnemyHit`） | 命中判定 | 無条件 |
| R8 | `battleEngine.ts:978` | 敵フリーズ耐性 | `bossEffects.enemyFreezeResistPct > 0` |
| R9 | `battleEngine.ts:1065` | ボス毒付与への耐性 | `poisonResistPct > 0` |
| R10 | `battleEngine.ts:1077` | ボスフリーズへの耐性 | `freezeResistPct > 0` |
| R11 | `battleEngine.ts:1240` | クラーケンのフリーズ付与 | `enemyAttackPlayerFreezeChance > 0` |
| R12 | `battleEngine.ts:1254` | クラーケンのチル付与 | `enemyAttackPlayerChillChance > 0` |

呼び出し元:
- R1 は `applyPlayerDamage:118`（`options.hit && options.blocked===undefined` のときのみ）と `:1143`, `:1207`, `:1283` から
- R7 は `:1142`, `:1206`, `:1282` から

### 5.2 決定的なRNG消費順を定義するうえでの最重要事項

**すべての判定が MOD 値でショートサーキットする**（`chance > 0` の左辺評価で `rng()` に到達しない）。
つまり**消費本数がビルドに依存する**。

→ **単一ストリームを両側で共有すると、相手のビルドが自分のロール結果を変える。**
これは決定性そのものは壊さないが（再現はできる）、
「相手のパッシブ構成を変えると自分のクリが変わる」という不健全な結合が生まれ、
P2 の総当たり分析（67,528試合）で相性を誤読する原因になる。

**推奨: 側ごとに独立したRNGストリームを持たせる。**

```ts
// seed から2本を導出（HMAC でも xorshift の2段派生でもよい）
side[0].rng = createRng(hash(seed, 0));
side[1].rng = createRng(hash(seed, 1));
// 行動順のコイントスは第3のストリーム
const orderRng = createRng(hash(seed, 2));
```

さらに**堅くする案（推奨度: 中）**: 用途ごとにサブストリームを分ける
（`rngCrit` / `rngPoison` / `rngIgnite` / `rngChill` / `rngFreeze` / `rngHit` / `rngBlock`）。
こうすると「クリ率だけ変えた検証」でも他の系列が動かず、P2 のバランス分析が読みやすくなる。

### 5.3 PvP での1行動あたりの消費順（推奨・両側独立ストリーム前提）

**攻撃側 `attacker` のストリーム**
```
1. R2  クリティカル判定            （criticalChance > 0 のとき）
2. R3  毒付与判定                  （相手のスタックが上限未満 かつ poisonChance > 0）
3. R4  発火付与判定                （igniteChance > 0）
4. R5  チル付与判定                （chillChance > 0）
5. R6  フリーズ付与判定            （相手が未フリーズ かつ effectiveChance > 0）
```
**防御側 `defender` のストリーム**
```
a. R7  命中判定                    （必ず1本消費）  ※防御側の evasion を使うので防御側ストリーム
b. R1  ブロック判定                （命中時 かつ blockChance > 0）
c. R5' チル耐性ロール              （§3-J で確率減算型に統一するなら不要 = 0本）
d. R6' フリーズ耐性ロール          （同上）
```

> **命中とブロックを防御側ストリームに置く根拠**: どちらも防御側のステータス（`evasion` / `blockChance`）で
> 決まる判定であり、防御側ストリームに置くと「攻撃側のビルド変更が回避結果を動かさない」。
> ★この割り当ては設計判断なので、実装時に `docs` にも明記して固定すること。
> → **決定（P1）: この割り当てを採用**。攻撃側ストリーム = クリ→毒→発火→チル→フリーズ、
> 防御側ストリーム = 命中→ブロック。耐性は確率減算型なので耐性ロールは0本。§10 D-2

現行 PvE（`battleEngine.ts`）の実際の消費順は
プレイヤー行動: `R2 → R3 → R4 → R5 → (R6 → R8)`、
敵行動: `(R9) → (R10) → R7 → R1 → …` である。**PvP は PvE と同順である必要はない**
（別エンジンなので）が、`pvpEngine.ts` 内で1つに固定し、`rulesetVersion` に紐づけること。

---

## 6. 決定性リスク（`core/` 内で再現性を壊しうる箇所）

### A. `Math.pow` — ★最優先。設計書の前提が誤っている

```
core/battleEngine.ts:716
  woundMult = Math.pow(1.2, engine.state.enemyWoundStacks);
```

`Math.pow` は **ECMA-262 で implementation-approximated**（実装依存の近似が許されている）。
Hermes（端末）と Node V8（審判）で最終ビットが一致する保証がない。
設計書 §4.1 の「`Math.pow` / `**` が一切使われていない」は事実に反する。

**対処**: `enemyWoundStacks` は 0〜5 の整数（`:815` で上限5）なので、
反復乗算に置き換える。
```ts
let m = 1; for (let i = 0; i < stacks; i++) m *= 1.2;
```
★定数テーブル（`1.728` リテラル等）は反復乗算と最終ビットが一致するとは限らない。
反復乗算に統一し、テーブル化しないことを推奨。

その他の `Math.pow`:
- `core/player.ts:84` `Math.floor(100 * Math.pow(level, 1.8))` — EXP計算。戦闘外だが
  **PvP のビルド検証（§6.3 のレベル→パッシブポイント上限）で審判が使う**ため、
  端末と審判で不一致が起きると正当なビルドを弾く可能性がある ★要検証

### B. `Date` 依存

```
core/simulation.ts:63    const seed = initialSeed ?? config.seed ?? Date.now();
core/simulation.ts:166   const seed = config.seed ?? Date.now();
core/simulation.ts:351   （同上）
core/simulation.ts:414   （同上）
```
PvP エンジンは `core/simulation.ts` を使わない。ただし
**`pvpEngine.ts` の `rng` は `?? Math.random` のようなフォールバックを持たせず、必須引数にする**こと。
現行 `battleEngine.ts:230` は `config.rng ?? Math.random` になっており、渡し忘れが静かに非決定になる。

`core/` の他ファイルに `Date` / `Date.now()` / `performance.now()` は無い。

### C. `Math.random` 直接使用

| 場所 | 内容 |
|---|---|
| `core/battleEngine.ts:230` | `config.rng ?? Math.random`（フォールバック） |
| `core/combatEffects.ts:49,129,262,569,661` | 引数の既定値 `rng: () => number = Math.random` |
| `core/battle.ts:285`, `core/gaugeBattle.ts:168,215` | 同上 |
| `core/equipmentSets.ts` | ドロップ生成。戦闘に無関係（設計書 §4.1 の注記どおり） |

→ **PvP では既定値を置かない**。TypeScript で必須にすれば渡し忘れがコンパイルエラーになる。

### D. 入力オブジェクトの破壊的変更 — ★重大

```
core/battleEngine.ts:1352-1358
  engine.state.warlordEnrageActivated = true;
  engine.playerMods.attackSpeedPct += 20;      // ← 呼び出し元の mods オブジェクトを直接変更
  engine.playerMods.hpOnHit += 300;            // ← 同上
  engine.playerAttackSpeedBase = getAttackSpeedFromMods(engine.playerMods) * …
```

`engine.playerMods` は `createBattleEngine` に渡された参照そのもの（`:334`）。
`hooks/useBattle.ts:836-878` の `useMemo` が返すオブジェクトなので、
**同じ mods で2回戦うと2回目は `attackSpeedPct` が +20 された状態から始まる。**
PvE でも潜在バグ（フロア遷移で毎回 `createBattleEngine` するが mods は同一参照）。

**PvP では必ず side ごとに mods をディープコピーしてから戦闘に入る。**
配列フィールド（`poisonDamageMorePct` / `igniteDamageMorePct` / `shieldMorePct` /
`attackSpeedMorePct` / `evasionMorePct`）もコピーが必要なので浅いスプレッドでは不十分。

同様の変異: `:325` `Object.assign(bossEffects, intro.initBossEffects)`（PvPでは不使用）。

### E. 浮動小数の蓄積

決定的（IEEE754で規定される四則演算のみ）だが、値そのものは非整数になる:

| 値 | 場所 | 備考 |
|---|---|---|
| `gauge` | `:487-488` | `6.6666…` を毎ティック加算。長時間戦闘で丸め誤差が蓄積 |
| `remainingMs` | `combatEffects.ts:350,621,731` | `deltaMs = 1000/30 = 33.333…` を減算 |
| `poisonStackAccumulator` | `:929-932` | `1.5` 刻み |
| `speedMultiplier` | `combatEffects.ts:576-580` | `0.8 - x*0.2` |
| `attackSpeed` | `modEffects.ts:507-514` | inc/more の積 |

**同一の演算順序であればビット単位で一致する**ので、リプレイ検証には影響しない。
ただし **PvP エンジンでは加算順序を絶対に変えない**。
→ §2.3 の P4（ゲージ加算）は必ず固定順 `[0,1]` にする。

### F. オブジェクトキー順・環境依存

| 場所 | 内容 | 影響 |
|---|---|---|
| `core/endContent.ts:81,101,112` | `Object.entries` / `Object.fromEntries` によるマップ生成 | 全て文字列キーなので挿入順で決定的。**問題なし**。PvPでは不使用 |
| `core/endContent.ts:10-22, 156-163` | `getBossSkillName` が `require('@/lib/i18n')` を lazy load し、失敗時 `null` | **端末と Node で結果が違う**（イベントの表示文字列のみ）。PvPでは呼ばない |
| `core/modEffects.ts:393-402` | `for (const item of equipment)` / `for (const mod of item.mods)` | **配列順序に依存**。同じ MOD 集合でも順序が違うと `poisonDamageMorePct` などの配列順が変わる。値の合計は同じなので結果は変わらないが、**ビルドスナップショットの正規化（装備スロット順・MOD順の固定）を §6.4 の圧縮形式で規定すること** ★重要 |

### G. `NaN` / `Infinity` の可能性

| 場所 | 条件 | 対処 |
|---|---|---|
| `core/battle.ts:99` `def / (def + 500)` | `def === -500` で `0/0 = NaN`、`def < -500` で符号反転 | 現行は `:255` `Math.max(0, …)` で `def >= 0` が保証される。**PvP でも `def = max(0, …)` を必ず通す** |
| `modEffects.ts:514` `Math.max(0.1, result)` | `result` が `NaN` なら `Math.max` は `NaN` を返す | ビルド検証で `attackSpeedPct` / `attackSpeedMorePct` に `undefined` / 非数が入らないことを保証 |
| `combatEffects.ts:524` `accuracy/(accuracy+evasion)` | `accuracy >= 1` (`:522`)、`evasion >= 0` (`:523`) が保証済み | 問題なし |
| `combatEffects.ts:283` `igniteTickIntervalMs/(1+pct/100)` | `igniteTickSpeedPct === -100` で `0除算 → Infinity` | 負値MODは存在しないが、**改造ビルド対策として審判側で MOD 値の範囲チェック必須**（設計書 §6.3-1） |
| `:716` `Math.pow(1.2, stacks)` | `stacks` が `NaN` なら `NaN` が全ダメージに伝播 | §6-A の置換で解消 |
| `core/simulation.ts:32-40` `createRng` | **`seed === 0` だと xorshift が全て0を返し、`rng()` が永久に 0 を返す** | → **決定: 両方やる**。`assertValidPvpSeed()` が seed=0 を例外で弾き、派生シードは `\| 1` で必ず奇数にする（`core/pvp/rng.ts`）。§10 D-1 |

### H. `Math.floor` の適用点

ダメージは `calculateDamage`（`battle.ts:102`）で `Math.floor` され整数になるが、
その後 `:722-723` で `Math.floor(damage * combinedMult)` と**二重に floor される**。
設計書 §3.3 の `damageScale` を ATK 側に掛ける方式にすると floor の適用点が1つ増える。
**`pvpEngine.ts` 内で `damageScale` を掛ける位置を1箇所に固定**すること
（推奨: 各 combatant の `effectiveAtk` を算出する P1 フェーズで一度だけ掛ける）。

---

## 7. `PvpCombatant` に持たせるべき state（両側化必須リスト）

設計書 §3.1 の定義に、本調査で見つかった不足分を追加したもの。

```ts
interface PvpCombatant {
  // 素の戦闘力（スナップショット由来、defHpToAtk は atk に畳み込み済み）
  currentHp: number; maxHp: number; atk: number; def: number;
  attackSpeed: number;      // getAttackSpeedFromMods() * (heavyStrike ? 0.8 : 1)
  accuracy: number;         // ruleset.playerAccuracy (=500)
  gauge: number;
  mods: CombinedModEffects; // ★必ずディープコピー（配列5本も）

  // シールド
  shield: number; maxShield: number;
  lastShieldDamageTick: number | null;   // ← 設計書に無い
  lastHitDamageTick: number | null;      // ← 設計書に無い（repeatHitDamageReductionPct 用）
  lastAutoCleanseTick: number | null;    // ← 設計書に無い（永久凍土用）

  // 自分に乗っている状態
  poisonStacks: PoisonStack[];
  igniteState: IgniteState | null;
  chillState: ChillState | null;
  freezeState: FreezeState | null;
  pendingChillAfterFreeze: ChillState | null;  // ← 設計書に無い（現行はエンジンローカル）
  woundStacks: number;
  woundActionCounter: number;            // ← 設計書に無い

  // カウンタ
  attackCount: number;
  consecutiveEvades: number;
  igniteApplyCount: number;              // ← 設計書に無い（igniteStackingDamage 用）
  poisonStackAccumulator: number;        // ← 設計書に無い（poisonMultiStack 用）
  deferredDamages: DeferredDamage[];
  regenCounter: number;                  // ← 設計書に無い（1秒周期の位相）
  warlordEnrageActivated: boolean;       // ← 設計書に無い

  // RNG
  rng: () => number;                     // 側ごと独立ストリーム（§5.2）
}
```

`regenCounter` は現行 `battleEngine.ts:89,492-494` にありエンジンローカル。
両側で同じ位相（毎ティック +1、`>= 30` で消化）なので実質共通だが、
**明示的に側ごとに持たせて `for (const s of [0,1])` で回す**方が対称性の検査が楽。

---

## 8. `PvpRuleset` に追加を提案するフィールド

設計書 §3.5 の定義に加えて、本調査で判断が必要と判明したもの:

```ts
interface PvpRuleset {
  version: number;
  damageScale: number;              // 0.15
  playerAccuracy: number;           // 500
  suddenDeathStartSec: number;      // 45
  suddenDeathRampPctPerSec: number; // 5
  timeLimitSec: number;             // 90

  // ↓ 本調査で追加が必要と判明したもの
  statusResistMode: 'roll' | 'chanceReduction';  // §3-J。'chanceReduction' 推奨
  statusResistCapPct: number;                    // 90（現行の min(90, …) を外出し）
  poisonResistAppliesTo: 'apply' | 'damage' | 'both';  // §4 #50
  igniteResistEnabled: boolean;                  // §4 #69 の死に効果を生かすか
  royalRoarCleansesIgnite: boolean;              // §3-D3
  autoCleanseCleansesIgnite: boolean;            // §3-J1
  warlordEnrageCheckPhase: 'tick' | 'onDefend';  // §2.3-5
  maxActionsPerTick: number;                     // 5（現行ハードコード :651, :1049）
  maxTicks: number;                              // 現行 30000（gaugeBattle.ts:172）
}
```

> `freezeResistPct` はビルド側の MOD なので `ruleset` には持たせない
> （設計書 §3.5 の `freezeResistPct: 50` はパッシブで積める上限値の説明であり、ルールセット値ではない）★要確認
> → **確認済み（P1）**: `freezeResistPct` は `PvpRuleset` に持たせず、防御側の MOD 値をそのまま使う。
> 上限は `statusResistCapPct`（90）としてルールセットに置いた。

---

## 9. P1 の実装順とテスト

1. **`resolveActionOrder()` と RNG ストリーム分割**を最初に作り、
   「同一 seed で 1000 ティック回して state が完全一致」する決定性テストを先に書く
2. **`applyDamageTo(side, damage, options)`** を作る（`battleEngine.ts:110-157` の対称版）。
   B1〜B5 を全部含める。ここが両側化の中核
3. **`takeAction(attacker, defender)`** を作る。§2.2 の順序をそのまま両側化
4. **状態異常フェーズ（P2/P3/P6）** を両側ループ化
5. **サドンデス**（§2.3 P0 + `bossEffects.playerDamageTakenMult` と同位置に適用）
6. **`Math.pow` の置換**（§6-A）と **mods ディープコピー**（§6-D）を忘れない

**テスト観点**
- 決定性: 同一 `(buildA, buildB, seed, rulesetVersion)` → 同一 `winner` / `elapsedTicks` / 全イベント列
- 対称性: `sides` を入れ替えて seed 由来のコイントスも反転させると、勝者も反転する
- 引き分け: 両者同時HP0 → `winner === 'draw'`
- 時間切れ: `timeLimitSec` 到達 → 残HP割合が高い方、完全同値なら `sides[1]`（防衛側）
- `hpToShield` ビルドで回復8箇所すべてが止まること
- `heavyStrike` ミラーで `woundStacks` が両側に独立して積まれること
- mods 非変異: `warlordEnrage` 発動後に入力 mods オブジェクトが不変であること

**参考にできる既存資産**
- `tests/core/`
- `scripts/verifyBattleEngineConsistency.ts`
- `scripts/pvp/recordGoldenBattleLogs.ts`（P0で追加）
- `tools/build-explorer/simBuild.ts`（`buildToSimInput` `:127-141` が `{playerStats, modEffects}` を返す。
  PvP のビルドスナップショット → `PvpCombatant` 変換にほぼそのまま流用できる）
- `tools/build-explorer/data/builds.json`（実ビルド368件）

---

## 10. P1実装での決定事項（2026-08-21・実装完了）

本メモの ★要判断 / ★要検証 / ★要確認 に対する決定。すべて `core/pvp/ruleset.ts` の
`PVP_RULESET_V1`（`version: 1`）に反映済みで、値は `rulesetVersion` に紐づく。

| # | 項目 | 決定 | 実装箇所 |
|---|---|---|---|
| D-1 | seed=0（§6-G） | `assertValidPvpSeed()` が seed=0・非整数・非有限を**例外で弾く**。加えて派生シードは `\| 1` で必ず奇数にして 0 を構造的に回避 | `core/pvp/rng.ts` |
| D-2 | RNGストリーム割り当て（§5.3） | seed から**3本**を決定的整数演算（splitmix32相当 + `Math.imul`）で派生。攻撃側: クリ→毒→発火→チル→フリーズ / 防御側: 命中→ブロック。耐性ロールは0本（D-3のため） | `core/pvp/rng.ts`, `core/pvpEngine.ts` |
| D-3 | チル/フリーズ耐性（§3-J2/J4/J5, §4 #48/#49） | **確率減算型に統一**（`statusResistMode: 'chanceReduction'`, `statusResistCapPct: 90`）。`core/combat/status.ts` の `tryApplyChill` / `tryApplyFreeze` に**後方互換の省略可能引数**として耐性を追加（既定0＝PvE挙動不変） | `core/combat/status.ts` |
| D-4 | 毒耐性（§4 #50） | **ダメージ軽減のみ**（`poisonResistAppliesTo: 'damage'`）。PvEの付与ロール（J6）との二重適用は持ち込まない | `core/pvpEngine.ts` `takeAction` |
| D-5 | 永久凍土 / 王の咆哮（§3-D3, §3-J1） | **どちらも発火を解除する**（`autoCleanseCleansesIgnite: true`, `royalRoarCleansesIgnite: true`） | `core/pvpEngine.ts` |
| D-6 | `igniteResistPct`（§4 #69, §3-K6） | **有効化**。毒耐性と同形の発火ダメージ軽減として実装（`igniteResistEnabled: true`）。PvEの `enemyIgniteDamageMult` は持ち込まない | `core/pvpEngine.ts` `processIgnitePhase` |
| D-7 | `warlordEnrage`（§2.3-5, §3-D7, §6-D） | **毎ティック両側判定**（`warlordEnrageCheckPhase: 'tick'`、P1フェーズ）。`mods` は側ごとのディープコピーに対してのみ変異させ、**入力オブジェクトは不変**（テストで保証） | `core/pvpEngine.ts` `checkWarlordEnrage` / `clonePvpMods` |
| D-8 | `Math.pow`（§6-A） | `woundMultiplier(stacks)` として**1.2 の反復乗算**に置換。定数テーブルは使わない。静的テストで `Math.pow` / `**` の混入を検出 | `core/pvpEngine.ts`, `tests/core/pvp/determinismGuards.test.ts` |
| D-9 | `damageScale` の適用点（§6-H） | 実効ATK算出（時間バフ後）で**1回だけ** `scaledAtk = effectiveAtk * damageScale`。通常攻撃・クリ追撃・Uber追撃・双撃・king_slam・毒・発火はすべて `scaledAtk` から派生 | `core/pvpEngine.ts` `deriveTimeBuffs` |
| D-10 | 反撃（`retaliateDefPct`, §3-K2） | DEF由来のため設計書 §3.3 の列挙外だが、**「係数は全ダメージに等しく掛ける」の趣旨に合わせて damageScale を掛ける**。ルールセットで切り替え可能（`damageScaleAppliesToRetaliate: true`）。P2で再検討 | `core/pvpEngine.ts` `takeAction` |
| D-11 | `poisonMultiStack` の上限超過（§3-H） | **PvEの挙動をそのまま両側化**（超過を許す）。「式を変えない」原則を優先し、仕様/バグの判断はPvP側では行わない | `core/pvpEngine.ts` `takeAction` |
| D-12 | `igniteSpread`（§3-I） | 明示分岐を書かない。`gaugeBattle.ts` を呼ばないので自然に無効 | — |
| D-13 | イベントの `side` の意味 | **「そのイベントの主体＝状態が変化した側」**。`attack` は攻撃側、それ以外は効果を受けた側。sides入れ替えで `side` が `1-s` に反転するだけになり、対称性テストが機械的に書ける | `core/pvp/types.ts` |
| D-14 | 死亡解決（§2.3-2） | フェーズ末尾でまとめて判定。両者HP0は `'draw'`。ただし**毒で相手が倒れた場合はその行動を中断**（PvEの `break` と同形） | `core/pvpEngine.ts` `resolveDeaths` |
| D-15 | 命中と状態異常付与の関係 | **状態異常の付与は命中判定に依存させない**。ゲートすると防御側の回避が攻撃側ストリームの消費を変え、§5.2 が避けたい結合が復活するため。ライフスティール・重傷付与は「スイングが通った（命中かつ非ブロック）」ときのみ。★P2の検討対象 | `core/pvpEngine.ts` `takeAction` |
| D-16 | 1行動あたりの命中/ブロック | **1行動につき命中1回・ブロック1回**。メイン攻撃と全追撃（クリ追撃/Uber追撃/双撃/king_slam）は1スイングとして合算してから被ダメージ加工（B1〜B5）を1回通す。追撃ごとに `applyDamageTo` を呼ぶと `repeatHitDamageReductionPct` が同一行動内で誤発火するため | `core/pvpEngine.ts` `takeAction` |
| D-17 | サドンデスの適用範囲 | **改訂（2026-08-21）**: 設計書 §3.4(c) は「両者の**被ダメージ倍率**」なので、**全ダメージに適用**する（通常攻撃・追撃・king_slam・反撃・毒・発火・遅延ダメージの消化）。`suddenDeathAppliesToDot: true`、false で初版の「スイングのみ」に戻せる。適用点は各ダメージの最終値に対して `Math.floor(dmg * mult)`（整数維持）。DoTに別係数は設けない。<br>**吸収回復（ライフスティール）には掛けない** — スイングのライフスティールがサドンデス前の値から計算されているのと揃えるため（掛けるとサドンデスの意図と逆に働く）。<br>**遅延ダメージだけ適用点を動かした**: 従来の「遅延分割前」に掛けたまま消化時にも掛けると倍率が2乗になる（90秒で 3.25² ≈ 10.6倍）。そこで**遅延分は素の値でキューに積み、消化する瞬間に掛ける**。倍率1のあいだ（＝45秒まで）は分割結果が1ビットも変わらないことを総当たりの45秒までの分布が完全一致することで確認済み。 | `core/pvpEngine.ts` `applySuddenDeath` / `takeAction` / `processPerSecond` / `processIgnitePhase` |
| D-18 | 発火フェーズの順序非依存化 | 発火は「ダメージは自分・吸収回復は相手」なので側ごと逐次処理だと処理順で結果が変わる。**ダメージ適用パスと回復パスを分離**して順序非依存にした（対称性の担保） | `core/pvpEngine.ts` `processIgnitePhase` |
| D-19 | 発火吸収の回復上限（PvE `:623` の `playerStats.maxHp`） | PvEは圧縮前の `playerStats.maxHp` を上限にしている（`hpToShield` との組み合わせで不整合）。**PvPでは combatant の `maxHp`（圧縮後）を使う**。対称形として正しい方を採る | `core/pvpEngine.ts` `healSide` |
| D-20 | §6-A の `core/player.ts:84` の `Math.pow`（★要検証） | **P1では未対応**。EXP計算は戦闘に影響しないが、P3/P4 の審判側ビルド検証（レベル→パッシブポイント上限）で使うため、**P3着手時に整数演算へ置換するか検証する**（未解決事項） | — |
| D-21 | §6-F のビルドスナップショット正規化（★重要） | **P1では未対応**。`combineMods()` は装備配列・MOD配列の順序に依存して `*MorePct` 配列の順序が変わる。合計値は同じなので戦闘結果は変わらないが、P3のスナップショット圧縮形式で装備スロット順・MOD順を固定する必要がある（未解決事項） | — |
| D-22 | 時間切れの残存割合（初版の欠陥） | **改訂（2026-08-21）**: 初版は `finalHpPct = currentHp / maxHp` だったため、**両者ともシールドで全ダメージを吸収しきってHPが1も減らない**と「完全同値 → 防衛側の不戦勝」になっていた。S3ビルドの38%が `hpToShield` を持つため**全体の8.2%（5,525試合）**が該当し、side0/side1 勝率が 46.9%/53.1% に歪んでいた。→ `finalHpPct = (currentHp + shield) / (maxHp + maxShield)` に変更し、`PvpResult` に `finalShield: [number, number]` を追加。修正後は完全同値が **76試合（0.11%）** まで減り、side0/side1 が 49.80%/50.18% に是正された | `core/pvpEngine.ts` `pvpRemainingPct` / `resolveTimeout` |
| D-23 | 反撃へのサドンデス適用 | 初版は反撃（`retaliateDefPct`）にサドンデス倍率が掛かっていなかった（漏れ）。D-17 の改訂にあわせて掛けるようにした。`suddenDeathAppliesToDot` とは独立で常に適用（反撃はDoTではなく直接ダメージのため） | `core/pvpEngine.ts` `takeAction` |
