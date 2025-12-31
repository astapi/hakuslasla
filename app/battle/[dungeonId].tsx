import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CharacterDisplay } from '@/components/battle/CharacterDisplay';
import { BattleLog } from '@/components/battle/BattleLog';
import { StatusPanel } from '@/components/player/StatusPanel';
import { EquipmentSlots } from '@/components/player/EquipmentSlots';
import { Button } from '@/components/common/Button';
import { useBattle } from '@/hooks/useBattle';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getDungeon } from '@/data/dungeons';

export default function BattleScreen() {
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const router = useRouter();
  const { state } = useBattle(dungeonId || '');
  const { level } = usePlayerStore();
  const dungeon = getDungeon(dungeonId || '');

  useEffect(() => {
    if (state.phase === 'cleared' || state.phase === 'defeat') {
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
          },
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [state.phase, dungeonId, router, dungeon, state]);

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
          </Text>
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
          <Text style={styles.fightingText}>戦闘中...</Text>
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

      {/* 下部: ステータス・装備 */}
      <View style={styles.infoArea}>
        <StatusPanel currentHp={state.playerCurrentHp} />
        <View style={styles.spacer} />
        <EquipmentSlots />

        {state.phase === 'fighting' && (
          <View style={styles.retreatButton}>
            <Button title="撤退する" onPress={handleRetreat} variant="danger" />
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
  spacer: {
    height: 12,
  },
  retreatButton: {
    marginTop: 16,
  },
});
