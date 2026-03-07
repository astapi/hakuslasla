/**
 * App Store Connect の App Info ローカライゼーション（サブタイトル）を更新
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateAppInfoLocalizations.ts
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

// API リクエスト (PATCH)
async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// 型定義
interface AppInfo {
  id: string;
  attributes: {
    appStoreState: string;
  };
}

interface AppInfoLocalization {
  id: string;
  attributes: {
    locale: string;
    name: string | null;
    subtitle: string | null;
  };
}

interface Response<T> {
  data: T[];
}

// 各言語のサブタイトル
const subtitles: Record<string, string> = {
  ja: '自動戦闘xビルド構築',
  'en-US': 'Auto Battles × Build Crafting',
  'en-GB': 'Auto Battles × Build Crafting',
  'en-AU': 'Auto Battles × Build Crafting',
  'en-CA': 'Auto Battles × Build Crafting',
  'zh-Hans': '自动战斗×构筑系统',
  'zh-Hant': '自動戰鬥×構築系統',
  ko: '자동 전투 × 빌드 구축',
  'es-ES': 'Batallas Auto × Builds',
  'es-MX': 'Batallas Auto × Builds',
  'fr-FR': 'Combat Auto × Build',
  'de-DE': 'Auto-Kampf × Build',
};

// メイン処理
async function main() {
  console.log('🌐 App Info ローカライゼーション更新\n');

  // 1. App Info 一覧を取得
  console.log('📱 App Info を取得中...');
  const appInfos = await apiGet<Response<AppInfo>>(
    `/apps/${config.appId}/appInfos`
  );

  // 審査準備中のApp Infoを検索
  const prepareForSubmission = appInfos.data.find(
    (ai) => ai.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!prepareForSubmission) {
    console.log('   ❌ 審査準備中のApp Infoが見つかりません');
    return;
  }

  console.log(`   App Info ID: ${prepareForSubmission.id}`);
  console.log(`   State: ${prepareForSubmission.attributes.appStoreState}\n`);

  // 既存のローカライゼーションを取得
  const existingLocs = await apiGet<Response<AppInfoLocalization>>(
    `/appInfos/${prepareForSubmission.id}/appInfoLocalizations`
  );

  console.log('📝 ローカライゼーションを更新中...\n');

  for (const loc of existingLocs.data) {
    const locale = loc.attributes.locale;
    const expectedSubtitle = subtitles[locale];

    if (!expectedSubtitle) {
      console.log(`   ⏭️  ${locale}: サブタイトル設定なし`);
      continue;
    }

    const currentSubtitle = loc.attributes.subtitle;
    if (currentSubtitle === expectedSubtitle) {
      console.log(`   ✅ ${locale}: 既に正しいサブタイトル設定済み`);
      continue;
    }

    try {
      await apiPatch(`/appInfoLocalizations/${loc.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: loc.id,
          attributes: {
            subtitle: expectedSubtitle,
          },
        },
      });
      console.log(`   ✅ ${locale}: サブタイトル更新完了`);
      console.log(`      "${expectedSubtitle}"`);
    } catch (error) {
      console.log(`   ❌ ${locale}: エラー - ${error}`);
    }
  }

  console.log('\n✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
