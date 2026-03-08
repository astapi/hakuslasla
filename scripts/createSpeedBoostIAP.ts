/**
 * App Store Connect に「3倍速解放」アプリ内課金を作成するスクリプト
 *
 * 使用方法:
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/createSpeedBoostIAP.ts
 */

import { validateConfig, apiRequest, config } from './appStoreConnect';

// ============================================
// ローカライズ定義
// ============================================

const PRODUCT_ID = 'com.astapi.LootDive.speed_boost';

const localizations: { locale: string; name: string; description: string }[] = [
  {
    locale: 'ja',
    name: '3倍速解放',
    description: '戦闘速度3倍速を設定できるようになります',
  },
  {
    locale: 'en-US',
    name: '3x Speed Unlock',
    description: 'Unlock 3x battle speed option',
  },
  {
    locale: 'en-GB',
    name: '3x Speed Unlock',
    description: 'Unlock 3x battle speed option',
  },
  {
    locale: 'en-AU',
    name: '3x Speed Unlock',
    description: 'Unlock 3x battle speed option',
  },
  {
    locale: 'en-CA',
    name: '3x Speed Unlock',
    description: 'Unlock 3x battle speed option',
  },
  {
    locale: 'zh-Hans',
    name: '3倍速解锁',
    description: '解锁3倍战斗速度选项',
  },
  {
    locale: 'ko',
    name: '3배속 해금',
    description: '3배속 전투 속도 옵션을 해금합니다',
  },
  {
    locale: 'es-ES',
    name: 'Desbloqueo 3x',
    description: 'Desbloquea la opción de velocidad de batalla 3x',
  },
  {
    locale: 'es-MX',
    name: 'Desbloqueo 3x',
    description: 'Desbloquea la opción de velocidad de batalla 3x',
  },
  {
    locale: 'fr-FR',
    name: 'Vitesse 3x',
    description: 'Débloque l\'option de vitesse de combat 3x',
  },
  {
    locale: 'fr-CA',
    name: 'Vitesse 3x',
    description: 'Débloque l\'option de vitesse de combat 3x',
  },
  {
    locale: 'de-DE',
    name: '3x Geschwindigkeit',
    description: 'Schalte die 3x Kampfgeschwindigkeitsoption frei',
  },
];

// ============================================
// API (v2 for In-App Purchases)
// ============================================

async function apiRequestV2<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // apiRequest uses v1 base URL, we need v2 for in-app purchases
  const { generateToken } = await import('./appStoreConnect');
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v2';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('🚀 「3倍速解放」アプリ内課金を作成\n');

  try {
    validateConfig();

    // 古いIAPを削除
    const OLD_IAP_ID = '6760246885';
    console.log(`🗑️  古い In-App Purchase を削除中 (ID: ${OLD_IAP_ID})...`);
    try {
      await apiRequestV2<void>(`/inAppPurchases/${OLD_IAP_ID}`, { method: 'DELETE' });
      console.log('✅ 削除完了\n');
    } catch (e: any) {
      console.log(`⚠️  削除スキップ: ${e.message}\n`);
    }

    // In-App Purchase を作成 (v2 API)
    console.log('📦 In-App Purchase を作成中...');
    const iapResponse = await apiRequestV2<{ data: { id: string } }>(
      `/inAppPurchases`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchases',
            attributes: {
              name: '3x Speed Unlock',
              productId: PRODUCT_ID,
              inAppPurchaseType: 'NON_CONSUMABLE',
              reviewNote: 'Unlocks 3x battle speed option. Can also be unlocked via invite code feature.',
            },
            relationships: {
              app: {
                data: {
                  type: 'apps',
                  id: config.appId,
                },
              },
            },
          },
        }),
      }
    );

    const iapId = iapResponse.data.id;
    console.log(`✅ In-App Purchase 作成完了 (ID: ${iapId})\n`);

    // 2. ローカライゼーションを追加
    console.log('🌐 ローカライゼーションを追加中...');
    for (const loc of localizations) {
      try {
        await apiRequest<{ data: { id: string } }>(
          '/inAppPurchaseLocalizations',
          {
            method: 'POST',
            body: JSON.stringify({
              data: {
                type: 'inAppPurchaseLocalizations',
                attributes: {
                  locale: loc.locale,
                  name: loc.name,
                  description: loc.description,
                },
                relationships: {
                  inAppPurchaseV2: {
                    data: {
                      type: 'inAppPurchases',
                      id: iapId,
                    },
                  },
                },
              },
            }),
          }
        );
        console.log(`   ✅ ${loc.locale}: ${loc.name}`);
      } catch (error: any) {
        console.error(`   ❌ ${loc.locale}: ${error.message}`);
      }
    }

    console.log('\n✅ 完了！');
    console.log(`   Product ID: ${PRODUCT_ID}`);
    console.log(`   IAP ID: ${iapId}`);
    console.log('\n⚠️  App Store Connectで価格の設定が別途必要です。');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
