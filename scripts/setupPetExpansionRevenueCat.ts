/**
 * RevenueCat v2 API に「ペット枠拡張」課金コンテンツを登録するスクリプト
 *
 * inventory_expansion と同じ構成を作成する:
 *   - App Store 商品 (com.astapi.LootDive.pet_expansion, non_consumable)
 *   - Test Store 商品 (dev 用)
 *   - Entitlement (lookup_key: expanded_pets) ← pet 両商品 + premium_bundle 両商品を紐付け
 *   - default offering の Package (lookup_key: pet_expansion) ← pet 両商品を紐付け
 *
 * べき等: 既に存在するものは作成せず、未紐付けの商品のみアタッチする。
 *
 * 使用方法（書き込み権限付き Secret Key が必要）:
 *   REVENUECAT_SECRET_KEY=sk_xxx TSX_TSCONFIG_PATH=tsconfig.scripts.json \
 *     tsx scripts/setupPetExpansionRevenueCat.ts
 *
 * 必要な API キー権限:
 *   project_configuration:products:read_write
 *   project_configuration:entitlements:read_write
 *   project_configuration:offerings:read_write / packages:read_write
 *
 * ⚠️ ASC 側の IAP (createPetExpansionIAP.ts) を先に作成しておくこと。
 */

const BASE = 'https://api.revenuecat.com/v2';
const PROJECT_ID = 'proj911ce6dc';
const APP_STORE_APP_ID = 'appdb46af63da'; // LootDive (App Store)
const TEST_STORE_APP_ID = 'app0ed09e75f0'; // Test Store

const PET_APP_STORE_STORE_ID = 'com.astapi.LootDive.pet_expansion';
const PET_TEST_STORE_STORE_ID = 'pet_expansion'; // Test Store 用（任意の文字列）
const BUNDLE_APP_STORE_STORE_ID = 'com.astapi.LootDive.premium_bundle';
const BUNDLE_TEST_STORE_STORE_ID = 'premium_bundle';

const ENTITLEMENT_LOOKUP_KEY = 'expanded_pets';
const PACKAGE_LOOKUP_KEY = 'pet_expansion';
const DISPLAY_NAME = 'ペット枠拡張';

const KEY = process.env.REVENUECAT_SECRET_KEY;
if (!KEY) {
  console.error('❌ 環境変数 REVENUECAT_SECRET_KEY が未設定です（書き込み権限付き Secret Key）');
  process.exit(1);
}

async function rc<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return json as T;
}

// 全ページ取得
async function listAll(path: string): Promise<any[]> {
  const items: any[] = [];
  let url: string | null = path;
  while (url) {
    const page: any = await rc('GET', url);
    items.push(...(page.items ?? []));
    url = page.next_page ? String(page.next_page).replace(BASE, '') : null;
  }
  return items;
}

async function ensureProduct(storeId: string, appId: string): Promise<string> {
  const products = await listAll(`/projects/${PROJECT_ID}/products?limit=100`);
  const found = products.find((p) => p.store_identifier === storeId && p.app_id === appId);
  if (found) {
    console.log(`   ✔️ 商品 既存: ${storeId} (${found.id})`);
    return found.id;
  }
  const body: Record<string, unknown> = {
    store_identifier: storeId,
    app_id: appId,
    type: 'non_consumable', // 永続解放（inventory_expansion と同じ）。'one_time' は non_renewing_subscription になるので不可
    display_name: DISPLAY_NAME,
  };
  // Test Store 商品は user-facing title が必須
  if (appId === TEST_STORE_APP_ID) {
    body.title = DISPLAY_NAME;
  }
  const created = await rc('POST', `/projects/${PROJECT_ID}/products`, body);
  console.log(`   ➕ 商品 作成: ${storeId} (${created.id})`);
  return created.id;
}

async function findProductId(storeId: string, appId: string): Promise<string | null> {
  const products = await listAll(`/projects/${PROJECT_ID}/products?limit=100`);
  return products.find((p) => p.store_identifier === storeId && p.app_id === appId)?.id ?? null;
}

async function ensureEntitlement(): Promise<string> {
  const ents = await listAll(`/projects/${PROJECT_ID}/entitlements?limit=100`);
  const found = ents.find((e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY);
  if (found) {
    console.log(`   ✔️ Entitlement 既存: ${ENTITLEMENT_LOOKUP_KEY} (${found.id})`);
    return found.id;
  }
  const created = await rc('POST', `/projects/${PROJECT_ID}/entitlements`, {
    lookup_key: ENTITLEMENT_LOOKUP_KEY,
    display_name: DISPLAY_NAME,
  });
  console.log(`   ➕ Entitlement 作成: ${ENTITLEMENT_LOOKUP_KEY} (${created.id})`);
  return created.id;
}

async function attachToEntitlement(entitlementId: string, productIds: string[]): Promise<void> {
  const attached = await listAll(`/projects/${PROJECT_ID}/entitlements/${entitlementId}/products?limit=100`);
  const attachedIds = new Set(attached.map((p) => p.id));
  const missing = productIds.filter((id) => !attachedIds.has(id));
  if (missing.length === 0) {
    console.log('   ✔️ Entitlement への商品紐付け: 変更なし');
    return;
  }
  await rc('POST', `/projects/${PROJECT_ID}/entitlements/${entitlementId}/actions/attach_products`, {
    product_ids: missing,
  });
  console.log(`   ➕ Entitlement に紐付け: ${missing.length}件`);
}

async function ensurePackage(offeringId: string): Promise<string> {
  const pkgs = await listAll(`/projects/${PROJECT_ID}/offerings/${offeringId}/packages?limit=100`);
  const found = pkgs.find((p) => p.lookup_key === PACKAGE_LOOKUP_KEY);
  if (found) {
    console.log(`   ✔️ Package 既存: ${PACKAGE_LOOKUP_KEY} (${found.id})`);
    return found.id;
  }
  const created = await rc('POST', `/projects/${PROJECT_ID}/offerings/${offeringId}/packages`, {
    lookup_key: PACKAGE_LOOKUP_KEY,
    display_name: DISPLAY_NAME,
  });
  console.log(`   ➕ Package 作成: ${PACKAGE_LOOKUP_KEY} (${created.id})`);
  return created.id;
}

async function attachToPackage(packageId: string, productIds: string[]): Promise<void> {
  const attached = await listAll(`/projects/${PROJECT_ID}/packages/${packageId}/products?limit=100`);
  const attachedIds = new Set(attached.map((p: any) => p.product?.id ?? p.id));
  const missing = productIds.filter((id) => !attachedIds.has(id));
  if (missing.length === 0) {
    console.log('   ✔️ Package への商品紐付け: 変更なし');
    return;
  }
  await rc('POST', `/projects/${PROJECT_ID}/packages/${packageId}/actions/attach_products`, {
    products: missing.map((id) => ({ product_id: id, eligibility_criteria: 'all' })),
  });
  console.log(`   ➕ Package に紐付け: ${missing.length}件`);
}

async function main() {
  console.log('🐾 RevenueCat にペット枠拡張を登録\n');

  console.log('1) 商品を確認/作成');
  const petAppStore = await ensureProduct(PET_APP_STORE_STORE_ID, APP_STORE_APP_ID);
  const petTest = await ensureProduct(PET_TEST_STORE_STORE_ID, TEST_STORE_APP_ID);

  console.log('2) バンドル商品IDを取得（Entitlement紐付け用）');
  const bundleAppStore = await findProductId(BUNDLE_APP_STORE_STORE_ID, APP_STORE_APP_ID);
  const bundleTest = await findProductId(BUNDLE_TEST_STORE_STORE_ID, TEST_STORE_APP_ID);
  console.log(`   bundle(App Store)=${bundleAppStore} bundle(Test)=${bundleTest}`);

  console.log('3) Entitlement を確認/作成し商品を紐付け');
  const entitlementId = await ensureEntitlement();
  const entProducts = [petAppStore, petTest, bundleAppStore, bundleTest].filter(
    (x): x is string => !!x
  );
  await attachToEntitlement(entitlementId, entProducts);

  console.log('4) default offering の Package を確認/作成し商品を紐付け');
  const offerings = await listAll(`/projects/${PROJECT_ID}/offerings?limit=100`);
  const defaultOffering = offerings.find((o) => o.lookup_key === 'default') ?? offerings[0];
  if (!defaultOffering) throw new Error('default offering が見つかりません');
  const packageId = await ensurePackage(defaultOffering.id);
  await attachToPackage(packageId, [petAppStore, petTest]);

  console.log('\n✅ 完了！ RevenueCat 側のペット枠拡張の登録が整いました。');
  console.log('   ※ App Store 側の IAP が承認されるまで実機ショップには表示されません。');
  console.log('   ※ クライアントは v2.0.0 未満では非表示（constants/purchases.ts の minVersion）。');
}

main().catch((e) => {
  console.error('\n❌ エラー:', e.message);
  process.exit(1);
});

export {};
