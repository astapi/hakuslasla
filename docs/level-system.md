# レベルシステム

## 概要

キャラクターの成長システム。経験値を獲得してレベルアップし、ステータスとスキルポイントが上昇します。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `types/index.ts` | 型定義 |
| `core/player.ts` | レベル計算ロジック |
| `stores/usePlayerStore.ts` | 状態管理・レベルアップ処理 |
| `db/repositories/characterRepository.ts` | キャラクターDB |
| `hooks/useBattle.ts` | 戦闘終了時の経験値付与 |
| `components/player/StatusPanel.tsx` | レベル・経験値表示 |

---

## 1. 型定義

### Character（DB用）

```typescript
interface Character {
  id: number;
  name: string;
  level: number;        // 現在レベル（初期値: 1）
  exp: number;          // 現在経験値（初期値: 0）
  skillPoints: number;  // スキルポイント（初期値: 0）
  maxHp: number;        // 初期値: 100
  atk: number;          // 初期値: 10
  def: number;          // 初期値: 5
  createdAt: string;
  updatedAt: string;
}
```

### PlayerStats（ゲーム状態用）

```typescript
interface PlayerStats {
  level: number;
  exp: number;
  expToNextLevel: number;  // 次のレベルに必要な経験値
  skillPoints: number;
  maxHp: number;
  atk: number;
  def: number;
}
```

### LevelUpResult

```typescript
interface LevelUpResult {
  newLevel: number;
  newExp: number;
  expToNextLevel: number;
  skillPointsGained: number;
  statsGained: {
    maxHp: number;
    atk: number;
    def: number;
  };
}
```

---

## 2. 初期ステータス

**ファイル**: `core/player.ts`

```typescript
export const INITIAL_STATS: Stats = {
  maxHp: 100,
  atk: 10,
  def: 5,
};
```

| 項目 | 初期値 |
|------|--------|
| レベル | 1 |
| 経験値 | 0 |
| スキルポイント | 0 |
| HP | 100 |
| ATK | 10 |
| DEF | 5 |

---

## 3. 経験値計算

### 次のレベルに必要な経験値

```typescript
export function getExpToNextLevel(level: number): number {
  return level * 50;
}
```

**計算式**: `次レベルまでの必要経験値 = 現在レベル × 50`

### 必要経験値テーブル

| レベル | 次レベルまで | 累計経験値 |
|--------|-------------|-----------|
| 1 → 2 | 50 | 50 |
| 2 → 3 | 100 | 150 |
| 3 → 4 | 150 | 300 |
| 4 → 5 | 200 | 500 |
| 5 → 6 | 250 | 750 |
| 10 → 11 | 500 | 2,750 |
| 20 → 21 | 1,000 | 10,500 |

---

## 4. レベルアップボーナス

```typescript
export const LEVEL_UP_BONUS = {
  maxHp: 0,        // ステータス強化はスキルツリーで行う
  atk: 0,          // ステータス強化はスキルツリーで行う
  def: 0,          // ステータス強化はスキルツリーで行う
  skillPoints: 1,  // +1 SP/レベル
};
```

**設計方針**: レベルアップではスキルポイントのみ獲得。HP/ATK/DEFの強化はスキルツリーで行う。

### レベル別基本ステータス

| レベル | HP | ATK | DEF | 累計SP |
|--------|-----|-----|-----|--------|
| 1 | 100 | 10 | 5 | 0 |
| 2 | 100 | 10 | 5 | 1 |
| 3 | 100 | 10 | 5 | 2 |
| 5 | 100 | 10 | 5 | 4 |
| 10 | 100 | 10 | 5 | 9 |
| 20 | 100 | 10 | 5 | 19 |

**ステータス強化方法**:
- スキルツリーでスキルポイントを消費してHP/ATK/DEFを上昇
- 装備品によるボーナス
- MODによるボーナス

---

## 5. レベルアップ処理

### 計算関数（core/player.ts）

```typescript
export function calculateLevelUp(
  currentLevel: number,
  currentExp: number,
  expGained: number
): LevelUpResult {
  let level = currentLevel;
  let exp = currentExp + expGained;
  let expToNext = getExpToNextLevel(level);
  let totalHpGained = 0;
  let totalAtkGained = 0;
  let totalDefGained = 0;
  let skillPointsGained = 0;

  // 複数レベルアップ対応
  while (exp >= expToNext) {
    exp -= expToNext;
    level += 1;
    expToNext = getExpToNextLevel(level);

    totalHpGained += LEVEL_UP_BONUS.maxHp;
    totalAtkGained += LEVEL_UP_BONUS.atk;
    totalDefGained += LEVEL_UP_BONUS.def;
    skillPointsGained += LEVEL_UP_BONUS.skillPoints;
  }

  return {
    newLevel: level,
    newExp: exp,
    expToNextLevel: expToNext,
    skillPointsGained,
    statsGained: {
      maxHp: totalHpGained,
      atk: totalAtkGained,
      def: totalDefGained,
    },
  };
}
```

### 特徴

- **複数レベルアップ対応**: 大量の経験値獲得時に連続レベルアップ
- **whileループ**: `exp >= expToNext` の間繰り返し判定
- **ステータス累積**: 複数レベルアップ分のボーナスを合算

---

## 6. 経験値獲得タイミング

### 戦闘終了時（hooks/useBattle.ts）

```typescript
useEffect(() => {
  const saveResults = async () => {
    if (state.phase === 'cleared' || state.phase === 'defeat') {
      if (state.totalExpGained > 0) {
        await gainExp(state.totalExpGained);
      }
      // ドロップアイテム処理...
    }
  };
  saveResults();
}, [state.phase, state.totalExpGained, ...]);
```

### 経験値獲得フロー

```
敵撃破
  ↓
ENEMY_DEFEATED アクション
  ↓
totalExpGained に加算
  ↓
戦闘終了（cleared / defeat）
  ↓
gainExp(totalExpGained) 呼び出し
  ↓
レベルアップ判定 + DB保存
```

### 敵ごとの経験値

| ダンジョン | 敵 | 経験値 |
|-----------|-----|--------|
| 始まりの草原 | スライム | 10 |
| 始まりの草原 | オオカミ | 14 |
| 地底洞窟 | オーク | 30 |
| 忘却の遺跡 | リッチ | 60 |

---

## 7. ストアでの経験値処理

### gainExp メソッド（stores/usePlayerStore.ts）

```typescript
gainExp: async (amount: number) => {
  const state = get();
  if (!state.characterId) return;

  // レベルアップ計算
  const result = calculateLevelUp(state.level, state.exp, amount);

  // DB保存
  await characterRepository.updateStats(state.characterId, {
    level: result.newLevel,
    exp: result.newExp,
    skillPoints: state.skillPoints + result.skillPointsGained,
    maxHp: state.maxHp + result.statsGained.maxHp,
    atk: state.atk + result.statsGained.atk,
    def: state.def + result.statsGained.def,
  });

  // メモリ状態更新
  set({
    level: result.newLevel,
    exp: result.newExp,
    expToNextLevel: result.expToNextLevel,
    skillPoints: state.skillPoints + result.skillPointsGained,
    maxHp: state.maxHp + result.statsGained.maxHp,
    atk: state.atk + result.statsGained.atk,
    def: state.def + result.statsGained.def,
  });
}
```

---

## 8. DB保存・読み込み

### テーブル定義（db/schema.ts）

```sql
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  skill_points INTEGER NOT NULL DEFAULT 0,
  max_hp INTEGER NOT NULL DEFAULT 100,
  atk INTEGER NOT NULL DEFAULT 10,
  def INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 読み込み（loadCharacter）

```typescript
loadCharacter: async (characterId: number) => {
  const character = await characterRepository.getById(characterId);

  set({
    level: character.level,
    exp: character.exp,
    expToNextLevel: getExpToNextLevel(character.level),  // 動的計算
    skillPoints: character.skillPoints,
    maxHp: character.maxHp,
    atk: character.atk,
    def: character.def,
    isLoaded: true,
  });
}
```

### 保存（updateStats）

```typescript
async updateStats(id: number, stats: UpdateCharacterStats): Promise<void> {
  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (stats.level !== undefined) {
    updates.push('level = ?');
    values.push(stats.level);
  }
  // ... 他のフィールド

  await db.runAsync(
    `UPDATE characters SET ${updates.join(', ')} WHERE id = ?`,
    ...values
  );
}
```

---

## 9. UI表示

### StatusPanel（components/player/StatusPanel.tsx）

```typescript
export const StatusPanel = ({ currentHp }: StatusPanelProps) => {
  const { level, exp, expToNextLevel, skillPoints, getTotalStats } = usePlayerStore();
  const stats = getTotalStats();

  return (
    <View>
      {/* ヘッダー: ステータス + Lv.X */}
      <Text style={styles.level}>Lv.{level}</Text>

      {/* ステータスグリッド: HP, ATK, DEF, SP */}
      <Text>{stats.maxHp}</Text>
      <Text>{stats.atk}</Text>
      <Text>{stats.def}</Text>
      <Text>{skillPoints}</Text>

      {/* EXPバー */}
      <HPBar current={exp} max={expToNextLevel} color="#9C27B0" />
    </View>
  );
};
```

### 表示箇所

| 画面 | 表示内容 |
|------|---------|
| ホーム画面 | レベル、ステータス、EXPバー |
| 戦闘画面 | レベル、現在HP |
| 結果画面 | 獲得経験値（+XXX EXP） |
| キャラクター作成 | 初期ステータスプレビュー |

---

## 10. 合計ステータス計算

### getTotalStats（装備込み）

```typescript
getTotalStats: () => {
  let totalAtk = state.atk;   // 基本ATK（レベル+スキル）
  let totalDef = state.def;   // 基本DEF（レベル+スキル）

  Object.values(state.equipment).forEach((item) => {
    if (item) {
      totalAtk += item.atk;   // 装備ATK
      totalDef += item.def;   // 装備DEF

      // MODボーナス
      if (item.mods) {
        for (const mod of item.mods) {
          if (mod.type === 'atk_bonus') totalAtk += mod.value;
          if (mod.type === 'def_bonus') totalDef += mod.value;
        }
      }
    }
  });

  return { maxHp: state.maxHp, atk: totalAtk, def: totalDef };
}
```

### ステータス構成

```
基本ステータス（レベルベース）
  + スキルボーナス（スキル取得時）
  + 装備ボーナス（装備ATK/DEF）
  + MODボーナス（atk_bonus/def_bonus）
  ─────────────────────────────
  = 合計ステータス（戦闘で使用）
```

---

## 11. スキルポイント連携

### スキル取得時

```typescript
unlockSkill: async (skillId: string): Promise<boolean> => {
  if (state.skillPoints < 1) return false;

  const skill = getSkillNode(skillId);

  // スキル効果適用
  const newMaxHp = state.maxHp + (skill.effect.hp || 0);
  const newAtk = state.atk + (skill.effect.atk || 0);
  const newDef = state.def + (skill.effect.def || 0);
  const newSkillPoints = state.skillPoints - 1;  // 消費

  // DB保存 + メモリ更新
  // ...

  return true;
}
```

### スキルポイントの流れ

```
レベルアップ
  ↓
スキルポイント +1
  ↓
スキル画面で使用
  ↓
スキルポイント -1、ステータス上昇
```

---

## 12. 仕様サマリー

| 項目 | 内容 |
|------|------|
| 初期レベル | 1 |
| 初期HP/ATK/DEF | 100 / 10 / 5 |
| 必要経験値計算 | `level × 50` |
| レベルアップボーナス | SP+1のみ（ステータス上昇なし） |
| ステータス強化 | スキルツリー・装備・MODで行う |
| 複数レベルアップ | 対応 |
| 経験値獲得タイミング | 戦闘終了時（勝敗問わず） |
| DB保存 | 経験値獲得時に即時保存 |

---

## 13. 関連ドキュメント

- [戦闘システム](./battle-system.md) - 経験値獲得の詳細
- [ホーム画面](./home-screen.md) - ステータス表示
- [ダンジョンシステム](./dungeon-system.md) - 敵の経験値
