/**
 * App Store Connect API クライアント
 *
 * 使用例:
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/appStoreConnect.ts
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

// 環境変数から設定を取得
const config = {
  issuerId: env.APP_STORE_CONNECT_ISSUER_ID,
  keyId: env.APP_STORE_CONNECT_KEY_ID,
  privateKeyPath: env.APP_STORE_CONNECT_PRIVATE_KEY_PATH,
  appId: env.APP_STORE_CONNECT_APP_ID,
};

// 設定の検証
function validateConfig() {
  const missing: string[] = [];
  if (!config.issuerId) missing.push('APP_STORE_CONNECT_ISSUER_ID');
  if (!config.keyId) missing.push('APP_STORE_CONNECT_KEY_ID');
  if (!config.privateKeyPath) missing.push('APP_STORE_CONNECT_PRIVATE_KEY_PATH');
  if (!config.appId) missing.push('APP_STORE_CONNECT_APP_ID');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  if (!fs.existsSync(config.privateKeyPath)) {
    throw new Error(`Private key file not found: ${config.privateKeyPath}`);
  }
}

// JWT トークンを生成
async function generateToken(): Promise<string> {
  const privateKeyPem = fs.readFileSync(config.privateKeyPath, 'utf-8');
  const privateKey = await importPKCS8(privateKeyPem, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 20 * 60; // 20分後に期限切れ

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

// API リクエストを実行
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// アプリ情報を取得
interface AppResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      name: string;
      bundleId: string;
      sku: string;
      primaryLocale: string;
    };
  };
}

async function getAppInfo(): Promise<AppResponse> {
  return apiRequest<AppResponse>(`/apps/${config.appId}`);
}

// ビルド一覧を取得
interface BuildsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      version: string;
      uploadedDate: string;
      processingState: string;
      buildAudienceType: string;
    };
  }>;
  links: {
    self: string;
    next?: string;
  };
}

async function getBuilds(limit = 10): Promise<BuildsResponse> {
  return apiRequest<BuildsResponse>(
    `/builds?filter[app]=${config.appId}&limit=${limit}&sort=-uploadedDate`
  );
}

// App Store バージョン一覧を取得
interface AppStoreVersionsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      versionString: string;
      appStoreState: string;
      releaseType: string;
      createdDate: string;
    };
  }>;
}

async function getAppStoreVersions(): Promise<AppStoreVersionsResponse> {
  return apiRequest<AppStoreVersionsResponse>(
    `/apps/${config.appId}/appStoreVersions?limit=5`
  );
}

// TestFlight ベータグループ一覧を取得
interface BetaGroupsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      name: string;
      isInternalGroup: boolean;
      publicLinkEnabled: boolean;
      publicLinkLimit?: number;
    };
  }>;
}

async function getBetaGroups(): Promise<BetaGroupsResponse> {
  return apiRequest<BetaGroupsResponse>(`/apps/${config.appId}/betaGroups`);
}

// メイン実行
async function main() {
  console.log('🔗 App Store Connect API 接続テスト\n');

  try {
    validateConfig();
    console.log('✅ 設定の検証完了');
    console.log(`   Issuer ID: ${config.issuerId}`);
    console.log(`   Key ID: ${config.keyId}`);
    console.log(`   App ID: ${config.appId}\n`);

    // アプリ情報取得
    console.log('📱 アプリ情報を取得中...');
    const appInfo = await getAppInfo();
    console.log(`   アプリ名: ${appInfo.data.attributes.name}`);
    console.log(`   Bundle ID: ${appInfo.data.attributes.bundleId}`);
    console.log(`   SKU: ${appInfo.data.attributes.sku}\n`);

    // ビルド一覧取得
    console.log('🏗️  最新ビルド一覧:');
    const builds = await getBuilds(5);
    builds.data.forEach((build) => {
      const date = new Date(build.attributes.uploadedDate).toLocaleString(
        'ja-JP'
      );
      console.log(
        `   v${build.attributes.version} - ${build.attributes.processingState} (${date})`
      );
    });
    console.log();

    // App Store バージョン一覧
    console.log('📦 App Store バージョン:');
    const versions = await getAppStoreVersions();
    versions.data.forEach((version) => {
      console.log(
        `   v${version.attributes.versionString} - ${version.attributes.appStoreState}`
      );
    });
    console.log();

    // TestFlight グループ
    console.log('🧪 TestFlight グループ:');
    const betaGroups = await getBetaGroups();
    betaGroups.data.forEach((group) => {
      const type = group.attributes.isInternalGroup ? '内部' : '外部';
      console.log(`   ${group.attributes.name} (${type})`);
    });

    console.log('\n✅ 接続テスト完了！');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

// エクスポート（他のスクリプトから使用可能）
export {
  generateToken,
  apiRequest,
  getAppInfo,
  getBuilds,
  getAppStoreVersions,
  getBetaGroups,
  config,
};

// 直接実行時のみmainを実行
main();
