import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlayerStore } from '@/stores/usePlayerStore';
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
} from '@/utils/debugPresets';
import {
  settingsRepository,
  BattleSpeedMultiplier,
  BATTLE_SPEED_OPTIONS,
  DEFAULT_BATTLE_SPEED,
} from '@/db/repositories/settingsRepository';

const LEVELS: PresetLevel[] = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export default function DebugScreen() {
  const router = useRouter();
  const { level, unlockedSkills, equipment, refresh } = usePlayerStore();

  // パッシブプリセット
  const [selectedType, setSelectedType] = useState<PresetType>('REGEN');
  const [selectedLevel, setSelectedLevel] = useState<PresetLevel>(35);
  const [isApplyingPassive, setIsApplyingPassive] = useState(false);

  // 装備プリセット
  const [selectedDungeon, setSelectedDungeon] = useState<string>('volcano');
  const [selectedEquipType, setSelectedEquipType] = useState<EquipmentSetType>('DEF');
  const [isApplyingEquip, setIsApplyingEquip] = useState(false);

  // 戦闘速度設定
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeedMultiplier>(DEFAULT_BATTLE_SPEED);

  // 戦闘速度設定の読み込み
  useEffect(() => {
    const loadBattleSpeed = async () => {
      const speed = await settingsRepository.getBattleSpeed();
      setBattleSpeed(speed);
    };
    loadBattleSpeed();
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

  // 現在の装備数を計算
  const equippedCount = Object.values(equipment).filter(Boolean).length;

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
