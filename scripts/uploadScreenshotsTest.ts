/**
 * 1言語だけでスクリーンショットアップロードをテスト（エラー詳細表示）
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

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

const SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_65';

async function main() {
  console.log('📸 スクリーンショットアップロードテスト（1ファイルのみ）\n');

  // 審査準備中のバージョンを取得
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

  // ローカライゼーションを取得
  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  // jaでテスト
  const loc = localizations.data.find((l) => l.attributes.locale === 'ja');
  if (!loc) {
    console.log('❌ jaが見つかりません');
    return;
  }

  console.log(`\n📱 ${loc.attributes.locale} でテスト`);

  // スクリーンショットセットを取得
  const setsResponse = await apiGet<Response<AppScreenshotSet>>(
    `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`
  );

  let screenshotSet = setsResponse.data.find(
    (s) => s.attributes.screenshotDisplayType === SCREENSHOT_DISPLAY_TYPE
  );

  if (!screenshotSet) {
    console.log('📦 スクリーンショットセットを作成中...');
    const createSetResponse = await apiPost<SingleResponse<AppScreenshotSet>>(
      '/appScreenshotSets',
      {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: SCREENSHOT_DISPLAY_TYPE },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: loc.id },
            },
          },
        },
      }
    );
    screenshotSet = createSetResponse.data;
  }

  // テスト用ファイル（小さいファイル）
  const filePath = path.join(__dirname, '..', 'storeAssets', 'fix', 'ja', '4.png');

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ファイルが見つかりません: ${filePath}`);
    return;
  }

  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const checksum = crypto.createHash('md5').update(fileData).digest('base64');

  console.log(`\n📤 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

  // 1. スクリーンショット予約を作成
  console.log('\n1. スクリーンショット予約を作成...');
  const createResponse = await apiPost<
    SingleResponse<{ id: string; attributes: { uploadOperations: UploadOperation[] } }>
  >('/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileName, fileSize },
      relationships: {
        appScreenshotSet: { data: { type: 'appScreenshotSets', id: screenshotSet.id } },
      },
    },
  });

  const screenshotId = createResponse.data.id;
  const uploadOperations = createResponse.data.attributes.uploadOperations;

  console.log(`   screenshotId: ${screenshotId}`);
  console.log(`   uploadOperations: ${uploadOperations.length}個`);

  // 2. 各パートをアップロード
  for (let i = 0; i < uploadOperations.length; i++) {
    const operation = uploadOperations[i];
    console.log(`\n2-${i + 1}. パート${i + 1}をアップロード...`);
    console.log(`   URL: ${operation.url.substring(0, 100)}...`);
    console.log(`   method: ${operation.method}`);
    console.log(`   offset: ${operation.offset}, length: ${operation.length}`);
    console.log(`   headers:`);
    operation.requestHeaders.forEach((h) => {
      console.log(`     ${h.name}: ${h.value}`);
    });

    const chunk = fileData.slice(operation.offset, operation.offset + operation.length);
    const headers: Record<string, string> = {};
    operation.requestHeaders.forEach((h) => {
      headers[h.name] = h.value;
    });

    try {
      const uploadResponse = await fetch(operation.url, {
        method: operation.method,
        headers: headers,
        body: chunk,
      });

      console.log(`   response status: ${uploadResponse.status}`);
      console.log(`   response ok: ${uploadResponse.ok}`);

      if (!uploadResponse.ok) {
        const responseText = await uploadResponse.text();
        console.log(`   response body: ${responseText}`);
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      console.log('   ✅ 成功');
    } catch (error) {
      console.log(`   ❌ エラー: ${error}`);
      if (error instanceof Error) {
        console.log(`   エラー名: ${error.name}`);
        console.log(`   エラーメッセージ: ${error.message}`);
        console.log(`   cause: ${(error as any).cause}`);
        if ((error as any).cause) {
          console.log(`   cause.code: ${(error as any).cause?.code}`);
          console.log(`   cause.message: ${(error as any).cause?.message}`);
        }
        console.log(`   スタック: ${error.stack}`);
      }
      return;
    }
  }

  // 3. アップロード完了をコミット
  console.log('\n3. アップロード完了をコミット...');
  await apiPatch(`/appScreenshots/${screenshotId}`, {
    data: {
      type: 'appScreenshots',
      id: screenshotId,
      attributes: { uploaded: true, sourceFileChecksum: checksum },
    },
  });

  console.log('\n✅ テスト成功！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
