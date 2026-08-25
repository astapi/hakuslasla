import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ImageSourcePropType } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getAllUberTreeNodes, canUnlockUberNode, canRefundUberNode, UberTreeNode, UBER_TREE_START_NODE_ID } from '@/data/uberTree';
import { settingsRepository } from '@/db';
import { PassiveEffect } from '@/types';
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
  LinearGradient,
} from 'react-native-svg';
import { ms, fs } from '@/utils/scaling';

const GRID_SIZE = 64;
const NODE_SIZE_NORMAL = 36;
const NODE_SIZE_FINAL = 50;
const NODE_SIZE_START = 44;

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const INITIAL_SCALE = 0.7;

const ROUTE_COLORS: Record<string, string> = {
  core: '#B39DDB',
  destruction: '#FF6B6B',
  immortality: '#4CAF50',
  critical: '#FFD700',
  venom: '#8BC34A',
  inferno: '#FF9800',
  frostbite: '#64B5F6',
};

const ROUTE_BG_COLORS: Record<string, string> = {
  core: '#2d1f46',
  destruction: '#4a1a1a',
  immortality: '#1a3a1a',
  critical: '#3a3520',
  venom: '#2a3a14',
  inferno: '#3a2810',
  frostbite: '#1a2a3a',
};

const COLORS = {
  background: '#0c0c14',
  lineDefault: '#3d3d4a',
  lineUnlocked: '#8b7355',
  nodeDefault: '#1a1a24',
  borderDefault: '#4a4a5a',
  borderUnlocked: '#7cb342',
  borderCanUnlock: '#c9a227',
  borderSelected: '#ffffff',
  glowUnlocked: '#4CAF50',
  glowCanUnlock: '#FFD700',
};

type IconType = 'atk' | 'hp' | 'def' | 'poison' | 'crit' | 'regen' | 'vamp' | 'special' | 'speed';

const ICON_IMAGES: Record<IconType, ImageSourcePropType> = {
  atk: require('../assets/images/passive/attack_power.png'),
  hp: require('../assets/images/passive/max_health.png'),
  def: require('../assets/images/passive/defense.png'),
  poison: require('../assets/images/passive/poison.png'),
  crit: require('../assets/images/passive/critical_strike.png'),
  regen: require('../assets/images/passive/health_regeneration.png'),
  vamp: require('../assets/images/passive/life_steal.png'),
  special: require('../assets/images/passive/attack_power.png'),
  speed: require('../assets/images/passive/attack_speed.png'),
};

const ICON_BG_COLORS: Record<IconType, string> = {
  atk: '#5b1e1e',
  hp: '#3f1f2a',
  def: '#1f3b46',
  poison: '#2e4a1c',
  crit: '#4a2b5a',
  regen: '#1f4a2e',
  vamp: '#4a1f2e',
  special: '#3a3a3a',
  speed: '#2a3b5a',
};

const getIconType = (effect: PassiveEffect): IconType => {
  if (effect.attack_speed_pct || effect.attack_speed_more_pct) return 'speed';
  if (effect.damage_defer_pct) return 'def';
  if (effect.hp_on_hit) return 'vamp';
  if (effect.heavy_strike || effect.def_hp_to_atk) return 'special';
  if (effect.uber_critical_follow_up) return 'crit';
  if (effect.ignite_intensify) return 'atk';
  if (effect.chill_freeze_damage_mult) return 'def';
  if (effect.poison_multi_stack) return 'poison';
  if (effect.atk_more_pct || effect.atk_increased_pct || (effect.atk && !effect.hp && !effect.def)) return 'atk';
  if (effect.hp_more_pct || effect.hp_increased_pct || (effect.hp && !effect.atk && !effect.def)) return 'hp';
  if (effect.def_more_pct || effect.def_increased_pct || (effect.def && !effect.atk && !effect.hp)) return 'def';
  if (effect.poison_chance || effect.poison_damage_pct) return 'poison';
  if (effect.critical_chance || effect.critical_damage) return 'crit';
  if (effect.hp_regen) return 'regen';
  if (effect.chill_chance || effect.freeze_chance || effect.chill_effect_pct) return 'def';
  if (effect.ignite_chance || effect.ignite_damage_pct) return 'atk';
  return 'special';
};

const getNodeSize = (node: UberTreeNode): number => {
  if (node.id === UBER_TREE_START_NODE_ID) return NODE_SIZE_START;
  if (node.id.endsWith('_4')) return NODE_SIZE_FINAL;
  return NODE_SIZE_NORMAL;
};

const generateSmoothPath = (
  startX: number, startY: number,
  endX: number, endY: number
): string => {
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }
  const ctrl1X = startX + dx * 0.3;
  const ctrl1Y = startY + dy * 0.1;
  const ctrl2X = startX + dx * 0.7;
  const ctrl2Y = startY + dy * 0.9;
  return `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y} ${ctrl2X} ${ctrl2Y} ${endX} ${endY}`;
};

export default function UberTreeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { unlockedUberSkills, uberPoints, unlockUberSkill, refundUberSkill, refresh } = usePlayerStore();
  const [selectedNode, setSelectedNode] = useState<UberTreeNode | null>(null);
  const [respecTokens, setRespecTokens] = useState(0);

  // 画面フォーカス時にuberPointsとリスペックトークンを最新に更新
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void settingsRepository.getRespecTokens().then(setRespecTokens);
    }, [refresh])
  );

  const allNodes = getAllUberTreeNodes();

  const scale = useSharedValue(INITIAL_SCALE);
  const savedScale = useSharedValue(INITIAL_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const isUnlocked = useCallback((nodeId: string) => {
    if (nodeId === UBER_TREE_START_NODE_ID) return true;
    return unlockedUberSkills.includes(nodeId);
  }, [unlockedUberSkills]);

  const canUnlock = useCallback((nodeId: string) => {
    return canUnlockUberNode(nodeId, unlockedUberSkills) && uberPoints > 0;
  }, [unlockedUberSkills, uberPoints]);

  const { minX, minY, contentWidth, contentHeight } = useMemo(() => {
    const xPositions = allNodes.map(n => n.position.x);
    const yPositions = allNodes.map(n => n.position.y);
    const mnX = Math.min(...xPositions);
    const mxX = Math.max(...xPositions);
    const mnY = Math.min(...yPositions);
    const mxY = Math.max(...yPositions);
    const padding = GRID_SIZE * 2;
    return {
      minX: mnX,
      minY: mnY,
      contentWidth: (mxX - mnX + 1) * GRID_SIZE + padding,
      contentHeight: (mxY - mnY + 1) * GRID_SIZE + padding,
    };
  }, [allNodes]);

  const getNodeCenter = useCallback((node: UberTreeNode) => {
    const xIndex = node.position.x - minX;
    const yIndex = node.position.y - minY;
    const padding = GRID_SIZE;
    return {
      x: xIndex * GRID_SIZE + padding + GRID_SIZE / 2,
      y: yIndex * GRID_SIZE + padding + GRID_SIZE / 2,
    };
  }, [minX, minY]);

  const getNodePosition = useCallback((node: UberTreeNode) => {
    const center = getNodeCenter(node);
    const size = getNodeSize(node);
    return { left: center.x - size / 2, top: center.y - size / 2 };
  }, [getNodeCenter]);

  const connections = useMemo(() => {
    const result: { id: string; path: string; isUnlocked: boolean; canUnlock: boolean; routeColor: string }[] = [];
    allNodes.forEach((node) => {
      const nodeCenter = getNodeCenter(node);
      node.requiredNodes.forEach((req, reqIndex) => {
        const parentIds = Array.isArray(req) ? req : [req];
        parentIds.forEach((parentId) => {
          const parentNode = allNodes.find(n => n.id === parentId);
          if (!parentNode) return;
          const parentCenter = getNodeCenter(parentNode);
          const bothUnlocked = isUnlocked(node.id) && isUnlocked(parentId);
          const canUnlockThis = canUnlock(node.id) && isUnlocked(parentId);
          const path = generateSmoothPath(parentCenter.x, parentCenter.y, nodeCenter.x, nodeCenter.y);
          result.push({
            id: `${parentId}-${node.id}-${reqIndex}`,
            path,
            isUnlocked: bothUnlocked,
            canUnlock: canUnlockThis,
            routeColor: ROUTE_COLORS[node.route] || ROUTE_COLORS.core,
          });
        });
      });
    });
    return result;
  }, [allNodes, isUnlocked, canUnlock, getNodeCenter]);

  const handleUnlock = useCallback(async () => {
    if (!selectedNode) return;
    const success = await unlockUberSkill(selectedNode.id);
    if (success) setSelectedNode(null);
  }, [selectedNode, unlockUberSkill]);

  const handleRefundNode = useCallback(async (nodeId: string) => {
    const success = await refundUberSkill(nodeId);
    if (!success) return;
    const count = await settingsRepository.getRespecTokens();
    setRespecTokens(count);
    setSelectedNode(null);
  }, [refundUberSkill]);

  // ジェスチャー
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => { savedScale.value = scale.value; });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

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

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <ScreenWrapper>
      <GestureHandlerRootView style={styles.container}>
        {/* ヘッダー */}
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

        {/* ズームヒント */}
        <View style={styles.zoomHint}>
          <Text style={styles.zoomHintText}>{t('passiveTree.zoomHint')}</Text>
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
              <Svg width={contentWidth} height={contentHeight} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="lineGradUnlocked" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#8b7355" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#a08060" stopOpacity="1" />
                  </LinearGradient>
                </Defs>

                {connections.map((conn) => (
                  <Path
                    key={conn.id}
                    d={conn.path}
                    stroke={
                      conn.isUnlocked
                        ? conn.routeColor
                        : conn.canUnlock
                          ? `${conn.routeColor}88`
                          : COLORS.lineDefault
                    }
                    strokeWidth={conn.isUnlocked ? 3 : 2}
                    fill="none"
                    strokeLinecap="round"
                  />
                ))}
              </Svg>

              {/* ノード */}
              {allNodes.map((node) => {
                const unlocked = isUnlocked(node.id);
                const canDo = canUnlock(node.id);
                const position = getNodePosition(node);
                const size = getNodeSize(node);
                const iconType = getIconType(node.effect);
                const isStart = node.id === UBER_TREE_START_NODE_ID;
                const isFinal = node.id.endsWith('_4');
                const routeColor = ROUTE_COLORS[node.route] || ROUTE_COLORS.core;
                const routeBg = ROUTE_BG_COLORS[node.route] || ROUTE_BG_COLORS.core;
                const isSelectedNode = selectedNode?.id === node.id;
                const iconSize = size * (isFinal || isStart ? 0.65 : 0.55);

                return (
                  <Pressable
                    key={node.id}
                    style={({ pressed }) => [
                      styles.nodeContainer,
                      { left: position.left, top: position.top, width: size, height: size },
                      pressed && styles.nodePressed,
                    ]}
                    onPress={() => setSelectedNode(node)}
                  >
                    <Svg width={size} height={size}>
                      <Defs>
                        <RadialGradient id={`ng-${node.id}`} cx="50%" cy="50%" r="50%">
                          <Stop offset="0%" stopColor={unlocked ? routeBg : canDo ? '#3d3520' : '#2a2a34'} />
                          <Stop offset="100%" stopColor={unlocked ? '#0c0c14' : canDo ? '#1d1510' : '#1a1a24'} />
                        </RadialGradient>
                        <RadialGradient id={`gw-${node.id}`} cx="50%" cy="50%" r="50%">
                          <Stop offset="60%" stopColor={unlocked ? routeColor : canDo ? COLORS.glowCanUnlock : 'transparent'} stopOpacity="0.3" />
                          <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
                        </RadialGradient>
                      </Defs>

                      {(isSelectedNode || canDo) && (
                        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#gw-${node.id})`} />
                      )}

                      {(isFinal || isStart) && (
                        <Circle
                          cx={size / 2} cy={size / 2} r={size / 2 - 2}
                          stroke={unlocked ? routeColor : canDo ? COLORS.borderCanUnlock : '#4a4a5a'}
                          strokeWidth={1.5} fill="none" strokeDasharray="4 2"
                        />
                      )}

                      <Circle
                        cx={size / 2} cy={size / 2}
                        r={size / 2 - (isFinal || isStart ? 6 : 3)}
                        fill={`url(#ng-${node.id})`}
                        stroke={
                          isSelectedNode ? COLORS.borderSelected
                            : unlocked ? routeColor
                            : canDo ? COLORS.borderCanUnlock
                            : COLORS.borderDefault
                        }
                        strokeWidth={isSelectedNode ? 3 : 2}
                      />

                      <Circle
                        cx={size / 2} cy={size / 2 - size * 0.1}
                        r={size / 4} fill="rgba(255, 255, 255, 0.05)"
                      />
                    </Svg>

                    <View
                      style={[
                        styles.iconOverlay,
                        {
                          width: size, height: size,
                          backgroundColor: isStart ? routeBg : ICON_BG_COLORS[iconType],
                          borderColor: unlocked ? routeColor : canDo ? COLORS.borderCanUnlock : COLORS.borderDefault,
                          borderWidth: unlocked ? 2 : canDo ? 1.5 : 1,
                          opacity: unlocked ? 1 : canDo ? 0.9 : 0.65,
                          borderRadius: size / 2,
                        },
                      ]}
                    >
                      {isStart ? (
                        <MaterialCommunityIcons name="star-four-points" size={iconSize} color={routeColor} />
                      ) : (
                        <Image
                          source={ICON_IMAGES[iconType]}
                          style={[styles.nodeIconImage, { width: iconSize, height: iconSize, opacity: unlocked ? 1 : canDo ? 0.9 : 0.6 }]}
                          resizeMode="contain"
                        />
                      )}
                    </View>

                    {unlocked && !isStart && (
                      <View style={[styles.unlockedDot, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
                    )}
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
                <View style={[styles.routeDot, { backgroundColor: ROUTE_COLORS[selectedNode.route] }]} />
                <Text style={[styles.infoPanelTitle, { color: ROUTE_COLORS[selectedNode.route] }]}>
                  {t(`uberNodes.${selectedNode.id}.name`, { defaultValue: selectedNode.name })}
                </Text>
                {isUnlocked(selectedNode.id) && (
                  <Text style={styles.unlockedBadge}>{t('uberTree.unlocked')}</Text>
                )}
              </View>
              <Text style={styles.infoPanelDescription}>
                {t(`uberNodes.${selectedNode.id}.description`, { defaultValue: selectedNode.description })}
              </Text>

              {selectedNode.id !== UBER_TREE_START_NODE_ID && !isUnlocked(selectedNode.id) && (
                <View style={styles.infoPanelActions}>
                  {canUnlock(selectedNode.id) ? (
                    <Pressable style={styles.unlockButton} onPress={handleUnlock}>
                      <Text style={styles.unlockButtonText}>{t('uberTree.unlock')}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.lockedText}>{t('uberTree.locked')}</Text>
                  )}
                </View>
              )}

              {isUnlocked(selectedNode.id) && selectedNode.id !== UBER_TREE_START_NODE_ID && (
                <View style={styles.infoPanelActions}>
                  {canRefundUberNode(selectedNode.id, unlockedUberSkills) ? (
                    respecTokens > 0 ? (
                      <Pressable style={styles.respecButton} onPress={() => handleRefundNode(selectedNode.id)}>
                        <Text style={styles.respecButtonText}>
                          {t('passiveTree.respecButton', { count: 1 })}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.noRespecText}>{t('passiveTree.noRespecToken')}</Text>
                    )
                  ) : (
                    <Text style={styles.lockedText}>{t('passiveTree.cannotRespec')}</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.infoPanelPlaceholder}>{t('passiveTree.placeholder')}</Text>
          )}
        </View>
      </GestureHandlerRootView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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
  zoomHint: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(4),
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  zoomHintText: {
    fontSize: fs(11),
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
  nodeIconImage: {
    opacity: 0.95,
  },
  unlockedDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: '#7cb342',
    borderWidth: 1,
    borderColor: '#1a1a24',
  },
  routeDot: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    marginRight: ms(6),
  },
  infoPanel: {
    backgroundColor: 'rgba(15, 15, 25, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 115, 85, 0.3)',
    padding: ms(12),
    minHeight: ms(100),
  },
  infoPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ms(6),
  },
  infoPanelTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    flex: 1,
  },
  unlockedBadge: {
    fontSize: fs(12),
    color: '#7cb342',
    fontWeight: 'bold',
    backgroundColor: 'rgba(124, 179, 66, 0.2)',
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(4),
  },
  infoPanelDescription: {
    fontSize: fs(14),
    color: '#a0a0a0',
    lineHeight: ms(20),
  },
  infoPanelActions: {
    marginTop: ms(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlockButton: {
    backgroundColor: '#c9a227',
    paddingVertical: ms(8),
    paddingHorizontal: ms(16),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: '#e0c040',
  },
  unlockButtonText: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  lockedText: {
    fontSize: fs(13),
    color: '#666',
  },
  respecButton: {
    backgroundColor: '#4a7a9b',
    paddingVertical: ms(8),
    paddingHorizontal: ms(16),
    borderRadius: ms(6),
    borderWidth: 1,
    borderColor: '#6ea2c2',
  },
  respecButtonText: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
  },
  noRespecText: {
    fontSize: fs(13),
    color: '#666',
  },
  infoPanelPlaceholder: {
    fontSize: fs(14),
    color: '#555',
    textAlign: 'center',
    paddingVertical: ms(20),
  },
});
