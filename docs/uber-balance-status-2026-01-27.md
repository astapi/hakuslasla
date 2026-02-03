# Uberボス バランス調整 - 現状認識ドキュメント

**日付**: 2026-01-27
**対象**: エンドコンテンツ（異次元ラッシュ）Uberボスバランス調整

---

## 1. プロジェクト概要

### 背景
- Uberボス実装後、ステータスを雑に強くした結果、勝てるビルドが存在しない状況
- スクリプトでランダムビルドを生成しても勝てないレベル
- 理論的に強いビルド + 適切なボス調整が必要

### 目標
- プレイヤーが適切な装備とビルドで全Uberボスをクリア可能にする
- Uberボスから専用装備をドロップさせ、それを使って次のボスに挑戦できる進行システム

---

## 2. 実施した変更

### 2.1 装備追加・修正

#### 新規追加装備（15アイテム）
1. **毒特化装備（5アイテム）**
   - uber_venom_fang（武器）
   - uber_venom_plate（防具）
   - uber_venom_grip（手袋）
   - uber_venom_stride（靴）
   - uber_venom_heart（アクセサリ）

2. **クリティカル特化装備（5アイテム）**
   - uber_assassin_blade（武器）
   - uber_assassin_coat（防具）
   - uber_assassin_grip（手袋）
   - uber_assassin_steps（靴）
   - uber_assassin_pendant（アクセサリ）

3. **DEF特化装備（5アイテム）**
   - uber_fortress_blade（武器）
   - uber_fortress_plate（防具）
   - uber_fortress_grip（手袋）
   - uber_fortress_stomp（靴）
   - uber_fortress_bulwark（アクセサリ）

#### 既存装備の強化
- 武器ATK: 80-120 → 140-150 (+40-65)
- 防具DEF: 210-260 → 270-340 (+60)
- attack_speed_pct などの追加MOD

#### 毒装備の設計修正（重要）
**初期設計の誤り**：
- 毒付与率を過剰に積んでいた（157%）
- ATKとATK増加%が不足していた

**ユーザーからの指摘**：
> 毒付与率は100%以上積んでも意味がない。毒ダメージ算出のベースはATKなので、装備のATKとATK増加%がとても重要。

**修正内容**：
- uber_venom_fang: poison_chance 35% → 30%, poison_damage_pct → atk_bonus 60
- uber_venom_plate: poison_damage_reduction → poison_damage_pct 80%
- uber_venom_grip: poison_chance 30% → atk_increased_pct 30%, poison_more 15% → 20%
- uber_venom_stride: poison_chance 25% → atk_bonus 50
- uber_venom_heart: poison_chance 30% → 25%, +poison_damage_more_pct 25%

結果：ATK 365 → 656 (+79%), 毒ダメージ 1377 → 3994 (+190%)

### 2.2 MODシステムのバグ修正

**問題**：`core/modEffects.ts`の`applyEquipmentMod()`関数で装備からの毒MODが適用されていなかった

**修正内容**（modEffects.ts:104-120）：
```typescript
case 'poison_damage_pct':
  effects.poisonDamagePct += mod.value;
  break;
case 'poison_damage_more_pct':
  effects.poisonDamageMorePct.push(mod.value);
  break;
case 'poison_max_stacks':
  effects.poisonMaxStacks += mod.value;
  break;
case 'poison_damage_reduction':
  effects.poisonDamageReduction += mod.value;
  break;
case 'poison_lifesteal':
  effects.poisonLifesteal += mod.value;
  break;
case 'hp_on_crit':
  effects.hpOnCrit += mod.value;
  break;
```

**影響**：毒more 0% → 45%、最終毒ダメージが正しく計算されるようになった

### 2.3 ボスステータス調整

#### 初期調整（後に元に戻した）
- uber_demon_lord: ATK 3600 → 2400 (-33%)
- uber_true_final_boss: ATK 4000 → 2800 (-30%)

#### 最終決定（元に戻した）
- uber_demon_lord: ATK **3600**
- uber_true_final_boss: ATK **4000**

**理由**：毒特化ビルドの火力が十分（3994 DPS）で元のATKでも全ボス100%勝率を達成

### 2.4 ゲームシステム変更

**クリティカルダメージ倍率の変更（types.ts:356）**：
```typescript
baseCriticalMultiplier: 1.5 → 3.0
```

**理由**：純粋バランスビルド（毒なし）の火力底上げのため

---

## 3. ビルドテスト結果

### 3.1 毒特化ビルド

**構成**：
- レベル: 60
- パッシブ: poison(20) + guard(15) + regen(14) = 49ノード
- 装備: 修正後の毒装備フルセット

**ステータス**：
- HP: 1979
- ATK: 656
- DEF: 916
- ダメージ軽減: 35%

**MOD効果**：
- 毒付与率: 92%
- 毒ダメージ: +320%
- 毒more: +45%
- 最終毒ダメージ: **3994 DPS**
- 攻撃速度: +45%

**勝率**：
| ボス | 勝率 |
|------|------|
| Uber ゴブリンキング | ✅ 100% |
| Uber 盗賊の頭 | ✅ 100% |
| Uber ヴァンパイア | ✅ 100% |
| Uber クラーケン | ✅ 100% |
| Uber 魔王 | ✅ 100% |
| Uber 終焉の王 | ✅ 100% |

**評価**：完璧。全ボス制覇。

### 3.2 純粋バランスビルド（Lv60/59P版）

**コンセプト**：
- 毒に頼らず、ATK + 攻撃速度 + HIT時回復で押し切る
- クリティカル率93%、クリ倍率3.0倍を活用

**構成**：
- レベル: 60（パッシブポイント59）
- パッシブ: vamp(20) + guard(20) + speed(14) + regen(5) = 59ノード
- 装備: uber_vampire_fang + uber_fortress_plate + uber_vampire_grip + uber_bandit_steps + uber_vampire_heart

**ステータス**：
- HP: 1872
- ATK: 794
- DEF: 1490
- ダメージ軽減: 42%

**MOD効果**：
- HIT時HP回復: +240
- ターンHP回復: +188 (+2.5%)
- クリティカル: 93% / +0%
- 攻撃速度: +128% (2.28倍)
- 毒付与: 0%

**理論DPS計算**：
```
基本ダメージ = 794 × (1 - 1200/(1200+500)) = 794 × 0.294 = 233
クリダメージ = 233 × 3.0 = 699
期待値 = 699 × 0.93 + 233 × 0.07 = 666
最終DPS = 666 × 2.28 = 1518 DPS
```

**勝率**：
| ボス | 勝率 |
|------|------|
| Uber ゴブリンキング | ❌ 0% |
| Uber 盗賊の頭 | ✅ 100% |
| Uber ヴァンパイア | ✅ 100% |
| Uber クラーケン | ✅ 100% |
| Uber 魔王 | ❌ 0% |
| Uber 終焉の王 | ❌ 0% |

**評価**：3/6ボスクリア。uber_goblin_kingで詰まる。

### 3.3 その他のビルド結果

**クリティカル特化**（testAllBuilds.ts）：
- 勝率: 3/6 (50%)
- 問題点: HPが低すぎる（912）

**極限タンク**（testAllBuilds.ts）：
- 勝率: 2/6 (33.3%)
- 問題点: 火力不足（ATK 497、攻撃速度0%）

---

## 4. 現在の問題点

### 4.1 uber_goblin_kingの特殊能力

**判明した特殊能力**：
1. **毎秒2000リジェネ**
2. **HP50%以下でHIT時500回復**

### 4.2 純粋バランスビルドの課題

**DPS不足**：
- プレイヤーDPS: **1518**
- ボスリジェネ: **2000**
- **差分: -482** ← 削りきれない

**HP50%以降はさらに厳しい**：
- ボスのHIT時回復500が追加される
- 実質的に倒せない

### 4.3 毒特化との比較

| 項目 | 毒特化 | 純粋バランス |
|------|--------|-------------|
| DPS | 3994 | 1518 |
| ボスリジェネに対して | 余裕で上回る | 届かない |
| HIT時回復トリガー | しない（毒DoT） | する（直接攻撃） |

**毒特化が有利な理由**：
- 毒DoTは「HIT」ではないので、ボスのHIT時回復を発動させない
- DPSがリジェネを大きく上回る

---

## 5. ゲームバランス設定

### DEF減衰式
```typescript
defReduction = def / (def + 500)
```

**例**：
- DEF 500: 50%軽減
- DEF 1000: 66.7%軽減
- DEF 1200: 70.6%軽減
- DEF 1500: 75%軽減

### クリティカル計算
```typescript
critMultiplier = baseCriticalMultiplier(3.0) + criticalDamage / 100
```

**例**：
- critical_damage +0%: 3.0倍
- critical_damage +100%: 4.0倍
- critical_damage +300%: 6.0倍

### 毒ダメージ計算
```typescript
poisonDamage = ATK × (1 + poisonDamagePct/100) × (1 + totalPoisonMore/100)
```

---

## 6. 今後の方向性（提案）

### 6.1 純粋バランスビルドの改善案

**A. DPSを2000以上に引き上げる**
- ATKを上げる（武器変更、ATKボーナス追加）
- クリティカルダメージMODを追加（+100-300%）
- 目標DPS: 2500程度

**B. uber_goblin_kingを諦める**
- このビルドは他のボス（Bandit/Vampire/Kraken）専用とする
- 別のビルドでgoblin_kingに対応

**C. 装備の組み合わせを再検討**
- より攻撃的な装備（uber_bandit_dagger等、ATKの高い武器）
- クリティカルダメージMODのある装備

### 6.2 バランス調整の選択肢

**オプションA: uber_goblin_kingのリジェネを下げる**
- 2000 → 1000程度
- バランスビルドでも対応可能に

**オプションB: 現状維持**
- 毒特化ビルドは完璧に機能している
- 純粋バランスは別の役割（中級ボス用）として位置づける

**オプションC: より多様なビルドを育てる**
- クリティカルダメージ特化
- 攻撃速度極振り
- など

---

## 7. 技術的な学び

### 7.1 毒ビルドの設計原則
1. **毒付与率は100%程度で十分**（それ以上は無駄）
2. **毒ダメージのベースはATK** → ATKとATK増加%を優先
3. **毒ダメージ%と毒more%でダメージを倍化**

### 7.2 DEF軽減の重要性
- DEF 1200は70.6%軽減 = 攻撃力を1/3以下に抑える
- 高DEFボス相手にはATKを大幅に盛る必要がある

### 7.3 ボス特殊能力の影響
- リジェネ2000は非常に強力
- DPSベースの戦略には大きな障壁
- DoT系（毒）はリジェネを気にせず有利

---

## 8. テストスクリプト一覧

| スクリプト | 用途 | 結果 |
|-----------|------|------|
| testCorrectedPoisonBuild.ts | 修正後の毒特化ビルド | 6/6 ✅ |
| testAllBuilds.ts | 4種類のビルド比較 | 毒のみ6/6 |
| testPureBalanceBuild.ts | 純粋バランス（49P） | 3/6 |
| testPureBalanceLv60.ts | 純粋バランス（59P） | 3/6 |
| testHybridBuild.ts | ハイブリッドビルド | 未更新 |
| testImprovedBuilds.ts | 強化装備テスト | 古い装備定義使用 |

---

## 9. 結論

### 成功した点
✅ 毒特化ビルドは完璧に機能（全Uber制覇）
✅ MODバグ修正により装備が正しく機能
✅ ボスステータスは元の値で問題なし

### 未解決の課題
❌ 純粋バランスビルドがuber_goblin_kingを突破できない
❌ クリティカル特化ビルドの耐久力不足
❌ タンクビルドの火力不足

### 次のステップ
1. 純粋バランスビルドのATK/クリダメ強化を検討
2. uber_goblin_kingのリジェネ調整を検討
3. 多様なビルドが成立するバランスを目指す

---

**ドキュメント作成者**: Claude Code
**最終更新**: 2026-01-27
