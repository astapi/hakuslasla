import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Button } from '@/components/common/Button';
import { storageRepository } from '@/db';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { getItem } from '@/data/items';
import { StorageItem } from '@/types';

export default function StorageScreen() {
  const router = useRouter();
  const { addToInventory } = usePlayerStore();
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await storageRepository.getAll();
      setStorageItems(items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStorage();
    }, [fetchStorage])
  );

  const handleBack = () => {
    router.back();
  };

  const handleWithdraw = async (itemId: string) => {
    const success = await storageRepository.withdraw(itemId, 1);
    if (success) {
      await addToInventory(itemId, 1);
      await fetchStorage();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <Text style={styles.loadingText}>読み込み中...</Text>
        ) : storageItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>倉庫は空です</Text>
            <Text style={styles.emptySubtext}>インベントリからアイテムを預けることができます</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {storageItems.map((storageItem) => {
              const item = getItem(storageItem.itemId);
              if (!item) return null;
              return (
                <View key={storageItem.itemId} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {storageItem.quantity > 1 && (
                        <Text style={styles.itemQuantity}>x{storageItem.quantity}</Text>
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
                      onPress={() => handleWithdraw(storageItem.itemId)}
                    >
                      <Text style={styles.actionButtonText}>引き出す</Text>
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
  loadingText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 32,
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
  footer: {
    padding: 16,
    paddingBottom: 32,
  },
});
