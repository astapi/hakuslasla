/**
 * 審査準備中バージョンの「このバージョンの最新情報」を更新
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateWhatsNew.ts
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
    whatsNew: string | null;
  };
}

interface LocalizationsResponse {
  data: AppStoreVersionLocalization[];
}

interface VersionsResponse {
  data: AppStoreVersion[];
}

// 各言語のwhatsNewテキスト
const whatsNewByLocale: Record<string, string> = {
  ja: `【改善】
・同じダンジョンを連続で周回しやすいように改善
・Uberボスを周回できるように改善`,

  'en-US': `[Improvements]
• Improved ease of replaying the same dungeon consecutively
• Improved ability to repeatedly challenge Uber bosses`,

  'en-GB': `[Improvements]
• Improved ease of replaying the same dungeon consecutively
• Improved ability to repeatedly challenge Uber bosses`,

  'en-AU': `[Improvements]
• Improved ease of replaying the same dungeon consecutively
• Improved ability to repeatedly challenge Uber bosses`,

  'en-CA': `[Improvements]
• Improved ease of replaying the same dungeon consecutively
• Improved ability to repeatedly challenge Uber bosses`,

  'zh-Hans': `【改善】
• 改善了连续刷同一地下城的便捷性
• 改善了可以反复挑战Uber Boss的功能`,

  ko: `[개선]
• 같은 던전을 연속으로 반복하기 쉽도록 개선
• Uber 보스를 반복 도전할 수 있도록 개선`,

  'es-ES': `[Mejoras]
• Mejorada la facilidad para repetir el mismo calabozo consecutivamente
• Mejorada la posibilidad de desafiar repetidamente a los jefes Uber`,

  'es-MX': `[Mejoras]
• Mejorada la facilidad para repetir el mismo calabozo consecutivamente
• Mejorada la posibilidad de desafiar repetidamente a los jefes Uber`,

  'fr-FR': `[Améliorations]
• Amélioration de la facilité à rejouer le même donjon consécutivement
• Amélioration de la possibilité de défier les boss Uber de manière répétée`,

  'de-DE': `[Verbesserungen]
• Verbesserung der Moeglichkeit, denselben Dungeon hintereinander zu wiederholen
• Verbesserung der Moeglichkeit, Uber-Bosse wiederholt herauszufordern`,
};

// メイン処理
async function main() {
  console.log('🔄 「このバージョンの最新情報」の更新処理を開始\n');

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

  // 2. ローカライゼーションを取得
  console.log('📝 ローカライゼーションを取得中...');
  const localizations = await apiGet<LocalizationsResponse>(
    `/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`
  );

  console.log(`   ${localizations.data.length} 言語のローカライゼーションを発見\n`);

  // 3. whatsNewを更新
  console.log('🔄 「このバージョンの最新情報」を更新中...\n');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;
    const whatsNew = whatsNewByLocale[locale];

    if (!whatsNew) {
      console.log(`   ⚠️  ${locale}: 翻訳が定義されていないためスキップ`);
      skippedCount++;
      continue;
    }

    try {
      await apiPatch(`/appStoreVersionLocalizations/${loc.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: loc.id,
          attributes: {
            whatsNew: whatsNew,
          },
        },
      });

      console.log(`   ✅ ${locale}: 更新完了`);
      console.log(`      "${whatsNew.substring(0, 60)}..."`);
      updatedCount++;
    } catch (error) {
      console.log(`   ❌ ${locale}: エラー - ${error}`);
    }
  }

  console.log(`\n📊 結果: ${updatedCount} 言語を更新, ${skippedCount} 言語スキップ`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
