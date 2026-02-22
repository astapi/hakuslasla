/**
 * 追加した言語のサポートURLを設定
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

interface Response<T> {
  data: T[];
}

interface AppInfoLocalization {
  id: string;
  attributes: {
    locale: string;
    supportUrl: string | null;
  };
}

interface AppInfo {
  id: string;
  attributes: {
    appStoreState: string;
  };
}

const SUPPORT_URL = 'https://www.astapi.net/lootdive/contact';

// 追加した言語
const targetLocales = ['zh-Hans', 'ko', 'es-ES', 'es-MX', 'fr-FR', 'de-DE'];

async function main() {
  console.log('🔗 サポートURLを設定\n');
  console.log(`URL: ${SUPPORT_URL}\n`);

  // App Infoを取得
  const appInfos = await apiGet<Response<AppInfo>>(
    `/apps/${config.appId}/appInfos`
  );

  // PREPARE_FOR_SUBMISSIONのApp Infoを取得
  const appInfo = appInfos.data.find(
    (info) => info.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );
  if (!appInfo) {
    console.log('❌ 審査準備中のApp Infoが見つかりません');
    return;
  }

  console.log(`📦 App Info ID: ${appInfo.id}\n`);

  // App Info Localizationsを取得
  const localizations = await apiGet<Response<AppInfoLocalization>>(
    `/appInfos/${appInfo.id}/appInfoLocalizations`
  );

  let updatedCount = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;

    if (!targetLocales.includes(locale)) {
      continue;
    }

    try {
      await apiPatch(`/appInfoLocalizations/${loc.id}`, {
        data: {
          type: 'appInfoLocalizations',
          id: loc.id,
          attributes: {
            supportUrl: SUPPORT_URL,
          },
        },
      });

      console.log(`✅ ${locale}: サポートURL設定完了`);
      updatedCount++;
    } catch (error) {
      console.log(`❌ ${locale}: ${error}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n📊 結果: ${updatedCount}言語を更新`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
