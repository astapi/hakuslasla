# アイテムMODシステム

## 概要

MOD（モディファイア）は、アイテムに付与される追加効果です。通常のステータス（ATK/DEF）に加え、特殊効果を付与します。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | MOD関連の型定義 |
| `data/items.ts` | MOD生成ロジック |
| `data/json/items.json` | MOD設定データ（modConfigs） |
| `hooks/useBattle.ts` | 戦闘中のMOD効果適用 |
| `stores/usePlayerStore.ts` | 装備MODのステータス計算 |

---

## 1. 型定義

### ModType（types/index.ts:52-57）

```typescript
export type ModType =
  | 'atk_bonus'        // 攻撃力ボーナス
  | 'def_bonus'        // 防御力ボーナス
  | 'hp_regen'         // 毎ターンHP回復
  | 'poison_chance'    // 毒付与確率
  | 'critical_chance'; // クリティカル確率
```

### ItemMod（types/index.ts:60-63）

```typescript
export interface ItemMod {
  type: ModType;
  value: number;
}
```

### ModConfig（types/index.ts:66-71）

```typescript
export interface ModConfig {
  type: ModType;
  minValue: number;  // 最小値
  maxValue: number;  // 最大値
  weight: number;    // 出現確率の重み
}
```

---

## 2. MODの種類と効果

| MODタイプ | 表示 | 効果 | 適用タイミング |
|----------|------|------|---------------|
| `atk_bonus` | ATK+X | 攻撃力に加算 | ステータス計算時 |
| `def_bonus` | DEF+X | 防御力に加算 | ステータス計算時 |
| `hp_regen` | 毎ターンHP X回復 | HPを回復 | ターン開始時 |
| `poison_chance` | 毒付与+X% | 敵に毒を付与 | 攻撃時 |
| `critical_chance` | クリティカル+X% | ダメージ2倍 | 攻撃時 |

### 効果の詳細

#### hp_regen
- ターン開始時にHPを回復
- maxHpを超えない

#### poison_chance
- 攻撃時に確率で毒を付与
- 毒ダメージ = プレイヤーダメージ × 0.5
- 持続ターン: 5ターン
- 敵が既に毒状態の場合は付与されない

#### critical_chance
- 攻撃時に確率でクリティカル発生
- クリティカル時のダメージ倍率: 2倍

---

## 3. MOD設定値

**ファイル**: `data/json/items.json`

```json
"modConfigs": [
  { "type": "atk_bonus",       "minValue": 1,  "maxValue": 5,  "weight": 20 },
  { "type": "def_bonus",       "minValue": 1,  "maxValue": 5,  "weight": 20 },
  { "type": "hp_regen",        "minValue": 1,  "maxValue": 10, "weight": 15 },
  { "type": "poison_chance",   "minValue": 5,  "maxValue": 30, "weight": 10 },
  { "type": "critical_chance", "minValue": 5,  "maxValue": 20, "weight": 15 }
]
```

### 出現確率

総重み = 20 + 20 + 15 + 10 + 15 = 80

| MODタイプ | 重み | 出現確率 |
|----------|------|---------|
| atk_bonus | 20 | 25.0% |
| def_bonus | 20 | 25.0% |
| hp_regen | 15 | 18.75% |
| poison_chance | 10 | 12.5% |
| critical_chance | 15 | 18.75% |

---

## 4. MOD生成ロジック

### ランダムMOD生成（data/items.ts:102-137）

```typescript
function generateRandomMods(count: number): ItemMod[] {
  const mods: ItemMod[] = [];
  const usedTypes = new Set<ModType>();

  for (let i = 0; i < count; i++) {
    // 重み付きランダム選択
    const totalWeight = modConfigs
      .filter(c => !usedTypes.has(c.type))
      .reduce((sum, c) => sum + c.weight, 0);

    let roll = Math.random() * totalWeight;
    for (const config of modConfigs) {
      if (usedTypes.has(config.type)) continue;
      roll -= config.weight;
      if (roll <= 0) {
        // minValue〜maxValueの範囲でランダム生成
        const value = Math.floor(
          Math.random() * (config.maxValue - config.minValue + 1)
        ) + config.minValue;

        mods.push({ type: config.type, value });
        usedTypes.add(config.type);
        break;
      }
    }
  }
  return mods;
}
```

### アイテムインスタンス生成（data/items.ts:144-161）

```typescript
export function createItemInstance(
  itemId: string,
  modCount: number = 0
): Item | undefined {
  const base = getItemBase(itemId);
  if (!base) return undefined;

  // 固有MOD + ランダムMOD
  const fixedMods = base.fixedMods || [];
  const randomMods = modCount > 0 ? generateRandomMods(modCount) : [];

  // 固有MODと同じタイプのランダムMODは除外
  const fixedTypes = new Set(fixedMods.map(m => m.type));
  const filteredRandomMods = randomMods.filter(m => !fixedTypes.has(m.type));

  return {
    ...base,
    instanceId: generateInstanceId(),
    mods: [...fixedMods, ...filteredRandomMods],
  };
}
```

### MOD数の決定

ドロップ時に0〜2個のランダムMODが付与されます。

```typescript
const modCount = Math.floor(Math.random() * 3);  // 0, 1, or 2
```

| MOD数 | 確率 |
|-------|------|
| 0個 | 33.3% |
| 1個 | 33.3% |
| 2個 | 33.3% |

---

## 5. ユニークアイテムの固有MOD

### 固有MODの特徴

- `fixedMods`プロパティで定義
- ランダムMODは付与されない（modCount=0）
- 複数の固有MODを持つことが可能

### ユニークアイテム一覧

#### 始まりの草原

| アイテム | スロット | 固有MOD |
|---------|---------|--------|
| 分裂核 | アクセサリ | hp_regen: 20 |
| 狼の牙 | 武器 | critical_chance: 15 |
| 毒針の指輪 | アクセサリ | poison_chance: 60 |

#### 地底洞窟

| アイテム | スロット | 固有MOD |
|---------|---------|--------|
| 骨の剣 | 武器 | atk_bonus: 5 |
| 戦鬼の腰帯 | アクセサリ | atk_bonus: 3, def_bonus: 3 |
| 闇夜のマント | 防具 | def_bonus: 5 |

#### 忘却の遺跡

| アイテム | スロット | 固有MOD |
|---------|---------|--------|
| 心核石 | アクセサリ | hp_regen: 10, def_bonus: 5 |
| 呪縛の包帯 | 手袋 | poison_chance: 30 |
| 失われた魔導書 | アクセサリ | critical_chance: 25 |
| 石翼のブーツ | 靴 | def_bonus: 5 |

### 固有MODの定義例（data/json/items.json）

```json
"wolf_fang": {
  "id": "wolf_fang",
  "name": "狼の牙",
  "slot": "weapon",
  "atk": 12,
  "def": 0,
  "fixedMods": [
    { "type": "critical_chance", "value": 15 }
  ]
}
```

---

## 6. 戦闘中のMOD効果適用

### 効果の集計（hooks/useBattle.ts:250-275）

```typescript
const getModEffectsFromEquipment = useCallback(() => {
  const combined = {
    hpRegen: 0,
    poisonChance: 0,
    criticalChance: 0,
  };

  Object.values(equipment).forEach((item) => {
    if (item && item.mods) {
      for (const mod of item.mods) {
        switch (mod.type) {
          case 'hp_regen':
            combined.hpRegen += mod.value;
            break;
          case 'poison_chance':
            combined.poisonChance += mod.value;
            break;
          case 'critical_chance':
            combined.criticalChance += mod.value;
            break;
        }
      }
    }
  });

  return combined;
}, [equipment]);
```

### ターン処理フロー

```
ターン開始
  │
  ├─ 1. HP回復（hp_regen）
  │     if (hpRegen > 0 && currentHp < maxHp)
  │       currentHp += hpRegen
  │
  ├─ 2. 敵の毒ダメージ処理
  │     if (enemyPoison.remainingTurns > 0)
  │       enemyHp -= poisonDamage
  │
  ├─ 3. クリティカル判定（critical_chance）
  │     if (random < criticalChance)
  │       damage *= 2
  │
  ├─ 4. プレイヤー攻撃
  │
  └─ 5. 毒付与判定（poison_chance）
        if (!enemyPoison && random < poisonChance)
          applyPoison(damage * 0.5, 5turns)
```

### ATK/DEFボーナスの適用（stores/usePlayerStore.ts:291-316）

```typescript
getTotalStats: () => {
  let totalAtk = state.atk;
  let totalDef = state.def;

  Object.values(state.equipment).forEach((item) => {
    if (item) {
      totalAtk += item.atk;
      totalDef += item.def;

      // MODボーナスを加算
      if (item.mods) {
        for (const mod of item.mods) {
          if (mod.type === 'atk_bonus') totalAtk += mod.value;
          if (mod.type === 'def_bonus') totalDef += mod.value;
        }
      }
    }
  });

  return { maxHp, atk: totalAtk, def: totalDef };
}
```

---

## 7. UI表示

### MOD説明の取得（data/items.ts:215-230）

```typescript
export function getModDescription(mod: ItemMod): string {
  switch (mod.type) {
    case 'atk_bonus':
      return `ATK+${mod.value}`;
    case 'def_bonus':
      return `DEF+${mod.value}`;
    case 'hp_regen':
      return `毎ターンHP${mod.value}回復`;
    case 'poison_chance':
      return `毒付与+${mod.value}%`;
    case 'critical_chance':
      return `クリティカル+${mod.value}%`;
    default:
      return '';
  }
}
```

### 表示ルール

| 場所 | 表示方法 |
|------|---------|
| 装備スロット | ATK/DEFはステータスに合算、他MODは「MOD xN」バッジ |
| インベントリ | 全MODを日本語説明で表示 |
| ステータスパネル | 合計ATK/DEF値（MOD込み） |

---

## 8. MODシステム全体フロー

```
【アイテムドロップ】
      │
      ├─ ユニークドロップ
      │     └─ createItemInstance(itemId, 0)
      │         └─ 固有MODのみ
      │
      └─ 通常ドロップ
            └─ createItemInstance(itemId, 0〜2)
                ├─ 固有MOD（あれば）
                └─ ランダムMOD（0〜2個）
                      │
                      └─ generateRandomMods()
                          ├─ 重み付きランダム選択
                          ├─ min〜max範囲で値決定
                          └─ 同一タイプは1個まで

【装備時】
      │
      └─ usePlayerStore.equip()
          └─ equipment に保存

【戦闘時】
      │
      ├─ getTotalStats()
      │     └─ atk_bonus/def_bonus を合算
      │
      └─ executeTurn()
            ├─ hp_regen → ターン開始時回復
            ├─ critical_chance → 攻撃時判定
            └─ poison_chance → 攻撃後判定
```

---

## 9. カスタマイズ方法

### 新しいMODタイプを追加する場合

1. `types/index.ts` の `ModType` に追加
2. `data/json/items.json` の `modConfigs` に設定追加
3. `data/items.ts` の `getModDescription()` に表示文追加
4. `hooks/useBattle.ts` に効果処理を実装
5. 必要に応じてUI更新

### MODの出現率を調整する場合

`data/json/items.json` の `modConfigs` の `weight` 値を変更

### MODの値範囲を調整する場合

`data/json/items.json` の `modConfigs` の `minValue`/`maxValue` を変更

### ユニークアイテムに固有MODを追加する場合

`data/json/items.json` の対象アイテムに `fixedMods` を追加

```json
"item_id": {
  "fixedMods": [
    { "type": "critical_chance", "value": 20 }
  ]
}
```
