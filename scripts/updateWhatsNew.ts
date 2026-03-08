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
  ja: `【新機能】
・戦闘の倍速機能を追加
・友達招待機能を追加

【新クラス追加】
・新プレイアブルクラス「レンジャー」が登場！

【クラス強化】
・ウォリアーにクラス固有能力を追加し、HPを強化

【バランス調整】
・Uberボスのユニーク装備を強化（固定MODを4つに増加）

【不具合修正】
・戦闘画面のキャラクター・モンスター画像サイズを調整
・一部ユニーク装備がフィルターで除外される問題を修正`,

  'en-US': `[New Features]
• Added battle speed multiplier
• Added friend invite feature

[New Class]
• New playable class "Ranger" is now available!

[Class Enhancement]
• Added unique class ability to Warrior and increased HP

[Balance Adjustments]
• Strengthened Uber boss unique equipment (increased fixed mods to 4)

[Bug Fixes]
• Adjusted character and monster image sizes on the battle screen
• Fixed an issue where some unique equipment was excluded by filters`,

  'en-GB': `[New Features]
• Added battle speed multiplier
• Added friend invite feature

[New Class]
• New playable class "Ranger" is now available!

[Class Enhancement]
• Added unique class ability to Warrior and increased HP

[Balance Adjustments]
• Strengthened Uber boss unique equipment (increased fixed mods to 4)

[Bug Fixes]
• Adjusted character and monster image sizes on the battle screen
• Fixed an issue where some unique equipment was excluded by filters`,

  'en-AU': `[New Features]
• Added battle speed multiplier
• Added friend invite feature

[New Class]
• New playable class "Ranger" is now available!

[Class Enhancement]
• Added unique class ability to Warrior and increased HP

[Balance Adjustments]
• Strengthened Uber boss unique equipment (increased fixed mods to 4)

[Bug Fixes]
• Adjusted character and monster image sizes on the battle screen
• Fixed an issue where some unique equipment was excluded by filters`,

  'en-CA': `[New Features]
• Added battle speed multiplier
• Added friend invite feature

[New Class]
• New playable class "Ranger" is now available!

[Class Enhancement]
• Added unique class ability to Warrior and increased HP

[Balance Adjustments]
• Strengthened Uber boss unique equipment (increased fixed mods to 4)

[Bug Fixes]
• Adjusted character and monster image sizes on the battle screen
• Fixed an issue where some unique equipment was excluded by filters`,

  'zh-Hans': `【新功能】
• 新增战斗倍速功能
• 新增好友邀请功能

【新职业】
• 新可玩职业「游侠」现已登场！

【职业强化】
• 为战士添加职业固有能力，并强化HP

【平衡调整】
• 强化Uber Boss的唯一装备（固定MOD增加至4个）

【问题修复】
• 调整战斗画面中角色和怪物的图像大小
• 修复部分唯一装备被筛选器排除的问题`,

  ko: `[새로운 기능]
• 전투 배속 기능 추가
• 친구 초대 기능 추가

[새 클래스]
• 새로운 플레이어블 클래스 "레인저" 등장!

[클래스 강화]
• 전사에 클래스 고유 능력 추가 및 HP 강화

[밸런스 조정]
• Uber 보스 유니크 장비 강화 (고정 MOD 4개로 증가)

[버그 수정]
• 전투 화면의 캐릭터 및 몬스터 이미지 크기 조정
• 일부 유니크 장비가 필터에서 제외되는 문제 수정`,

  'es-ES': `[Nuevas funciones]
• Velocidad de combate acelerada añadida
• Función de invitación de amigos añadida

[Nueva clase]
• ¡La nueva clase jugable "Explorador" ya está disponible!

[Mejora de clase]
• Añadida habilidad única al Guerrero y aumento de HP

[Ajustes de equilibrio]
• Equipamiento único del jefe Uber reforzado (MODs fijos aumentados a 4)

[Corrección de errores]
• Ajustados los tamaños de imagen de personajes y monstruos en la pantalla de combate
• Corregido un problema donde algunos equipamientos únicos eran excluidos por los filtros`,

  'es-MX': `[Nuevas funciones]
• Velocidad de combate acelerada añadida
• Función de invitación de amigos añadida

[Nueva clase]
• ¡La nueva clase jugable "Explorador" ya está disponible!

[Mejora de clase]
• Añadida habilidad única al Guerrero y aumento de HP

[Ajustes de equilibrio]
• Equipamiento único del jefe Uber reforzado (MODs fijos aumentados a 4)

[Corrección de errores]
• Ajustados los tamaños de imagen de personajes y monstruos en la pantalla de combate
• Corregido un problema donde algunos equipamientos únicos eran excluidos por los filtros`,

  'fr-FR': `[Nouvelles fonctionnalités]
• Ajout de la vitesse de combat accélérée
• Ajout de la fonction d'invitation d'amis

[Nouvelle classe]
• La nouvelle classe jouable « Rôdeur » est maintenant disponible !

[Amélioration de classe]
• Ajout d'une capacité unique au Guerrier et augmentation des HP

[Ajustements d'équilibre]
• Renforcement de l'équipement unique du boss Uber (MODs fixes augmentés à 4)

[Corrections de bugs]
• Ajustement de la taille des images des personnages et des monstres sur l'écran de combat
• Correction d'un problème où certains équipements uniques étaient exclus par les filtres`,

  'de-DE': `[Neue Funktionen]
• Kampfgeschwindigkeits-Multiplikator hinzugefuegt
• Freunde-Einladungsfunktion hinzugefuegt

[Neue Klasse]
• Die neue spielbare Klasse "Waldläufer" ist jetzt verfuegbar!

[Klassenverbesserung]
• Einzigartige Klassenfaehigkeit fuer den Krieger hinzugefuegt und HP erhoeht

[Balance-Anpassungen]
• Einzigartige Ausruestung des Uber-Bosses verstaerkt (feste MODs auf 4 erhoeht)

[Fehlerbehebungen]
• Groesse der Charakter- und Monsterbilder auf dem Kampfbildschirm angepasst
• Problem behoben, bei dem einige einzigartige Ausruestungen durch Filter ausgeschlossen wurden`,
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
