import { BattleLog } from '@/components/battle/BattleLog';
import { CharacterDisplay } from '@/components/battle/CharacterDisplay';
import { Button } from '@/components/common/Button';
import { getDungeon } from '@/data/dungeons';
import { useBattle } from '@/hooks/useBattle';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ImageBackground, ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
};

export default function BattleScreen() {
  const { t } = useTranslation();
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const router = useRouter();
  const { state, isPaused, togglePause, isAutoRunning, startAutoRun, stopAutoRun } = useBattle(dungeonId || '');
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

    if (state.phase === 'cleared' || state.phase === 'defeat') {
      // 累計（現在の周回分を含む）
      const finalTotalExp = (state.grandTotalExp || 0) + state.totalExpGained;
      const finalTotalItems = [...(state.grandTotalItems || []), ...state.droppedItems];

      // 結果画面に遷移
      const timer = setTimeout(() => {
        router.replace({
          pathname: '/result',
          params: {
            dungeonId: dungeonId,
            dungeonName: dungeon?.name || '',
            result: state.phase === 'cleared' ? 'cleared' : 'defeat',
            floorsCleared: state.currentFloor.toString(),
            maxFloor: state.maxFloor.toString(),
            expGained: state.totalExpGained.toString(),
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

  const handleRetreatConfirm = () => {
    setShowRetreatModal(false);
    router.replace('/home');
  };

  const backgroundImage = dungeonId ? backgroundImages[dungeonId] : undefined;

  // バトルエリアの内容
  const battleAreaContent = (
    <>
      <View style={styles.floorInfo}>
        <Text style={styles.floorText}>
          {dungeon?.name} - {state.currentFloor}/{state.maxFloor}{t('battle.floor')}
          {state.runCount > 1 && ` (${state.runCount}${t('battle.round')})`}
        </Text>
        {isAutoRunning && (
          <Text style={styles.autoRunText}>{t('battle.autoRunning')}</Text>
        )}
      </View>

      {/* 上部2/3のスペーサー */}
      <View style={styles.battleFieldSpacer} />

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
          {state.enemy && (
            <CharacterDisplay
              name={state.enemy.name}
              currentHp={state.enemy.currentHp}
              maxHp={state.enemy.maxHp}
              imageId={state.enemy.image}
              isAttacking={enemyAttacking}
              actionGauge={state.enemyGauge}
            />
          )}
        </View>
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
              />
            </View>
            {!isPaused && (
              <View style={styles.buttonWrapper}>
                {isAutoRunning ? (
                  <Button
                    title={t('battle.stopAutoRun')}
                    onPress={stopAutoRun}
                    variant="warning"
                  />
                ) : (
                  <Button
                    title={t('battle.autoRun')}
                    onPress={startAutoRun}
                    variant="primary"
                  />
                )}
              </View>
            )}
            {isPaused && (
              <View style={styles.buttonWrapper}>
                <Button title={t('battle.retreat')} onPress={() => setShowRetreatModal(true)} variant="danger" />
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
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleRetreatConfirm}
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
    backgroundColor: '#1a1a2e',
  },
  battleArea: {
    height: 280,
    overflow: 'hidden',
  },
  battleAreaImage: {
    resizeMode: 'cover',
  },
  battleAreaOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  battleAreaFallback: {
    backgroundColor: '#16213e',
  },
  floorInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  floorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  autoRunText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  battleFieldSpacer: {
    flex: 1,
  },
  battleField: {
    paddingBottom: 6,
    backgroundColor: 'rgba(22, 33, 62, 0.6)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  charactersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fightingText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  victoryText: {
    textAlign: 'center',
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  defeatText: {
    textAlign: 'center',
    color: '#F44336',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  clearedText: {
    textAlign: 'center',
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  actionArea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
  logArea: {
    flex: 1,
    padding: 16,
    maxHeight: 300,
  },
  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: 'bold',
  },
  modalConfirmButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
  },
  modalConfirmText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
  },
});
