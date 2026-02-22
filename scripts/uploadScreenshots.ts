/**
 * App Store Connect にスクリーンショットをアップロード
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/uploadScreenshots.ts
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
  attributes: {
    locale: string;
  };
}

interface AppScreenshotSet {
  id: string;
  attributes: {
    screenshotDisplayType: string;
  };
}

interface AppScreenshot {
  id: string;
  attributes: {
    fileName: string;
    assetDeliveryState: {
      state: string;
    };
  };
}

interface UploadOperation {
  method: string;
  url: string;
  length: number;
  offset: number;
  requestHeaders: Array<{ name: string; value: string }>;
}

// スクリーンショット用ディスプレイタイプ（iPhone 6.5インチ）
const SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_65';

// 言語とApp Store Connectロケールのマッピング
const localeMapping: Record<string, string[]> = {
  ja: ['ja'],
  en: ['en-US', 'en-GB', 'en-AU', 'en-CA', 'de-DE'],
  zh: ['zh-Hans', 'zh-Hant'],
  ko: ['ko'],
  es: ['es-ES', 'es-MX'],
  FR: ['fr-FR'],
};

// ファイル順序の定義
function getScreenshotFiles(folder: string, lang: string): string[] {
  const basePath = path.join(__dirname, '..', 'storeAssets', 'fix', folder);

  if (lang === 'ja') {
    // ja: 1.png -> 7.png
    return Array.from({ length: 7 }, (_, i) => path.join(basePath, `${i + 1}.png`));
  } else {
    // その他: 1-XX バトル1.png, 1-XX バトル1-1.png, ... 1-XX バトル1-6.png
    const prefix = `1-${folder.toUpperCase()} バトル`;
    const files = [
      path.join(basePath, `${prefix}1.png`),
      path.join(basePath, `${prefix}1-1.png`),
      path.join(basePath, `${prefix}1-2.png`),
      path.join(basePath, `${prefix}1-3.png`),
      path.join(basePath, `${prefix}1-4.png`),
      path.join(basePath, `${prefix}1-5.png`),
      path.join(basePath, `${prefix}1-6.png`),
    ];
    return files;
  }
}

async function uploadScreenshotFile(
  screenshotSetId: string,
  filePath: string,
  position: number
): Promise<boolean> {
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);
  const fileSize = fileData.length;
  const checksum = crypto.createHash('md5').update(fileData).digest('base64');

  console.log(`      📤 ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    // 1. スクリーンショット予約を作成
    const createResponse = await apiPost<
      SingleResponse<{
        id: string;
        attributes: {
          uploadOperations: UploadOperation[];
        };
      }>
    >('/appScreenshots', {
      data: {
        type: 'appScreenshots',
        attributes: {
          fileName: fileName,
          fileSize: fileSize,
        },
        relationships: {
          appScreenshotSet: {
            data: {
              type: 'appScreenshotSets',
              id: screenshotSetId,
            },
          },
        },
      },
    });

    const screenshotId = createResponse.data.id;
    const uploadOperations = createResponse.data.attributes.uploadOperations;

    // 2. 各パートをアップロード
    for (const operation of uploadOperations) {
      const chunk = fileData.slice(operation.offset, operation.offset + operation.length);
      const headers: Record<string, string> = {};
      operation.requestHeaders.forEach((h) => {
        headers[h.name] = h.value;
      });

      const uploadResponse = await fetch(operation.url, {
        method: operation.method,
        headers: headers,
        body: chunk,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
    }

    // 3. アップロード完了をコミット
    await apiPatch(`/appScreenshots/${screenshotId}`, {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: {
          uploaded: true,
          sourceFileChecksum: checksum,
        },
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
  folder: string
): Promise<void> {
  console.log(`\n   📱 ${locale}:`);

  // 1. スクリーンショットセットを取得
  const setsResponse = await apiGet<Response<AppScreenshotSet>>(
    `/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`
  );

  let screenshotSet = setsResponse.data.find(
    (s) => s.attributes.screenshotDisplayType === SCREENSHOT_DISPLAY_TYPE
  );

  // 2. スクリーンショットセットが存在しない場合は作成
  if (!screenshotSet) {
    console.log(`      📦 スクリーンショットセットを作成中...`);
    const createSetResponse = await apiPost<SingleResponse<AppScreenshotSet>>(
      '/appScreenshotSets',
      {
        data: {
          type: 'appScreenshotSets',
          attributes: {
            screenshotDisplayType: SCREENSHOT_DISPLAY_TYPE,
          },
          relationships: {
            appStoreVersionLocalization: {
              data: {
                type: 'appStoreVersionLocalizations',
                id: localizationId,
              },
            },
          },
        },
      }
    );
    screenshotSet = createSetResponse.data;
    console.log(`      ✅ 作成完了`);
  }

  // 3. 既存のスクリーンショットを取得して削除
  console.log(`      🗑️  既存スクリーンショットを削除中...`);
  const existingScreenshots = await apiGet<Response<AppScreenshot>>(
    `/appScreenshotSets/${screenshotSet.id}/appScreenshots`
  );

  for (const screenshot of existingScreenshots.data) {
    try {
      await apiDelete(`/appScreenshots/${screenshot.id}`);
    } catch (e) {
      // 削除エラーは無視
    }
  }
  console.log(`      ✅ ${existingScreenshots.data.length}件削除`);

  // 4. 新しいスクリーンショットをアップロード
  console.log(`      📤 新しいスクリーンショットをアップロード中...`);
  const files = getScreenshotFiles(folder, folder);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    if (fs.existsSync(filePath)) {
      await uploadScreenshotFile(screenshotSet.id, filePath, i);
      // APIレート制限を避けるため少し待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      console.log(`      ⚠️  ファイルが見つかりません: ${filePath}`);
    }
  }
}

async function main() {
  console.log('📸 スクリーンショットアップロード開始\n');

  // 1. 審査準備中のバージョンを取得
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

  // 2. ローカライゼーションを取得
  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  const localeMap = new Map<string, string>();
  localizations.data.forEach((loc) => {
    localeMap.set(loc.attributes.locale, loc.id);
  });

  // 3. 各言語のスクリーンショットを処理
  for (const [folder, locales] of Object.entries(localeMapping)) {
    console.log(`\n🌐 ${folder}フォルダを処理中...`);

    for (const locale of locales) {
      const localizationId = localeMap.get(locale);
      if (!localizationId) {
        console.log(`   ⚠️  ${locale}: ローカライゼーションが見つかりません`);
        continue;
      }

      try {
        await processLocale(localizationId, locale, folder);
      } catch (error) {
        console.log(`   ❌ ${locale}: エラー - ${error}`);
      }
    }
  }

  console.log('\n✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
