# インベントリ・倉庫システム

## 概要

プレイヤーのアイテム管理システム。インベントリ（キャラクター固有）と倉庫（全キャラクター共有）の2つのストレージで構成されます。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | 型定義 |
| `stores/usePlayerStore.ts` | 状態管理・ロジック |
| `db/schema.ts` | DBテーブル定義 |
| `db/repositories/inventoryRepository.ts` | インベントリDB操作 |
| `db/repositories/equipmentRepository.ts` | 装備DB操作 |
| `db/repositories/storageRepository.ts` | 倉庫DB操作 |
| `app/inventory.tsx` | インベントリ画面 |
| `app/storage.tsx` | 倉庫画面 |
| `components/player/EquipmentSlots.tsx` | 装備スロット表示 |
| `core/player.ts` | 定数・計算ロジック |

---

## 1. 型定義

### 装備スロット（types/index.ts）

```typescript
type EquipmentSlot = 'weapon' | 'armor' | 'gloves' | 'boots' | 'accessory';
```

| スロット | 日本語名 |
|---------|---------|
| weapon | 武器 |
| armor | 防具 |
| gloves | 手袋 |
| boots | 靴 |
| accessory | アクセサリー |

### アイテム定義

```typescript
// マスターデータ
interface ItemBase {
  id: string;
  name: string;
  slot: EquipmentSlot;
  atk: number;
  def: number;
  fixedMods?: ItemMod[];  // ユニークアイテムの固有MOD
}

// アイテムインスタンス
interface Item extends ItemBase {
  instanceId: string;  // ユニークなインスタンスID
  mods: ItemMod[];     // 付与されたMOD
}
```

### 装備管理

```typescript
type Equipment = {
  [key in EquipmentSlot]: Item | null;
};
```

### 倉庫アイテム

```typescript
interface StorageItem {
  itemId: string;
  quantity: number;
}
```

---

## 2. インベントリシステム

### 容量制限

```typescript
// core/player.ts
export const INVENTORY_MAX_SIZE = 50;
```

- 最大50個まで保持可能
- 1アイテム = 1スロット（スタック不可）
- 同じアイテムでもinstanceIdが異なれば別カウント

### 容量チェック（usePlayerStore）

```typescript
// 空き数を取得
getInventorySpace: () => number

// 満杯かどうか
isInventoryFull: () => boolean
```

### DBテーブル（schema.ts）

```sql
CREATE TABLE inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL UNIQUE,
  item_data TEXT NOT NULL,
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

- `instance_id`: アイテムインスタンスの一意ID
- `item_data`: Item全体をJSON形式で保存

### リポジトリ操作（inventoryRepository）

```typescript
// 全アイテム取得
async getAll(characterId: number): Promise<Item[]>

// アイテム追加
async addItem(characterId: number, item: Item): Promise<void>

// アイテム削除
async removeItem(characterId: number, instanceId: string): Promise<boolean>

// 個別取得
async getItem(characterId: number, instanceId: string): Promise<Item | null>

// クリア
async clear(characterId: number): Promise<void>
```

### ストア操作（usePlayerStore）

#### アイテム追加

```typescript
addToInventory: async (item: Item): Promise<boolean> => {
  // 容量チェック
  if (state.inventory.length >= INVENTORY_MAX_SIZE) {
    return false;
  }

  // DB保存
  await inventoryRepository.addItem(characterId, item);

  // メモリ更新
  set({ inventory: [...state.inventory, item] });
  return true;
}
```

#### アイテム削除

```typescript
removeFromInventory: async (instanceId: string): Promise<boolean> => {
  // DB削除
  const success = await inventoryRepository.removeItem(characterId, instanceId);

  // メモリ更新
  set({
    inventory: state.inventory.filter((i) => i.instanceId !== instanceId),
  });
  return success;
}
```

---

## 3. 装備システム

### DBテーブル（schema.ts）

```sql
CREATE TABLE equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  item_data TEXT,
  UNIQUE(character_id, slot),
  FOREIGN KEY (character_id) REFERENCES characters(id)
);
```

- 各キャラクターに5行（スロットごと）
- `item_data`がNULL = 未装備

### リポジトリ操作（equipmentRepository）

```typescript
// 全装備取得
async getAll(characterId: number): Promise<EquipmentRecord[]>

// スロット別取得
async getBySlot(characterId: number, slot: EquipmentSlot): Promise<Item | null>

// 装備
async equip(characterId: number, slot: EquipmentSlot, item: Item): Promise<void>

// 解除
async unequip(characterId: number, slot: EquipmentSlot): Promise<Item | null>

// 全解除
async unequipAll(characterId: number): Promise<void>
```

### 装備操作（usePlayerStore）

#### 装備する

```typescript
equipItem: async (instanceId: string) => {
  // 1. インベントリからアイテムを取得
  const item = state.inventory.find((i) => i.instanceId === instanceId);

  // 2. 現在の装備を取得（装備交換の場合）
  const oldItem = state.equipment[item.slot];

  // 3. DB操作
  await inventoryRepository.removeItem(characterId, instanceId);
  if (oldItem) {
    await inventoryRepository.addItem(characterId, oldItem);
  }
  await equipmentRepository.equip(characterId, item.slot, item);

  // 4. メモリ更新
  const newInventory = state.inventory.filter((i) => i.instanceId !== instanceId);
  if (oldItem) newInventory.push(oldItem);

  set({
    equipment: { ...state.equipment, [item.slot]: item },
    inventory: newInventory,
  });
}
```

#### 装備解除

```typescript
unequipItem: async (slot: EquipmentSlot) => {
  const item = state.equipment[slot];
  if (!item) return;

  // 容量チェック
  if (state.inventory.length >= INVENTORY_MAX_SIZE) {
    return; // インベントリ満杯
  }

  // DB操作
  await equipmentRepository.unequip(characterId, slot);
  await inventoryRepository.addItem(characterId, item);

  // メモリ更新
  set({
    equipment: { ...state.equipment, [slot]: null },
    inventory: [...state.inventory, item],
  });
}
```

### ステータス計算（getTotalStats）

```typescript
getTotalStats: () => {
  let totalAtk = state.atk;
  let totalDef = state.def;

  Object.values(state.equipment).forEach((item) => {
    if (item) {
      // 基本ステータス加算
      totalAtk += item.atk;
      totalDef += item.def;

      // MODボーナス加算
      for (const mod of item.mods) {
        if (mod.type === 'atk_bonus') totalAtk += mod.value;
        if (mod.type === 'def_bonus') totalDef += mod.value;
      }
    }
  });

  return { maxHp: state.maxHp, atk: totalAtk, def: totalDef };
}
```

---

## 4. 倉庫システム

### 特徴

- **全キャラクター共有**（character_idなし）
- **スタック対応**（同一item_idは個数加算）
- **MODなし**（基本アイテムのみ保存）

### DBテーブル（schema.ts）

```sql
CREATE TABLE storage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1
);
```

### リポジトリ操作（storageRepository）

```typescript
// 全アイテム取得
async getAll(): Promise<StorageItem[]>

// 預ける（UPSERT）
async deposit(itemId: string, quantity: number = 1): Promise<void>

// 引き出す
async withdraw(itemId: string, quantity: number = 1): Promise<boolean>

// 個数取得
async getItemQuantity(itemId: string): Promise<number>

// クリア
async clear(): Promise<void>
```

### 預け入れ（deposit）

```sql
INSERT INTO storage (item_id, quantity)
VALUES (?, ?)
ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + excluded.quantity
```

- 既存アイテム → 個数加算
- 新規アイテム → 新規行作成

### 引き出し（withdraw）

```typescript
async withdraw(itemId: string, quantity: number = 1): Promise<boolean> {
  const current = await getItemQuantity(itemId);
  if (current < quantity) return false;

  if (current === quantity) {
    // 全量削除
    await db.runAsync('DELETE FROM storage WHERE item_id = ?', itemId);
  } else {
    // 数量減少
    await db.runAsync(
      'UPDATE storage SET quantity = quantity - ? WHERE item_id = ?',
      quantity, itemId
    );
  }
  return true;
}
```

### 倉庫からの引き出しフロー（app/storage.tsx）

```typescript
const handleWithdraw = async (itemId: string) => {
  // 1. インベントリ容量チェック
  if (isInventoryFull()) {
    Alert.alert('エラー', 'インベントリがいっぱいです');
    return;
  }

  // 2. 倉庫から引き出し
  const success = await storageRepository.withdraw(itemId, 1);
  if (!success) return;

  // 3. アイテムインスタンス生成（MODなし）
  const item = createItemInstance(itemId, 0);

  // 4. インベントリに追加
  await addToInventory(item);

  // 5. 倉庫リスト更新
  refreshStorage();
};
```

---

## 5. UI画面

### インベントリ画面（app/inventory.tsx）

#### レイアウト

```
┌─────────────────────────────────────┐
│ インベントリ           45/50       │ ← ヘッダー（容量表示）
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ [アイコン]  草原の剣            │ │ ← 選択アイテム詳細
│ │ 武器  ATK+8  DEF+0              │ │
│ │ MOD: ATK+3, クリティカル+10%   │ │
│ │ [装備する]  [捨てる]            │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [武器(5)] [防具(3)] [手袋(2)]...   │ ← カテゴリタブ
├─────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│ │item│ │item│ │item│ │item│       │ ← 4列グリッド
│ └────┘ └────┘ └────┘ └────┘       │
│ ┌────┐ ┌────┐                      │
│ │item│ │item│                      │
│ └────┘ └────┘                      │
├─────────────────────────────────────┤
│ [戻る]                              │ ← フッター
└─────────────────────────────────────┘
```

#### 機能

- カテゴリ別表示（5つのスロット）
- アイテム詳細表示（選択時）
- MOD付きアイテムに金色インジケータ
- 装備ボタン（古い装備はインベントリに戻る）
- 削除ボタン（アイテム完全削除）

#### グループ化処理

```typescript
const itemsBySlot = useMemo(() => {
  const grouped: Record<EquipmentSlot, Item[]> = {
    weapon: [],
    armor: [],
    gloves: [],
    boots: [],
    accessory: [],
  };
  for (const item of inventory) {
    grouped[item.slot].push(item);
  }
  return grouped;
}, [inventory]);
```

### 倉庫画面（app/storage.tsx）

#### レイアウト

```
┌─────────────────────────────────────┐
│ 倉庫                                │ ← ヘッダー
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 朽ちた剣           x3          │ │ ← アイテムカード
│ │ 武器  ATK+5  DEF+0              │ │
│ │ [引き出す]                      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 布の服             x2          │ │
│ │ 防具  ATK+0  DEF+3              │ │
│ │ [引き出す]                      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [戻る]                              │ ← フッター
└─────────────────────────────────────┘
```

#### 機能

- 全アイテムリスト表示
- 個数表示（`x{quantity}`）
- 1個ずつ引き出し
- 画面フォーカス時に自動更新

### 装備スロット（components/player/EquipmentSlots.tsx）

#### 表示内容

```
┌────────┬────────┬────────┬────────┬────────┐
│ 武器   │ 防具   │ 手袋   │ 靴     │ アクセ │
├────────┼────────┼────────┼────────┼────────┤
│草原の剣│ -      │革の手袋│うさぎの│毒針の  │
│+8ATK   │        │+2DEF   │ブーツ  │指輪    │
│MOD x1  │        │        │+3DEF   │MOD x1  │
└────────┴────────┴────────┴────────┴────────┘
```

- 各スロットの装備アイテム名
- ステータス合計（ATK/DEF）
- MOD個数バッジ

---

## 6. スタック処理

### インベントリ

**スタック**: 非対応

- 同じアイテムでもinstanceIdが異なれば別枠
- MOD組み合わせが異なれば別アイテム

### 倉庫

**スタック**: 対応

- 同一item_id → 個数加算
- MODなし基本アイテムのみ

### 比較表

| 機能 | インベントリ | 倉庫 |
|------|------------|------|
| スタック | 不可 | 可 |
| MOD保持 | あり | なし |
| キャラ紐付け | あり | なし（共有） |
| 容量制限 | 50個 | 無制限 |

---

## 7. データフロー

```
┌─────────────────────────────────────────────────────────────┐
│                  キャラクター読み込み                        │
│  loadCharacter(characterId)                                 │
│    ├─ equipmentRepository.getAll() → Equipment              │
│    └─ inventoryRepository.getAll() → Item[]                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   戦闘終了    │    │ インベントリ  │    │    倉庫       │
│               │    │    画面       │    │    画面       │
│ droppedItems  │    │               │    │               │
│      │        │    │ equipItem()   │    │ withdraw()    │
│      ▼        │    │ unequipItem() │    │      │        │
│addToInventory │    │removeFromInv()│    │      ▼        │
└───────┬───────┘    └───────────────┘    │addToInventory │
        │                                  └───────────────┘
        ▼
┌───────────────────────────────────────┐
│         usePlayerStore                │
│  ┌─────────────────────────────────┐  │
│  │ inventory: Item[]               │  │
│  │ equipment: Equipment            │  │
│  └─────────────────────────────────┘  │
│              ↕ 同期                   │
│  ┌─────────────────────────────────┐  │
│  │ inventoryRepository             │  │
│  │ equipmentRepository             │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

---

## 8. マイグレーション対応

### 古いデータの補完

```typescript
function completeItemFromMaster(data: MigratedItem): Item | null {
  if (!data._needsMigration) {
    return data as Item;  // 正常なItem
  }

  // マスターデータから補完
  const base = getItemBase(data.id);
  return {
    ...base,
    instanceId: data.instanceId,
    mods: data.mods || base.fixedMods || [],
  };
}
```

- 取得時に自動補完
- 補完後にDBへ書き戻し

---

## 9. 仕様サマリー

| 項目 | 仕様 |
|------|------|
| インベントリ容量 | 50個 |
| インベントリスタック | 不可（別アイテム扱い） |
| 倉庫スタック | 可（MODなし基本アイテムのみ） |
| 倉庫の共有 | 全キャラクター共有 |
| 装備スロット数 | 5個 |
| 各スロット装備数 | 1個 |
| MOD保持 | インベントリのみ |
| アイテムID管理 | instanceId（UUID形式） |

---

## 10. カスタマイズ方法

### インベントリ容量を変更する場合

`core/player.ts` の定数を変更：

```typescript
export const INVENTORY_MAX_SIZE = 100;  // 50→100に変更
```

### 新しい装備スロットを追加する場合

1. `types/index.ts` の `EquipmentSlot` に追加
2. `stores/usePlayerStore.ts` の初期Equipment定義を更新
3. `components/player/EquipmentSlots.tsx` のUIを更新
4. `db/repositories/equipmentRepository.ts` の初期化処理を更新

### 倉庫にMOD保持機能を追加する場合

1. `db/schema.ts` のstorageテーブルを変更
   - `item_data TEXT` カラム追加
2. `db/repositories/storageRepository.ts` を更新
3. `app/storage.tsx` のUI更新

---

## 11. 関連ドキュメント

- [ドロップ率システム](./drop-rate-system.md) - アイテム獲得の仕組み
- [MODシステム](./mod-system.md) - アイテムMODの詳細
- [ダンジョンシステム](./dungeon-system.md) - ダンジョンとドロップテーブル
