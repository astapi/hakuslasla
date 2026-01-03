# ホーム画面

## 概要

ゲームの中心ハブとなる画面。キャラクター情報の確認、装備の確認、各機能への遷移を行います。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `app/home.tsx` | ホーム画面（メイン） |
| `components/player/StatusPanel.tsx` | ステータスパネル |
| `components/player/EquipmentSlots.tsx` | 装備スロット表示 |
| `components/battle/HPBar.tsx` | HP/EXPバー |
| `stores/usePlayerStore.ts` | プレイヤー状態管理 |
| `data/images.ts` | 画像マッピング |

---

## 1. 画面レイアウト

```
┌─────────────────────────────────────────────────────────┐
│ キャラクター情報セクション                                │
│ ┌──────────┬──────────────────────────────────────────┐ │
│ │          │ キャラクター名              [変更]      │ │
│ │  [画像]  │ ┌──────────────────────────────────────┐│ │
│ │          │ │ ステータス              Lv.5        ││ │
│ │          │ │ HP 100 │ ATK 25 │ DEF 10 │ SP 2    ││ │
│ │          │ │ EXP ████████░░░░░░░░ 50/100         ││ │
│ │          │ └──────────────────────────────────────┘│ │
│ └──────────┴──────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 装備スロットセクション                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [武器] [防具] [手袋] [靴] [アクセ]                  │ │
│ │ 草原の剣  -    革の手袋 うさぎの  毒針の           │ │
│ │ +8ATK        +2DEF   ブーツ   指輪              │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ 下部メニューバー（固定）                                 │
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │  スキル  │  持ち物  │   倉庫   │   冒険   │          │
│ │    ★    │    🎒    │    📦    │    🏰    │          │
│ └──────────┴──────────┴──────────┴──────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 表示情報

### キャラクター情報

| 項目 | 説明 | ソース |
|------|------|--------|
| 画像 | キャラクター立ち絵（120×160px） | `playerImages.standing` |
| 名前 | キャラクター名 | `usePlayerStore.characterName` |
| 変更ボタン | キャラクター選択画面へ | `clear()` + `router.replace('/')` |

### ステータスパネル

| 項目 | 説明 | 計算方法 |
|------|------|---------|
| レベル | 現在レベル | `level` |
| HP | 最大HP | `getTotalStats().maxHp` |
| ATK | 攻撃力（装備込み） | `getTotalStats().atk` |
| DEF | 防御力（装備込み） | `getTotalStats().def` |
| SP | スキルポイント | `skillPoints` |
| EXP | 経験値バー | `exp / expToNextLevel` |

### 装備スロット

| スロット | 日本語名 | 表示内容 |
|---------|---------|---------|
| weapon | 武器 | アイテム名、ATK、MOD数 |
| armor | 防具 | アイテム名、DEF、MOD数 |
| gloves | 手袋 | アイテム名、ATK/DEF、MOD数 |
| boots | 靴 | アイテム名、DEF、MOD数 |
| accessory | アクセ | アイテム名、ATK/DEF、MOD数 |

---

## 3. ナビゲーション

### 下部メニューボタン

| ボタン | アイコン | 遷移先 | 説明 |
|-------|---------|--------|------|
| スキル | star-four-points | `/skills` | スキルツリー画面 |
| 持ち物 | bag-personal | `/inventory` | インベントリ画面 |
| 倉庫 | treasure-chest | `/storage` | 倉庫画面 |
| 冒険 | castle | `/dungeon-select` | ダンジョン選択画面 |

### スキルボタンの特別表示

```typescript
// SP > 0 の場合
- アイコン色: 黄金色 (#FFD700)
- SPバッジ表示（赤背景）
- ラベル色: 黄金色

// SP = 0 の場合
- アイコン色: 白
- バッジ非表示
- ラベル色: グレー (#aaa)
```

### ハンドラー関数

```typescript
const handleOpenSkills = () => router.push('/skills');
const handleOpenInventory = () => router.push('/inventory');
const handleOpenStorage = () => router.push('/storage');
const handleOpenDungeonSelect = () => router.push('/dungeon-select');

const handleChangeCharacter = () => {
  clear();  // ストア状態リセット
  router.replace('/');  // キャラクター選択画面へ
};
```

---

## 4. コンポーネント構成

### HomeScreen (app/home.tsx)

```typescript
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentSlots } from '@/components/player/EquipmentSlots';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { playerImages } from '@/data/images';

export default function HomeScreen() {
  const router = useRouter();
  const { skillPoints, characterName, isLoaded, clear } = usePlayerStore();

  // ロード中の表示
  if (!isLoaded) {
    return <LoadingView />;
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* キャラクター情報 */}
        {/* 装備スロット */}
      </ScrollView>
      {/* 下部メニュー */}
    </View>
  );
}
```

### StatusPanel (components/player/StatusPanel.tsx)

```typescript
interface StatusPanelProps {
  currentHp?: number;  // 戦闘中の現在HP（オプション）
}

export const StatusPanel = ({ currentHp }: StatusPanelProps) => {
  const {
    level, exp, expToNextLevel, skillPoints,
    maxHp, atk, def, equipment, getTotalStats
  } = usePlayerStore();

  const stats = getTotalStats();

  return (
    <View>
      {/* ヘッダー: ステータス + Lv.X */}
      {/* グリッド: HP, ATK, DEF, SP */}
      {/* EXPバー */}
    </View>
  );
};
```

### EquipmentSlots (components/player/EquipmentSlots.tsx)

```typescript
export const EquipmentSlots = () => {
  const { equipment } = usePlayerStore();

  return (
    <View style={styles.container}>
      {SLOT_ORDER.map((slot) => (
        <SlotDisplay key={slot} slot={slot} item={equipment[slot]} />
      ))}
    </View>
  );
};
```

---

## 5. プレイヤーストア連携

### 購読される状態

```typescript
// HomeScreen
const { skillPoints, characterName, isLoaded, clear } = usePlayerStore();

// StatusPanel
const { level, exp, expToNextLevel, skillPoints,
        maxHp, atk, def, equipment, getTotalStats } = usePlayerStore();

// EquipmentSlots
const { equipment } = usePlayerStore();
```

### ステータス計算

```typescript
getTotalStats: () => {
  let totalAtk = state.atk;
  let totalDef = state.def;

  Object.values(state.equipment).forEach((item) => {
    if (item) {
      totalAtk += item.atk;
      totalDef += item.def;

      // MODボーナス加算
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

---

## 6. スタイリング

### 色スキーム

| 用途 | 色 | 値 |
|------|-----|-----|
| 背景（メイン） | ダークネイビー | #1a1a2e |
| 背景（メニューバー） | 濃紺 | #16213e |
| 背景（パネル） | 半透明黒 | rgba(0, 0, 0, 0.5) |
| テキスト（主） | 白 | #fff |
| テキスト（サブ） | グレー | #aaa |
| 強調（レベル） | 黄金色 | #FFD700 |
| ステータス（アップ） | 緑 | #4CAF50 |
| EXPバー | 紫 | #9C27B0 |

### 主要スタイル

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,  // 下部メニュー分の余白
  },
  characterSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  characterImage: {
    width: 120,
    height: 160,
    marginRight: 16,
  },
  bottomMenu: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,  // セーフエリア対応
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
```

---

## 7. ロード状態処理

```typescript
if (!isLoaded) {
  return (
    <View style={styles.container}>
      <Text style={styles.loadingText}>読み込み中...</Text>
    </View>
  );
}
```

- `loadCharacter()` 完了時に `isLoaded = true`
- DBからの全データ取得完了を待機
- ホーム画面表示の前提条件

---

## 8. 画面遷移フロー

```
キャラクター選択 (/)
  ↓ handleSelectCharacter()
  ↓ loadCharacter() + router.replace('/home')
ホーム画面 (/home)
  ├→ スキル → /skills
  ├→ 持ち物 → /inventory
  ├→ 倉庫 → /storage
  ├→ 冒険 → /dungeon-select → /battle/[id] → /result → /home
  └→ 変更 → clear() + router.replace('/') → キャラ選択
```

### 遷移時の注意

- `router.replace()` を使用（戻るボタン対策）
- `/home` は `headerBackVisible: false` で戻るボタン非表示
- キャラクター変更時は `clear()` でストア状態をリセット

---

## 9. 関連ドキュメント

- [インベントリ・倉庫システム](./inventory-storage-system.md) - 持ち物・倉庫画面
- [戦闘システム](./battle-system.md) - 冒険の戦闘フロー
- [ダンジョンシステム](./dungeon-system.md) - ダンジョン選択
- [MODシステム](./mod-system.md) - 装備MODの詳細
