/**
 * プロモーションテキストを取得して表示
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
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return response.json() as Promise<T>;
}

interface AppStoreVersionLocalization {
  id: string;
  attributes: {
    locale: string;
    promotionalText: string | null;
  };
}

interface Response<T> {
  data: T[];
}

async function main() {
  console.log('📝 プロモーションテキスト取得\n');

  // 審査準備中のバージョンを取得
  const versions = await apiGet<Response<{ id: string; attributes: { appStoreState: string } }>>(
    `/apps/${config.appId}/appStoreVersions?limit=10`
  );

  const prepareForSubmission = versions.data.find(
    (v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!prepareForSubmission) {
    console.log('❌ 審査準備中のバージョンが見つかりません');
    return;
  }

  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  for (const loc of localizations.data) {
    const { locale, promotionalText } = loc.attributes;
    console.log(`📍 ${locale}:`);
    console.log(`   ${promotionalText || '(なし)'}\n`);
  }
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
