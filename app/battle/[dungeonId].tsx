import { BattleLog } from '@/components/battle/BattleLog';
import { CharacterDisplay } from '@/components/battle/CharacterDisplay';
import { BoostIndicator } from '@/components/battle/BoostIndicator';
import { Button } from '@/components/common/Button';
import { getDungeon } from '@/data/dungeons';
import { useBattle } from '@/hooks/useBattle';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ms, fs, s } from '@/utils/scaling';
import { getChestImageForItem, getChestRarityForItem } from '@/data/images';

// ダンジョン背景画像マッピング
const backgroundImages: Record<string, ImageSourcePropType> = {
  grassland: require('@/assets/images/backgrounds/grassland.jpg'),
  cave: require('@/assets/images/backgrounds/cave.jpg'),
  ruins: require('@/assets/images/backgrounds/ruins.jpg'),
  goblin_fort: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  demon_castle: require('@/assets/images/backgrounds/demon_castle.jpg'),
  ice_cave: require('@/assets/images/backgrounds/ice_cave.jpg'),
  volcano: require('@/assets/images/backgrounds/volcano.jpg'),
  dark_forest: require('@/assets/images/backgrounds/dark_forest.jpg'),
  sky_tower: require('@/assets/images/backgrounds/sky_tower.jpg'),
  hell_gate: require('@/assets/images/backgrounds/hell_gate.jpg'),
  dragon_nest: require('@/assets/images/backgrounds/dragon_nest.jpg'),
  sacred_temple: require('@/assets/images/backgrounds/sacred_temple.jpg'),
  chaos_realm: require('@/assets/images/backgrounds/chaos_realm.jpg'),
  final_land: require('@/assets/images/backgrounds/final_land.jpg'),
  dimensional_rush: require('@/assets/images/backgrounds/final_land.jpg'),
  uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  uber_bandit_leader: require('@/assets/images/backgrounds/ruins.jpg'),
  uber_vampire: require('@/assets/images/backgrounds/dark_forest.jpg'),
  uber_kraken: require('@/assets/images/backgrounds/cave.jpg'),
  uber_demon_lord: require('@/assets/images/backgrounds/demon_castle.jpg'),
  uber_true_final_boss: require('@/assets/images/backgrounds/final_land.jpg'),
};

type ChestRarity = 'normal' | 'magic' | 'rare' | 'unique';

const chestEffectConfig: Record<ChestRarity, {
  dropHeight: number;
  bounceHeight: number;
  swayDeg: number;
  glowOpacity: number;
  pulseScale: number;
}> = {
  normal: { dropHeight: 16, bounceHeight: 2, swayDeg: 5, glowOpacity: 0, pulseScale: 1.0 },
  magic: { dropHeight: 22, bounceHeight: 3, swayDeg: 7, glowOpacity: 0.18, pulseScale: 1.03 },
  rare: { dropHeight: 28, bounceHeight: 4, swayDeg: 9, glowOpacity: 0.3, pulseScale: 1.05 },
  unique: { dropHeight: 34, bounceHeight: 5, swayDeg: 12, glowOpacity: 0.45, pulseScale: 1.08 },
};

const CHEST_SIZE = s(92);

const getChestOffsets = (count: number) => {
  const hGap = s(68);
  const vGap = s(60);
  if (count <= 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -hGap / 2, y: 0 }, { x: hGap / 2, y: 0 }];
  if (count === 3) return [
    { x: 0, y: -vGap / 2 },
    { x: -hGap / 2, y: vGap / 2 },
    { x: hGap / 2, y: vGap / 2 },
  ];
  return [
    { x: -hGap / 2, y: -vGap / 2 },
    { x: hGap / 2, y: -vGap / 2 },
    { x: -hGap / 2, y: vGap / 2 },
    { x: hGap / 2, y: vGap / 2 },
  ];
};

const ChestDrop = ({
  itemIndex,
  image,
  rarity,
  offsetX,
  offsetY,
}: {
  itemIndex: number;
  image: ImageSourcePropType;
  rarity: ChestRarity;
  offsetX: number;
  offsetY: number;
}) => {
  const { dropHeight, bounceHeight, swayDeg, glowOpacity, pulseScale } = chestEffectConfig[rarity];
  const translateY = useSharedValue(-s(dropHeight));
  const rotateZ = useSharedValue(0);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    const dropDelay = itemIndex * 80;
    translateY.value = withDelay(
      dropDelay,
      withSequence(
        withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(-s(bounceHeight), { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) })
      )
    );

    rotateZ.value = withDelay(
      dropDelay + 380,
      withRepeat(
        withSequence(
          withTiming(swayDeg, { duration: 200, easing: Easing.inOut(Easing.sin) }),
          withTiming(-swayDeg, { duration: 200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );

    if (pulseScale > 1) {
      scale.value = withDelay(
        dropDelay + 420,
        withRepeat(
          withSequence(
            withTiming(pulseScale, { duration: 520, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      );
    }

    if (glowOpacity > 0) {
      glow.value = withDelay(
        dropDelay + 420,
        withRepeat(
          withSequence(
            withTiming(glowOpacity, { duration: 520, easing: Easing.inOut(Easing.sin) }),
            withTiming(glowOpacity * 0.6, { duration: 520, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
        )
      );
    }
  }, [itemIndex, rotateZ, translateY, bounceHeight, swayDeg, pulseScale, glowOpacity, glow, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -CHEST_SIZE / 2 + offsetX },
      { translateY: -CHEST_SIZE / 2 + offsetY },
      { translateY: translateY.value },
      { rotateZ: `${rotateZ.value}deg` },
      { scale: scale.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Animated.View style={[styles.chestDrop, animatedStyle]}>
      <Animated.View style={[styles.chestGlow, glowStyle]} />
      <Image source={image} style={styles.chestImage} resizeMode="contain" />
    </Animated.View>
  );
};

export default function BattleScreen() {
  const { t } = useTranslation();
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const router = useRouter();
  const { state, isPaused, togglePause, isAutoRunning, startAutoRun, stopAutoRun, retreat } = useBattle(dungeonId || '');
  const { level } = usePlayerStore();
  const dungeon = getDungeon(dungeonId || '');

  // 攻撃アニメーション用のstate
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const prevLogLengthRef = useRef(0);

  // 撤退確認モーダル
  const [showRetreatModal, setShowRetreatModal] = useState(false);

  // 戦闘ログの変化を監視して攻撃アニメーションをトリガー
  useEffect(() => {
    const currentLength = state.battleLog.length;
    if (currentLength > prevLogLengthRef.current) {
      // 新しいログエントリを取得
      const newEntries = state.battleLog.slice(prevLogLengthRef.current);
      for (const entry of newEntries) {
        if (entry.type === 'player_attack' || entry.type === 'critical') {
          setPlayerAttacking(true);
          setTimeout(() => setPlayerAttacking(false), 200);
        } else if (entry.type === 'enemy_attack') {
          setEnemyAttacking(true);
          setTimeout(() => setEnemyAttacking(false), 200);
        }
      }
    }
    prevLogLengthRef.current = currentLength;
  }, [state.battleLog]);

  useEffect(() => {
    // 自動周回中でクリアした場合は結果画面に遷移しない（次の周回が始まる）
    if (isAutoRunning && state.phase === 'cleared') {
      return;
    }

    if (state.phase === 'cleared' || state.phase === 'defeat' || state.phase === 'retreat') {
      const isRetreat = state.phase === 'retreat';
      // 累計（現在の周回分を含む）
      const finalTotalExp = isRetreat ? 0 : (state.grandTotalExp || 0) + state.totalExpGained;
      const finalTotalItems = [...(state.grandTotalItems || []), ...state.droppedItems];

      // 結果画面に遷移
      const timer = setTimeout(() => {
        router.replace({
          pathname: '/result',
          params: {
            dungeonId: dungeonId,
            dungeonName: dungeon?.name || '',
            result: state.phase === 'cleared' ? 'cleared' : state.phase === 'retreat' ? 'retreat' : 'defeat',
            floorsCleared: state.currentFloor.toString(),
            maxFloor: state.maxFloor.toString(),
            expGained: isRetreat ? '0' : state.totalExpGained.toString(),
            itemsGained: JSON.stringify(state.droppedItems),
            runCount: state.runCount?.toString() || '1',
            grandTotalExp: finalTotalExp.toString(),
            grandTotalItems: JSON.stringify(finalTotalItems),
          },
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [state.phase, dungeonId, router, dungeon, state, isAutoRunning]);

  const handleRetreatConfirm = async () => {
    setShowRetreatModal(false);
    await retreat();
  };

  const backgroundImage = dungeonId ? backgroundImages[dungeonId] : undefined;
  const showChest = Boolean(state.enemy && state.enemy.currentHp <= 0 && state.lastDroppedItems.length > 0);

  // バトルエリアの内容
  const battleAreaContent = (
    <>
      <View style={styles.floorInfo}>
        <View style={styles.floorInfoRow}>
          <Text style={styles.floorText}>
            {dungeon?.name} - {state.currentFloor}/{state.maxFloor}{t('battle.floor')}
            {state.runCount > 1 && ` (${state.runCount}${t('battle.round')})`}
          </Text>
          <BoostIndicator />
        </View>
        {isAutoRunning && (
          <Text style={styles.autoRunText}>{t('battle.autoRunning')}</Text>
        )}
      </View>

      {/* 上部2/3のスペーサー */}
      <View style={styles.battleFieldSpacer}>
        {state.phase === 'victory' && (
          <Text style={styles.victoryText}>{t('battle.victory')}</Text>
        )}
        {state.phase === 'defeat' && (
          <Text style={styles.defeatText}>{t('battle.defeat')}</Text>
        )}
        {state.phase === 'cleared' && (
          <Text style={styles.clearedText}>{t('battle.cleared')}</Text>
        )}
      </View>

      {/* 下部1/3: キャラクターエリア（バトルフィールド） */}
      <View style={styles.battleField}>
        <View style={styles.charactersContainer}>
          <CharacterDisplay
            name={t('battle.player')}
            currentHp={state.playerCurrentHp}
            maxHp={state.playerMaxHp}
            level={level}
            isPlayer
            isAttacking={playerAttacking}
            actionGauge={state.playerGauge}
          />
          {state.enemy && !showChest && (
            <CharacterDisplay
              name={t(`monsters.${state.enemy.id}.name`, { defaultValue: state.enemy.name })}
              currentHp={state.enemy.currentHp}
              maxHp={state.enemy.maxHp}
              imageId={state.enemy.image}
              isAttacking={enemyAttacking}
              actionGauge={state.enemyGauge}
            />
          )}
          {state.enemy && showChest && (
            <View style={styles.chestSlot}>
              <View style={styles.chestRow}>
                {state.lastDroppedItems.map((item, index) => {
                  const offsets = getChestOffsets(state.lastDroppedItems.length);
                  const { x, y } = offsets[index] || { x: 0, y: 0 };
                  return (
                    <ChestDrop
                      key={`${item.instanceId}-${index}`}
                      itemIndex={index}
                      image={getChestImageForItem(item)}
                      rarity={getChestRarityForItem(item)}
                      offsetX={x}
                      offsetY={y}
                    />
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      {/* 上部: バトルエリア */}
      {backgroundImage ? (
        <ImageBackground
          source={backgroundImage}
          style={styles.battleArea}
          imageStyle={styles.battleAreaImage}
        >
          <View style={styles.battleAreaOverlay}>
            {battleAreaContent}
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.battleArea, styles.battleAreaFallback]}>
          <View style={styles.battleAreaOverlay}>
            {battleAreaContent}
          </View>
        </View>
      )}

      {/* 中部: 戦闘ログ */}
      <View style={styles.logArea}>
        <BattleLog logs={state.battleLog} />
      </View>

      {/* 下部: アクションボタン */}
      {state.phase === 'fighting' && (
        <View style={styles.actionArea}>
          <View style={styles.actionButtons}>
            <View style={styles.buttonWrapper}>
              <Button
                title={isPaused ? t('battle.resume') : t('battle.pause')}
                onPress={togglePause}
                variant="secondary"
                testID="battle-toggle-pause"
              />
            </View>
            {!isPaused && (
              <View style={styles.buttonWrapper}>
                {isAutoRunning ? (
                  <Button
                    title={t('battle.stopAutoRun')}
                    onPress={stopAutoRun}
                    variant="warning"
                    testID="battle-auto-toggle"
                  />
                ) : (
                  <Button
                    title={t('battle.autoRun')}
                    onPress={startAutoRun}
                    variant="primary"
                    testID="battle-auto-toggle"
                  />
                )}
              </View>
            )}
            {isPaused && (
              <View style={styles.buttonWrapper}>
                <Button
                  title={t('battle.retreat')}
                  onPress={() => setShowRetreatModal(true)}
                  variant="danger"
                  testID="battle-retreat"
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* 撤退確認モーダル */}
      <Modal
        visible={showRetreatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRetreatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('battle.retreatConfirm.title')}</Text>
            <Text style={styles.modalMessage}>
              {t('battle.retreatConfirm.message')}
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowRetreatModal(false)}
                testID="battle-retreat-cancel"
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleRetreatConfirm}
                testID="battle-retreat-confirm"
              >
                <Text style={styles.modalConfirmText}>{t('battle.retreatConfirm.confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#15191E',
  },
  battleArea: {
    height: s(280),
    overflow: 'hidden',
  },
  battleAreaImage: {
    resizeMode: 'cover',
  },
  battleAreaOverlay: {
    flex: 1,
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
  },
  battleAreaFallback: {
    backgroundColor: '#16213e',
  },
  floorInfo: {
    alignItems: 'center',
    marginBottom: ms(8),
  },
  floorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
  },
  floorText: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  autoRunText: {
    fontSize: fs(12),
    color: '#4CAF50',
    marginTop: ms(4),
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  battleFieldSpacer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  battleField: {
    paddingBottom: ms(6),
    backgroundColor: 'rgba(22, 33, 62, 0.6)',
    borderTopLeftRadius: ms(16),
    borderTopRightRadius: ms(16),
    paddingHorizontal: ms(8),
    paddingTop: ms(8),
  },
  charactersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chestSlot: {
    flex: 1,
    padding: ms(12),
    borderRadius: ms(12),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chestRow: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  chestDrop: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  chestGlow: {
    position: 'absolute',
    width: s(108),
    height: s(108),
    borderRadius: s(54),
    backgroundColor: 'rgba(255, 215, 0, 0.6)',
  },
  chestImage: {
    width: CHEST_SIZE,
    height: CHEST_SIZE,
  },
  fightingText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: fs(14),
    marginTop: ms(8),
  },
  victoryText: {
    textAlign: 'center',
    color: '#4CAF50',
    fontSize: fs(18),
    fontWeight: 'bold',
    marginTop: ms(8),
  },
  defeatText: {
    textAlign: 'center',
    color: '#F44336',
    fontSize: fs(18),
    fontWeight: 'bold',
    marginTop: ms(8),
  },
  clearedText: {
    textAlign: 'center',
    color: '#FFD700',
    fontSize: fs(18),
    fontWeight: 'bold',
    marginTop: ms(8),
  },
  actionArea: {
    paddingHorizontal: ms(16),
    paddingVertical: ms(12),
  },
  actionButtons: {
    flexDirection: 'row',
    gap: ms(12),
  },
  buttonWrapper: {
    flex: 1,
  },
  logArea: {
    flex: 1,
    padding: ms(16),
    maxHeight: s(300),
  },
  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#15191E',
    borderRadius: ms(16),
    padding: ms(24),
    width: '80%',
    maxWidth: ms(320),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: fs(18),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: ms(16),
  },
  modalMessage: {
    fontSize: fs(14),
    color: '#aaa',
    textAlign: 'center',
    marginBottom: ms(24),
    lineHeight: ms(22),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: ms(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: ms(12),
    borderRadius: ms(8),
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCancelText: {
    fontSize: fs(14),
    color: '#aaa',
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
  },
  modalConfirmText: {
    fontSize: fs(14),
    color: '#F44336',
    fontWeight: 'bold',
  },
});
