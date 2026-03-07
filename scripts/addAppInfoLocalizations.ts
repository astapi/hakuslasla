/**
 * App Store Connect に App Info ローカライゼーション（名前、サブタイトル）を追加
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/addAppInfoLocalizations.ts
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

// API リクエスト (POST)
async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
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

// 追加する言語のサブタイトル
const subtitles: Record<string, string> = {
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
  console.log('🌐 App Info ローカライゼーション追加\n');

  // 1. App Info 一覧を取得
  console.log('📱 App Info を取得中...');
  const appInfos = await apiGet<Response<AppInfo>>(
    `/apps/${config.appId}/appInfos`
  );

  console.log(`   見つかった App Info: ${appInfos.data.length} 件\n`);

  for (const appInfo of appInfos.data) {
    console.log(`   App Info ID: ${appInfo.id}`);
    console.log(`   State: ${appInfo.attributes.appStoreState}\n`);

    // 既存のローカライゼーションを取得
    const existingLocs = await apiGet<Response<AppInfoLocalization>>(
      `/appInfos/${appInfo.id}/appInfoLocalizations`
    );
    const existingLocales = existingLocs.data.map((l) => l.attributes.locale);
    console.log(`   既存ローカライゼーション: ${existingLocales.join(', ')}\n`);

    // 新しいローカライゼーションを追加
    for (const [locale, subtitle] of Object.entries(subtitles)) {
      if (existingLocales.includes(locale)) {
        console.log(`   ⏭️  ${locale}: 既に存在するためスキップ`);
        continue;
      }

      try {
        console.log(`   📝 ${locale}:`);
        await apiPost('/appInfoLocalizations', {
          data: {
            type: 'appInfoLocalizations',
            attributes: {
              locale: locale,
              name: 'LootDive',
              subtitle: subtitle,
            },
            relationships: {
              appInfo: {
                data: {
                  type: 'appInfos',
                  id: appInfo.id,
                },
              },
            },
          },
        });
        console.log(`      ✅ 追加完了`);
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes('409')) {
          console.log(`      ⚠️  この状態では追加できません`);
        } else {
          console.log(`      ❌ エラー: ${error}`);
        }
      }
    }
    console.log();
  }

  console.log('✅ 処理完了！');
  console.log('\n注意: App Infoローカライゼーションの追加に問題がある場合は、');
  console.log('App Store Connect管理画面から手動で言語を追加してください。');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
