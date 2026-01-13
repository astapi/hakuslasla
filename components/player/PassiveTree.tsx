import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getAllPassiveNodes, canUnlockNode } from '@/data/passiveTree';
import { PassiveNode, PassiveEffect } from '@/types';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Circle,
  Defs,
  RadialGradient,
  Stop,
  G,
  LinearGradient,
} from 'react-native-svg';

// ノードのサイズ設定
const NODE_SIZE_SMALL = 28;
const NODE_SIZE_MEDIUM = 36;
const NODE_SIZE_LARGE = 46;
const NODE_SIZE_KEYSTONE = 56;
const GRID_SIZE = 56;

// ズーム設定
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;
const INITIAL_SCALE = 0.55;

// カラーテーマ（PoE風）
const COLORS = {
  background: '#0c0c14',
  lineDefault: '#3d3d4a',
  lineUnlocked: '#8b7355',
  lineCanUnlock: '#6b5b45',
  nodeDefault: '#1a1a24',
  nodeUnlocked: '#2d4a2d',
  nodeCanUnlock: '#3d3520',
  borderDefault: '#4a4a5a',
  borderUnlocked: '#7cb342',
  borderCanUnlock: '#c9a227',
  borderSelected: '#ffffff',
  glowUnlocked: '#4CAF50',
  glowCanUnlock: '#FFD700',
};

// アイコンタイプ
type IconType = 'atk' | 'hp' | 'def' | 'poison' | 'crit' | 'regen' | 'guard' | 'vamp' | 'special' | 'legendary' | 'speed';

// 仮アイコンテキスト
const ICON_FALLBACK: Record<IconType, string> = {
  atk: '⚔',
  hp: '♥',
  def: '🛡',
  poison: '☠',
  crit: '★',
  regen: '✚',
  guard: '🔰',
  vamp: '🩸',
  special: '◆',
  legendary: '👑',
  speed: '⚡',
};

// ノードのアイコンタイプを判定
const getIconType = (effect: PassiveEffect): IconType => {
  // 伝説ノード（全more%）
  if (effect.atk_more_pct && effect.hp_more_pct && effect.def_more_pct) {
    return 'legendary';
  }
  // 攻撃速度系
  if (effect.attack_speed_pct || effect.attack_speed_more_pct) {
    return 'speed';
  }
  // ダメージ軽減系
  if (effect.damage_reduction_pct) {
    return 'guard';
  }
  // HIT時HP回復系
  if (effect.hp_on_hit) {
    return 'vamp';
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
  // キーストーン判定
  if (node.id.includes('final') || node.id.includes('key') || effect.no_direct_damage) {
    return NODE_SIZE_KEYSTONE;
  }
  if (effect.atk_more_pct || effect.hp_more_pct || effect.def_more_pct ||
      effect.attack_speed_more_pct || effect.poison_damage_more_pct) {
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

// 2点間のベジェ曲線パスを生成
const generateBezierPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string => {
  const dx = endX - startX;
  const dy = endY - startY;

  // 縦方向優先の場合
  if (Math.abs(dy) > Math.abs(dx)) {
    const controlY = startY + dy * 0.5;
    return `M ${startX} ${startY} Q ${startX} ${controlY} ${(startX + endX) / 2} ${controlY} Q ${endX} ${controlY} ${endX} ${endY}`;
  }

  // 横方向優先の場合
  const controlX = startX + dx * 0.5;
  return `M ${startX} ${startY} Q ${controlX} ${startY} ${controlX} ${(startY + endY) / 2} Q ${controlX} ${endY} ${endX} ${endY}`;
};

// S字カーブのベジェ曲線パスを生成（PoE風）
const generateSmoothPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string => {
  const dx = endX - startX;
  const dy = endY - startY;

  // 直線に近い場合はシンプルなカーブ
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  // S字カーブ用のコントロールポイント
  const ctrl1X = startX + dx * 0.3;
  const ctrl1Y = startY + dy * 0.1;
  const ctrl2X = startX + dx * 0.7;
  const ctrl2Y = startY + dy * 0.9;

  return `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y} ${ctrl2X} ${ctrl2Y} ${endX} ${endY}`;
};

export const PassiveTree = () => {
  const { skillPoints, unlockedSkills, unlockSkill } = usePlayerStore();
  const nodes = getAllPassiveNodes();
  const [selectedNode, setSelectedNode] = useState<PassiveNode | null>(null);

  // ズーム・パン用のshared values
  const scale = useSharedValue(INITIAL_SCALE);
  const savedScale = useSharedValue(INITIAL_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const handleUnlockNode = (nodeId: string) => {
    unlockSkill(nodeId);
  };

  // 座標範囲を取得
  const { minX, minY, xRange, yRange, contentWidth, contentHeight } = useMemo(() => {
    const xPositions = nodes.map(n => n.position.x);
    const yPositions = nodes.map(n => n.position.y);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const xRange = maxX - minX + 1;
    const yRange = maxY - minY + 1;
    const padding = GRID_SIZE * 2;
    return {
      minX,
      minY,
      xRange,
      yRange,
      contentWidth: xRange * GRID_SIZE + padding,
      contentHeight: yRange * GRID_SIZE + padding,
    };
  }, [nodes]);

  const getNodeCenter = (node: PassiveNode) => {
    const xIndex = node.position.x - minX;
    const yIndex = node.position.y - minY;
    const padding = GRID_SIZE;
    return {
      x: xIndex * GRID_SIZE + padding + GRID_SIZE / 2,
      y: yIndex * GRID_SIZE + padding + GRID_SIZE / 2,
    };
  };

  const getNodePosition = (node: PassiveNode) => {
    const center = getNodeCenter(node);
    const size = getNodeSize(node);
    return {
      left: center.x - size / 2,
      top: center.y - size / 2,
    };
  };

  // 接続線データを生成
  const connections = useMemo(() => {
    const result: Array<{
      id: string;
      path: string;
      isUnlocked: boolean;
      canUnlock: boolean;
    }> = [];

    nodes.forEach((node) => {
      const nodeCenter = getNodeCenter(node);
      node.requiredNodes.forEach((req, reqIndex) => {
        const parentIds = Array.isArray(req) ? req : [req];
        parentIds.forEach((parentId) => {
          const parentNode = nodes.find(n => n.id === parentId);
          if (!parentNode) return;

          const parentCenter = getNodeCenter(parentNode);
          const isUnlocked = unlockedSkills.includes(node.id) && unlockedSkills.includes(parentId);
          const canUnlockThis = canUnlockNode(node.id, unlockedSkills) && skillPoints > 0;

          const path = generateSmoothPath(
            parentCenter.x,
            parentCenter.y,
            nodeCenter.x,
            nodeCenter.y
          );

          result.push({
            id: `${parentId}-${node.id}-${reqIndex}`,
            path,
            isUnlocked,
            canUnlock: canUnlockThis && unlockedSkills.includes(parentId),
          });
        });
      });
    });

    return result;
  }, [nodes, unlockedSkills, skillPoints, minX, minY]);

  const handleNodePress = (node: PassiveNode) => {
    setSelectedNode(node);
  };

  const handleUnlockFromPanel = () => {
    if (selectedNode && canUnlockNode(selectedNode.id, unlockedSkills) && skillPoints > 0) {
      handleUnlockNode(selectedNode.id);
    }
  };

  const isSelected = (node: PassiveNode) => selectedNode?.id === node.id;

  // ピンチジェスチャー
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // パンジェスチャー
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // ダブルタップでリセット
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(INITIAL_SCALE);
      savedScale.value = INITIAL_SCALE;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  // ジェスチャーを合成
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  // アニメーションスタイル
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>パッシブツリー</Text>
        <Text style={styles.skillPoints}>SP: {skillPoints}</Text>
      </View>

      {/* ズームヒント */}
      <View style={styles.zoomHint}>
        <Text style={styles.zoomHintText}>ピンチで拡大縮小 / ダブルタップでリセット</Text>
      </View>

      {/* ツリー表示エリア */}
      <View style={styles.treeArea}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[
              styles.treeContent,
              { width: contentWidth, height: contentHeight },
              animatedStyle,
            ]}
          >
            {/* SVG接続線 */}
            <Svg
              width={contentWidth}
              height={contentHeight}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                {/* 接続線のグラデーション */}
                <LinearGradient id="lineGradientUnlocked" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8b7355" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#a08060" stopOpacity="1" />
                </LinearGradient>
                <LinearGradient id="lineGradientCanUnlock" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#6b5b45" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#8b7b55" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>

              {/* 接続線を描画 */}
              {connections.map((conn) => (
                <Path
                  key={conn.id}
                  d={conn.path}
                  stroke={
                    conn.isUnlocked
                      ? "url(#lineGradientUnlocked)"
                      : conn.canUnlock
                        ? "url(#lineGradientCanUnlock)"
                        : COLORS.lineDefault
                  }
                  strokeWidth={conn.isUnlocked ? 3 : 2}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
            </Svg>

            {/* ノード */}
            {nodes.map((node) => {
              const isUnlocked = unlockedSkills.includes(node.id);
              const canUnlock = canUnlockNode(node.id, unlockedSkills) && skillPoints > 0;
              const position = getNodePosition(node);
              const size = getNodeSize(node);
              const iconType = getIconType(node.effect);
              const iconSize = size * 0.45;
              const isKeystone = size === NODE_SIZE_KEYSTONE;

              return (
                <Pressable
                  key={node.id}
                  style={({ pressed }) => [
                    styles.nodeContainer,
                    {
                      left: position.left,
                      top: position.top,
                      width: size,
                      height: size,
                    },
                    pressed && styles.nodePressed,
                  ]}
                  onPress={() => handleNodePress(node)}
                >
                  <Svg width={size} height={size}>
                    <Defs>
                      {/* ノード背景グラデーション */}
                      <RadialGradient id={`nodeGrad-${node.id}`} cx="50%" cy="50%" r="50%">
                        <Stop
                          offset="0%"
                          stopColor={
                            isUnlocked
                              ? '#3d5a3d'
                              : canUnlock
                                ? '#4d4520'
                                : '#2a2a34'
                          }
                        />
                        <Stop
                          offset="100%"
                          stopColor={
                            isUnlocked
                              ? '#1d3a1d'
                              : canUnlock
                                ? '#2d2510'
                                : '#1a1a24'
                          }
                        />
                      </RadialGradient>

                      {/* グロー効果 */}
                      <RadialGradient id={`glow-${node.id}`} cx="50%" cy="50%" r="50%">
                        <Stop
                          offset="60%"
                          stopColor={
                            isUnlocked
                              ? COLORS.glowUnlocked
                              : canUnlock
                                ? COLORS.glowCanUnlock
                                : 'transparent'
                          }
                          stopOpacity="0.3"
                        />
                        <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                      </RadialGradient>
                    </Defs>

                    {/* グロー円（選択時やアクティブ時） */}
                    {(isSelected(node) || canUnlock) && (
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2}
                        fill={`url(#glow-${node.id})`}
                      />
                    )}

                    {/* 外枠（装飾リング） */}
                    {isKeystone && (
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 - 2}
                        stroke={isUnlocked ? '#7cb342' : canUnlock ? '#c9a227' : '#4a4a5a'}
                        strokeWidth={1.5}
                        fill="none"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* メイン円 */}
                    <Circle
                      cx={size / 2}
                      cy={size / 2}
                      r={size / 2 - (isKeystone ? 6 : 3)}
                      fill={`url(#nodeGrad-${node.id})`}
                      stroke={
                        isSelected(node)
                          ? COLORS.borderSelected
                          : isUnlocked
                            ? COLORS.borderUnlocked
                            : canUnlock
                              ? COLORS.borderCanUnlock
                              : COLORS.borderDefault
                      }
                      strokeWidth={isSelected(node) ? 3 : 2}
                    />

                    {/* 内側のハイライト */}
                    <Circle
                      cx={size / 2}
                      cy={size / 2 - size * 0.1}
                      r={size / 4}
                      fill="rgba(255, 255, 255, 0.05)"
                    />
                  </Svg>

                  {/* アイコン */}
                  <View style={[styles.iconOverlay, { width: size, height: size }]}>
                    <Text style={[styles.nodeIcon, { fontSize: iconSize }]}>
                      {ICON_FALLBACK[iconType]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        </GestureDetector>
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
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  zoomHint: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  zoomHintText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  treeArea: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  treeContent: {
    position: 'relative',
  },
  nodeContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodePressed: {
    opacity: 0.8,
  },
  iconOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeIcon: {
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // 下部情報パネル
  infoPanel: {
    backgroundColor: 'rgba(15, 15, 25, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 115, 85, 0.3)',
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
    color: '#e0d0b0',
    flex: 1,
  },
  unlockedBadge: {
    fontSize: 12,
    color: '#7cb342',
    fontWeight: 'bold',
    backgroundColor: 'rgba(124, 179, 66, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  infoPanelDescription: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  infoPanelActions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlockButton: {
    backgroundColor: '#c9a227',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0c040',
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
    color: '#555',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
