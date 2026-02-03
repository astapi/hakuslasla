# Uberユニーク装備 改善提案

作成日: 2026-01-26

## 現状の問題

uber_krakenまでのUberユニーク装備では、uber_demon_lordとuber_true_final_bossを倒すことができない。

### 現在の最強ビルド（Uber Vampire特化）の結果
- 最終ステ: HP:1868 ATK:353 DEF:793
- uber_kraken: ✅ 100%
- uber_demon_lord: ❌ 0%
- uber_true_final_boss: ❌ 0%

### 問題点
1. 基礎ステータスが終焉の地装備より弱い
2. 毒DoTビルドに特化した装備が存在しない
3. MODの種類が限定的（poison_damage_pct、poison_damage_more_pctなどがない）

---

## 改善案

### 方針1: 既存装備の基礎ステータス強化

既存のUberユニーク装備の基礎値を引き上げる。

#### Uber Goblin King装備
```json
// 現在
"uber_goblin_blade": { "atk": 110 }
"uber_goblin_plate": { "def": 220 }

// 提案
"uber_goblin_blade": { "atk": 150 }  // +40
"uber_goblin_plate": { "def": 280 }  // +60
```

#### Uber Vampire装備
```json
// 現在
"uber_vampire_fang": { "atk": 80 }
"uber_vampire_plate": { "def": 240 }

// 提案
"uber_vampire_fang": { "atk": 140 }  // +60
"uber_vampire_plate": { "def": 300 }  // +60
```

#### Uber Kraken装備
```json
// 現在
"uber_kraken_tentacle": { "atk": 85 }
"uber_kraken_shell": { "def": 260 }

// 提案
"uber_kraken_tentacle": { "atk": 150 }  // +65
"uber_kraken_shell": { "def": 320 }     // +60
```

---

### 方針2: 毒特化Uberユニーク装備の追加

uber_vampireまたはuber_krakenのドロップに毒特化装備を追加。

#### 新装備案1: 「Uber 毒蛇の牙」（武器）

**ドロップ元**: uber_vampire（追加ドロップ）

```json
{
  "id": "uber_venom_fang",
  "name": "Uber 毒蛇の牙",
  "slot": "weapon",
  "atk": 140,
  "def": 0,
  "fixedMods": [
    { "type": "poison_chance", "value": 35 },
    { "type": "poison_damage_pct", "value": 80 },
    { "type": "attack_speed_pct", "value": 25 }
  ]
}
```

**狙い**: 毒付与率と毒ダメージを高めて、DoTビルドの火力を上げる

---

#### 新装備案2: 「Uber 猛毒の篭手」（グローブ）

**ドロップ元**: uber_kraken（追加ドロップ）

```json
{
  "id": "uber_venom_grip",
  "name": "Uber 猛毒の篭手",
  "slot": "gloves",
  "atk": 75,
  "def": 90,
  "fixedMods": [
    { "type": "poison_chance", "value": 30 },
    { "type": "poison_damage_pct", "value": 60 },
    { "type": "poison_damage_more_pct", "value": 15 }
  ]
}
```

**狙い**: 初めての`poison_damage_more_pct`を持つ装備。毒ビルドの最終火力を大幅に向上。

---

#### 新装備案3: 「Uber 深淵の鱗甲」（防具）

**ドロップ元**: uber_kraken（追加ドロップ）

```json
{
  "id": "uber_abyss_plate",
  "name": "Uber 深淵の鱗甲",
  "slot": "armor",
  "atk": 0,
  "def": 320,
  "fixedMods": [
    { "type": "poison_damage_reduction", "value": 20 },
    { "type": "damage_reduction_pct", "value": 15 },
    { "type": "hp_bonus", "value": 280 }
  ]
}
```

**狙い**: 敵が毒状態時の被ダメージ軽減を大幅に上げ、毒DoTビルドの生存力を向上。

---

### 方針3: 既存Uberユニークの固定MOD追加・変更

#### uber_vampire_stride（靴）の強化

```json
// 現在
"fixedMods": [
  { "type": "attack_speed_pct", "value": 18 },
  { "type": "hp_regen", "value": 80 },
  { "type": "poison_chance", "value": 20 }
]

// 提案
"fixedMods": [
  { "type": "attack_speed_pct", "value": 18 },
  { "type": "hp_regen", "value": 80 },
  { "type": "poison_chance", "value": 20 },
  { "type": "poison_damage_pct", "value": 40 }  // 追加
]
```

#### uber_kraken_eye（アクセ）の強化

```json
// 現在
"fixedMods": [
  { "type": "poison_chance", "value": 25 },
  { "type": "damage_reduction_pct", "value": 8 },
  { "type": "hp_bonus", "value": 220 }
]

// 提案
"fixedMods": [
  { "type": "poison_chance", "value": 25 },
  { "type": "poison_damage_pct", "value": 50 },  // 追加
  { "type": "damage_reduction_pct", "value": 8 },
  { "type": "hp_bonus", "value": 220 }
]
```

---

## 推奨実装順序

### フェーズ1: 最小限の改善（方針3のみ）
- 既存装備の固定MODに`poison_damage_pct`を追加
- 実装コスト: 低
- 効果: 中程度

### フェーズ2: 基礎値強化（方針1）
- 既存Uberユニークの基礎ATK/DEFを強化
- 実装コスト: 低
- 効果: 高

### フェーズ3: 新装備追加（方針2）
- 毒特化のUberユニーク装備を3種類追加
- 実装コスト: 中
- 効果: 最高

---

## 期待される効果

### フェーズ1+2実装後の予測
- uber_demon_lord勝率: 0% → 40-60%
- uber_true_final_boss勝率: 0% → 10-20%

### 全フェーズ実装後の予測
- uber_demon_lord勝率: 0% → 70-90%
- uber_true_final_boss勝率: 0% → 40-60%

---

## 代替案: ボス調整

装備を強化する代わりに、ボスのステータスを調整する案。

### uber_demon_lord調整案
```json
// 現在
"maxHp": 20000,
"atk": 3600,
"def": 1600,

// 提案
"maxHp": 18000,  // -10%
"atk": 3200,     // -11%
"def": 1400,     // -12.5%
```

### uber_true_final_boss調整案
```json
// 現在
"maxHp": 60000,
"atk": 4000,
"def": 1800,

// 提案
"maxHp": 50000,  // -17%
"atk": 3500,     // -12.5%
"def": 1600,     // -11%
```

---

## 結論

**推奨**: 方針2（新装備追加）+ 方針3（既存MOD強化）

理由:
1. プレイヤーに「装備を集めて強くなる」という達成感を提供
2. 毒DoTビルドという明確な攻略ルートを示せる
3. ボス調整よりもゲームとして面白い

**次善策**: 方針1（基礎値強化）+ ボス調整

理由:
1. 実装コストが低い
2. 既存のバランスを大きく崩さない
