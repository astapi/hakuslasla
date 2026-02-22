/**
 * 古い6.7インチ用のスクリーンショットとプレビューを削除
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

interface AppStoreVersionLocalization {
  id: string;
  attributes: { locale: string };
}

interface AppScreenshotSet {
  id: string;
  attributes: { screenshotDisplayType: string };
}

interface AppPreviewSet {
  id: string;
  attributes: { previewType: string };
}

// 削除対象の6.7インチ用タイプ
const DELETE_SCREENSHOT_TYPE = 'APP_IPHONE_67';
const DELETE_PREVIEW_TYPE = 'IPHONE_67';

async function main() {
  console.log('🗑️  古い6.7インチ用アセットを削除\n');

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

  let deletedScreenshotSets = 0;
  let deletedPreviewSets = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;
    let deleted = false;

    // 6.7インチスクリーンショットセットを削除
    const screenshotSets = await apiGet<Response<AppScreenshotSet>>(
      `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`
    );

    for (const set of screenshotSets.data) {
      if (set.attributes.screenshotDisplayType === DELETE_SCREENSHOT_TYPE) {
        try {
          await apiDelete(`/appScreenshotSets/${set.id}`);
          deletedScreenshotSets++;
          deleted = true;
        } catch (e) {
          console.log(`   ❌ ${locale}: スクリーンショットセット削除失敗 - ${e}`);
        }
      }
    }

    // 6.7インチプレビューセットを削除
    const previewSets = await apiGet<Response<AppPreviewSet>>(
      `/appStoreVersionLocalizations/${loc.id}/appPreviewSets`
    );

    for (const set of previewSets.data) {
      if (set.attributes.previewType === DELETE_PREVIEW_TYPE) {
        try {
          await apiDelete(`/appPreviewSets/${set.id}`);
          deletedPreviewSets++;
          deleted = true;
        } catch (e) {
          console.log(`   ❌ ${locale}: プレビューセット削除失敗 - ${e}`);
        }
      }
    }

    if (deleted) {
      console.log(`✅ ${locale}: 削除完了`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 結果:`);
  console.log(`   スクリーンショットセット: ${deletedScreenshotSets}件削除`);
  console.log(`   プレビューセット: ${deletedPreviewSets}件削除`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
