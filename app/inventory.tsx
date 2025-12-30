import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/common/Button';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { storageRepository } from '@/db';
import { getItem } from '@/data/items';

export default function InventoryScreen() {
  const router = useRouter();
  const { inventory, equipItem, removeFromInventory } = usePlayerStore();

  const handleBack = () => {
    router.back();
  };

  const handleEquip = async (itemId: string) => {
    await equipItem(itemId);
  };

  const handleDeposit = async (itemId: string) => {
    const success = await removeFromInventory(itemId, 1);
    if (success) {
      await storageRepository.deposit(itemId, 1);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {inventory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>アイテムがありません</Text>
            <Text style={styles.emptySubtext}>ダンジョンで入手したアイテムがここに表示されます</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {inventory.map((invItem) => {
              const item = getItem(invItem.itemId);
              if (!item) return null;
              return (
                <View key={invItem.itemId} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {invItem.quantity > 1 && (
                        <Text style={styles.itemQuantity}>x{invItem.quantity}</Text>
                      )}
                    </View>
                    <Text style={styles.itemSlot}>{item.slot}</Text>
                  </View>
                  <View style={styles.itemStats}>
                    {item.atk > 0 && <Text style={styles.statText}>ATK +{item.atk}</Text>}
                    {item.def > 0 && <Text style={styles.statText}>DEF +{item.def}</Text>}
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => handleEquip(invItem.itemId)}
                    >
                      <Text style={styles.actionButtonText}>装備</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.depositButton]}
                      onPress={() => handleDeposit(invItem.itemId)}
                    >
                      <Text style={styles.depositButtonText}>預ける</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="戻る" onPress={handleBack} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
  },
  itemList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  itemInfo: {
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  itemSlot: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  itemStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  depositButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  depositButtonText: {
    fontSize: 14,
    color: '#aaa',
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
