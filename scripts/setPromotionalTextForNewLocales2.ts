/**
 * 新しく追加した言語にプロモーションテキストを設定（170文字制限対応版）
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

async function apiPatch<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const response = await fetch(`https://api.appstoreconnect.apple.com/v1${endpoint}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }
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

// 各言語のプロモーションテキスト（170文字以内に短縮）
// 英語原文 (152文字): "Dive into dungeons and hunt legendary loot. Fully automated battles for busy players. Explore 17+ dungeons, defeat bosses, and craft your ultimate build."
const promotionalTexts: Record<string, string> = {
  // スペイン語 (Spain) - 170文字以内
  'es-ES':
    '¡Sumérgete en mazmorras y caza botín legendario! Batallas automáticas para jugadores ocupados. Explora +17 mazmorras, derrota jefes y crea tu build definitivo.',

  // スペイン語 (Mexico)
  'es-MX':
    '¡Sumérgete en mazmorras y caza botín legendario! Batallas automáticas para jugadores ocupados. Explora +17 mazmorras, derrota jefes y crea tu build definitivo.',

  // フランス語 - 170文字以内
  'fr-FR':
    'Plongez dans les donjons et chassez du butin légendaire ! Combats automatiques pour joueurs occupés. Explorez +17 donjons, battez des boss et créez votre build ultime.',

  // ドイツ語 - 170文字以内
  'de-DE':
    'Tauche in Dungeons ein und jage legendäre Beute! Vollautomatische Kämpfe für beschäftigte Spieler. Erkunde 17+ Dungeons, besiege Bosse und erstelle deinen Build.',
};

async function main() {
  console.log('🌐 プロモーションテキストを設定（170文字以内版）\n');

  // 文字数チェック
  console.log('📏 文字数チェック:');
  for (const [locale, text] of Object.entries(promotionalTexts)) {
    console.log(`   ${locale}: ${text.length}文字 ${text.length <= 170 ? '✅' : '❌'}`);
  }
  console.log();

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

  const localeMap = new Map<string, AppStoreVersionLocalization>();
  localizations.data.forEach((loc) => {
    localeMap.set(loc.attributes.locale, loc);
  });

  console.log('📝 プロモーションテキストを設定中...\n');

  let updatedCount = 0;

  for (const [locale, text] of Object.entries(promotionalTexts)) {
    const loc = localeMap.get(locale);

    if (!loc) {
      console.log(`   ⚠️  ${locale}: ローカライゼーションが見つかりません`);
      continue;
    }

    try {
      await apiPatch(`/appStoreVersionLocalizations/${loc.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: loc.id,
          attributes: {
            promotionalText: text,
          },
        },
      });

      console.log(`   ✅ ${locale}: 設定完了`);
      console.log(`      "${text}"\n`);
      updatedCount++;
    } catch (error) {
      console.log(`   ❌ ${locale}: エラー - ${error}`);
    }
  }

  console.log(`📊 結果: ${updatedCount} 言語に設定完了`);
  console.log('✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
