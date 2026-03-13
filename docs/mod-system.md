# アイテムMODシステム

## 概要

MOD（モディファイア）は、アイテムに付与される追加効果です。各MODにはTier（1〜10、1が最高）があり、Tierによって値の範囲が決まります。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | MOD関連の型定義 |
| `data/items.ts` | MOD生成ロジック |
| `data/json/mods.json` | MOD設定データ（Tier別値範囲） |
| `data/json/dungeons.json` | ダンジョン別Tier/MOD数設定 |
| `hooks/useBattle.ts` | 戦闘中のMOD効果適用 |
| `stores/usePlayerStore.ts` | 装備MODのステータス計算 |
| `core/battle.ts` | ダメージ計算 |

---

## 1. 型定義

### ModType（types/index.ts）

```typescript
export type ModType =
  | 'atk_bonus'           // ATK+X (フラット)
  | 'def_bonus'           // DEF+X (フラット)
  | 'hp_bonus'            // HP+X (フラット)
  | 'atk_increased_pct'   // ATK +X% (increased)
  | 'def_increased_pct'   // DEF +X% (increased)
  | 'hp_increased_pct'    // HP +X% (increased)
  | 'hp_regen'            // 毎秒HP X回復
  | 'hp_regen_pct'        // 毎秒HP X%回復
  | 'poison_chance'       // 毒付与確率+X%
  | 'critical_chance'     // クリティカル確率+X%
  | 'critical_damage'     // クリティカルダメージ+X%
  | 'damage_reduction_pct' // ダメージ軽減+X%（鎧専用）
  | 'lifesteal';          // ダメージ吸収+X%（武器専用）
```

### ItemMod

```typescript
export interface ItemMod {
  type: ModType;
  value: number;
  tier: number;  // 1〜10（1が最高、10が最低）
}
```

### ModConfig

```typescript
export interface ModConfig {
  type: ModType;
  weight: number;  // 出現確率の重み
  tiers: Record<string, TierValueRange>;  // tier番号 → 値範囲
  slots?: EquipmentSlot[];  // 出現可能なスロット（未指定は全スロット）
}

export interface TierValueRange {
  min: number;
  max: number;
}
```

---

## 2. MODの種類と効果

### ステータス系

| MODタイプ | 効果 | 適用タイミング |
|----------|------|---------------|
| `atk_bonus` | ATK+X | ステータス計算時 |
| `def_bonus` | DEF+X | ステータス計算時 |
| `hp_bonus` | HP+X | ステータス計算時 |
| `atk_increased_pct` | ATK +X% | ステータス計算時 |
| `def_increased_pct` | DEF +X% | ステータス計算時 |
| `hp_increased_pct` | HP +X% | ステータス計算時 |

### 戦闘系

| MODタイプ | 効果 | 適用タイミング |
|----------|------|---------------|
| `hp_regen` | 毎秒HP X回復 | 毎秒 |
| `hp_regen_pct` | 毎秒最大HPのX%回復 | 毎秒 |
| `poison_chance` | 毒付与確率+X% | 攻撃時 |
| `critical_chance` | クリティカル確率+X% | 攻撃時 |
| `critical_damage` | クリティカルダメージ+X% | クリティカル発生時 |
| `damage_reduction_pct` | 被ダメージX%軽減 | 被ダメージ時 |
| `lifesteal` | 与ダメージのX%をHP回復 | 攻撃後 |

### スロット制限

| MODタイプ | 出現スロット |
|----------|-------------|
| `damage_reduction_pct` | armor（鎧）のみ |
| `lifesteal` | weapon（武器）のみ |
| その他 | 全スロット |

---

## 3. Tierシステム

### 概要

- Tier範囲: 10（最低）〜 1（最高）
- 各TierにはMODごとに固定の値範囲が設定
- 隣接Tierと値が重ならない連続した範囲

### MOD設定（data/json/mods.json）

```json
{
  "type": "atk_bonus",
  "weight": 15,
  "tiers": {
    "10": { "min": 1, "max": 5 },
    "9": { "min": 6, "max": 10 },
    "8": { "min": 11, "max": 15 },
    "7": { "min": 16, "max": 20 },
    "6": { "min": 21, "max": 25 },
    "5": { "min": 26, "max": 30 },
    "4": { "min": 31, "max": 35 },
    "3": { "min": 36, "max": 40 },
    "2": { "min": 41, "max": 45 },
    "1": { "min": 46, "max": 50 }
  }
}
```

### Tier別色分け

| Tier | 色 |
|------|-----|
| T1-T2 | 金色 (#FFD700) |
| T3-T4 | 紫 (#9370DB) |
| T5-T6 | 青 (#4169E1) |
| T7-T8 | 緑 (#32CD32) |
| T9-T10 | 灰色 (#AAAAAA) |

### Tier出現ウェイト

各Tierの出現確率は均等ではなく、ウェイト付き確率で決定されます。

**通常時:**

| Tier | Weight | 確率（全Tier時） |
|------|--------|-----------------|
| T1 | 2 | 1.79% |
| T2 | 4 | 3.57% |
| T3 | 8 | 7.14% |
| T4 | 20 | 17.86% |
| T5 | 20 | 17.86% |
| T6 | 18 | 16.07% |
| T7 | 15 | 13.39% |
| T8 | 12 | 10.71% |
| T9 | 8 | 7.14% |
| T10 | 5 | 4.46% |

**ブースト時（1段階シフト方式）:**

広告視聴などでブースト状態になると、通常時の1つ上のTierのウェイトが適用されます。

| Tier | Weight | 確率（全Tier時） | 通常時比 |
|------|--------|-----------------|---------|
| T1 | 4 | 3.60% | 約2倍 |
| T2 | 8 | 7.21% | 約2倍 |
| T3 | 20 | 18.02% | 約2.5倍 |
| T4 | 20 | 18.02% | 変化なし |
| T5 | 18 | 16.22% | やや減少 |
| T6 | 15 | 13.51% | 減少 |
| T7 | 12 | 10.81% | 減少 |
| T8 | 8 | 7.21% | 減少 |
| T9 | 5 | 4.50% | 減少 |
| T10 | 1 | 0.90% | 大幅減少 |

**課金Tierフィルター適用時（T7-T1のみ）:**

| 状態 | T1確率 |
|------|--------|
| 通常 + 課金フィルター | 2.30% |
| ブースト + 課金フィルター | 4.12% |

---

## 4. ダンジョン別設定

### Tier範囲（modTierRange）

ダンジョンが進むほど高Tierが出現可能に。

| ダンジョン | Tier範囲 |
|-----------|---------|
| grassland | T10のみ |
| cave | T10-9 |
| ruins | T10-8 |
| goblin_fort | T10-7 |
| demon_castle | T10-6 |
| ice_cave | T10-5 |
| volcano | T10-4 |
| dark_forest | T10-3 |
| sky_tower | T10-2 |
| hell_gate以降 | T10-1（全Tier） |

### MOD数範囲（modCountRange）

| ダンジョン | MOD数 |
|-----------|-------|
| grassland, cave, ruins | 0-1 |
| goblin_fort, demon_castle, ice_cave | 0-3 |
| volcano, dark_forest, sky_tower | 1-4 |
| hell_gate以降 | 2-4 |

---

## 5. ダメージ計算

### DEF減衰式

```typescript
export function calculateDamage(
  atk: number,
  def: number,
  additionalReduction: number = 0
): number {
  const defReduction = def / (def + 100);
  const totalReduction = Math.min(0.99, defReduction + additionalReduction / 100);
  return Math.max(1, Math.floor(atk * (1 - totalReduction)));
}
```

### DEF軽減率

| DEF | 軽減率 |
|-----|--------|
| 50 | 33% |
| 100 | 50% |
| 200 | 67% |
| 300 | 75% |
| 500 | 83% |

### damage_reduction_pct MODの効果

DEF軽減率に加算される。

例: DEF 50（33%軽減）+ damage_reduction_pct 5% = **38%軽減**

---

## 6. MOD生成ロジック

### generateRandomMods()

```typescript
export function generateRandomMods(
  count: number,
  dungeonId?: string,
  itemSlot?: EquipmentSlot
): ItemMod[]
```

1. ダンジョンのTier範囲を取得
2. スロット制限とTier範囲でMODをフィルタリング
3. 重み付きランダムでMODタイプを選択
4. 有効なTierからウェイト付き確率で選択（T4-T5が出やすい分布）
5. Tierの値範囲内でランダムに値を決定

### createItemInstance()

```typescript
export function createItemInstance(
  itemId: string,
  modCount: number = 0,
  dungeonId?: string
): Item | undefined
```

- 固有MOD（fixedMods）はTier 1として扱う
- ランダムMODはダンジョンとスロットを考慮して生成
- 同一タイプのMODは1つまで（固有MOD優先）

---

## 7. 戦闘中のMOD効果適用

### ターン処理フロー

```
ターン開始
  │
  ├─ 1. HP回復（hp_regen + hp_regen_pct）
  │     totalRegen = flatRegen + (maxHp * pctRegen / 100)
  │
  ├─ 2. 敵の毒ダメージ処理
  │
  ├─ 3. クリティカル判定（critical_chance）
  │     if (random < criticalChance)
  │       damage *= (1 + criticalDamage / 100)
  │
  ├─ 4. プレイヤー攻撃
  │
  ├─ 5. 毒付与判定（poison_chance）
  │
  └─ 6. 敵の攻撃
        damage = calculateDamage(enemyAtk, playerDef, damageReductionPct)
```

---

## 8. UI表示

### MOD説明の取得

```typescript
export function getModDescription(mod: ItemMod): string {
  const tierStr = `[T${mod.tier}] `;
  switch (mod.type) {
    case 'atk_bonus': return tierStr + `ATK+${mod.value}`;
    case 'def_bonus': return tierStr + `DEF+${mod.value}`;
    case 'hp_bonus': return tierStr + `HP+${mod.value}`;
    case 'hp_regen': return tierStr + `毎秒HP${mod.value}回復`;
    case 'hp_regen_pct': return tierStr + `毎秒HP${mod.value}%回復`;
    case 'poison_chance': return tierStr + `毒付与+${mod.value}%`;
    case 'critical_chance': return tierStr + `クリティカル+${mod.value}%`;
    case 'critical_damage': return tierStr + `クリダメ+${mod.value}%`;
    case 'damage_reduction_pct': return tierStr + `ダメージ軽減+${mod.value}%`;
    case 'lifesteal': return tierStr + `ダメージ吸収+${mod.value}%`;
    // ...
  }
}
```

---

## 9. カスタマイズ方法

### 新しいMODタイプを追加する場合

1. `types/index.ts` の `ModType` に追加
2. `data/json/mods.json` にMOD設定を追加
3. `data/items.ts` の `ModEffects` と関連関数を更新
4. `hooks/useBattle.ts` に効果処理を実装
5. 必要に応じて `core/battle.ts` を更新
6. `getModDescription()` に表示文を追加

### スロット制限MODを追加する場合

`mods.json` で `slots` を指定:

```json
{
  "type": "new_mod_type",
  "weight": 5,
  "slots": ["armor", "gloves"],
  "tiers": { ... }
}
```

### MODの出現率を調整する場合

`data/json/mods.json` の `weight` 値を変更

### ダンジョンのMOD設定を調整する場合

`data/json/dungeons.json` の各ダンジョンの:
- `modTierRange`: 出現可能なTier範囲
- `modCountRange`: 付与されるMOD数の範囲
