import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { DropFilterSettings, DEFAULT_DROP_FILTER, EquipmentSlot } from '@/types';
import { settingsRepository } from '@/db/repositories/settingsRepository';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '鎧',
  gloves: '手袋',
  boots: '靴',
  accessory: 'アクセサリー',
};

const SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: 'sword',
  armor: 'shield',
  gloves: 'hand-back-right',
  boots: 'shoe-formal',
  accessory: 'ring',
};

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<DropFilterSettings>(DEFAULT_DROP_FILTER);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await settingsRepository.getDropFilter();
      setSettings(loaded);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: DropFilterSettings) => {
    setSettings(newSettings);
    await settingsRepository.setDropFilter(newSettings);
  };

  const toggleCategory = (slot: EquipmentSlot) => {
    const newSettings = {
      ...settings,
      categories: {
        ...settings.categories,
        [slot]: !settings.categories[slot],
      },
    };
    saveSettings(newSettings);
  };

  const updateMinModCount = (delta: number) => {
    const newValue = Math.max(0, Math.min(4, settings.minModCount + delta));
    saveSettings({ ...settings, minModCount: newValue });
  };

  const updateMaxTier = (delta: number) => {
    // 0 = フィルタリングなし、1-10 = Tier指定
    const newValue = Math.max(0, Math.min(10, settings.maxTier + delta));
    saveSettings({ ...settings, maxTier: newValue });
  };

  const resetToDefault = () => {
    saveSettings(DEFAULT_DROP_FILTER);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>ドロップフィルター設定</Text>
        <Pressable style={styles.resetButton} onPress={resetToDefault}>
          <Text style={styles.resetButtonText}>リセット</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* カテゴリフィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>カテゴリフィルター</Text>
          <Text style={styles.sectionDescription}>
            ONのカテゴリのみドロップを取得します
          </Text>
          {(Object.keys(SLOT_LABELS) as EquipmentSlot[]).map((slot) => (
            <View key={slot} style={styles.filterRow}>
              <View style={styles.filterLabel}>
                <MaterialCommunityIcons
                  name={SLOT_ICONS[slot] as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={20}
                  color="#aaa"
                />
                <Text style={styles.filterLabelText}>{SLOT_LABELS[slot]}</Text>
              </View>
              <Switch
                value={settings.categories[slot]}
                onValueChange={() => toggleCategory(slot)}
                trackColor={{ false: '#333', true: '#4CAF50' }}
                thumbColor={settings.categories[slot] ? '#fff' : '#888'}
              />
            </View>
          ))}
        </View>

        {/* MOD数フィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>最小MOD数フィルター</Text>
          <Text style={styles.sectionDescription}>
            指定した数以上のMODを持つアイテムのみ取得します（0で無効）
          </Text>
          <View style={styles.numberInputRow}>
            <Pressable
              style={[styles.numberButton, settings.minModCount === 0 && styles.numberButtonDisabled]}
              onPress={() => updateMinModCount(-1)}
              disabled={settings.minModCount === 0}
            >
              <MaterialCommunityIcons name="minus" size={24} color="#fff" />
            </Pressable>
            <View style={styles.numberDisplay}>
              <Text style={styles.numberValue}>
                {settings.minModCount === 0 ? '無効' : `${settings.minModCount}個以上`}
              </Text>
            </View>
            <Pressable
              style={[styles.numberButton, settings.minModCount === 4 && styles.numberButtonDisabled]}
              onPress={() => updateMinModCount(1)}
              disabled={settings.minModCount === 4}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* MOD Tierフィルター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MOD Tierフィルター</Text>
          <Text style={styles.sectionDescription}>
            指定したTier以下のMODを1つ以上持つアイテムのみ取得します（Tier1が最高品質）
          </Text>
          <View style={styles.numberInputRow}>
            <Pressable
              style={[styles.numberButton, settings.maxTier === 0 && styles.numberButtonDisabled]}
              onPress={() => updateMaxTier(-1)}
              disabled={settings.maxTier === 0}
            >
              <MaterialCommunityIcons name="minus" size={24} color="#fff" />
            </Pressable>
            <View style={styles.numberDisplay}>
              <Text style={styles.numberValue}>
                {settings.maxTier === 0 ? '無効' : `Tier ${settings.maxTier} 以下`}
              </Text>
            </View>
            <Pressable
              style={[styles.numberButton, settings.maxTier === 10 && styles.numberButtonDisabled]}
              onPress={() => updateMaxTier(1)}
              disabled={settings.maxTier === 10}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
            </Pressable>
          </View>
          {settings.maxTier > 0 && (
            <Text style={styles.tierHint}>
              Tier 1 = 最高品質, Tier 10 = 最低品質
            </Text>
          )}
        </View>

        {/* 現在の設定サマリー */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>現在のフィルター</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              {Object.entries(settings.categories)
                .filter(([, enabled]) => enabled)
                .map(([slot]) => SLOT_LABELS[slot as EquipmentSlot])
                .join('、') || 'なし'}
            </Text>
            {settings.minModCount > 0 && (
              <Text style={styles.summaryText}>
                MOD {settings.minModCount}個以上
              </Text>
            )}
            {settings.maxTier > 0 && (
              <Text style={styles.summaryText}>
                Tier {settings.maxTier} 以下のMODを含む
              </Text>
            )}
            {settings.minModCount === 0 && settings.maxTier === 0 &&
              Object.values(settings.categories).every(v => v) && (
              <Text style={styles.summaryTextDisabled}>
                フィルタリングなし（すべて取得）
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 6,
  },
  resetButtonText: {
    fontSize: 12,
    color: '#F44336',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterLabelText: {
    fontSize: 14,
    color: '#fff',
  },
  numberInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  numberButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonDisabled: {
    backgroundColor: '#333',
  },
  numberDisplay: {
    minWidth: 120,
    alignItems: 'center',
  },
  numberValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  tierHint: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  summaryBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#4CAF50',
  },
  summaryTextDisabled: {
    fontSize: 13,
    color: '#666',
  },
});
