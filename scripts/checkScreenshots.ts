/**
 * 現在のスクリーンショット状態を確認
 */

import * as fs from 'fs';
import * as path from 'path';
import { SignJWT, importPKCS8 } from 'jose';

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

interface Response<T> {
  data: T[];
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
  attributes: {
    fileName: string;
    fileSize: number;
    assetDeliveryState: {
      state: string;
      errors?: Array<{ code: string; description: string }>;
    };
  };
}

const SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_65';

async function main() {
  console.log('📸 スクリーンショット状態確認\n');

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

  console.log(`📦 審査準備中: v${prepareForSubmission.attributes.versionString}\n`);

  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  // jaのみ確認
  const jaLoc = localizations.data.find((l) => l.attributes.locale === 'ja');
  if (!jaLoc) {
    console.log('❌ jaが見つかりません');
    return;
  }

  console.log(`📱 ja:`);

  const setsResponse = await apiGet<Response<AppScreenshotSet>>(
    `/appStoreVersionLocalizations/${jaLoc.id}/appScreenshotSets`
  );

  const screenshotSet = setsResponse.data.find(
    (s) => s.attributes.screenshotDisplayType === SCREENSHOT_DISPLAY_TYPE
  );

  if (!screenshotSet) {
    console.log('   スクリーンショットセットがありません');
    return;
  }

  console.log(`   セットID: ${screenshotSet.id}`);

  const screenshots = await apiGet<Response<AppScreenshot>>(
    `/appScreenshotSets/${screenshotSet.id}/appScreenshots`
  );

  console.log(`   スクリーンショット数: ${screenshots.data.length}\n`);

  for (const ss of screenshots.data) {
    const state = ss.attributes.assetDeliveryState;
    console.log(`   - ${ss.attributes.fileName}`);
    console.log(`     ID: ${ss.id}`);
    console.log(`     サイズ: ${(ss.attributes.fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     状態: ${state.state}`);
    if (state.errors && state.errors.length > 0) {
      state.errors.forEach((e) => {
        console.log(`     エラー: ${e.code} - ${e.description}`);
      });
    }
  }
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
