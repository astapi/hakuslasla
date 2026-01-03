import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getAllPassiveNodes, canUnlockNode, getNodeConnections } from '@/data/passiveTree';
import { PassiveNode } from '@/types';

export const PassiveTree = () => {
  const { skillPoints, unlockedSkills, unlockSkill } = usePlayerStore();
  const nodes = getAllPassiveNodes();
  const connections = getNodeConnections();

  const handleUnlockNode = (nodeId: string) => {
    unlockSkill(nodeId);
  };

  // ノードをY座標でグループ化
  const nodesByRow = nodes.reduce((acc, node) => {
    const y = node.position.y;
    if (!acc[y]) acc[y] = [];
    acc[y].push(node);
    return acc;
  }, {} as Record<number, PassiveNode[]>);

  // Y座標でソートして行を取得
  const sortedRows = Object.keys(nodesByRow)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>パッシブツリー</Text>
        <Text style={styles.skillPoints}>SP: {skillPoints}</Text>
      </View>

      <ScrollView style={styles.treeContainer}>
        {sortedRows.map((rowY, rowIndex) => {
          const rowNodes = nodesByRow[rowY].sort((a, b) => a.position.x - b.position.x);

          return (
            <View key={rowY}>
              {/* 接続線（前の行から現在の行への線） */}
              {rowIndex > 0 && (
                <View style={styles.connectionRow}>
                  {rowNodes.map((node) => {
                    const hasConnection = node.requiredNodes.length > 0;
                    // OR条件があるかチェック（配列要素があるか）
                    const hasOrCondition = node.requiredNodes.some(
                      (req) => Array.isArray(req)
                    );
                    return (
                      <View key={`conn-${node.id}`} style={styles.connectionCell}>
                        {hasConnection && (
                          <View style={[
                            styles.connectorLine,
                            hasOrCondition
                              ? styles.connectorLineOr
                              : styles.connectorLineAnd
                          ]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ノード行 */}
              <View style={styles.nodeRow}>
                {rowNodes.map((node) => {
                  const isUnlocked = unlockedSkills.includes(node.id);
                  const canUnlock = canUnlockNode(node.id, unlockedSkills) && skillPoints > 0;

                  return (
                    <Pressable
                      key={node.id}
                      style={({ pressed }) => [
                        styles.nodeContainer,
                        isUnlocked && styles.nodeUnlocked,
                        canUnlock && !isUnlocked && styles.nodeAvailable,
                        pressed && styles.nodePressed,
                      ]}
                      onPress={() => canUnlock && handleUnlockNode(node.id)}
                      disabled={!canUnlock || isUnlocked}
                    >
                      <Text
                        style={[styles.nodeName, isUnlocked && styles.nodeNameUnlocked]}
                        numberOfLines={1}
                      >
                        {node.name}
                      </Text>
                      <Text style={styles.nodeDescription} numberOfLines={2}>
                        {node.description}
                      </Text>
                      {isUnlocked && <Text style={styles.unlockedBadge}>習得済み</Text>}
                      {canUnlock && !isUnlocked && (
                        <Text style={styles.availableBadge}>習得可能</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 12,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  treeContainer: {
    flex: 1,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: 20,
  },
  connectionCell: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  connectorLine: {
    width: 2,
    height: '100%',
  },
  connectorLineOr: {
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
  },
  connectorLineAnd: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  nodeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nodeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 100,
    maxWidth: 120,
    alignItems: 'center',
  },
  nodeUnlocked: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  nodeAvailable: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  nodePressed: {
    opacity: 0.7,
  },
  nodeName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 4,
    textAlign: 'center',
  },
  nodeNameUnlocked: {
    color: '#fff',
  },
  nodeDescription: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  unlockedBadge: {
    fontSize: 9,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: 'bold',
  },
  availableBadge: {
    fontSize: 9,
    color: '#FFD700',
    marginTop: 4,
    fontWeight: 'bold',
  },
});
