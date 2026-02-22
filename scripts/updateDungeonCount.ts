/**
 * プロモーションテキストと概要の「17」→「20」を全言語で更新
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

interface AppStoreVersionLocalization {
  id: string;
  attributes: {
    locale: string;
    description: string | null;
    promotionalText: string | null;
  };
}

async function main() {
  console.log('📝 ダンジョン数を17→20に更新\n');

  // 審査準備中のバージョンを取得
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

  // ローカライゼーションを取得
  const localizations = await apiGet<Response<AppStoreVersionLocalization>>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  let updatedCount = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;
    let description = loc.attributes.description || '';
    let promotionalText = loc.attributes.promotionalText || '';

    let needsUpdate = false;
    const updates: { description?: string; promotionalText?: string } = {};

    // 17を20に置換（様々なパターンに対応）
    const patterns = [
      /17\+/g,      // 17+
      /\+17/g,      // +17
      /17種類/g,    // 17種類
      /17種以上/g,  // 17種以上
      /17以上/g,    // 17以上
      /17개/g,      // 17개 (韓国語)
    ];

    let newDescription = description;
    let newPromotionalText = promotionalText;

    for (const pattern of patterns) {
      newDescription = newDescription.replace(pattern, (match) => match.replace('17', '20'));
      newPromotionalText = newPromotionalText.replace(pattern, (match) => match.replace('17', '20'));
    }

    if (newDescription !== description) {
      updates.description = newDescription;
      needsUpdate = true;
    }

    if (newPromotionalText !== promotionalText) {
      updates.promotionalText = newPromotionalText;
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`📱 ${locale}:`);

      try {
        await apiPatch(`/appStoreVersionLocalizations/${loc.id}`, {
          data: {
            type: 'appStoreVersionLocalizations',
            id: loc.id,
            attributes: updates,
          },
        });

        if (updates.description) {
          console.log(`   ✅ 概要を更新`);
        }
        if (updates.promotionalText) {
          console.log(`   ✅ プロモーションテキストを更新`);
        }
        updatedCount++;
      } catch (error) {
        console.log(`   ❌ エラー: ${error}`);
      }

      // レート制限を避けるため待機
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n📊 結果: ${updatedCount}言語を更新`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
