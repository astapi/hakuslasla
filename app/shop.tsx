import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PurchasesPackage } from 'react-native-purchases';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { usePurchaseStore, hasSpeedBoost } from '@/stores/usePurchaseStore';
import {
  PURCHASE_PRODUCTS,
  ENTITLEMENT_IDS,
  INVENTORY_BASE_SIZE,
  INVENTORY_EXPANDED_SIZE,
  STORAGE_BASE_SIZE,
  STORAGE_EXPANDED_SIZE,
  PET_BASE_SIZE,
  PET_EXPANDED_SIZE,
} from '@/constants/purchases';
import { ms, fs } from '@/utils/scaling';

export default function ShopScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    isInitialized,
    isLoading,
    availablePackages,
    entitlements,
    initialize,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
  } = usePurchaseStore();

  // Entitlementチェック関数（状態変化を検知するためローカルで定義）
  const hasEntitlement = useCallback(
    (entitlementId: string) => {
      // デバッグモードでは全て有効
      if (__DEV__ && process.env.EXPO_PUBLIC_ALL_ENTITLEMENTS === 'true') {
        return true;
      }
      return entitlements.has(entitlementId);
    },
    [entitlements]
  );

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (isInitialized && availablePackages.length === 0) {
      fetchOfferings();
    }
  }, [isInitialized, availablePackages.length, fetchOfferings]);

  // デバッグ: 全パッケージのIDを確認
  useEffect(() => {
    if (availablePackages.length > 0) {
      console.log('[Shop] All Packages from RevenueCat:');
      availablePackages.forEach((pkg) => {
        console.log(`  - Package ID: ${pkg.identifier}, Product ID: ${pkg.product.identifier}, Title: ${pkg.product.title}`);
      });

      console.log('[Shop] Expected Entitlement IDs from code:');
      PURCHASE_PRODUCTS.forEach((p) => {
        console.log(`  - ${p.entitlementId}: ${t(p.nameKey)}`);
      });
    }
  }, [availablePackages, t]);

  // 画面が表示されるたびに顧客情報を更新
  useFocusEffect(
    useCallback(() => {
      if (isInitialized) {
        console.log('[Shop] Refreshing customer info...');
        refreshCustomerInfo();
      }
    }, [isInitialized, refreshCustomerInfo])
  );

  // デバッグ: Entitlements状態を監視
  useEffect(() => {
    console.log('[Shop] Current entitlements:', Array.from(entitlements));
  }, [entitlements]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    const result = await purchasePackage(pkg);

    if (result.success) {
      Alert.alert(
        t('shop.purchaseSuccess'),
        t('shop.purchaseSuccessMessage'),
        [{ text: t('common.ok') }]
      );
    } else if (result.error !== 'cancelled') {
      Alert.alert(
        t('shop.purchaseFailed'),
        t('shop.purchaseFailedMessage'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    const result = await restorePurchases();
    setIsRestoring(false);

    if (result.success) {
      Alert.alert(
        t('shop.restoreSuccess'),
        t('shop.restoreSuccessMessage'),
        [{ text: t('common.ok') }]
      );
    } else {
      Alert.alert(
        t('shop.restoreFailed'),
        t('shop.restoreFailedMessage'),
        [{ text: t('common.ok') }]
      );
    }
  };

  const handleBack = () => {
    router.back();
  };

  // バンドル商品かどうかを判定
  const isBundleProduct = (entitlementId: string) => {
    return entitlementId === 'bundle';
  };

  // バンドル商品の購入済み判定（全Entitlementを保有している場合）
  const isBundlePurchased = () => {
    return (
      hasEntitlement(ENTITLEMENT_IDS.EXPANDED_INVENTORY) &&
      hasEntitlement(ENTITLEMENT_IDS.EXPANDED_STORAGE) &&
      hasEntitlement(ENTITLEMENT_IDS.TIER_FILTER_ENABLED) &&
      hasEntitlement(ENTITLEMENT_IDS.PERMANENT_BOOST) &&
      hasEntitlement(ENTITLEMENT_IDS.CHARACTER_SLOTS)
    );
  };

  // descriptionKeyに対応する補間パラメータを取得
  const getDescriptionParams = (descriptionKey: string): Record<string, number> | undefined => {
    switch (descriptionKey) {
      case 'shop.inventoryExpansion.description':
        return { from: INVENTORY_BASE_SIZE, to: INVENTORY_EXPANDED_SIZE };
      case 'shop.storageExpansion.description':
        return { from: STORAGE_BASE_SIZE, to: STORAGE_EXPANDED_SIZE };
      case 'shop.petExpansion.description':
        return { from: PET_BASE_SIZE, to: PET_EXPANDED_SIZE };
      default:
        return undefined;
    }
  };

  // パッケージに対応するアイコンと翻訳キーを取得
  const getPackageDisplayInfo = (pkg: PurchasesPackage) => {
    const packageId = pkg.identifier;

    // Package ID → Entitlement ID のマッピングを取得
    const productInfo = PURCHASE_PRODUCTS.find(p => p.packageId === packageId);

    // マッピングからEntitlement IDを取得（なければPackage IDをフォールバック）
    const entitlementId = productInfo?.entitlementId || packageId;

    // 補間パラメータを取得
    const descriptionParams = productInfo ? getDescriptionParams(productInfo.descriptionKey) : undefined;

    return {
      iconName: productInfo?.iconName || 'star',
      // 定義がある場合は翻訳を使用、なければRevenueCatの情報をそのまま使用
      name: productInfo ? t(productInfo.nameKey) : pkg.product.title,
      description: productInfo ? t(productInfo.descriptionKey, descriptionParams) : pkg.product.description || pkg.product.title,
      entitlementId: entitlementId,
    };
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{t('shop.title')}</Text>
          <Text style={styles.subtitle}>{t('shop.subtitle')}</Text>
        </View>
        <Pressable
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          <MaterialCommunityIcons name="restore" size={ms(20)} color="#4ECDC4" />
          <Text style={styles.restoreButtonText}>{t('shop.restore')}</Text>
        </Pressable>
      </View>

      {!isInitialized || isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* 招待コード案内バナー（課金で購入済みの場合は非表示） */}
            {!hasEntitlement(ENTITLEMENT_IDS.SPEED_BOOST) && (
              <View style={styles.inviteBanner}>
                <MaterialCommunityIcons
                  name="speedometer"
                  size={ms(24)}
                  color={hasSpeedBoost() ? '#4CAF50' : '#4ECDC4'}
                />
                <View style={styles.inviteBannerContent}>
                  {hasSpeedBoost() ? (
                    <Text style={styles.inviteBannerActivated}>
                      {t('shop.inviteCodeBanner.activated')}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.inviteBannerTitle}>
                        {t('shop.inviteCodeBanner.title')}
                      </Text>
                      <Text style={styles.inviteBannerDescription}>
                        {t('shop.inviteCodeBanner.description')}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {availablePackages.filter(pkg => PURCHASE_PRODUCTS.some(p => p.packageId === pkg.identifier)).length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="store-off" size={ms(48)} color="#666" />
                <Text style={styles.emptyStateText}>{t('shop.noProducts')}</Text>
              </View>
            ) : (
              availablePackages.filter(pkg => PURCHASE_PRODUCTS.some(p => p.packageId === pkg.identifier)).map((pkg, index) => {
                const displayInfo = getPackageDisplayInfo(pkg);
                // バンドル商品の場合は全Entitlement保有をチェック、それ以外は個別チェック
                const isPurchased = isBundleProduct(displayInfo.entitlementId)
                  ? isBundlePurchased()
                  : hasEntitlement(displayInfo.entitlementId);
                // 招待コードで有効化済み（課金未購入）
                const isInviteActivated = displayInfo.entitlementId === ENTITLEMENT_IDS.SPEED_BOOST
                  && !hasEntitlement(ENTITLEMENT_IDS.SPEED_BOOST)
                  && hasSpeedBoost();
                const isDisabled = isPurchased || isInviteActivated;
                const price = pkg.product.priceString;

                return (
                  <Pressable
                    key={pkg.identifier}
                    style={({ pressed }) => [
                      styles.productCard,
                      isDisabled && styles.productCardPurchased,
                      pressed && styles.productCardPressed,
                    ]}
                    onPress={() => !isDisabled && handlePurchase(pkg)}
                    disabled={isDisabled}
                  >
                    <View style={styles.productIcon}>
                      <MaterialCommunityIcons
                        name={displayInfo.iconName as any}
                        size={ms(32)}
                        color={isDisabled ? '#4CAF50' : '#4ECDC4'}
                      />
                    </View>

                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{displayInfo.name}</Text>
                      {isInviteActivated ? (
                        <View style={styles.statusRow}>
                          <MaterialCommunityIcons name="check-circle" size={ms(14)} color="#4CAF50" />
                          <Text style={styles.statusText}>{t('shop.inviteCodeBanner.activated')}</Text>
                        </View>
                      ) : isPurchased ? (
                        <View style={styles.statusRow}>
                          <MaterialCommunityIcons name="check-circle" size={ms(14)} color="#4CAF50" />
                          <Text style={styles.statusText}>{t('shop.purchased')}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.productDescription}>{displayInfo.description}</Text>
                    </View>

                    {!isDisabled && (
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>{price}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={t('common.back')}
              onPress={handleBack}
              variant="secondary"
            />
          </View>
        </>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: ms(16),
    paddingTop: ms(16),
    paddingBottom: ms(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(4),
  },
  subtitle: {
    fontSize: fs(14),
    color: '#aaa',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    paddingVertical: ms(6),
    paddingHorizontal: ms(12),
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
  },
  restoreButtonText: {
    fontSize: fs(12),
    color: '#4ECDC4',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fs(14),
    color: '#aaa',
    marginTop: ms(12),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: ms(80),
  },
  emptyStateText: {
    fontSize: fs(14),
    color: '#666',
    marginTop: ms(16),
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(16),
    marginBottom: ms(12),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(12),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  productCardPurchased: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  productCardPressed: {
    opacity: 0.7,
  },
  productIcon: {
    width: ms(48),
    height: ms(48),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: ms(24),
    marginRight: ms(16),
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(4),
  },
  productDescription: {
    fontSize: fs(12),
    color: '#aaa',
    lineHeight: fs(16),
  },
  priceContainer: {
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    borderRadius: ms(8),
  },
  priceText: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    marginBottom: ms(2),
  },
  statusText: {
    fontSize: fs(11),
    color: '#4CAF50',
    fontWeight: '600',
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: ms(14),
    marginBottom: ms(16),
    backgroundColor: 'rgba(78, 205, 196, 0.08)',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
    gap: ms(12),
  },
  inviteBannerContent: {
    flex: 1,
  },
  inviteBannerTitle: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: ms(2),
  },
  inviteBannerDescription: {
    fontSize: fs(12),
    color: '#aaa',
  },
  inviteBannerActivated: {
    fontSize: fs(13),
    fontWeight: '600',
    color: '#4CAF50',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
    gap: ms(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
});
