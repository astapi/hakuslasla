/**
 * App Store Connect にアプリプレビュー動画をアップロード
 *
 * ja: storeAssets/fix/ja/promo.mp4
 * その他: storeAssets/fix/en/promo_en.mp4
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

interface AppPreviewSet {
  id: string;
  attributes: { previewType: string };
}

interface AppPreview {
  id: string;
}

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

// プレビュー動画用ディスプレイタイプ（iPhone 6.7インチ）
const PREVIEW_TYPE = 'IPHONE_67';

// 言語とファイルのマッピング
const localeVideoMapping: Record<string, string> = {
  ja: 'ja/promo.mp4',
  'en-US': 'en/promo_en.mp4',
  'en-GB': 'en/promo_en.mp4',
  'en-AU': 'en/promo_en.mp4',
  'en-CA': 'en/promo_en.mp4',
  'zh-Hans': 'en/promo_en.mp4',
  'zh-Hant': 'en/promo_en.mp4',
  ko: 'en/promo_en.mp4',
  'es-ES': 'en/promo_en.mp4',
  'es-MX': 'en/promo_en.mp4',
  'fr-FR': 'en/promo_en.mp4',
  'de-DE': 'en/promo_en.mp4',
};

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
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function uploadPreviewFile(
  previewSetId: string,
  filePath: string
): Promise<boolean> {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const checksum = crypto.createHash('md5').update(fileData).digest('base64');

  console.log(`      📤 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    // 1. プレビュー予約を作成
    const createResponse = await apiPost<
      SingleResponse<{
        id: string;
        attributes: { uploadOperations: UploadOperation[] };
      }>
    >('/appPreviews', {
      data: {
        type: 'appPreviews',
        attributes: { fileName, fileSize },
        relationships: {
          appPreviewSet: { data: { type: 'appPreviewSets', id: previewSetId } },
        },
      },
    });

    const previewId = createResponse.data.id;
    const uploadOperations = createResponse.data.attributes.uploadOperations;

    console.log(`         📦 ${uploadOperations.length}パートをアップロード中...`);

    // 2. 各パートをアップロード
    for (let i = 0; i < uploadOperations.length; i++) {
      const operation = uploadOperations[i];
      const chunk = fileData.slice(operation.offset, operation.offset + operation.length);
      const headers: Record<string, string> = {};
      operation.requestHeaders.forEach((h) => { headers[h.name] = h.value; });

      process.stdout.write(`         パート ${i + 1}/${uploadOperations.length}...`);
      await uploadWithRetry(operation.url, operation.method, headers, chunk);
      console.log(' ✅');
    }

    // 3. アップロード完了をコミット
    await apiPatch(`/appPreviews/${previewId}`, {
      data: {
        type: 'appPreviews',
        id: previewId,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    });

    console.log(`         ✅ アップロード完了！`);
    return true;
  } catch (error) {
    console.log(`         ❌ エラー: ${error}`);
    return false;
  }
}

async function processLocale(
  localizationId: string,
  locale: string,
  videoPath: string
): Promise<void> {
  console.log(`\n   📱 ${locale}:`);

  if (!fs.existsSync(videoPath)) {
    console.log(`      ⚠️  ファイルが見つかりません: ${videoPath}`);
    return;
  }

  // 1. プレビューセットを取得
  const setsResponse = await apiGet<Response<AppPreviewSet>>(
    `/appStoreVersionLocalizations/${localizationId}/appPreviewSets`
  );

  let previewSet = setsResponse.data.find((s) => s.attributes.previewType === PREVIEW_TYPE);

  // 2. プレビューセットが存在しない場合は作成
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
    console.log(`      ✅ 作成完了`);
  }

  // 3. 既存のプレビューを削除
  console.log(`      🗑️  既存プレビューを削除中...`);
  const existingPreviews = await apiGet<Response<AppPreview>>(
    `/appPreviewSets/${previewSet.id}/appPreviews`
  );
  for (const preview of existingPreviews.data) {
    try { await apiDelete(`/appPreviews/${preview.id}`); } catch (e) {}
  }
  console.log(`      ✅ ${existingPreviews.data.length}件削除`);

  // 4. 新しいプレビューをアップロード
  await uploadPreviewFile(previewSet.id, videoPath);
}

async function main() {
  console.log('🎬 アプリプレビュー動画アップロード開始\n');

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

  for (const [locale, videoFile] of Object.entries(localeVideoMapping)) {
    const localizationId = localeMap.get(locale);
    if (!localizationId) {
      console.log(`\n   ⚠️  ${locale}: ローカライゼーションが見つかりません`);
      continue;
    }

    const videoPath = path.join(basePath, videoFile);
    try {
      await processLocale(localizationId, locale, videoPath);
    } catch (error) {
      console.log(`   ❌ ${locale}: エラー - ${error}`);
    }

    // レート制限を避けるため待機
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\n✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
