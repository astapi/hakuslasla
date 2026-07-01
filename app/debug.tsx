import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
 Share } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { createItemInstance } from '@/data/items';
import { buildCharacterBuildSnapshot } from '@/utils/buildSnapshot';
import {
  PRESET_TYPES,
  PRESET_NAMES,
  PresetType,
  PresetLevel,
  applyPresetToCharacter,
  EQUIPMENT_SET_TYPES,
  EQUIPMENT_SET_NAMES,
  DUNGEON_INFO,
  EquipmentSetType,
  applyEquipmentPresetToCharacter,
  BUILD_PRESETS,
  applyBuildPresetToCharacter,
  applyGoblinKingScreenshotPreset,
  addRankingCharacters,
} from '@/utils/debugPresets';
import {
  settingsRepository,
  BattleSpeedMultiplier,
  BATTLE_SPEED_OPTIONS,
  DEFAULT_BATTLE_SPEED,
} from '@/db/repositories/settingsRepository';
import { usePurchaseStore, hasSpeedBoost } from '@/stores/usePurchaseStore';
import { getOrCreateMyInviteCode } from '@/lib/inviteCode';
import { EndContentTooltip } from '@/components/common/EndContentTooltip';
import { UberTreeTooltip } from '@/components/common/UberTreeTooltip';
import { DimensionalCorridorTooltip } from '@/components/common/DimensionalCorridorTooltip';

const LEVELS: PresetLevel[] = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

// 今回修正したMODを持つユニークアイテム一覧
const DEBUG_UNIQUE_ITEMS = [
  { id: 'double_strike_ring', name: '双撃の指輪', mod: 'クリティカル時追撃' },
  { id: 'uber_double_strike_ring', name: 'Uber 双撃の指輪', mod: 'クリティカル時追撃' },
  { id: 'dragon_heart', name: 'ドラゴンの心臓', mod: 'HP回復→ATK変換' },
  { id: 'magma_core', name: '炎の精霊の杖', mod: '発火吸収' },
  { id: 'uber_assassin_steps', name: 'Uber 暗殺者の足運び', mod: 'クリ時HP回復' },
  { id: 'uber_endblade', name: 'Uber 時の試練の剣', mod: 'ATK増加%' },
  { id: 'uber_kraken_eye', name: 'Uber クラーケンの瞳', mod: '毒ダメ/more/被ダメ減' },
  { id: 'uber_vampire_stride', name: 'Uber 吸血鬼の歩み', mod: '毒ダメージ%' },
  { id: 'uber_venom_grip', name: 'Uber 毒蛇の手甲', mod: '毒ダメ/more' },
  { id: 'uber_venom_heart', name: 'Uber 毒蛇の心臓', mod: '毒ダメ/more' },
  { id: 'uber_venom_plate', name: 'Uber 毒蛇の鎧', mod: '毒ダメージ%' },
] as const;

export default function DebugScreen() {
  const router = useRouter();
  const {
    level,
    unlockedSkills,
    unlockedUberSkills,
    uberPoints,
    equipment,
    inventory,
    pets,
    activePetInstanceId,
    petLevels,
    refresh,
    addToInventory,
  } = usePlayerStore();
  const [showBuildJson, setShowBuildJson] = useState(false);

  // パッシブプリセット
  const [selectedType, setSelectedType] = useState<PresetType>('REGEN');
  const [selectedLevel, setSelectedLevel] = useState<PresetLevel>(35);
  const [isApplyingPassive, setIsApplyingPassive] = useState(false);

  // 装備プリセット
  const [selectedDungeon, setSelectedDungeon] = useState<string>('volcano');
  const [selectedEquipType, setSelectedEquipType] = useState<EquipmentSetType>('DEF');
  const [isApplyingEquip, setIsApplyingEquip] = useState(false);
  const [selectedBuildId, setSelectedBuildId] = useState<string>(BUILD_PRESETS[0]?.id ?? '');
  const [isApplyingBuild, setIsApplyingBuild] = useState(false);
  const [isOpeningGoblinKingScreenshot, setIsOpeningGoblinKingScreenshot] = useState(false);

  // 戦闘速度設定
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);

  // 招待コード
  const [inviteBoostActive, setInviteBoostActive] = useState(false);

  // Tips表示
  const [showEndContentTooltip, setShowEndContentTooltip] = useState(false);
  const [showUberTreeTooltip, setShowUberTreeTooltip] = useState(false);
  const [showDimensionalCorridorTooltip, setShowDimensionalCorridorTooltip] = useState(false);

  // 戦闘速度設定・招待コード状態の読み込み
  useEffect(() => {
    const loadSettings = async () => {
      const speed = await settingsRepository.getBattleSpeed();
      setBattleSpeed(speed);
      const boost = await settingsRepository.getInviteSpeedBoost();
      setInviteBoostActive(boost);
    };
    loadSettings();
  }, []);

  const handleBattleSpeedChange = async (speed: BattleSpeedMultiplier) => {
    setBattleSpeed(speed);
    await settingsRepository.setBattleSpeed(speed);
  };

  const handleApplyPassivePreset = async () => {
    Alert.alert(
      'パッシブプリセット適用',
      `${PRESET_NAMES[selectedType]} LV${selectedLevel} を適用します。\n\n現在のスキルはリセットされます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '適用',
          style: 'destructive',
          onPress: async () => {
            setIsApplyingPassive(true);
            try {
              const success = await applyPresetToCharacter(selectedType, selectedLevel);
              if (success) {
                await refresh();
                Alert.alert('完了', `${PRESET_NAMES[selectedType]} LV${selectedLevel} を適用しました`);
              } else {
                Alert.alert('エラー', 'プリセットの適用に失敗しました');
              }
            } catch (error) {
              Alert.alert('エラー', '予期しないエラーが発生しました');
              console.error(error);
            } finally {
              setIsApplyingPassive(false);
            }
          },
        },
      ]
    );
  };

  const handleApplyEquipmentPreset = async () => {
    const dungeonName = DUNGEON_INFO.find(d => d.id === selectedDungeon)?.name || selectedDungeon;
    Alert.alert(
      '装備プリセット適用',
      `${dungeonName}の${EQUIPMENT_SET_NAMES[selectedEquipType]}装備を適用します。\n\n現在の装備・インベントリはリセットされます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '適用',
          style: 'destructive',
          onPress: async () => {
            setIsApplyingEquip(true);
            try {
              const success = await applyEquipmentPresetToCharacter(selectedDungeon, selectedEquipType);
              if (success) {
                await refresh();
                Alert.alert('完了', `${dungeonName}の${EQUIPMENT_SET_NAMES[selectedEquipType]}装備を適用しました`);
              } else {
                Alert.alert('エラー', '装備プリセットの適用に失敗しました');
              }
            } catch (error) {
              Alert.alert('エラー', '予期しないエラーが発生しました');
              console.error(error);
            } finally {
              setIsApplyingEquip(false);
            }
          },
        },
      ]
    );
  };

  const handleApplyBuildPreset = async () => {
    if (!selectedBuildId) return;
    Alert.alert(
      'ビルドプリセット適用',
      '現在の装備・パッシブはリセットされます。適用しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '適用',
          style: 'destructive',
          onPress: async () => {
            setIsApplyingBuild(true);
            try {
              const success = await applyBuildPresetToCharacter(selectedBuildId);
              if (success) {
                await refresh();
                const name = BUILD_PRESETS.find((b) => b.id === selectedBuildId)?.name ?? '';
                Alert.alert('完了', `${name} を適用しました`);
              } else {
                Alert.alert('エラー', 'ビルド適用に失敗しました');
              }
            } catch (error) {
              Alert.alert('エラー', '予期しないエラーが発生しました');
              console.error(error);
            } finally {
              setIsApplyingBuild(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenGoblinKingScreenshotBattle = async () => {
    setIsOpeningGoblinKingScreenshot(true);
    try {
      const success = await applyGoblinKingScreenshotPreset();
      if (!success) {
        Alert.alert('エラー', 'ゴブリンキング戦用プリセットの適用に失敗しました');
        return;
      }
      await refresh();
      router.replace('/battle/uber_uber_goblin_king?startFloor=1&staticBattle=1&screenshotBattle=1' as any);
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
      console.error(error);
    } finally {
      setIsOpeningGoblinKingScreenshot(false);
    }
  };

  // ランキングキャラ追加
  const [isAddingRanking, setIsAddingRanking] = useState(false);

  const handleAddRankingCharacters = async () => {
    Alert.alert(
      'ランキングキャラ追加',
      '次元回廊ランキングTOP3のキャラクターを新規キャラとしてDBに追加します。\n\n※スロット上限を無視して追加します',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '追加',
          onPress: async () => {
            setIsAddingRanking(true);
            try {
              const result = await addRankingCharacters(3);
              if (result.added > 0) {
                const names = result.characters
                  .map((c) => `${c.rank}位: ${c.name} (${c.floorReached}F)`)
                  .join('\n');
                Alert.alert(
                  '完了',
                  `${result.added}キャラクターを追加しました\n\n${names}\n\n※キャラ選択画面から確認できます`
                );
              } else {
                Alert.alert('エラー', 'ランキングデータの取得に失敗しました');
              }
            } catch (error) {
              console.error('[Debug] Add ranking characters failed:', error);
              Alert.alert('エラー', `追加に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
            } finally {
              setIsAddingRanking(false);
            }
          },
        },
      ]
    );
  };

  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const handleAddUniqueItem = async (itemId: string, itemName: string) => {
    setAddingItemId(itemId);
    try {
      const item = createItemInstance(itemId);
      if (!item) {
        Alert.alert('エラー', `アイテム ${itemId} の生成に失敗しました`);
        return;
      }
      const success = await addToInventory(item);
      if (success) {
        Alert.alert('完了', `${itemName} をインベントリに追加しました`);
      } else {
        Alert.alert('エラー', 'インベントリが一杯です');
      }
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
      console.error(error);
    } finally {
      setAddingItemId(null);
    }
  };

  // 現在の装備数を計算
  const equippedCount = Object.values(equipment).filter(Boolean).length;
  const buildJson = JSON.stringify(
    buildCharacterBuildSnapshot({
      level,
      equipment,
      pets,
      activePetInstanceId,
      petLevels,
      unlockedSkills,
      unlockedUberSkills,
      uberPoints,
    }),
    null,
    2
  );
  const handleCopyBuildJson = async () => {
    setShowBuildJson(true);
    try {
      await Share.share({ message: buildJson });
    } catch {
      Alert.alert(
        '共有不可',
        '共有シートを開けませんでした。下のJSONを長押しで選択してコピーしてください。'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>デバッグメニュー</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 現在の状態 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>現在の状態</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>レベル: {level}</Text>
            <Text style={styles.infoText}>取得スキル数: {unlockedSkills.length}</Text>
            <Text style={styles.infoText}>装備数: {equippedCount}/5</Text>
          </View>
          <View style={styles.buildActionRow}>
            <Pressable
              style={styles.buildToggleButton}
              onPress={() => setShowBuildJson((prev) => !prev)}
            >
              <Text style={styles.buildToggleText}>
                {showBuildJson ? 'ビルドJSONを隠す' : 'ビルドJSONを表示'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.buildCopyButton}
              onPress={handleCopyBuildJson}
            >
              <MaterialCommunityIcons name="share-variant" size={14} color="#ddd" />
              <Text style={styles.buildCopyText}>共有</Text>
            </Pressable>
          </View>
          {showBuildJson && (
            <View style={styles.buildJsonBox}>
              <Text style={styles.buildJsonText} selectable>
                {buildJson}
              </Text>
            </View>
          )}
        </View>

        {/* ========================================
            パッシブプリセット
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="star-four-points" size={20} color="#FFD700" />
          <Text style={styles.sectionHeaderText}>パッシブプリセット</Text>
        </View>

        {/* プリセットタイプ選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>タイプ</Text>
          <View style={styles.presetGrid}>
            {PRESET_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.presetButton,
                  selectedType === type && styles.presetButtonSelected,
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedType === type && styles.presetButtonTextSelected,
                  ]}
                >
                  {PRESET_NAMES[type]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* レベル選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>レベル</Text>
          <View style={styles.levelGrid}>
            {LEVELS.map((lv) => (
              <Pressable
                key={lv}
                style={[
                  styles.levelButton,
                  selectedLevel === lv && styles.levelButtonSelected,
                ]}
                onPress={() => setSelectedLevel(lv)}
              >
                <Text
                  style={[
                    styles.levelButtonText,
                    selectedLevel === lv && styles.levelButtonTextSelected,
                  ]}
                >
                  LV{lv}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* パッシブ適用ボタン */}
        <View style={styles.section}>
          <Pressable
            style={[styles.applyButton, isApplyingPassive && styles.applyButtonDisabled]}
            onPress={handleApplyPassivePreset}
            disabled={isApplyingPassive}
          >
            <MaterialCommunityIcons
              name="star-four-points"
              size={20}
              color="#fff"
              style={styles.applyIcon}
            />
            <Text style={styles.applyButtonText}>
              {isApplyingPassive ? '適用中...' : `${PRESET_NAMES[selectedType]} LV${selectedLevel} を適用`}
            </Text>
          </Pressable>
        </View>

        {/* ========================================
            装備プリセット
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="sword" size={20} color="#4CAF50" />
          <Text style={styles.sectionHeaderText}>装備プリセット</Text>
        </View>

        {/* ダンジョン選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ダンジョン（装備元）</Text>
          <View style={styles.dungeonGrid}>
            {DUNGEON_INFO.map((dungeon) => (
              <Pressable
                key={dungeon.id}
                style={[
                  styles.dungeonButton,
                  selectedDungeon === dungeon.id && styles.dungeonButtonSelected,
                ]}
                onPress={() => setSelectedDungeon(dungeon.id)}
              >
                <Text
                  style={[
                    styles.dungeonButtonText,
                    selectedDungeon === dungeon.id && styles.dungeonButtonTextSelected,
                  ]}
                >
                  {dungeon.name}
                </Text>
                <Text
                  style={[
                    styles.dungeonLevelText,
                    selectedDungeon === dungeon.id && styles.dungeonLevelTextSelected,
                  ]}
                >
                  LV{dungeon.level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 装備タイプ選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>装備タイプ</Text>
          <View style={styles.equipTypeGrid}>
            {EQUIPMENT_SET_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.equipTypeButton,
                  selectedEquipType === type && styles.equipTypeButtonSelected,
                ]}
                onPress={() => setSelectedEquipType(type)}
              >
                <Text
                  style={[
                    styles.equipTypeButtonText,
                    selectedEquipType === type && styles.equipTypeButtonTextSelected,
                  ]}
                >
                  {EQUIPMENT_SET_NAMES[type]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 装備適用ボタン */}
        <View style={styles.section}>
          <Pressable
            style={[styles.applyButton, styles.applyButtonEquip, isApplyingEquip && styles.applyButtonDisabled]}
            onPress={handleApplyEquipmentPreset}
            disabled={isApplyingEquip}
          >
            <MaterialCommunityIcons
              name="sword"
              size={20}
              color="#fff"
              style={styles.applyIcon}
            />
            <Text style={styles.applyButtonText}>
              {isApplyingEquip
                ? '適用中...'
                : `${DUNGEON_INFO.find(d => d.id === selectedDungeon)?.name}の${EQUIPMENT_SET_NAMES[selectedEquipType]}装備を適用`}
            </Text>
          </Pressable>
        </View>

        {/* ========================================
            ビルドプリセット
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="account-cog" size={20} color="#80DEEA" />
          <Text style={styles.sectionHeaderText}>ビルドプリセット</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ビルド</Text>
          <View style={styles.presetGrid}>
            {BUILD_PRESETS.map((build) => (
              <Pressable
                key={build.id}
                style={[
                  styles.presetButton,
                  selectedBuildId === build.id && styles.presetButtonSelected,
                ]}
                onPress={() => setSelectedBuildId(build.id)}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedBuildId === build.id && styles.presetButtonTextSelected,
                  ]}
                >
                  {build.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={[styles.applyButton, isApplyingBuild && styles.applyButtonDisabled]}
            onPress={handleApplyBuildPreset}
            disabled={isApplyingBuild}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={18}
              color="#fff"
              style={styles.applyIcon}
            />
            <Text style={styles.applyButtonText}>
              {isApplyingBuild ? '適用中...' : 'ビルド適用'}
            </Text>
          </Pressable>
        </View>

        {/* ========================================
            ストアスクショ用
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="camera" size={20} color="#FFB74D" />
          <Text style={styles.sectionHeaderText}>ストアスクショ用</Text>
        </View>

        <View style={styles.section}>
          <Pressable
            style={[
              styles.applyButton,
              styles.screenshotButton,
              isOpeningGoblinKingScreenshot && styles.applyButtonDisabled,
            ]}
            onPress={handleOpenGoblinKingScreenshotBattle}
            disabled={isOpeningGoblinKingScreenshot}
          >
            <MaterialCommunityIcons
              name="sword-cross"
              size={20}
              color="#fff"
              style={styles.applyIcon}
            />
            <Text style={styles.applyButtonText}>
              {isOpeningGoblinKingScreenshot
                ? '準備中...'
                : 'UberUberゴブリンキング 戦闘中へ'}
            </Text>
          </Pressable>
        </View>

        {/* ========================================
            戦闘速度設定
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="fast-forward" size={20} color="#2196F3" />
          <Text style={styles.sectionHeaderText}>戦闘速度設定</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>速度倍率</Text>
          <View style={styles.speedGrid}>
            {BATTLE_SPEED_OPTIONS.map((speed) => (
              <Pressable
                key={speed}
                style={[
                  styles.speedButton,
                  battleSpeed === speed && styles.speedButtonSelected,
                ]}
                onPress={() => handleBattleSpeedChange(speed)}
              >
                <Text
                  style={[
                    styles.speedButtonText,
                    battleSpeed === speed && styles.speedButtonTextSelected,
                  ]}
                >
                  {speed}x
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.speedHint}>
            {battleSpeed === 1
              ? '通常速度'
              : `戦闘が${battleSpeed}倍速で進行します`}
          </Text>
        </View>

        {/* ========================================
            招待コード
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="ticket-confirmation" size={20} color="#FF9800" />
          <Text style={styles.sectionHeaderText}>招待コード</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              招待コード倍速: {inviteBoostActive ? '有効' : '無効'}
            </Text>
            <Text style={styles.infoText}>
              hasSpeedBoost(): {hasSpeedBoost() ? 'true' : 'false'}
            </Text>
          </View>

          <Pressable
            style={[styles.applyButton, styles.resetButton]}
            onPress={() => {
              Alert.alert(
                '招待コードリセット',
                '招待コードの有効化をリセットし、Firestoreのドキュメントを削除して新しいコードを再生成します。',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: 'リセット',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        // 1. ローカルの倍速フラグをリセット
                        await settingsRepository.setInviteSpeedBoost(false);
                        usePurchaseStore.getState().setInviteSpeedBoost(false);
                        setInviteBoostActive(false);

                        // 2. ローカルのコードキャッシュをクリア（Firestoreは手動削除前提）
                        await settingsRepository.setMyInviteCode('');

                        // 4. 新しいコードを再生成
                        const newCode = await getOrCreateMyInviteCode();

                        Alert.alert('完了', `リセットしました。\n新しいコード: ${newCode}`);
                      } catch (error) {
                        console.error('[Debug] Invite code reset failed:', error);
                        Alert.alert('エラー', 'リセットに失敗しました');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <MaterialCommunityIcons name="restore" size={20} color="#fff" style={styles.applyIcon} />
            <Text style={styles.applyButtonText}>招待コードをリセット＆再生成</Text>
          </Pressable>
        </View>

        {/* ========================================
            ランキングキャラ追加
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" />
          <Text style={styles.sectionHeaderText}>ランキングキャラ追加</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>次元回廊TOP3をキャラとして追加</Text>
          <Text style={styles.rankingHint}>
            Firestoreからランキング上位3名のデータを取得し、{'\n'}
            新規キャラクターとしてDBに追加します。{'\n'}
            装備はユニーク固有MODのみ復元されます。
          </Text>
          <Pressable
            style={[styles.applyButton, styles.rankingButton, isAddingRanking && styles.applyButtonDisabled]}
            onPress={handleAddRankingCharacters}
            disabled={isAddingRanking}
          >
            <MaterialCommunityIcons
              name="trophy"
              size={20}
              color="#fff"
              style={styles.applyIcon}
            />
            <Text style={styles.applyButtonText}>
              {isAddingRanking ? '取得中...' : 'TOP3キャラを追加'}
            </Text>
          </Pressable>
        </View>

        {/* ========================================
            ユニークアイテム追加（MOD表示確認用）
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="ring" size={20} color="#E040FB" />
          <Text style={styles.sectionHeaderText}>ユニークアイテム追加</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MOD表示確認用ユニーク装備</Text>
          <Text style={styles.uniqueItemHint}>
            インベントリ: {inventory.length}個
          </Text>
          <View style={styles.uniqueItemGrid}>
            {DEBUG_UNIQUE_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.uniqueItemButton,
                  addingItemId === item.id && styles.applyButtonDisabled,
                ]}
                onPress={() => handleAddUniqueItem(item.id, item.name)}
                disabled={addingItemId !== null}
              >
                <Text style={styles.uniqueItemName}>{item.name}</Text>
                <Text style={styles.uniqueItemMod}>{item.mod}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ========================================
            Tips表示テスト
           ======================================== */}
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="tooltip-text" size={20} color="#FFD700" />
          <Text style={styles.sectionHeaderText}>Tips表示テスト</Text>
        </View>

        <View style={styles.section}>
          <Pressable
            style={[styles.applyButton, { backgroundColor: '#8B6914' }]}
            onPress={() => setShowEndContentTooltip(true)}
          >
            <MaterialCommunityIcons name="star-circle" size={20} color="#fff" style={styles.applyIcon} />
            <Text style={styles.applyButtonText}>エンドコンテンツ解放Tips</Text>
          </Pressable>
          <Pressable
            style={[styles.applyButton, { backgroundColor: '#6A1B9A', marginTop: 8 }]}
            onPress={() => setShowUberTreeTooltip(true)}
          >
            <MaterialCommunityIcons name="tree" size={20} color="#fff" style={styles.applyIcon} />
            <Text style={styles.applyButtonText}>Uberツリー解放Tips</Text>
          </Pressable>
          <Pressable
            style={[styles.applyButton, { backgroundColor: '#00838F', marginTop: 8 }]}
            onPress={() => setShowDimensionalCorridorTooltip(true)}
          >
            <MaterialCommunityIcons name="infinity" size={20} color="#fff" style={styles.applyIcon} />
            <Text style={styles.applyButtonText}>次元回廊解放Tips</Text>
          </Pressable>
        </View>

        {/* 注意書き */}
        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="alert" size={16} color="#FFA500" />
          <Text style={styles.warningText}>
            プリセットを適用すると、現在のデータがリセットされます。{'\n'}
            ・パッシブ: レベル・SP・取得済みスキル{'\n'}
            ・装備: 装備品・インベントリ
          </Text>
        </View>
      </ScrollView>

      {/* エンドコンテンツ解放ツールチップ */}
      <EndContentTooltip
        visible={showEndContentTooltip}
        onDismiss={() => setShowEndContentTooltip(false)}
      />
      {/* Uberツリー解放ツールチップ */}
      <UberTreeTooltip
        visible={showUberTreeTooltip}
        onDismiss={() => setShowUberTreeTooltip(false)}
      />
      {/* 次元回廊解放ツールチップ */}
      <DimensionalCorridorTooltip
        visible={showDimensionalCorridorTooltip}
        onDismiss={() => setShowDimensionalCorridorTooltip(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  buildActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  buildToggleButton: {
    backgroundColor: 'rgba(35, 40, 51, 0.5)',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3F4B',
    flex: 1,
  },
  buildToggleText: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },
  buildCopyButton: {
    backgroundColor: 'rgba(35, 40, 51, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3F4B',
    flexDirection: 'row',
    gap: 6,
  },
  buildCopyText: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },
  buildJsonBox: {
    marginTop: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    padding: 8,
  },
  buildJsonText: {
    color: '#bbb',
    fontSize: 10,
    lineHeight: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetButtonSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  presetButtonText: {
    fontSize: 12,
    color: '#aaa',
  },
  presetButtonTextSelected: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelButton: {
    width: 56,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  levelButtonSelected: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderColor: '#2196F3',
  },
  levelButtonText: {
    fontSize: 12,
    color: '#aaa',
  },
  levelButtonTextSelected: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  dungeonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dungeonButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  dungeonButtonSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  dungeonButtonText: {
    fontSize: 11,
    color: '#aaa',
  },
  dungeonButtonTextSelected: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  dungeonLevelText: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  dungeonLevelTextSelected: {
    color: '#4CAF50',
  },
  equipTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  equipTypeButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  equipTypeButtonSelected: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  equipTypeButtonText: {
    fontSize: 13,
    color: '#aaa',
  },
  equipTypeButtonTextSelected: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 8,
  },
  applyButtonEquip: {
    backgroundColor: '#4CAF50',
  },
  screenshotButton: {
    backgroundColor: '#B45F06',
  },
  applyButtonDisabled: {
    backgroundColor: '#666',
  },
  applyIcon: {
    marginRight: 8,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedButton: {
    flex: 1,
    minWidth: 50,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  speedButtonSelected: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderColor: '#2196F3',
  },
  speedButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#aaa',
  },
  speedButtonTextSelected: {
    color: '#2196F3',
  },
  speedHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  resetButton: {
    backgroundColor: '#FF5722',
    marginTop: 12,
  },
  rankingButton: {
    backgroundColor: '#FF9800',
  },
  rankingHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  uniqueItemHint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  uniqueItemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uniqueItemButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(224, 64, 251, 0.15)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(224, 64, 251, 0.3)',
  },
  uniqueItemName: {
    fontSize: 12,
    color: '#E040FB',
    fontWeight: 'bold',
  },
  uniqueItemMod: {
    fontSize: 10,
    color: '#aaa',
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#FFA500',
    lineHeight: 18,
  },
});
