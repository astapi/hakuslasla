/**
 * 失敗したスクリーンショットを再アップロード + de-DEを追加
 */

import * as fs from 'fs';
import * as path from 'path';
import { SignJWT, importPKCS8 } from 'jose';
import * as crypto from 'crypto';

function loadEnv(): Record<string, string> {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  return env;
}

const env = loadEnv();
const config = {
  issuerId: env.APP_STORE_CONNECT_ISSUER_ID,
  keyId: env.APP_STORE_CONNECT_KEY_ID,
  privateKeyPath: env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
  appId: env.APP_STORE_CONNECT_APP_ID,
};

async function generateToken(): Promise<string> {
  const privateKeyPem = fs.readFileSync(config.privateKeyPath, 'utf-8');
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
    .setIssuer(config.issuerId)
    .setIssuedAt(now)
    .setExpirationTime(now + 20 * 60)
    .setAudience('appstoreconnect-v1')
    .sign(privateKey);
  return jwt;
}

async function apiGet<T>(endpoint: string): Promise<T> {
  const token = await generateToken();
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API GET Error ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API POST Error ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}

async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${endpoint}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API PATCH Error ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(endpoint: string): Promise<void> {
  const token = await generateToken();
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${endpoint}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`API DELETE Error ${response.status}: ${errorText}`);
  }
}

interface Response<T> {
  data: T[];
}

interface SingleResponse<T> {
  data: T;
}

interface AppStoreVersionLocalization {
  id: string;
  attributes: { locale: string };
}

interface AppScreenshotSet {
  id: string;
  attributes: { screenshotDisplayType: string };
}

interface AppScreenshot {
  id: string;
  attributes: { fileName: string };
}

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

const SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_67';

async function uploadWithRetry(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer,
  retries = 3
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { method, headers, body });
      if (response.ok) return;
      throw new Error(`Upload failed: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`         ⚠️  リトライ ${i + 1}/${retries}...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function uploadScreenshotFile(
  screenshotSetId: string,
  filePath: string
): Promise<boolean> {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const checksum = crypto.createHash('md5').update(fileData).digest('base64');

  console.log(`      📤 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    const createResponse = await apiPost<
      SingleResponse<{ id: string; attributes: { uploadOperations: UploadOperation[] } }>
    >('/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize },
        relationships: {
          appScreenshotSet: { data: { type: 'appScreenshotSets', id: screenshotSetId } },
        },
      },
    });

    const screenshotId = createResponse.data.id;
    const uploadOperations = createResponse.data.attributes.uploadOperations;

    for (const operation of uploadOperations) {
      const chunk = fileData.slice(operation.offset, operation.offset + operation.length);
      const headers: Record<string, string> = {};
      operation.requestHeaders.forEach((h) => { headers[h.name] = h.value; });

      await uploadWithRetry(operation.url, operation.method, headers, chunk);
    }

    await apiPatch(`/appScreenshots/${screenshotId}`, {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    });

    console.log(`         ✅ アップロード完了`);
    return true;
  } catch (error) {
    console.log(`         ❌ エラー: ${error}`);
    return false;
  }
}

async function processLocale(
  localizationId: string,
  locale: string,
  files: string[],
  deleteExisting: boolean
): Promise<void> {
  console.log(`\n   📱 ${locale}:`);

  // スクリーンショットセットを取得
  const setsResponse = await apiGet<Response<AppScreenshotSet>>(
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`
  );

  let screenshotSet = setsResponse.data.find(
    (s) => s.attributes.screenshotDisplayType === SCREENSHOT_DISPLAY_TYPE
  );

  if (!screenshotSet) {
    console.log(`      📦 スクリーンショットセットを作成中...`);
    const createSetResponse = await apiPost<SingleResponse<AppScreenshotSet>>(
      '/appScreenshotSets',
      {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: SCREENSHOT_DISPLAY_TYPE },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: localizationId },
            },
          },
        },
      }
    );
    screenshotSet = createSetResponse.data;
    console.log(`      ✅ 作成完了`);
  }

  if (deleteExisting) {
    console.log(`      🗑️  既存スクリーンショットを削除中...`);
    const existingScreenshots = await apiGet<Response<AppScreenshot>>(
      `/appScreenshotSets/${screenshotSet.id}/appScreenshots`
    );
    for (const screenshot of existingScreenshots.data) {
      try { await apiDelete(`/appScreenshots/${screenshot.id}`); } catch (e) {}
    }
    console.log(`      ✅ ${existingScreenshots.data.length}件削除`);
  }

  console.log(`      📤 スクリーンショットをアップロード中...`);
  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      await uploadScreenshotFile(screenshotSet.id, filePath);
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      console.log(`      ⚠️  ファイルが見つかりません: ${filePath}`);
    }
  }
}

async function main() {
  console.log('📸 スクリーンショット修正アップロード\n');

  const versions = await apiGet<
    Response<{ id: string; attributes: { appStoreState: string; versionString: string } }>
  >(`/apps/${config.appId}/appStoreVersions?limit=10`);

  const prepareForSubmission = versions.data.find(
    (v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!prepareForSubmission) {
    console.log('❌ 審査準備中のバージョンが見つかりません');
    return;
  }

  console.log(`📦 審査準備中: v${prepareForSubmission.attributes.versionString}`);

  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  const localeMap = new Map<string, string>();
  localizations.data.forEach((loc) => {
    localeMap.set(loc.attributes.locale, loc.id);
  });

  const basePath = path.join(__dirname, '..', 'storeAssets', 'fix');

  // 1. 日本語の全スクリーンショットを再アップロード（既存を削除してから）
  console.log('\n🌐 日本語スクリーンショットを修正...');
  const jaId = localeMap.get('ja');
  if (jaId) {
    const jaFiles = Array.from({ length: 7 }, (_, i) => path.join(basePath, 'ja', `${i + 1}.png`));
    await processLocale(jaId, 'ja', jaFiles, true);
  }

  // 2. ドイツ語（de-DE）を追加 - ENフォルダのスクリーンショットを使用
  console.log('\n🌐 ドイツ語スクリーンショットを追加...');
  const deId = localeMap.get('de-DE');
  if (deId) {
    const enPrefix = '1-EN バトル';
    const deFiles = [
      path.join(basePath, 'en', `${enPrefix}1.png`),
      path.join(basePath, 'en', `${enPrefix}1-1.png`),
      path.join(basePath, 'en', `${enPrefix}1-2.png`),
      path.join(basePath, 'en', `${enPrefix}1-3.png`),
      path.join(basePath, 'en', `${enPrefix}1-4.png`),
      path.join(basePath, 'en', `${enPrefix}1-5.png`),
      path.join(basePath, 'en', `${enPrefix}1-6.png`),
    ];
    await processLocale(deId, 'de-DE', deFiles, false);
  } else {
    console.log('   ⚠️  de-DE: ローカライゼーションが見つかりません');
  }

  console.log('\n✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
