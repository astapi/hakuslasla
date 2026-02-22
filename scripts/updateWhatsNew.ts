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
  ja: `・戦闘BGM・効果音を追加
・戦闘画面のUIを改善
・初回起動時に言語選択画面を追加
・安定性の向上`,

  'en-US': `• Added battle BGM and sound effects
• Improved battle screen UI
• Added language selection on first launch
• Improved stability`,

  'en-GB': `• Added battle BGM and sound effects
• Improved battle screen UI
• Added language selection on first launch
• Improved stability`,

  'en-AU': `• Added battle BGM and sound effects
• Improved battle screen UI
• Added language selection on first launch
• Improved stability`,

  'en-CA': `• Added battle BGM and sound effects
• Improved battle screen UI
• Added language selection on first launch
• Improved stability`,

  'zh-Hans': `• 添加战斗BGM和音效
• 改进战斗界面UI
• 首次启动时添加语言选择
• 提高稳定性`,

  ko: `• 전투 BGM 및 효과음 추가
• 전투 화면 UI 개선
• 첫 실행 시 언어 선택 화면 추가
• 안정성 향상`,

  'es-ES': `• Añadido BGM y efectos de sonido de batalla
• Mejorada la interfaz de la pantalla de batalla
• Añadida selección de idioma en el primer inicio
• Mejorada la estabilidad`,

  'es-MX': `• Añadido BGM y efectos de sonido de batalla
• Mejorada la interfaz de la pantalla de batalla
• Añadida selección de idioma en el primer inicio
• Mejorada la estabilidad`,

  'fr-FR': `• Ajout de BGM et d'effets sonores de combat
• Amélioration de l'interface de l'écran de combat
• Ajout de la sélection de langue au premier lancement
• Amélioration de la stabilité`,

  'de-DE': `• Kampf-BGM und Soundeffekte hinzugefügt
• Kampfbildschirm-UI verbessert
• Sprachauswahl beim ersten Start hinzugefügt
• Stabilität verbessert`,
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
