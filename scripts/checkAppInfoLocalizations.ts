/**
 * App Info Localizationsを確認
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

async function main() {
  console.log('📝 App Info Localizations確認\n');

  const appInfos = await apiGet<Response<AppInfo>>(
    `/apps/${config.appId}/appInfos`
  );

  console.log(`App Infos: ${appInfos.data.length}個\n`);

  for (const appInfo of appInfos.data) {
    console.log(`📦 App Info ID: ${appInfo.id}`);
    console.log(`   State: ${appInfo.attributes.appStoreState}`);

    const localizations = await apiGet<Response<AppInfoLocalization>>(
      `/appInfos/${appInfo.id}/appInfoLocalizations`
    );

    console.log(`   Localizations: ${localizations.data.length}個`);
    for (const loc of localizations.data) {
      console.log(`   - ${loc.attributes.locale}: supportUrl=${loc.attributes.supportUrl || '(なし)'}`);
    }
    console.log();
  }
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
