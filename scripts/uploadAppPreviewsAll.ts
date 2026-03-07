/**
 * 全言語のアプリプレビュー動画をアップロード
 * ja, en-USは手動アップロード済みなのでスキップ
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

interface AppPreviewSet {
  id: string;
  attributes: { previewType: string };
}

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

const PREVIEW_TYPE = 'IPHONE_65';

// アップロード対象（ja, en-USは手動済み、koはテスト済み）
const targetLocales = ['en-GB', 'en-AU', 'en-CA', 'zh-Hans', 'es-ES', 'es-MX', 'fr-FR', 'de-DE'];

async function uploadPreview(
  localizationId: string,
  locale: string,
  filePath: string
): Promise<boolean> {
  console.log(`\n   📱 ${locale}:`);

  // プレビューセットを取得
  const setsResponse = await apiGet<Response<AppPreviewSet>>(
    `/appStoreVersionLocalizations/${localizationId}/appPreviewSets`
  );

  let previewSet = setsResponse.data.find((s) => s.attributes.previewType === PREVIEW_TYPE);

  if (!previewSet) {
    console.log(`      📦 プレビューセットを作成中...`);
    const createSetResponse = await apiPost<SingleResponse<AppPreviewSet>>(
      '/appPreviewSets',
      {
        data: {
          type: 'appPreviewSets',
          attributes: { previewType: PREVIEW_TYPE },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: localizationId },
            },
          },
        },
      }
    );
    previewSet = createSetResponse.data;
  }

  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const checksum = crypto.createHash('md5').update(fileData).digest('base64');

  console.log(`      📤 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    // 1. プレビュー予約を作成
    const createResponse = await apiPost<
      SingleResponse<{ id: string; attributes: { uploadOperations: UploadOperation[] } }>
    >('/appPreviews', {
      data: {
        type: 'appPreviews',
        attributes: { fileName, fileSize },
        relationships: {
          appPreviewSet: { data: { type: 'appPreviewSets', id: previewSet.id } },
        },
      },
    });

    const previewId = createResponse.data.id;
    const uploadOperations = createResponse.data.attributes.uploadOperations;

    // 2. 各パートをアップロード
    for (let i = 0; i < uploadOperations.length; i++) {
      const operation = uploadOperations[i];
      const chunk = fileData.slice(operation.offset, operation.offset + operation.length);
      const headers: Record<string, string> = {};
      operation.requestHeaders.forEach((h) => {
        headers[h.name] = h.value;
      });

      process.stdout.write(`         パート ${i + 1}/${uploadOperations.length}...`);

      const uploadResponse = await fetch(operation.url, {
        method: operation.method,
        headers: headers,
        body: chunk,
      });

      if (!uploadResponse.ok) {
        console.log(` ❌ (${uploadResponse.status})`);
        return false;
      }
      console.log(' ✅');

      // パート間で少し待機
      await new Promise((r) => setTimeout(r, 500));
    }

    // 3. アップロード完了をコミット
    await apiPatch(`/appPreviews/${previewId}`, {
      data: {
        type: 'appPreviews',
        id: previewId,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    });

    console.log(`      ✅ 完了`);
    return true;
  } catch (error) {
    console.log(`      ❌ エラー: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🎬 アプリプレビュー動画アップロード\n');

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

  const videoPath = path.join(__dirname, '..', 'storeAssets', 'fix', 'en', 'promo_en.mp4');

  let successCount = 0;
  let failCount = 0;

  for (const locale of targetLocales) {
    const localizationId = localeMap.get(locale);
    if (!localizationId) {
      console.log(`\n   ⚠️  ${locale}: ローカライゼーションが見つかりません`);
      continue;
    }

    const success = await uploadPreview(localizationId, locale, videoPath);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // レート制限を避けるため待機
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n📊 結果: ${successCount}成功, ${failCount}失敗`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
