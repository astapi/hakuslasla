/**
 * 指定バージョンのプロモーションテキストを各言語で更新
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updatePromotionalText.ts 1.3.6
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
  };
}

interface LocalizationsResponse {
  data: AppStoreVersionLocalization[];
}

interface VersionsResponse {
  data: AppStoreVersion[];
}

const promotionalTextByLocale: Record<string, string> = {
  ja: '完全オートバトルで手軽に本格ハクスラ！4クラスからキャラクターを作成し、パッシブツリーで自分だけのビルドを構築。MODを厳選し最強装備を狙え。Uberボスの先、UberUberボスを倒せるか？',

  'en-US':
    'Authentic hack-and-slash, full auto! Create a hero from 4 classes, design your build on the Passive Tree, hunt MODs for top gear. Past the Ubers—beat the UberUber bosses?',

  'en-GB':
    'Authentic hack-and-slash, full auto! Create a hero from 4 classes, design your build on the Passive Tree, hunt MODs for top gear. Past the Ubers—beat the UberUber bosses?',

  'en-AU':
    'Authentic hack-and-slash, full auto! Create a hero from 4 classes, design your build on the Passive Tree, hunt MODs for top gear. Past the Ubers—beat the UberUber bosses?',

  'en-CA':
    'Authentic hack-and-slash, full auto! Create a hero from 4 classes, design your build on the Passive Tree, hunt MODs for top gear. Past the Ubers—beat the UberUber bosses?',

  'zh-Hans':
    '全自动战斗轻松畅玩正统刷宝RPG！从4种职业中创建角色，通过被动天赋树打造专属构筑。精挑MOD获取最强装备。能否击败Uber首领之后的UberUber首领？',

  ko: '완전 오토 배틀로 간편하게 즐기는 본격 핵앤슬래시! 4개 클래스에서 캐릭터를 생성하고 패시브 트리로 나만의 빌드를 구축. MOD를 엄선해 최강 장비를 노려라. Uber 보스 너머, UberUber 보스를 쓰러뜨릴 수 있는가?',

  'es-ES':
    'Hack and slash con combate auto. Crea un héroe entre 4 clases, forja tu build en el Árbol Pasivo, caza MODs por el mejor equipo. ¿Vencerás a los jefes UberUber?',

  'es-MX':
    'Hack and slash con combate auto. Crea un héroe entre 4 clases, forja tu build en el Árbol Pasivo, caza MODs por el mejor equipo. ¿Vencerás a los jefes UberUber?',

  'fr-FR':
    "Hack and slash en auto ! Crée ton héros parmi 4 classes, façonne ton build sur l'Arbre Passif, traque les MODs pour le meilleur équipement. Vaincras-tu les UberUber ?",

  'de-DE':
    'Hack-and-Slash mit Auto-Kampf! Erstelle einen Helden aus 4 Klassen, baue deinen Build im Passiv-Baum, jage MODs für Top-Ausrüstung. Besiegst du die UberUber-Bosse?',
};

async function main() {
  const targetVersion = process.argv[2];
  if (!targetVersion) {
    throw new Error('バージョン番号を指定してください (例: 1.3.6)');
  }

  console.log(`🔄 v${targetVersion} のプロモーションテキスト更新を開始\n`);

  console.log('📦 バージョン情報を取得中...');
  const versions = await apiGet<VersionsResponse>(
    `/apps/${config.appId}/appStoreVersions?limit=20`
  );

  const target = versions.data.find(
    (v) => v.attributes.versionString === targetVersion
  );

  if (!target) {
    const available = versions.data
      .map((v) => `${v.attributes.versionString} (${v.attributes.appStoreState})`)
      .join(', ');
    throw new Error(
      `v${targetVersion} が見つかりません。利用可能なバージョン: ${available}`
    );
  }

  console.log(
    `   対象: v${target.attributes.versionString} [${target.attributes.appStoreState}] (ID: ${target.id})\n`
  );

  console.log('📝 ローカライゼーションを取得中...');
  const localizations = await apiGet<LocalizationsResponse>(
    `/appStoreVersions/${target.id}/appStoreVersionLocalizations`
  );

  console.log(`   ${localizations.data.length} 言語のローカライゼーションを発見\n`);

  console.log('🔄 プロモーションテキストを更新中...\n');

  let updatedCount = 0;
  let skippedCount = 0;

  for (const loc of localizations.data) {
    const locale = loc.attributes.locale;
    const promotionalText = promotionalTextByLocale[locale];

    if (!promotionalText) {
      console.log(`   ⚠️  ${locale}: 翻訳が定義されていないためスキップ`);
      skippedCount++;
      continue;
    }

    const charCount = [...promotionalText].length;
    if (charCount > 170) {
      console.log(`   ❌ ${locale}: ${charCount}字（170字超のためスキップ）`);
      skippedCount++;
      continue;
    }

    try {
      await apiPatch(`/appStoreVersionLocalizations/${loc.id}`, {
        data: {
          type: 'appStoreVersionLocalizations',
          id: loc.id,
          attributes: {
            promotionalText: promotionalText,
          },
        },
      });

      console.log(`   ✅ ${locale} (${charCount}字): ${promotionalText.substring(0, 50)}...`);
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
