/**
 * App Store Connect のローカライゼーション状態を確認
 */

import * as fs from 'fs';
import * as path from 'path';
import { SignJWT, importPKCS8 } from 'jose';

// .envファイルを手動で読み込む
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

// JWT トークンを生成
async function generateToken(): Promise<string> {
  const privateKeyPem = fs.readFileSync(config.privateKeyPath, 'utf-8');
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 20 * 60;

  const jwt = await new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: config.keyId,
      typ: 'JWT',
    })
    .setIssuer(config.issuerId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience('appstoreconnect-v1')
    .sign(privateKey);

  return jwt;
}

// API リクエスト (GET)
async function apiGet<T>(endpoint: string): Promise<T> {
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// 型定義
interface AppStoreVersion {
  id: string;
  attributes: {
    versionString: string;
    appStoreState: string;
  };
}

interface AppStoreVersionLocalization {
  id: string;
  attributes: {
    locale: string;
    description: string | null;
    keywords: string | null;
    whatsNew: string | null;
    promotionalText: string | null;
    marketingUrl: string | null;
    supportUrl: string | null;
  };
}

interface AppInfoLocalization {
  id: string;
  attributes: {
    locale: string;
    name: string | null;
    subtitle: string | null;
    privacyPolicyText: string | null;
    privacyPolicyUrl: string | null;
  };
}

interface LocalizationsResponse<T> {
  data: T[];
}

interface VersionsResponse {
  data: AppStoreVersion[];
}

interface AppInfoResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      appStoreState: string;
    };
  }>;
}

// メイン処理
async function main() {
  console.log('🔍 App Store Connect ローカライゼーション状態確認\n');

  // 1. App Store バージョン一覧を取得
  console.log('📦 バージョン情報を取得中...');
  const versions = await apiGet<VersionsResponse>(
    `/apps/${config.appId}/appStoreVersions?limit=10`
  );

  // 審査準備中のバージョンを特定
  const prepareForSubmission = versions.data.find(
    (v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!prepareForSubmission) {
    throw new Error('審査準備中のバージョンが見つかりません');
  }

  console.log(
    `   審査準備中: v${prepareForSubmission.attributes.versionString} (ID: ${prepareForSubmission.id})\n`
  );

  // 2. バージョンのローカライゼーションを取得
  console.log('📝 バージョンローカライゼーションを取得中...');
  const versionLocalizations = await apiGet<LocalizationsResponse<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  console.log(`   ${versionLocalizations.data.length} 言語のバージョンローカライゼーション:\n`);
  for (const loc of versionLocalizations.data) {
    const attrs = loc.attributes;
    console.log(`   📍 ${attrs.locale}:`);
    console.log(`      - Description: ${attrs.description ? '✅ あり' : '❌ なし'}`);
    console.log(`      - Keywords: ${attrs.keywords ? '✅ あり' : '❌ なし'}`);
    console.log(`      - WhatsNew: ${attrs.whatsNew ? '✅ あり' : '❌ なし'}`);
    console.log(`      - PromotionalText: ${attrs.promotionalText ? '✅ あり' : '❌ なし'}`);
    console.log();
  }

  // 3. App Info のローカライゼーションを取得
  console.log('📱 App Info を取得中...');
  const appInfos = await apiGet<AppInfoResponse>(
    `/apps/${config.appId}/appInfos`
  );

  if (appInfos.data.length > 0) {
    const appInfo = appInfos.data[0];
    console.log(`   App Info ID: ${appInfo.id}\n`);

    const appInfoLocalizations = await apiGet<LocalizationsResponse<AppInfoLocalization>>(
      `/appInfos/${appInfo.id}/appInfoLocalizations`
    );

    console.log(`📝 App Info ローカライゼーション (${appInfoLocalizations.data.length} 言語):\n`);
    for (const loc of appInfoLocalizations.data) {
      const attrs = loc.attributes;
      console.log(`   📍 ${attrs.locale}:`);
      console.log(`      - Name: ${attrs.name || '❌ なし'}`);
      console.log(`      - Subtitle: ${attrs.subtitle || '❌ なし'}`);
      console.log();
    }
  }

  // 4. 必要な言語をリストアップ
  console.log('\n📋 必要な言語の確認:');
  const requiredLocales = [
    { code: 'ja', name: '日本語' },
    { code: 'en-US', name: '英語 (US)' },
    { code: 'en-GB', name: '英語 (UK)' },
    { code: 'en-AU', name: '英語 (AU)' },
    { code: 'en-CA', name: '英語 (CA)' },
    { code: 'zh-Hans', name: '簡体字中国語' },
    { code: 'zh-Hant', name: '繁体字中国語' },
    { code: 'ko', name: '韓国語' },
    { code: 'es-ES', name: 'スペイン語 (Spain)' },
    { code: 'es-MX', name: 'スペイン語 (Mexico)' },
    { code: 'fr-FR', name: 'フランス語' },
    { code: 'de-DE', name: 'ドイツ語' },
  ];

  const existingLocales = versionLocalizations.data.map((l) => l.attributes.locale);

  for (const locale of requiredLocales) {
    const exists = existingLocales.includes(locale.code);
    console.log(`   ${exists ? '✅' : '❌'} ${locale.code} (${locale.name})`);
  }

  console.log('\n✅ 確認完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
