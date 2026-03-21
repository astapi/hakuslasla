import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getAllUberTreeNodes, canUnlockUberNode, UberTreeNode } from '@/data/uberTree';
import { ms, fs } from '@/utils/scaling';

const ROUTE_COLORS: Record<string, string> = {
  destruction: '#FF6B6B',
  immortality: '#4CAF50',
  swiftness: '#64B5F6',
  corrosion: '#AB47BC',
};

const ROUTE_NAMES: Record<string, string> = {
  destruction: 'uberTree.route.destruction',
  immortality: 'uberTree.route.immortality',
  swiftness: 'uberTree.route.swiftness',
  corrosion: 'uberTree.route.corrosion',
};

export default function UberTreeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { unlockedUberSkills, uberPoints, unlockUberSkill } = usePlayerStore();
  const [selectedNode, setSelectedNode] = useState<UberTreeNode | null>(null);

  const allNodes = getAllUberTreeNodes();
  const routes = ['destruction', 'immortality', 'swiftness', 'corrosion'];

  const handleUnlock = useCallback(async () => {
    if (!selectedNode) return;
    const success = await unlockUberSkill(selectedNode.id);
    if (success) {
      setSelectedNode(null);
    }
  }, [selectedNode, unlockUberSkill]);

  const isUnlocked = (nodeId: string) => unlockedUberSkills.includes(nodeId);
  const canUnlock = (nodeId: string) => canUnlockUberNode(nodeId, unlockedUberSkills) && uberPoints > 0;

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>{t('uberTree.title')}</Text>
        <View style={styles.pointsBadge}>
          <MaterialCommunityIcons name="star-four-points" size={16} color="#FFD700" />
          <Text style={styles.pointsText}>{uberPoints}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {routes.map(route => {
          const routeNodes = allNodes.filter(n => n.route === route);
          const color = ROUTE_COLORS[route];

          return (
            <View key={route} style={styles.routeSection}>
              <Text style={[styles.routeName, { color }]}>{t(ROUTE_NAMES[route])}</Text>
              <View style={styles.nodeRow}>
                {routeNodes.map((node, idx) => {
                  const unlocked = isUnlocked(node.id);
                  const canDo = canUnlock(node.id);
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <View key={node.id} style={styles.nodeWrapper}>
                      {idx > 0 && (
                        <View style={[
                          styles.connector,
                          { backgroundColor: unlocked ? color : '#444' },
                        ]} />
                      )}
                      <Pressable
                        onPress={() => setSelectedNode(node)}
                        style={[
                          styles.node,
                          unlocked && { borderColor: color, backgroundColor: `${color}33` },
                          !unlocked && canDo && { borderColor: color, borderStyle: 'dashed' as const },
                          isSelected && styles.nodeSelected,
                        ]}
                      >
                        <Text style={[
                          styles.nodeNumber,
                          unlocked && { color },
                          !unlocked && !canDo && styles.nodeNumberLocked,
                        ]}>
                          {idx + 1}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* 選択ノード詳細 */}
        {selectedNode && (
          <View style={styles.detailPanel}>
            <Text style={[styles.detailName, { color: ROUTE_COLORS[selectedNode.route] }]}>
              {selectedNode.name}
            </Text>
            <Text style={styles.detailDesc}>{selectedNode.description}</Text>
            <View style={styles.detailStatus}>
              {isUnlocked(selectedNode.id) ? (
                <Text style={styles.unlockedText}>{t('uberTree.unlocked')}</Text>
              ) : canUnlock(selectedNode.id) ? (
                <Pressable onPress={handleUnlock} style={styles.unlockButton}>
                  <Text style={styles.unlockButtonText}>{t('uberTree.unlock')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.lockedText}>{t('uberTree.locked')}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
  },
  backButton: {
    padding: ms(4),
  },
  title: {
    flex: 1,
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: ms(8),
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: ms(12),
    paddingHorizontal: ms(10),
    paddingVertical: ms(4),
    gap: ms(4),
  },
  pointsText: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#FFD700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: ms(16),
    gap: ms(20),
  },
  routeSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(12),
    padding: ms(12),
  },
  routeName: {
    fontSize: fs(14),
    fontWeight: 'bold',
    marginBottom: ms(10),
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(4),
  },
  nodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connector: {
    width: ms(20),
    height: 2,
    marginHorizontal: ms(2),
  },
  node: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    borderWidth: 2,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  nodeSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  nodeNumber: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#888',
  },
  nodeNumberLocked: {
    color: '#444',
  },
  detailPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ms(12),
    padding: ms(16),
    gap: ms(8),
  },
  detailName: {
    fontSize: fs(16),
    fontWeight: 'bold',
  },
  detailDesc: {
    fontSize: fs(13),
    color: '#ccc',
  },
  detailStatus: {
    marginTop: ms(4),
  },
  unlockedText: {
    fontSize: fs(13),
    color: '#4CAF50',
    fontWeight: '600',
  },
  lockedText: {
    fontSize: fs(13),
    color: '#666',
  },
  unlockButton: {
    backgroundColor: '#FFD700',
    borderRadius: ms(8),
    paddingHorizontal: ms(20),
    paddingVertical: ms(8),
    alignSelf: 'flex-start',
  },
  unlockButtonText: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
});
