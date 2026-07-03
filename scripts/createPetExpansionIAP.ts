/**
 * App Store Connect に「ペット枠拡張」アプリ内課金を作成するスクリプト
 *
 * createSpeedBoostIAP.ts をベースにしたペット枠拡張版。
 * - IAP本体を作成 (NON_CONSUMABLE)
 * - 全ロケールのローカライズを追加（locales/*.json の shop.petExpansion を 50→100 でレンダリング）
 * - 参考として inventory_expansion の現在価格を読み取って表示（価格は「インベントリ拡張と同じ」にする）
 *
 * 使用方法:
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/createPetExpansionIAP.ts
 *
 * ⚠️ 価格の自動設定・審査用スクショ・審査提出は行いません（末尾の案内を参照）。
 */

import { validateConfig, apiRequest, generateToken, config } from './appStoreConnect';

// constants/purchases.ts は react-native 依存のため Node からは import 不可。値のみ再掲。
const PET_BASE_SIZE = 50;      // constants/purchases.ts と一致させること
const PET_EXPANDED_SIZE = 100; // constants/purchases.ts と一致させること

const PRODUCT_ID = 'com.astapi.LootDive.pet_expansion';
const INVENTORY_PRODUCT_ID = 'com.astapi.LootDive.inventory_expansion';

// ============================================
// ローカライズ定義（locales/*.json の shop.petExpansion を 50→100 で反映）
// ============================================
const F = PET_BASE_SIZE;   // 50
const T = PET_EXPANDED_SIZE; // 100

const localizations: { locale: string; name: string; description: string }[] = [
  { locale: 'ja',      name: 'ペット枠拡張',          description: `ペットの所持上限を${F}匹から${T}匹に拡張します` },
  { locale: 'en-US',   name: 'Pet Slots Expansion',   description: `Increases pet slot limit from ${F} to ${T}` },
  { locale: 'en-GB',   name: 'Pet Slots Expansion',   description: `Increases pet slot limit from ${F} to ${T}` },
  { locale: 'en-AU',   name: 'Pet Slots Expansion',   description: `Increases pet slot limit from ${F} to ${T}` },
  { locale: 'en-CA',   name: 'Pet Slots Expansion',   description: `Increases pet slot limit from ${F} to ${T}` },
  { locale: 'zh-Hans', name: '宠物槽扩展',            description: `将宠物槽上限从${F}增加到${T}` },
  { locale: 'ko',      name: '펫 슬롯 확장',          description: `펫 슬롯을 ${F}마리에서 ${T}마리로 증가` },
  { locale: 'es-ES',   name: 'Expansión de Mascotas', description: `Aumenta el límite de mascotas de ${F} a ${T}` },
  { locale: 'es-MX',   name: 'Expansión de Mascotas', description: `Aumenta el límite de mascotas de ${F} a ${T}` },
  { locale: 'fr-FR',   name: 'Extension familiers',   description: `Augmente la limite de familiers de ${F} à ${T}` },
  { locale: 'fr-CA',   name: 'Extension familiers',   description: `Augmente la limite de familiers de ${F} à ${T}` },
  { locale: 'de-DE',   name: 'Haustier-Plätze',       description: `Erhöht das Haustier-Limit von ${F} auf ${T}` },
];

// ============================================
// v2 API ヘルパー（In-App Purchases は v2）
// ============================================
async function apiRequestV2<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
  // DELETE 等は本文が空
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// v2 GET ヘルパー
async function apiGetV2<T>(endpoint: string): Promise<T> {
  return apiRequestV2<T>(endpoint, { method: 'GET' });
}

// 価格ポイントIDは base64(JSON) で、{s:iapId, t:territory, p:pricePointNo, ...} を持つ
function decodePricePoint(id: string): { s?: string; t?: string; p?: string } {
  try {
    return JSON.parse(Buffer.from(id, 'base64').toString());
  } catch {
    return {};
  }
}

// 既存IAPをproductIdで検索（重複作成防止）
async function findExistingIap(productId: string): Promise<string | null> {
  const res = await apiRequest<{ data: Array<{ id: string; attributes: { productId: string } }> }>(
    `/apps/${config.appId}/inAppPurchasesV2?filter[productId]=${encodeURIComponent(productId)}&limit=1`
  );
  return res.data[0]?.id ?? null;
}

// テリトリー指定で全価格ポイントを取得（v2, ページング）
async function getPricePoints(iapId: string, territory: string): Promise<any[]> {
  const out: any[] = [];
  let ep: string | null = `/inAppPurchases/${iapId}/pricePoints?filter[territory]=${territory}&limit=200`;
  while (ep) {
    const page: any = await apiGetV2<any>(ep);
    out.push(...(page.data ?? []));
    ep = page.links?.next
      ? String(page.links.next).replace('https://api.appstoreconnect.apple.com/v2', '')
      : null;
  }
  return out;
}

// inventory_expansion と同じ価格を pet に設定する（基準テリトリーの価格ポイント番号で突合）
async function syncPriceFromInventory(petIapId: string): Promise<void> {
  const invId = await findExistingIap(INVENTORY_PRODUCT_ID);
  if (!invId) {
    console.log('   ⚠️  inventory_expansion が見つからず価格設定をスキップ（UIで設定してください）');
    return;
  }
  // inventory の基準テリトリー + 基準価格ポイント番号を取得
  const invSchedule = await apiGetV2<any>(
    `/inAppPurchases/${invId}/iapPriceSchedule?include=baseTerritory,manualPrices`
  );
  const baseTerritory: string = invSchedule.data?.relationships?.baseTerritory?.data?.id ?? 'USA';
  const invPrice = (invSchedule.included ?? []).find((i: any) => i.type === 'inAppPurchasePrices');
  const basePointNo = decodePricePoint(invPrice?.id ?? '').p;
  if (!basePointNo) {
    console.log('   ⚠️  inventory の基準価格ポイントを特定できず、価格設定をスキップ');
    return;
  }
  // pet 側で同じ価格ポイント番号（＝同額）を探す
  const petPoints = await getPricePoints(petIapId, baseTerritory);
  const match = petPoints.find((d: any) => decodePricePoint(d.id).p === basePointNo);
  if (!match) {
    console.log(`   ⚠️  pet に価格ポイント#${basePointNo}が見つからず、価格設定をスキップ`);
    return;
  }
  console.log(
    `   💰 inventory と同額を設定: ${match.attributes?.customerPrice} (${baseTerritory}, #${basePointNo})`
  );
  // 価格スケジュールを作成（基準テリトリーのみ指定 → 他テリトリーはApple自動換算）
  const tempId = '${new-price-1}';
  await apiRequest('/inAppPurchasePriceSchedules', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'inAppPurchasePriceSchedules',
        relationships: {
          inAppPurchase: { data: { type: 'inAppPurchases', id: petIapId } },
          baseTerritory: { data: { type: 'territories', id: baseTerritory } },
          manualPrices: { data: [{ type: 'inAppPurchasePrices', id: tempId }] },
        },
      },
      included: [
        {
          type: 'inAppPurchasePrices',
          id: tempId,
          attributes: { startDate: null },
          relationships: {
            inAppPurchasePricePoint: {
              data: { type: 'inAppPurchasePricePoints', id: match.id },
            },
            inAppPurchaseV2: { data: { type: 'inAppPurchases', id: petIapId } },
          },
        },
      ],
    }),
  });
  console.log('   ✅ 価格設定 完了');
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('🐾 「ペット枠拡張」アプリ内課金を作成\n');
  try {
    validateConfig();

    // 重複チェック
    const existing = await findExistingIap(PRODUCT_ID);
    let iapId: string;
    if (existing) {
      console.log(`ℹ️  既に存在します (ID: ${existing}) → ローカライズのみ更新します\n`);
      iapId = existing;
    } else {
      console.log('📦 In-App Purchase を作成中...');
      const iapResponse = await apiRequestV2<{ data: { id: string } }>(`/inAppPurchases`, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'inAppPurchases',
            attributes: {
              name: 'Pet Slots Expansion',
              productId: PRODUCT_ID,
              inAppPurchaseType: 'NON_CONSUMABLE',
              reviewNote: `Increases the pet ownership limit from ${F} to ${T}.`,
            },
            relationships: {
              app: { data: { type: 'apps', id: config.appId } },
            },
          },
        }),
      });
      iapId = iapResponse.data.id;
      console.log(`✅ In-App Purchase 作成完了 (ID: ${iapId})\n`);
    }

    // ローカライズを追加
    console.log('🌐 ローカライゼーションを追加中...');
    for (const loc of localizations) {
      try {
        await apiRequest('/inAppPurchaseLocalizations', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'inAppPurchaseLocalizations',
              attributes: { locale: loc.locale, name: loc.name, description: loc.description },
              relationships: {
                inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } },
              },
            },
          }),
        });
        console.log(`   ✅ ${loc.locale}: ${loc.name}`);
      } catch (error: any) {
        console.error(`   ❌ ${loc.locale}: ${error.message}`);
      }
    }

    // 価格を inventory_expansion と同額に設定
    console.log('\n💴 価格を設定中（inventory_expansion と同額）...');
    await syncPriceFromInventory(iapId);

    console.log('\n✅ 完了！');
    console.log(`   Product ID: ${PRODUCT_ID}`);
    console.log(`   IAP ID: ${iapId}`);
    console.log('\n⚠️  以下はこのスクリプトでは行いません（App Store Connectで対応してください）:');
    console.log('   1. 審査用スクリーンショットのアップロード（IAP審査に必須）');
    console.log('   2. 審査提出（v2.0.0のバージョン審査と同時提出でOK）');
    console.log('   3. RevenueCat 側の商品/Entitlement/Package 登録');
    console.log('      → scripts/setupPetExpansionRevenueCat.ts を参照');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
