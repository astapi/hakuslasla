/**
 * App Store Connect の App Info ローカライゼーション（タイトル）を更新
 *
 * 日本語版タイトル「ルートダイブ | ビルド構築ハクスラ周回RPG」を元に
 * 各言語のタイトルを更新
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateAppInfoTitles.ts
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

// 各言語のタイトル (30文字制限)
// 日本語: ルートダイブ | ビルド構築ハクスラ周回RPG
// ビルド構築 = Build、ハクスラ = Loot、周回 = Grind
const titles: Record<string, string> = {
  ja: 'ルートダイブ | ビルド構築ハクスラ周回RPG',
  'en-US': 'Loot Dive - Build & Grind RPG',    // 28文字
  'en-GB': 'Loot Dive - Build & Grind RPG',    // 28文字
  'en-AU': 'Loot Dive - Build & Grind RPG',    // 28文字
  'en-CA': 'Loot Dive - Build & Grind RPG',    // 28文字
  'zh-Hans': 'Loot Dive | 构筑刷图RPG',         // 18文字
  'zh-Hant': 'Loot Dive | 構築刷圖RPG',         // 18文字
  ko: 'Loot Dive | 빌드 & 파밍 RPG',            // 23文字
  'es-ES': 'Loot Dive - RPG Build & Grind',    // 28文字
  'es-MX': 'Loot Dive - RPG Build & Grind',    // 28文字
  'fr-FR': 'Loot Dive - RPG Build & Grind',    // 28文字
  'de-DE': 'Loot Dive - Build & Grind-RPG',    // 28文字
};

// メイン処理
async function main() {
  console.log('🌐 App Info タイトル更新\n');
  console.log('日本語タイトル: ルートダイブ | ビルド構築ハクスラ周回RPG\n');

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

  console.log('📝 タイトルを更新中...\n');

  for (const loc of existingLocs.data) {
    const locale = loc.attributes.locale;
    const expectedTitle = titles[locale];

    // 日本語はスキップ（既に更新済み）
    if (locale === 'ja') {
      console.log(`   ⏭️  ${locale}: スキップ（手動更新済み）`);
      continue;
    }

    if (!expectedTitle) {
      console.log(`   ⏭️  ${locale}: タイトル設定なし`);
      continue;
    }

    const currentTitle = loc.attributes.name;
    if (currentTitle === expectedTitle) {
      console.log(`   ✅ ${locale}: 既に正しいタイトル設定済み`);
      continue;
    }

    try {
      await apiPatch(`/appInfoLocalizations/${loc.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: loc.id,
          attributes: {
            name: expectedTitle,
          },
        },
      });
      console.log(`   ✅ ${locale}: タイトル更新完了`);
      console.log(`      現在: "${currentTitle}"`);
      console.log(`      更新: "${expectedTitle}"`);
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
