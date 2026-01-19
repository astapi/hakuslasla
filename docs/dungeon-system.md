# ダンジョンシステム

## 概要

自動戦闘ハクスラRPGのダンジョンシステム。プレイヤーはダンジョンを選択し、各階層で敵と自動戦闘を行い、アイテムを収集します。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | ダンジョン関連の型定義 |
| `data/dungeons.ts` | ダンジョンデータ取得関数 |
| `data/json/dungeons.json` | ダンジョン詳細データ |
| `data/json/dungeonList.json` | ダンジョン一覧データ |
| `data/enemies.ts` | 敵データ取得関数 |
| `data/json/monsters.json` | モンスターマスターデータ |
| `hooks/useBattle.ts` | 戦闘ロジック |
| `app/dungeon-select.tsx` | ダンジョン選択画面 |

---

## 1. 型定義

### Dungeon（types/index.ts）

```typescript
interface Dungeon {
  id: string;                    // ダンジョン識別子
  name: string;                  // ダンジョン名
  description: string;           // 説明文
  maxFloor: number;              // 最大階層数
  recommendedLevel: number;      // 推奨レベル
  monsters: MonsterSpawn[];      // 出現モンスター設定
  dropTable: DungeonDropTable;   // ドロップテーブル
}
```

### MonsterSpawn

```typescript
interface MonsterSpawn {
  monsterId: string;   // モンスターID
  spawnRate: number;   // 出現確率（重み）
}
```

### DungeonDropTable

```typescript
interface DungeonDropTable {
  common: ItemDrop[];   // 共通ドロップ
  dungeon: ItemDrop[];  // ダンジョン固有ドロップ
}

interface ItemDrop {
  itemId: string;
  dropRate: number;     // ドロップ確率（重み）
}
```

---

## 2. ダンジョン一覧

| ダンジョン | ID | 推奨Lv | 階層数 | 説明 |
|-----------|-----|--------|--------|------|
| 始まりの草原 | grassland | 1 | 5階 | 冒険者が最初に訪れる穏やかな草原。弱いモンスターが生息している。 |
| 地底洞窟 | cave | 5 | 7階 | 地下深くに広がる暗い洞窟。中級のモンスターが潜んでいる。 |
| 忘却の遺跡 | ruins | 10 | 10階 | 古代文明の遺跡。強力なモンスターが徘徊する危険な場所。 |

---

## 3. 出現モンスター

### 始まりの草原（grassland）

#### 出現率

| モンスター | ID | 出現率 |
|-----------|-----|--------|
| スライム | slime | 30% |
| キラーラビット | wild_rabbit | 25% |
| ゴブリン | goblin | 20% |
| キラービー | bee | 15% |
| オオカミ | wolf | 10% |

#### ステータス

| モンスター | HP | ATK | DEF | EXP | ユニークドロップ |
|-----------|-----|-----|-----|-----|-----------------|
| スライム | 20 | 5 | 2 | 10 | 分裂核（5%） |
| キラーラビット | 15 | 6 | 1 | 8 | - |
| ゴブリン | 30 | 8 | 3 | 15 | - |
| キラービー | 12 | 10 | 1 | 12 | 毒針の指輪（5%） |
| オオカミ | 25 | 10 | 2 | 14 | 狼の牙（5%） |

---

### 地底洞窟（cave）

#### 出現率

| モンスター | ID | 出現率 |
|-----------|-----|--------|
| ジャイアントバット | bat | 25% |
| スケルトン | skeleton | 25% |
| ゴブリンウォリアー | goblin_warrior | 20% |
| 岩トカゲ | rock_lizard | 15% |
| オーク | orc | 15% |

#### ステータス

| モンスター | HP | ATK | DEF | EXP | ユニークドロップ |
|-----------|-----|-----|-----|-----|-----------------|
| ジャイアントバット | 28 | 12 | 3 | 18 | 闇夜のマント（3%） |
| スケルトン | 35 | 12 | 5 | 20 | 骨の剣（3%） |
| ゴブリンウォリアー | 45 | 14 | 6 | 25 | - |
| 岩トカゲ | 50 | 11 | 10 | 22 | - |
| オーク | 60 | 16 | 8 | 30 | 戦鬼の腰帯（3%） |

---

### 忘却の遺跡（ruins）

#### 出現率

| モンスター | ID | 出現率 |
|-----------|-----|--------|
| スケルトンナイト | skeleton_knight | 25% |
| ミイラ | mummy | 25% |
| ガーゴイル | gargoyle | 20% |
| ゴーレム | golem | 15% |
| リッチ | lich | 15% |

#### ステータス

| モンスター | HP | ATK | DEF | EXP | ユニークドロップ |
|-----------|-----|-----|-----|-----|-----------------|
| スケルトンナイト | 70 | 18 | 12 | 40 | - |
| ミイラ | 65 | 22 | 8 | 45 | 呪縛の包帯（2%） |
| ガーゴイル | 80 | 24 | 14 | 55 | 石翼のブーツ（2%） |
| ゴーレム | 100 | 20 | 15 | 50 | 心核石（2%） |
| リッチ | 55 | 28 | 6 | 60 | 失われた魔導書（2%） |

---

## 4. ドロップテーブル

### 始まりの草原（grassland）

#### 共通ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 朽ちた剣 | rusted_sword | 10 |
| 布の服 | cloth_clothes | 10 |
| 革の帽子 | leather_hat | 10 |
| 革の手袋 | leather_gloves | 10 |
| 革のブーツ | leather_boots | 10 |
| 銅の指輪 | copper_ring | 8 |
| 旅人のお守り | traveler_amulet | 8 |

#### ダンジョン固有ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 草原の剣 | grassland_sword | 15 |
| 軽量レザー | light_leather | 15 |
| うさぎのブーツ | rabbit_boots | 15 |

---

### 地底洞窟（cave）

#### 共通ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 朽ちた剣 | rusted_sword | 5 |
| 布の服 | cloth_clothes | 5 |
| 革の帽子 | leather_hat | 5 |
| 革の手袋 | leather_gloves | 8 |
| 革のブーツ | leather_boots | 8 |
| 銅の指輪 | copper_ring | 8 |
| 旅人のお守り | traveler_amulet | 8 |

#### ダンジョン固有ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 洞窟の鉄剣 | cave_iron_sword | 15 |
| 骨の盾 | bone_shield | 12 |
| コウモリマント | bat_mantle | 12 |
| 地底のお守り | underground_charm | 10 |
| 戦士の指輪 | warrior_ring | 10 |

---

### 忘却の遺跡（ruins）

#### 共通ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 革の手袋 | leather_gloves | 5 |
| 革のブーツ | leather_boots | 5 |
| 銅の指輪 | copper_ring | 5 |
| 旅人のお守り | traveler_amulet | 5 |

#### ダンジョン固有ドロップ

| アイテム | ID | 重み |
|---------|-----|------|
| 遺跡の魔剣 | ruins_magic_sword | 15 |
| 呪われたローブ | cursed_robe | 12 |
| ガーゴイルブーツ | gargoyle_boots | 12 |
| 古代の指輪 | ancient_ring | 10 |
| 忘却のお守り | oblivion_amulet | 10 |

---

## 5. 戦闘システム

### 戦闘状態（BattleState）

```typescript
interface BattleState {
  dungeonId: string;             // ダンジョンID
  currentFloor: number;          // 現在の階層
  maxFloor: number;              // 最大階層
  playerCurrentHp: number;       // プレイヤーの現在HP
  playerMaxHp: number;           // プレイヤーの最大HP
  enemy: BattleEnemy | null;     // 現在の敵
  enemyPoison: PoisonState | null; // 敵の毒状態
  phase: BattlePhase;            // 戦闘フェーズ
  battleLog: BattleLogEntry[];   // 戦闘ログ
  droppedItems: Item[];          // ドロップアイテム
  totalExpGained: number;        // 累積経験値
}
```

### 戦闘フェーズ

| フェーズ | 説明 |
|---------|------|
| `fighting` | 戦闘中 |
| `victory` | 敵撃破（次階層へ） |
| `defeat` | プレイヤー敗北 |
| `cleared` | ダンジョンクリア |

### 戦闘フロー

```
ダンジョン選択
  │
  └─→ startBattle()
        │
        ├─ ダンジョン情報取得
        ├─ 初期状態生成
        └─ 最初の敵を選択
              │
              └─→ 自動戦闘ループ（1秒ごと）
                    │
                    ├─ 1. HP回復（hp_regen MOD）
                    ├─ 2. 敵の毒ダメージ処理
                    ├─ 3. クリティカル判定
                    ├─ 4. プレイヤー攻撃
                    ├─ 5. 毒付与判定
                    ├─ 6. 敵撃破判定
                    │     ├─ Yes → ドロップ処理 → 次階層 or クリア
                    │     └─ No → 続行
                    ├─ 7. 敵の反撃
                    └─ 8. プレイヤー敗北判定
                          ├─ Yes → 結果画面へ
                          └─ No → 次ターンへ
```

### ダメージ計算

```typescript
damage = Math.max(1, atk - def)  // 最低1ダメージ保証
```

### クリティカル

- クリティカル発生時: ダメージ × 2
- 発生確率: 装備のcritical_chance MOD合計値

### 毒システム

- 毒ダメージ = 攻撃ダメージ × 0.5
- 持続ターン: 5ターン
- 既に毒状態の敵には重ね掛け不可
- 次階層移動時に敵の毒状態はリセット

---

## 6. 敵選択ロジック

```typescript
// data/enemies.ts
export const getRandomEnemy = (monsterSpawns: MonsterSpawn[]): Enemy | undefined => {
  // 総出現率を計算
  const totalRate = monsterSpawns.reduce((sum, spawn) => sum + spawn.spawnRate, 0);
  const random = Math.random() * totalRate;

  // 累積確率で選択
  let cumulative = 0;
  for (const spawn of monsterSpawns) {
    cumulative += spawn.spawnRate;
    if (random < cumulative) {
      return getEnemy(spawn.monsterId);
    }
  }

  return getEnemy(monsterSpawns[monsterSpawns.length - 1].monsterId);
};
```

**特徴**:
- 全階層で同じ敵プールから選択
- 階層ごとの難易度調整は未実装
- 出現率は重み付きランダム

---

## 7. 画面遷移

```
キャラクター選択 (/)
  │
  └─→ ホーム (/home)
        │
        └─→ ダンジョン選択 (/dungeon-select)
              │
              └─→ 戦闘 (/battle/[dungeonId])
                    │
                    └─→ 結果 (/result)
                          │
                          └─→ ホーム (/home)
```

- `router.replace()` で履歴をリセット（戻るボタン対策）
- 戦闘画面から直接ホームには戻れない

---

## 8. データ参照フロー

```
ダンジョン選択画面
  │
  └─ getDungeonList()
       → dungeonList.json
  │
  ↓ ダンジョン選択
  │
  └─ /battle/[dungeonId]へ遷移
       │
       └─ useBattle(dungeonId)
            │
            ├─ getDungeon(dungeonId)
            │    → dungeons.json
            │
            └─ getRandomEnemy(monsterSpawns)
                 → monsters.json
            │
            ↓ 戦闘実行
            │
            └─ ドロップ判定
                 ├─ tryUniqueDrop() - ユニークドロップ
                 └─ rollDropItems(dropTable) - 通常ドロップ
```

---

## 9. ユニークアイテム一覧

### 始まりの草原

| アイテム | ドロップ元 | 確率 | 固有MOD |
|---------|----------|------|--------|
| 分裂核 | スライム | 5% | hp_regen: 20 |
| 狼の牙 | オオカミ | 5% | critical_chance: 15 |
| 毒針の指輪 | キラービー | 5% | poison_chance: 60 |

### 地底洞窟

| アイテム | ドロップ元 | 確率 | 固有MOD |
|---------|----------|------|--------|
| 闇夜のマント | ジャイアントバット | 3% | def_bonus: 5 |
| 骨の剣 | スケルトン | 3% | atk_bonus: 5 |
| 戦鬼の腰帯 | オーク | 3% | atk_bonus: 3, def_bonus: 3 |

### 忘却の遺跡

| アイテム | ドロップ元 | 確率 | 固有MOD |
|---------|----------|------|--------|
| 心核石 | ゴーレム | 2% | hp_regen: 10, def_bonus: 5 |
| 呪縛の包帯 | ミイラ | 2% | poison_chance: 30 |
| 失われた魔導書 | リッチ | 2% | critical_chance: 25 |
| 石翼のブーツ | ガーゴイル | 2% | def_bonus: 5 |

---

## 10. 難易度比較

### 敵の平均ステータス

| ダンジョン | 平均HP | 平均ATK | 平均DEF | 平均EXP |
|-----------|--------|---------|---------|---------|
| 始まりの草原 | 20.4 | 7.8 | 1.8 | 11.8 |
| 地底洞窟 | 43.6 | 13.0 | 6.4 | 23.0 |
| 忘却の遺跡 | 74.0 | 22.4 | 11.0 | 50.0 |

### 推奨ステータス目安

| ダンジョン | 推奨HP | 推奨ATK | 推奨DEF |
|-----------|--------|---------|---------|
| 始まりの草原 | 50+ | 10+ | 5+ |
| 地底洞窟 | 80+ | 20+ | 10+ |
| 忘却の遺跡 | 120+ | 35+ | 15+ |

---

## 11. カスタマイズ方法

### 新しいダンジョンを追加する場合

1. `data/json/dungeonList.json` に一覧データを追加
2. `data/json/dungeons.json` に詳細データを追加
3. 必要に応じて新モンスターを `data/json/monsters.json` に追加
4. 新アイテムを `data/json/items.json` に追加

### モンスターの出現率を変更する場合

`data/json/dungeons.json` の対象ダンジョンの `monsters` 配列を編集：

```json
{
  "monsters": [
    { "monsterId": "slime", "spawnRate": 40 },  // 30→40に変更
    { "monsterId": "wolf", "spawnRate": 5 }     // 10→5に変更
  ]
}
```

### ドロップテーブルを変更する場合

`data/json/dungeons.json` の対象ダンジョンの `dropTable` を編集：

```json
{
  "dropTable": {
    "common": [...],
    "dungeon": [
      { "itemId": "new_item", "dropRate": 10 }
    ]
  }
}
```

---

## 12. 今後の拡張候補

現在未実装の機能：

- **階層ごとの難易度調整**: 深い階層ほど敵が強くなる
- **ボス戦システム**: 最終階層に専用ボス
- **ダンジョン解放条件**: 前のダンジョンクリアで次が解放
- **レアモンスター**: 低確率で強力な敵が出現
- **隠し部屋**: ランダムでボーナスステージ
