# アイテムドロップ率システム

## 概要

本ゲームのドロップシステムは、**ユニークドロップ**と**通常ドロップ**の2種類で構成されています。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `data/items.ts` | ドロップロジック実装 |
| `data/json/items.json` | アイテムマスターデータ |
| `data/json/monsters.json` | 敵のユニークドロップ設定 |
| `data/json/dungeons.json` | ダンジョンごとのドロップテーブル |
| `types/index.ts` | 型定義 |
| `hooks/useBattle.ts` | 戦闘中のドロップ処理 |

---

## 1. ドロップ数の決定

### 設定値（`DROP_CONFIG`）

**ファイル**: `data/items.ts`（18-26行目）

```typescript
export const DROP_CONFIG = {
  dropChances: [
    { count: 3, chance: 10 },  // 3個ドロップ: 10%
    { count: 2, chance: 20 },  // 2個ドロップ: 20%
    { count: 1, chance: 50 },  // 1個ドロップ: 50%
    // 残り20%はドロップなし
  ],
};
```

### 確率分布

| ドロップ数 | 確率 |
|-----------|------|
| 0個 | 20% |
| 1個 | 50% |
| 2個 | 20% |
| 3個 | 10% |

### 実装（`rollDropCount()`）

**ファイル**: `data/items.ts`（31-43行目）

```typescript
export const rollDropCount = (): number => {
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const { count, chance } of DROP_CONFIG.dropChances) {
    cumulative += chance;
    if (roll < cumulative) {
      return count;
    }
  }
  return 0; // ドロップなし
};
```

---

## 2. 通常ドロップシステム

### ドロップテーブル構造

各ダンジョンは以下の構造でドロップテーブルを定義：

```typescript
interface DungeonDropTable {
  common: ItemDrop[];   // 全ダンジョン共通
  dungeon: ItemDrop[];  // ダンジョン固有
}

interface ItemDrop {
  itemId: string;
  dropRate: number;  // 重み（%ではなく相対値）
}
```

### ドロップテーブル例（始まりの草原）

**ファイル**: `data/json/dungeons.json`

```json
{
  "dropTable": {
    "common": [
      { "itemId": "rusted_sword", "dropRate": 10 },
      { "itemId": "cloth_armor", "dropRate": 10 },
      { "itemId": "leather_boots", "dropRate": 10 },
      { "itemId": "leather_cap", "dropRate": 10 },
      { "itemId": "iron_ring", "dropRate": 8 }
    ],
    "dungeon": [
      { "itemId": "grassland_sword", "dropRate": 15 },
      { "itemId": "light_leather", "dropRate": 15 },
      { "itemId": "rabbit_boots", "dropRate": 15 }
    ]
  }
}
```

### アイテム選択アルゴリズム（重み付きランダム）

**ファイル**: `data/items.ts`（48-79行目）

```typescript
export const rollDropItems = (
  dropTable: DungeonDropTable,
  count: number
): ItemInstance[] => {
  const allDrops = [...dropTable.common, ...dropTable.dungeon];
  const totalWeight = allDrops.reduce((sum, drop) => sum + drop.dropRate, 0);

  const items: ItemInstance[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random() * totalWeight;
    let cumulative = 0;

    for (const drop of allDrops) {
      cumulative += drop.dropRate;
      if (roll < cumulative) {
        items.push(createItemInstance(drop.itemId));
        break;
      }
    }
  }
  return items;
};
```

**計算例**（始まりの草原）:

- 総重み = 10+10+10+10+10+8+15+15+15 = 103
- 草原の剣の選択確率 = 15/103 ≒ 14.6%
- 鉄の指輪の選択確率 = 8/103 ≒ 7.8%

---

## 3. ユニークドロップシステム

### 定義場所

敵データの`uniqueDrop`プロパティで定義：

**ファイル**: `data/json/monsters.json`

```json
{
  "id": "wolf",
  "name": "オオカミ",
  "uniqueDrop": {
    "itemId": "wolf_fang",
    "dropRate": 5
  }
}
```

### ユニークドロップ一覧

| 敵名 | アイテム | ドロップ率 |
|------|---------|----------|
| スライム | 分裂核 | 5% |
| オオカミ | 狼の牙 | 5% |
| ジャイアントバット | 闇夜のマント | 3% |
| ゴーレム | 心核石 | 2% |
| リッチ | 失われた魔導書 | 2% |
| ビー | 毒針の指輪 | 5% |

### 判定ロジック

**ファイル**: `data/items.ts`（203-210行目）

```typescript
export const tryUniqueDrop = (
  itemId: string,
  dropRate: number
): ItemInstance | null => {
  const roll = Math.random() * 100;
  if (roll < dropRate) {
    return createUniqueItemInstance(itemId);
  }
  return null;
};
```

### ユニークアイテムの特徴

- 固有MODを持つ（ランダムMODは付与されない）
- 特定の敵からのみ入手可能
- ドロップ率は低め（2-5%）

---

## 4. MOD付与システム

### ランダムMOD付与

通常ドロップされたアイテムには0〜2個のランダムMODが付与されます。

**ファイル**: `data/items.ts`（144-161行目）

```typescript
const modCount = Math.floor(Math.random() * 3);  // 0, 1, or 2
```

### MODタイプと重み

| MODタイプ | 重み | 効果範囲 |
|----------|------|---------|
| atk_bonus | 20 | +1〜5 ATK |
| def_bonus | 20 | +1〜5 DEF |
| hp_regen | 15 | 1〜10 HP/ターン |
| poison_chance | 10 | 5〜30% 毒付与 |
| critical_chance | 15 | 5〜20% クリティカル |

### 制約

- 同タイプMODは1アイテムに1個まで
- ユニークアイテムは固有MODのみ

---

## 5. 戦闘中の処理フロー

**ファイル**: `hooks/useBattle.ts`（317-336行目, 381-401行目）

```
敵撃破
  │
  ├─→ ユニークドロップ判定
  │     └─ random(0-100) < dropRate → アイテム獲得
  │         └─ ユニークアイテム（固有MOD）
  │
  └─→ 通常ドロップ判定
        ├─ ドロップ数: rollDropCount()
        │   └─ 0個: 20%, 1個: 50%, 2個: 20%, 3個: 10%
        │
        └─ アイテム選択: rollDropItems(dropTable, count)
            ├─ 共通テーブル + ダンジョン固有テーブル
            ├─ 重み付きランダム選択
            └─ 各アイテムに0〜2個のランダムMOD付与
```

---

## 6. ドロップ率のカスタマイズ

### ドロップ数確率を変更する場合

`data/items.ts` の `DROP_CONFIG` を編集：

```typescript
export const DROP_CONFIG = {
  dropChances: [
    { count: 3, chance: 5 },   // 減らす場合
    { count: 2, chance: 15 },
    { count: 1, chance: 60 },
  ],
};
```

### ダンジョン固有アイテムを追加する場合

`data/json/dungeons.json` の対象ダンジョンの`dropTable.dungeon`に追加：

```json
{
  "dungeon": [
    { "itemId": "new_item_id", "dropRate": 10 }
  ]
}
```

### ユニークドロップを追加する場合

1. `data/json/items.json` にアイテムを追加
2. `data/json/monsters.json` の対象敵に `uniqueDrop` を設定

---

## 7. 型定義

**ファイル**: `types/index.ts`（114-147行目）

```typescript
export interface ItemDrop {
  itemId: string;
  dropRate: number;
}

export interface DungeonDropTable {
  common: ItemDrop[];
  dungeon: ItemDrop[];
}

export interface UniqueDrop {
  itemId: string;
  dropRate: number;
}

export interface Enemy {
  id: string;
  name: string;
  // ...
  uniqueDrop?: UniqueDrop;
}
```

---

## 8. 期待値計算例

### 1回の戦闘あたりの期待ドロップ数

```
E[ドロップ数] = 0×0.2 + 1×0.5 + 2×0.2 + 3×0.1
             = 0 + 0.5 + 0.4 + 0.3
             = 1.2個
```

### ユニークアイテムの期待入手回数

5%ドロップ率のユニークアイテムを入手するまでの期待戦闘回数：

```
E[戦闘回数] = 1 / 0.05 = 20回
```
