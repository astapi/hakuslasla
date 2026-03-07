/**
 * プロモーションテキストを販売中バージョンから審査準備中バージョンへコピー
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/copyPromotionalText.ts
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
    promotionalText: string | null;
    description: string | null;
    whatsNew: string | null;
    keywords: string | null;
  };
}

interface LocalizationsResponse {
  data: AppStoreVersionLocalization[];
}

interface VersionsResponse {
  data: AppStoreVersion[];
}

// メイン処理
async function main() {
  console.log('🔄 プロモーションテキストのコピー処理を開始\n');

  // 1. App Store バージョン一覧を取得
  console.log('📦 バージョン情報を取得中...');
  const versions = await apiGet<VersionsResponse>(
    `/apps/${config.appId}/appStoreVersions?limit=10`
  );

  // 販売中と審査準備中のバージョンを特定
  const readyForSale = versions.data.find(
    (v) => v.attributes.appStoreState === 'READY_FOR_SALE'
  );
  const prepareForSubmission = versions.data.find(
    (v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION'
  );

  if (!readyForSale) {
    throw new Error('販売中のバージョンが見つかりません');
  }
  if (!prepareForSubmission) {
    throw new Error('審査準備中のバージョンが見つかりません');
  }

  console.log(`   販売中: v${readyForSale.attributes.versionString} (ID: ${readyForSale.id})`);
  console.log(`   審査準備中: v${prepareForSubmission.attributes.versionString} (ID: ${prepareForSubmission.id})\n`);

  // 2. 販売中バージョンのローカライゼーションを取得
  console.log('📝 販売中バージョンのローカライゼーションを取得中...');
  const sourceLocalizations = await apiGet<LocalizationsResponse>(
    `/appStoreVersions/${readyForSale.id}/appStoreVersionLocalizations`
  );

  console.log(`   ${sourceLocalizations.data.length} 言語のローカライゼーションを発見\n`);

  // 3. 審査準備中バージョンのローカライゼーションを取得
  console.log('📝 審査準備中バージョンのローカライゼーションを取得中...');
  const targetLocalizations = await apiGet<LocalizationsResponse>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  // ロケールでマッピング
  const targetLocaleMap = new Map<string, AppStoreVersionLocalization>();
  targetLocalizations.data.forEach((loc) => {
    targetLocaleMap.set(loc.attributes.locale, loc);
  });

  // 4. プロモーションテキストをコピー
  console.log('🔄 プロモーションテキストをコピー中...\n');

  let copiedCount = 0;
  let skippedCount = 0;

  for (const sourceLoc of sourceLocalizations.data) {
    const locale = sourceLoc.attributes.locale;
    const promotionalText = sourceLoc.attributes.promotionalText;
    const targetLoc = targetLocaleMap.get(locale);

    if (!targetLoc) {
      console.log(`   ⚠️  ${locale}: ターゲットにローカライゼーションが存在しません`);
      skippedCount++;
      continue;
    }

    if (!promotionalText) {
      console.log(`   ⏭️  ${locale}: プロモーションテキストが空のためスキップ`);
      skippedCount++;
      continue;
    }

    // プロモーションテキストを更新
    try {
      await apiPatch(`/appStoreVersionLocalizations/${targetLoc.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: targetLoc.id,
          attributes: {
            promotionalText: promotionalText,
          },
        },
      });

      console.log(`   ✅ ${locale}: "${promotionalText.substring(0, 50)}${promotionalText.length > 50 ? '...' : ''}"`);
      copiedCount++;
    } catch (error) {
      console.log(`   ❌ ${locale}: エラー - ${error}`);
    }
  }

  console.log(`\n📊 結果: ${copiedCount} 言語にコピー完了, ${skippedCount} 言語スキップ`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
