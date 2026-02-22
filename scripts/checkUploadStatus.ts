/**
 * スクリーンショットとプレビューのアップロードステータスを確認
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
    assetDeliveryState: {
      state: string;
      errors?: Array<{ code: string; description: string }>;
    };
  };
}

interface AppPreviewSet {
  id: string;
  attributes: { previewType: string };
}

interface AppPreview {
  id: string;
  attributes: {
    fileName: string;
    assetDeliveryState: {
      state: string;
      errors?: Array<{ code: string; description: string }>;
    };
  };
}

async function main() {
  console.log('📊 アップロードステータス確認\n');

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

  let issueCount = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;
    const issues: string[] = [];

    // スクリーンショットを確認
    const screenshotSets = await apiGet<Response<AppScreenshotSet>>(
      `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`
    );

    for (const set of screenshotSets.data) {
      const screenshots = await apiGet<Response<AppScreenshot>>(
        `/appScreenshotSets/${set.id}/appScreenshots`
      );

      for (const ss of screenshots.data) {
        const state = ss.attributes.assetDeliveryState.state;
        if (state !== 'COMPLETE') {
          issues.push(`📸 ${ss.attributes.fileName}: ${state}`);
          if (ss.attributes.assetDeliveryState.errors) {
            ss.attributes.assetDeliveryState.errors.forEach((e) => {
              issues.push(`   ❌ ${e.code}: ${e.description}`);
            });
          }
        }
      }
    }

    // プレビューを確認
    const previewSets = await apiGet<Response<AppPreviewSet>>(
      `/appStoreVersionLocalizations/${loc.id}/appPreviewSets`
    );

    for (const set of previewSets.data) {
      const previews = await apiGet<Response<AppPreview>>(
        `/appPreviewSets/${set.id}/appPreviews`
      );

      for (const preview of previews.data) {
        const state = preview.attributes.assetDeliveryState.state;
        if (state !== 'COMPLETE') {
          issues.push(`🎬 ${preview.attributes.fileName}: ${state}`);
          if (preview.attributes.assetDeliveryState.errors) {
            preview.attributes.assetDeliveryState.errors.forEach((e) => {
              issues.push(`   ❌ ${e.code}: ${e.description}`);
            });
          }
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n📱 ${locale}:`);
      issues.forEach((issue) => console.log(`   ${issue}`));
      issueCount += issues.length;
    }
  }

  if (issueCount === 0) {
    console.log('✅ すべてのアセットがCOMPLETE状態です');
  } else {
    console.log(`\n⚠️  ${issueCount}件の問題があります`);
  }
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
