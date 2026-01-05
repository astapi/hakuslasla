import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CharacterDisplay } from '@/components/battle/CharacterDisplay';
import { BattleLog } from '@/components/battle/BattleLog';
import { EquipmentSlots } from '@/components/player/EquipmentSlots';
import { Button } from '@/components/common/Button';
import { useBattle } from '@/hooks/useBattle';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getDungeon } from '@/data/dungeons';

export default function BattleScreen() {
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const router = useRouter();
  const { state, isPaused, togglePause, isAutoRunning, startAutoRun, stopAutoRun } = useBattle(dungeonId || '');
  const { level } = usePlayerStore();
  const dungeon = getDungeon(dungeonId || '');

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

  const handleRetreat = () => {
    router.replace('/home');
  };

  return (
    <View style={styles.container}>
      {/* 上部: バトルエリア */}
      <View style={styles.battleArea}>
        <View style={styles.floorInfo}>
          <Text style={styles.floorText}>
            {dungeon?.name} - {state.currentFloor}/{state.maxFloor}階
            {state.runCount > 1 && ` (${state.runCount}周目)`}
          </Text>
          {isAutoRunning && (
            <Text style={styles.autoRunText}>自動周回中</Text>
          )}
        </View>

        <View style={styles.charactersContainer}>
          <CharacterDisplay
            name="プレイヤー"
            currentHp={state.playerCurrentHp}
            maxHp={state.playerMaxHp}
            level={level}
            isPlayer
          />
          {state.enemy && (
            <CharacterDisplay
              name={state.enemy.name}
              currentHp={state.enemy.currentHp}
              maxHp={state.enemy.maxHp}
              imageId={state.enemy.image}
            />
          )}
        </View>

        {state.phase === 'fighting' && (
          <Text style={styles.fightingText}>
            {isPaused ? '一時停止中' : '戦闘中...'}
          </Text>
        )}
        {state.phase === 'victory' && (
          <Text style={styles.victoryText}>勝利！</Text>
        )}
        {state.phase === 'defeat' && (
          <Text style={styles.defeatText}>敗北...</Text>
        )}
        {state.phase === 'cleared' && (
          <Text style={styles.clearedText}>ダンジョン踏破！</Text>
        )}
      </View>

      {/* 中部: 戦闘ログ */}
      <View style={styles.logArea}>
        <BattleLog logs={state.battleLog} />
      </View>

      {/* 下部: 装備 */}
      <View style={styles.infoArea}>
        <EquipmentSlots />

        {state.phase === 'fighting' && (
          <View style={styles.actionButtons}>
            <View style={styles.buttonWrapper}>
              <Button
                title={isPaused ? '再開' : '一時停止'}
                onPress={togglePause}
                variant="secondary"
              />
            </View>
            <View style={styles.buttonWrapper}>
              {isAutoRunning ? (
                <Button
                  title="周回停止"
                  onPress={stopAutoRun}
                  variant="warning"
                />
              ) : (
                <Button
                  title="自動周回"
                  onPress={startAutoRun}
                  variant="primary"
                />
              )}
            </View>
            <View style={styles.buttonWrapper}>
              <Button title="撤退" onPress={handleRetreat} variant="danger" />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  battleArea: {
    padding: 16,
    backgroundColor: '#16213e',
  },
  floorInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  floorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  autoRunText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  charactersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fightingText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  victoryText: {
    textAlign: 'center',
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  defeatText: {
    textAlign: 'center',
    color: '#F44336',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  clearedText: {
    textAlign: 'center',
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  logArea: {
    flex: 1,
    padding: 16,
    maxHeight: 200,
  },
  infoArea: {
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  buttonWrapper: {
    flex: 1,
  },
});
