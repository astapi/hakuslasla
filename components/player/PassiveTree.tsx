import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getAllPassiveNodes, canUnlockNode } from '@/data/passiveTree';
import { PassiveNode, PassiveEffect } from '@/types';

// ノードのサイズ設定
const NODE_SIZE_SMALL = 40;
const NODE_SIZE_MEDIUM = 50;
const NODE_SIZE_LARGE = 62;
const GRID_SIZE = 56;

// アイコンタイプ
type IconType = 'atk' | 'hp' | 'def' | 'poison' | 'crit' | 'regen' | 'special' | 'legendary';

// 仮アイコン画像（後で実際の画像に差し替え）
const ICON_IMAGES: Record<IconType, any> = {
  atk: require('@/assets/images/icon.png'),      // 攻撃系
  hp: require('@/assets/images/icon.png'),       // HP系
  def: require('@/assets/images/icon.png'),      // 防御系
  poison: require('@/assets/images/icon.png'),   // 毒系
  crit: require('@/assets/images/icon.png'),     // クリティカル系
  regen: require('@/assets/images/icon.png'),    // 回復系
  special: require('@/assets/images/icon.png'),  // 複合効果
  legendary: require('@/assets/images/icon.png'), // 伝説ノード
};

// 仮アイコンテキスト（画像が用意できるまでの代替表示）
const ICON_FALLBACK: Record<IconType, string> = {
  atk: '⚔',
  hp: '♥',
  def: '🛡',
  poison: '☠',
  crit: '★',
  regen: '✚',
  special: '◆',
  legendary: '👑',
};

// ノードのアイコンタイプを判定
const getIconType = (effect: PassiveEffect): IconType => {
  // 伝説ノード（全more%）
  if (effect.atk_more_pct && effect.hp_more_pct && effect.def_more_pct) {
    return 'legendary';
  }
  // ATK系
  if (effect.atk_more_pct || effect.atk_increased_pct || (effect.atk && !effect.hp && !effect.def)) {
    return 'atk';
  }
  // HP系
  if (effect.hp_more_pct || effect.hp_increased_pct || (effect.hp && !effect.atk && !effect.def)) {
    return 'hp';
  }
  // DEF系
  if (effect.def_more_pct || effect.def_increased_pct || (effect.def && !effect.atk && !effect.hp)) {
    return 'def';
  }
  // 毒系
  if (effect.poison_chance) {
    return 'poison';
  }
  // クリティカル系
  if (effect.critical_chance || effect.critical_damage) {
    return 'crit';
  }
  // 回復系
  if (effect.hp_regen || effect.hp_regen_pct) {
    return 'regen';
  }
  // 複合効果
  return 'special';
};

// ノードの強さを判定
const getNodeSize = (node: PassiveNode): number => {
  const effect = node.effect;
  if (effect.atk_more_pct || effect.hp_more_pct || effect.def_more_pct) {
    return NODE_SIZE_LARGE;
  }
  if (effect.atk_increased_pct || effect.hp_increased_pct || effect.def_increased_pct) {
    return NODE_SIZE_MEDIUM;
  }
  const effectCount = Object.keys(effect).filter(k => (effect as Record<string, number | undefined>)[k]).length;
  if (effectCount >= 3) {
    return NODE_SIZE_LARGE;
  }
  if (effectCount >= 2) {
    return NODE_SIZE_MEDIUM;
  }
  return NODE_SIZE_SMALL;
};

export const PassiveTree = () => {
  const { skillPoints, unlockedSkills, unlockSkill } = usePlayerStore();
  const nodes = getAllPassiveNodes();
  const [selectedNode, setSelectedNode] = useState<PassiveNode | null>(null);

  const handleUnlockNode = (nodeId: string) => {
    unlockSkill(nodeId);
  };

  // 座標範囲を取得
  const xPositions = nodes.map(n => n.position.x);
  const minX = Math.min(...xPositions);
  const maxX = Math.max(...xPositions);
  const xRange = maxX - minX + 1;

  const yPositions = nodes.map(n => n.position.y);
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const yRange = maxY - minY + 1;

  const getNodePosition = (node: PassiveNode) => {
    const xIndex = node.position.x - minX;
    const yIndex = node.position.y - minY;
    const size = getNodeSize(node);
    return {
      left: xIndex * GRID_SIZE + (GRID_SIZE - size) / 2,
      top: yIndex * GRID_SIZE + (GRID_SIZE - size) / 2,
    };
  };

  const contentWidth = xRange * GRID_SIZE;
  const contentHeight = yRange * GRID_SIZE;

  const handleNodePress = (node: PassiveNode) => {
    setSelectedNode(node);
  };

  const handleUnlockFromPanel = () => {
    if (selectedNode && canUnlockNode(selectedNode.id, unlockedSkills) && skillPoints > 0) {
      handleUnlockNode(selectedNode.id);
    }
  };

  const isSelected = (node: PassiveNode) => selectedNode?.id === node.id;

  return (
    <View style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>パッシブツリー</Text>
        <Text style={styles.skillPoints}>SP: {skillPoints}</Text>
      </View>

      {/* ツリー表示エリア */}
      <View style={styles.treeArea}>
        <ScrollView
          style={styles.verticalScroll}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={true}
            nestedScrollEnabled={true}
            contentContainerStyle={{ width: contentWidth + 20 }}
          >
            <View style={[styles.treeContent, { width: contentWidth, height: contentHeight }]}>
              {/* 接続線 */}
              {nodes.map((node) => {
                const nodePos = getNodePosition(node);
                const nodeSize = getNodeSize(node);
                return node.requiredNodes.map((req, reqIndex) => {
                  const parentIds = Array.isArray(req) ? req : [req];
                  return parentIds.map((parentId) => {
                    const parentNode = nodes.find(n => n.id === parentId);
                    if (!parentNode) return null;
                    const parentPos = getNodePosition(parentNode);
                    const parentSize = getNodeSize(parentNode);
                    const isUnlocked = unlockedSkills.includes(node.id) && unlockedSkills.includes(parentId);

                    const startX = parentPos.left + parentSize / 2;
                    const startY = parentPos.top + parentSize;
                    const endX = nodePos.left + nodeSize / 2;
                    const endY = nodePos.top;

                    return (
                      <View
                        key={`line-${parentId}-${node.id}-${reqIndex}`}
                        style={[
                          styles.connectionLine,
                          {
                            left: Math.min(startX, endX),
                            top: startY,
                            width: Math.abs(endX - startX) + 2,
                            height: endY - startY,
                            borderLeftWidth: 2,
                            borderBottomWidth: startX !== endX ? 2 : 0,
                            borderColor: isUnlocked ? '#4CAF50' : 'rgba(255, 255, 255, 0.15)',
                          },
                        ]}
                      />
                    );
                  });
                });
              })}

              {/* ノード */}
              {nodes.map((node) => {
                const isUnlocked = unlockedSkills.includes(node.id);
                const canUnlock = canUnlockNode(node.id, unlockedSkills) && skillPoints > 0;
                const position = getNodePosition(node);
                const size = getNodeSize(node);
                const iconType = getIconType(node.effect);
                const iconSize = size * 0.5;

                return (
                  <Pressable
                    key={node.id}
                    style={({ pressed }) => [
                      styles.nodeCircle,
                      {
                        left: position.left,
                        top: position.top,
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: isSelected(node) ? 3 : 2,
                        borderColor: isSelected(node)
                          ? '#fff'
                          : isUnlocked
                            ? '#4CAF50'
                            : canUnlock
                              ? '#FFD700'
                              : 'rgba(255, 255, 255, 0.25)',
                        backgroundColor: isUnlocked
                          ? 'rgba(76, 175, 80, 0.5)'
                          : canUnlock
                            ? 'rgba(255, 215, 0, 0.25)'
                            : 'rgba(40, 40, 60, 0.9)',
                      },
                      pressed && styles.nodePressed,
                    ]}
                    onPress={() => handleNodePress(node)}
                  >
                    {/* アイコン（仮：テキスト表示、後で Image に差し替え） */}
                    <Text style={[styles.nodeIcon, { fontSize: iconSize }]}>
                      {ICON_FALLBACK[iconType]}
                    </Text>
                    {/*
                    // 画像版（後で有効化）
                    <Image
                      source={ICON_IMAGES[iconType]}
                      style={{ width: iconSize, height: iconSize }}
                      resizeMode="contain"
                    />
                    */}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* 下部情報パネル */}
      <View style={styles.infoPanel}>
        {selectedNode ? (
          <>
            <View style={styles.infoPanelHeader}>
              <Text style={styles.infoPanelTitle}>{selectedNode.name}</Text>
              {unlockedSkills.includes(selectedNode.id) && (
                <Text style={styles.unlockedBadge}>習得済</Text>
              )}
            </View>
            <Text style={styles.infoPanelDescription}>{selectedNode.description}</Text>

            {!unlockedSkills.includes(selectedNode.id) && (
              <View style={styles.infoPanelActions}>
                {canUnlockNode(selectedNode.id, unlockedSkills) ? (
                  skillPoints > 0 ? (
                    <Pressable style={styles.unlockButton} onPress={handleUnlockFromPanel}>
                      <Text style={styles.unlockButtonText}>習得 (SP: 1)</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.noSpText}>SPが足りません</Text>
                  )
                ) : (
                  <Text style={styles.lockedText}>前提スキルが必要</Text>
                )}
              </View>
            )}
          </>
        ) : (
          <Text style={styles.infoPanelPlaceholder}>ノードをタップして詳細を表示</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  skillPoints: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  treeArea: {
    flex: 1,
    padding: 8,
  },
  verticalScroll: {
    flex: 1,
  },
  treeContent: {
    position: 'relative',
  },
  connectionLine: {
    position: 'absolute',
  },
  nodeCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePressed: {
    opacity: 0.7,
  },
  nodeIcon: {
    color: '#fff',
  },
  // 下部情報パネル
  infoPanel: {
    backgroundColor: 'rgba(20, 20, 35, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    minHeight: 100,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  unlockedBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  infoPanelDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  infoPanelActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlockButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  noSpText: {
    fontSize: 13,
    color: '#F44336',
  },
  lockedText: {
    fontSize: 13,
    color: '#666',
  },
  infoPanelPlaceholder: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
