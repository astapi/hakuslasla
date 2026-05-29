import { BattleLog } from '@/components/battle/BattleLog';
import { CharacterAvatar } from '@/components/battle/CharacterAvatar';
import { CharacterStatus } from '@/components/battle/CharacterStatus';
import { PetAvatar } from '@/components/battle/PetAvatar';
import { getPet, getPetImageKey } from '@/data/pets';
import { BoostIndicator } from '@/components/battle/BoostIndicator';
import { SpeedButton } from '@/components/battle/SpeedButton';
import { Button } from '@/components/common/Button';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDungeon } from '@/data/dungeons';
import { useBattle } from '@/hooks/useBattle';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Image, ImageBackground, ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ms, fs, s } from '@/utils/scaling';
import { getChestImageForItem, getChestRarityForItem } from '@/data/images';
import { Analytics } from '@/lib/analytics';
import { UBER_DUNGEON_IDS, UBER_UBER_DUNGEON_IDS } from '@/core/endContent';

// ダンジョン背景画像マッピング
const backgroundImages: Record<string, ImageSourcePropType> = {
  grassland: require('@/assets/images/backgrounds/grassland.jpg'),
  cave: require('@/assets/images/backgrounds/cave.jpg'),
  ruins: require('@/assets/images/backgrounds/ruins.jpg'),
  goblin_fort: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  bandit_hideout: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  demon_castle: require('@/assets/images/backgrounds/demon_castle.jpg'),
  vampire_mansion: require('@/assets/images/backgrounds/vampire_mansion.jpg'),
  ice_cave: require('@/assets/images/backgrounds/ice_cave.jpg'),
  underwater_cave: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  volcano: require('@/assets/images/backgrounds/volcano.jpg'),
  orc_fortress: require('@/assets/images/backgrounds/orc_fortress.jpg'),
  dark_forest: require('@/assets/images/backgrounds/dark_forest.jpg'),
  sky_tower: require('@/assets/images/backgrounds/sky_tower.jpg'),
  hell_gate: require('@/assets/images/backgrounds/hell_gate.jpg'),
  dragon_nest: require('@/assets/images/backgrounds/dragon_nest.jpg'),
  sacred_temple: require('@/assets/images/backgrounds/sacred_temple.jpg'),
  chaos_realm: require('@/assets/images/backgrounds/chaos_realm.jpg'),
  final_land: require('@/assets/images/backgrounds/final_land.jpg'),
  dimensional_rush_1: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_2: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_3: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_4: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_5: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_rush_6: require('@/assets/images/backgrounds/dimensional_rush.jpg'),
  dimensional_corridor: require('@/assets/images/backgrounds/dimensional_corridor.jpg'),
  uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  uber_vampire: require('@/assets/images/backgrounds/vampire_mansion.jpg'),
  uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  uber_demon_lord: require('@/assets/images/backgrounds/demon_castle.jpg'),
  uber_true_final_boss: require('@/assets/images/backgrounds/final_land.jpg'),
  uber_uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  uber_uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  uber_uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
  debug_uber_uber_goblin_king: require('@/assets/images/backgrounds/goblin_fort.jpg'),
  debug_uber_uber_bandit_leader: require('@/assets/images/backgrounds/bandit_hideout.jpg'),
  debug_uber_uber_kraken: require('@/assets/images/backgrounds/underwater_cave.jpg'),
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

    // クリーンアップ: アンマウント時にアニメーションをキャンセル
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(rotateZ);
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
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
  useKeepAwake(); // 戦闘中はスリープを防止

  const { t } = useTranslation();
  const { dungeonId, startFloor } = useLocalSearchParams<{ dungeonId: string; startFloor?: string }>();
  const router = useRouter();
  const parsedStartFloor = startFloor ? parseInt(startFloor, 10) : 1;
  const { state, isPaused, togglePause, isAutoRunning, startAutoRun, stopAutoRun, retreat, battleSpeed, changeBattleSpeed, krakenFlurryCountdown, getPetsGained } = useBattle(dungeonId || '', { startFloor: parsedStartFloor });
  const { level, characterType, pets, activePetInstanceId } = usePlayerStore();
  const activePet = activePetInstanceId
    ? pets.find((p) => p.instanceId === activePetInstanceId)
    : undefined;
  const activePetDef = activePet ? getPet(activePet.petId) : undefined;
  const dungeon = getDungeon(dungeonId || '');
  const insets = useSafeAreaInsets();

  // 攻撃アニメーション用のstate
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  // 最後に処理したログエントリの参照を追跡（ログが切り詰められても追跡可能）
  const lastProcessedEntryRef = useRef<(typeof state.battleLog)[number] | null>(null);
  // タイマーIDを管理（古いタイマーをキャンセルするため）
  const playerAttackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyAttackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 撤退確認モーダル
  const [showRetreatModal, setShowRetreatModal] = useState(false);
  // 画面遷移前にImageを安全にアンマウントするフラグ
  const [isExiting, setIsExiting] = useState(false);

  // 戦闘ログの変化を監視して攻撃アニメーションをトリガー
  useEffect(() => {
    const currentLog = state.battleLog;
    if (currentLog.length === 0) {
      lastProcessedEntryRef.current = null;
      return;
    }

    // 最後に処理したエントリの位置を探す
    let startIndex = 0;
    if (lastProcessedEntryRef.current) {
      const foundIndex = currentLog.indexOf(lastProcessedEntryRef.current);
      if (foundIndex !== -1) {
        startIndex = foundIndex + 1;
      }
      // 見つからない場合（切り詰められて削除された場合）は0から処理
    }

    // 新しいエントリを取得
    const newEntries = currentLog.slice(startIndex);
    for (const entry of newEntries) {
      if (entry.type === 'player_attack' || entry.type === 'critical') {
        // 古いタイマーをキャンセル
        if (playerAttackTimerRef.current) {
          clearTimeout(playerAttackTimerRef.current);
        }
        setPlayerAttacking(true);
        playerAttackTimerRef.current = setTimeout(() => {
          setPlayerAttacking(false);
          playerAttackTimerRef.current = null;
        }, 200);
      } else if (entry.type === 'enemy_attack') {
        // 古いタイマーをキャンセル
        if (enemyAttackTimerRef.current) {
          clearTimeout(enemyAttackTimerRef.current);
        }
        setEnemyAttacking(true);
        enemyAttackTimerRef.current = setTimeout(() => {
          setEnemyAttacking(false);
          enemyAttackTimerRef.current = null;
        }, 200);
      }
    }

    // 最後のエントリを記録
    lastProcessedEntryRef.current = currentLog[currentLog.length - 1];
  }, [state.battleLog]);

  // アンマウント時にタイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (playerAttackTimerRef.current) {
        clearTimeout(playerAttackTimerRef.current);
      }
      if (enemyAttackTimerRef.current) {
        clearTimeout(enemyAttackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // 戦闘開始時にisExitingをリセット（自動周回の次ラウンド対応）
    if (state.phase === 'fighting') {
      setIsExiting(false);
    }

    // 自動周回中でクリアした場合は結果画面に遷移しない（次の周回が始まる）
    if (isAutoRunning && state.phase === 'cleared') {
      return;
    }

    if (state.phase === 'cleared' || state.phase === 'defeat' || state.phase === 'retreat') {
      if (state.phase === 'defeat') {
        Analytics.logBattleDefeat({
          dungeon_id: dungeonId || '',
          floor_reached: state.currentFloor,
          max_floor: state.maxFloor,
          player_level: level,
        });
      }

      const isRetreat = state.phase === 'retreat';
      // 累計（現在の周回分を含む）
      const finalTotalExp = isRetreat ? 0 : (state.grandTotalExp || 0) + state.totalExpGained;
      const finalTotalItems = [...(state.grandTotalItems || []), ...state.droppedItems];

      // 遷移前にImageコンポーネントをアンマウントし、
      // Reanimatedイベントリスナーとの競合によるクラッシュを防止
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 1700);

      // 結果画面に遷移（Imageアンマウント後に十分な間隔を確保）
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
            petsGained: JSON.stringify(getPetsGained()),
          },
        });
      }, 2000);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(timer);
      };
    }
  }, [state.phase, dungeonId, router, dungeon, state, isAutoRunning, level]);

  const handleRetreatConfirm = async () => {
    setShowRetreatModal(false);
    await retreat();
  };

  const backgroundImage = dungeonId ? backgroundImages[dungeonId] : undefined;
  const showChest = Boolean(state.enemy && state.enemy.currentHp <= 0 && state.lastDroppedItems.length > 0);

  // バトルエリアの内容（背景画像の上にはキャラクター画像のみ）
  const battleAreaContent = (
    <>
      <View style={styles.floorInfo}>
        <View style={styles.floorInfoRow}>
          <Text style={styles.floorText}>
            {t(`dungeons.${dungeonId}.name`)} - {state.currentFloor}/{state.maxFloor}{t('battle.floor')}
            {state.runCount > 1 && ` (${state.runCount}${t('battle.round')})`}
          </Text>
          <BoostIndicator />
          <SpeedButton currentSpeed={battleSpeed} onSpeedChange={changeBattleSpeed} />
        </View>
        {isAutoRunning && (
          <Text style={styles.autoRunText}>{t('battle.autoRunning')}</Text>
        )}
        {krakenFlurryCountdown !== null && (
          <View style={styles.flurryCounterRow}>
            <MaterialCommunityIcons name="wave" size={ms(14)} color="#5DADE2" />
            <Text style={styles.flurryCounterText}>
              {t('battle.tentacleFlurryCountdown', { count: krakenFlurryCountdown })}
            </Text>
          </View>
        )}
      </View>

      {/* 勝利/敗北/クリアテキスト */}
      <View style={styles.phaseTextContainer}>
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

      {/* キャラクターアバターエリア（画像のみ） */}
      {/* isExiting時はAnimated.Viewをマウント維持したまま、Imageのみ非表示にし、
          Reanimated StaticPropsRegistryとの競合クラッシュを防止 */}
      <View style={styles.avatarArea}>
        <View style={styles.avatarContainer}>
          <CharacterAvatar
            isPlayer
            characterType={characterType}
            isAttacking={playerAttacking}
            size={s(100)}
            chillState={state.playerChill}
            freezeState={state.playerFreeze}
            hideImage={isExiting}
          />
          {activePetDef && !isExiting && (
            <View style={styles.petSlot} pointerEvents="none">
              <PetAvatar imageId={getPetImageKey(activePetDef)} size={s(52)} />
            </View>
          )}
        </View>
        {state.enemy && (
          <>
            {/* 敵アバター: 宝箱表示時はopacityで非表示にし、
                Reanimatedイベント競合クラッシュを防止 */}
            <View style={[styles.avatarContainer, showChest && styles.hidden]}>
              <CharacterAvatar
                imageId={state.enemy.image}
                isAttacking={enemyAttacking}
                size={s(100)}
                poisonStacks={state.enemyPoison}
                igniteState={state.enemyIgnite}
                chillState={state.enemyChill}
                freezeState={state.enemyFreeze}
                hideImage={isExiting}
              />
            </View>
            {showChest && !isExiting && (
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
          </>
        )}
      </View>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 上部: バトルエリア（背景画像 + キャラクター画像のみ） */}
      {/* ImageBackgroundはアンマウントせずマウント維持し、
          Reanimated StaticPropsRegistryとの競合を防止 */}
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

      {/* ステータスエリア（ゲージ、名前、HP等） */}
      <View style={styles.statusArea}>
        <CharacterStatus
          name={t('battle.player')}
          currentHp={state.playerCurrentHp}
          maxHp={state.playerMaxHp}
          level={level}
          isPlayer
          actionGauge={state.playerGauge}
        />
        {state.enemy && (
          <CharacterStatus
            name={t(`monsters.${state.enemy.id}.name`, { defaultValue: state.enemy.name })}
            currentHp={state.enemy.currentHp}
            maxHp={state.enemy.maxHp}
            actionGauge={state.enemyGauge}
          />
        )}
      </View>

      {/* 戦闘ログ（画面下部まで拡張） */}
      <View style={styles.logArea}>
        <BattleLog logs={state.battleLog} />

        {/* フローティングアクションアイコン（右下縦並び） */}
        {state.phase === 'fighting' && (
          <View style={styles.floatingActions}>
            {/* 周回アイコン（Uberダンジョンでは非表示） */}
            {!UBER_DUNGEON_IDS.includes(dungeonId || '') && !UBER_UBER_DUNGEON_IDS.includes(dungeonId || '') && (
              <Pressable
                style={[
                  styles.floatingIconButton,
                  isAutoRunning && styles.floatingIconButtonActive,
                ]}
                onPress={isAutoRunning ? stopAutoRun : startAutoRun}
                testID="battle-auto-toggle"
              >
                <MaterialCommunityIcons
                  name="autorenew"
                  size={ms(18)}
                  color={isAutoRunning ? '#4CAF50' : 'rgba(255, 255, 255, 0.7)'}
                />
              </Pressable>
            )}
            {/* 一時停止/再開アイコン */}
            <Pressable
              style={[
                styles.floatingIconButton,
                isPaused && styles.floatingIconButtonPaused,
              ]}
              onPress={togglePause}
              testID="battle-toggle-pause"
            >
              <MaterialCommunityIcons
                name={isPaused ? 'play' : 'pause'}
                size={ms(18)}
                color={isPaused ? '#FFC107' : 'rgba(255, 255, 255, 0.7)'}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* 撤退ボタンエリア（常にスペース確保、一時停止中のみボタン表示） */}
      {state.phase === 'fighting' && (
        <View style={styles.retreatArea}>
          {isPaused && (
            <Pressable
              style={styles.retreatButton}
              onPress={() => setShowRetreatModal(true)}
              testID="battle-retreat"
            >
              <Text style={styles.retreatButtonText}>{t('battle.retreat')}</Text>
            </Pressable>
          )}
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
    height: s(260),
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
    backgroundColor: '#15191E',
  },
  floorInfo: {
    alignItems: 'center',
    marginBottom: ms(4),
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
  flurryCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    marginTop: ms(4),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    backgroundColor: 'rgba(30, 80, 130, 0.5)',
    borderRadius: ms(4),
    borderWidth: 1,
    borderColor: 'rgba(93, 173, 226, 0.7)',
  },
  flurryCounterText: {
    fontSize: fs(12),
    color: '#5DADE2',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  phaseTextContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ms(28),
  },
  avatarArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: ms(24),
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  petSlot: {
    // プレイヤー画像の左下に重ねて配置
    position: 'absolute',
    left: s(2),
    bottom: s(20),
    zIndex: 2,
  },
  hidden: {
    opacity: 0,
    position: 'absolute',
  },
  statusArea: {
    flexDirection: 'row',
    paddingHorizontal: ms(12),
    paddingVertical: ms(8),
  },
  chestSlot: {
    width: s(120),
    height: s(120),
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
  logArea: {
    flex: 1,
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(16),
    position: 'relative',
  },
  floatingActions: {
    position: 'absolute',
    right: ms(8),
    bottom: ms(8),
    gap: ms(6),
  },
  floatingIconButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingIconButtonActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderColor: '#4CAF50',
  },
  floatingIconButtonPaused: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    borderColor: '#FFC107',
  },
  retreatArea: {
    paddingHorizontal: ms(16),
    paddingBottom: ms(12),
    alignItems: 'center',
    minHeight: ms(52),
    justifyContent: 'center',
  },
  retreatButton: {
    paddingVertical: ms(10),
    paddingHorizontal: ms(32),
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.5)',
  },
  retreatButtonText: {
    fontSize: fs(14),
    color: '#F44336',
    fontWeight: 'bold',
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
