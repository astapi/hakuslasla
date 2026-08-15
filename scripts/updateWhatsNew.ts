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
  ja: `ルートダイブ ver2.1.0 アップデート情報

■ 新エンドコンテンツ「UberUber魔王」
・全てのUberボス・UberUberボスを撃破した者の前にのみ顕現する、次元を超えた魔王
・凄まじい再生力を持ち、生半可な火力では傷一つ与えられない

■ 新クラフト要素「刻印」
・レア装備に、狙ったMODを1つ確定で彫り込める新システム
・1つの装備につき1つまで。MODが空いていれば追加、埋まっていれば入れ替えるMODを選択
・「HIT時回復」「回避率」「回復→ATK変換」など、通常のドロップでは付かないMODも刻印なら付与できます
・刻印は終焉の地以降のダンジョンでドロップ（ボス撃破時は確定入手）
・ホーム画面下部の「刻印」から作成できます

■ パッシブツリーの不具合修正とお詫び
・前提条件を無視してリスペック（返却）ができてしまい、ツリーが分断された状態になる不具合を修正しました
・影響を受けたキャラクターは、パッシブツリーを初期化のうえ、消費済みのスキルポイントを全額返還いたします
・お詫びとして、全プレイヤーにリスペックトークンを80個配布いたします
・ご不便をおかけし、誠に申し訳ありませんでした`,

  "en-US": `LootDive ver 2.1.0 Update Notes

[New Endgame Content: UberUber Demon Lord]
• A demon lord beyond dimensions, appearing only before those who have defeated every Uber and UberUber boss
• Its monstrous regeneration shrugs off all but the mightiest firepower

[New Crafting: Engraving]
• Engrave one chosen mod onto a rare item, guaranteed
• One per item. Added to a free slot, or replace a mod you select when all slots are full
• Mods that never roll on normal drops — such as HP on Hit, Evasion %, and Regen to ATK — can be added via Engraving
• Engraves drop in dungeons from the Land of Endings onward (guaranteed from boss kills)
• Craft from "Engrave" at the bottom of the Home screen

[Passive Tree Fix and Apology]
• Fixed an issue where nodes could be refunded ignoring their prerequisites, leaving the tree disconnected
• Affected characters have had their passive tree reset, with all spent skill points fully refunded
• As an apology, 80 Respec Tokens have been granted to all players
• We sincerely apologize for the inconvenience`,

  "en-GB": `LootDive ver 2.1.0 Update Notes

[New Endgame Content: UberUber Demon Lord]
• A demon lord beyond dimensions, appearing only before those who have defeated every Uber and UberUber boss
• Its monstrous regeneration shrugs off all but the mightiest firepower

[New Crafting: Engraving]
• Engrave one chosen mod onto a rare item, guaranteed
• One per item. Added to a free slot, or replace a mod you select when all slots are full
• Mods that never roll on normal drops — such as HP on Hit, Evasion %, and Regen to ATK — can be added via Engraving
• Engraves drop in dungeons from the Land of Endings onward (guaranteed from boss kills)
• Craft from "Engrave" at the bottom of the Home screen

[Passive Tree Fix and Apology]
• Fixed an issue where nodes could be refunded ignoring their prerequisites, leaving the tree disconnected
• Affected characters have had their passive tree reset, with all spent skill points fully refunded
• As an apology, 80 Respec Tokens have been granted to all players
• We sincerely apologize for the inconvenience`,

  "en-AU": `LootDive ver 2.1.0 Update Notes

[New Endgame Content: UberUber Demon Lord]
• A demon lord beyond dimensions, appearing only before those who have defeated every Uber and UberUber boss
• Its monstrous regeneration shrugs off all but the mightiest firepower

[New Crafting: Engraving]
• Engrave one chosen mod onto a rare item, guaranteed
• One per item. Added to a free slot, or replace a mod you select when all slots are full
• Mods that never roll on normal drops — such as HP on Hit, Evasion %, and Regen to ATK — can be added via Engraving
• Engraves drop in dungeons from the Land of Endings onward (guaranteed from boss kills)
• Craft from "Engrave" at the bottom of the Home screen

[Passive Tree Fix and Apology]
• Fixed an issue where nodes could be refunded ignoring their prerequisites, leaving the tree disconnected
• Affected characters have had their passive tree reset, with all spent skill points fully refunded
• As an apology, 80 Respec Tokens have been granted to all players
• We sincerely apologize for the inconvenience`,

  "en-CA": `LootDive ver 2.1.0 Update Notes

[New Endgame Content: UberUber Demon Lord]
• A demon lord beyond dimensions, appearing only before those who have defeated every Uber and UberUber boss
• Its monstrous regeneration shrugs off all but the mightiest firepower

[New Crafting: Engraving]
• Engrave one chosen mod onto a rare item, guaranteed
• One per item. Added to a free slot, or replace a mod you select when all slots are full
• Mods that never roll on normal drops — such as HP on Hit, Evasion %, and Regen to ATK — can be added via Engraving
• Engraves drop in dungeons from the Land of Endings onward (guaranteed from boss kills)
• Craft from "Engrave" at the bottom of the Home screen

[Passive Tree Fix and Apology]
• Fixed an issue where nodes could be refunded ignoring their prerequisites, leaving the tree disconnected
• Affected characters have had their passive tree reset, with all spent skill points fully refunded
• As an apology, 80 Respec Tokens have been granted to all players
• We sincerely apologize for the inconvenience`,

  "zh-Hans": `LootDive ver 2.1.0 更新内容

■ 新终局内容「UberUber 魔王」
・只在击败所有Uber与UberUber首领者面前现身的超越次元的魔王
・拥有惊人的再生力，半吊子的火力无法伤其分毫

■ 新制作系统「刻印」
・可在稀有装备上确定刻入一个指定MOD的新系统
・每件装备限一个。MOD有空位则追加，已满则选择要替换的MOD
・「命中回复」「闪避率」「回复转ATK」等通常掉落无法获得的MOD，通过刻印即可附加
・刻印在终焉之地以后的地下城掉落（击败首领必定获得）
・可从主界面下方的「刻印」进行制作

■ 天赋树的问题修复与致歉
・修复了可无视前置条件退还天赋点，导致天赋树被分割的问题
・受影响的角色将重置天赋树，并全额返还已消耗的技能点
・作为补偿，向全体玩家发放80个洗点道具
・对于给您带来的不便，我们深表歉意`,

  ko: `LootDive ver 2.1.0 업데이트 정보

■ 신규 엔드 콘텐츠 'UberUber 마왕'
・모든 Uber 및 UberUber 보스를 격파한 자 앞에만 나타나는 차원을 초월한 마왕
・엄청난 재생력을 지녀 어설픈 화력으로는 상처 하나 낼 수 없습니다

■ 신규 제작 요소 '각인'
・레어 장비에 원하는 MOD를 하나 확정으로 새길 수 있는 신규 시스템
・장비당 1개까지. MOD 칸이 비어 있으면 추가, 가득 찼다면 교체할 MOD를 선택합니다
・'적중 시 회복', '회피율', '회복→ATK 변환' 등 일반 드롭으로는 붙지 않는 MOD도 각인으로 부여할 수 있습니다
・각인은 종말의 땅 이후의 던전에서 드롭됩니다 (보스 격파 시 확정 획득)
・홈 화면 하단의 '각인'에서 제작할 수 있습니다

■ 패시브 트리 오류 수정 및 사과 말씀
・전제 조건을 무시하고 리스펙(반환)이 가능해 트리가 분단되는 문제를 수정했습니다
・영향을 받은 캐릭터는 패시브 트리를 초기화하고, 소비한 스킬 포인트를 전액 반환해 드립니다
・사과의 뜻으로 모든 플레이어에게 리스펙 토큰 80개를 배포합니다
・불편을 드려 대단히 죄송합니다`,

  "es-ES": `LootDive ver 2.1.0 Notas de la actualización

[Nuevo contenido final: UberUber Señor Demonio]
• Un señor demonio más allá de las dimensiones, que solo aparece ante quienes han derrotado a todos los jefes Uber y UberUber
• Su monstruosa regeneración resiste todo salvo la potencia de fuego más devastadora

[Nueva fabricación: Grabado]
• Graba un mod elegido en un objeto raro, de forma garantizada
• Uno por objeto. Se añade a una ranura libre, o eliges qué mod reemplazar si están todas ocupadas
• Mods que nunca aparecen en el botín normal —como HP al golpear, Evasión % y Regen. a ATK— pueden añadirse mediante Grabado
• Los grabados caen en mazmorras a partir de la Tierra del Final (garantizados al derrotar jefes)
• Fabrica desde «Grabado» en la parte inferior de la pantalla de inicio

[Corrección del Árbol de Pasivas y disculpa]
• Se corrigió un error que permitía devolver nodos ignorando sus requisitos, dejando el árbol desconectado
• Los personajes afectados han visto reiniciado su árbol de pasivas, con todos los puntos de habilidad devueltos íntegramente
• Como disculpa, se han otorgado 80 Fichas de Reespecialización a todos los jugadores
• Lamentamos sinceramente las molestias`,

  "es-MX": `LootDive ver 2.1.0 Notas de la actualización

[Nuevo contenido final: UberUber Señor Demonio]
• Un señor demonio más allá de las dimensiones, que solo aparece ante quienes han derrotado a todos los jefes Uber y UberUber
• Su monstruosa regeneración resiste todo salvo la potencia de fuego más devastadora

[Nueva fabricación: Grabado]
• Graba un mod elegido en un objeto raro, de forma garantizada
• Uno por objeto. Se añade a una ranura libre, o eliges qué mod reemplazar si están todas ocupadas
• Mods que nunca aparecen en el botín normal —como HP al golpear, Evasión % y Regen. a ATK— pueden añadirse mediante Grabado
• Los grabados caen en mazmorras a partir de la Tierra del Final (garantizados al derrotar jefes)
• Fabrica desde «Grabado» en la parte inferior de la pantalla de inicio

[Corrección del Árbol de Pasivas y disculpa]
• Se corrigió un error que permitía devolver nodos ignorando sus requisitos, dejando el árbol desconectado
• Los personajes afectados han visto reiniciado su árbol de pasivas, con todos los puntos de habilidad devueltos íntegramente
• Como disculpa, se han otorgado 80 Fichas de Reespecialización a todos los jugadores
• Lamentamos sinceramente las molestias`,

  "fr-FR": `LootDive ver 2.1.0 Notes de mise à jour

[Nouveau contenu de fin de jeu : UberUber Seigneur Démon]
• Un seigneur démon au-delà des dimensions, qui n'apparaît que devant ceux ayant vaincu tous les boss Uber et UberUber
• Sa régénération monstrueuse résiste à tout, sauf à la plus écrasante puissance de feu

[Nouvel artisanat : Gravure]
• Gravez un mod de votre choix sur un objet rare, de façon garantie
• Un seul par objet. Ajouté à un emplacement libre, ou vous choisissez le mod à remplacer si tout est occupé
• Des mods qui n'apparaissent jamais sur le butin normal — PV par coup, Esquive %, Régén. vers ATQ — peuvent être ajoutés par Gravure
• Les gravures tombent dans les donjons à partir de la Terre des fins (garanties sur les boss)
• Fabriquez depuis « Gravure » en bas de l'écran d'accueil

[Correctif de l'Arbre de passifs et excuses]
• Correction d'un bug permettant de rembourser des nœuds en ignorant leurs prérequis, laissant l'arbre déconnecté
• Les personnages concernés ont vu leur arbre de passifs réinitialisé, tous les points de compétence dépensés étant intégralement remboursés
• En guise d'excuses, 80 Jetons de Réattribution ont été offerts à tous les joueurs
• Nous vous prions de nous excuser pour la gêne occasionnée`,

  "de-DE": `LootDive ver 2.1.0 Update-Infos

[Neuer Endgame-Inhalt: UberUber Dämonenherrscher]
• Ein Dämonenherrscher jenseits der Dimensionen, der nur vor jenen erscheint, die alle Uber- und UberUber-Bosse bezwungen haben
• Seine monströse Regeneration trotzt allem außer der gewaltigsten Feuerkraft

[Neues Handwerk: Gravur]
• Graviert garantiert einen gewählten Mod auf einen seltenen Gegenstand
• Einer pro Gegenstand. Wird auf einen freien Platz gesetzt, oder du wählst den zu ersetzenden Mod, wenn alle belegt sind
• Mods, die bei normaler Beute nie erscheinen – etwa LP bei Treffer, Ausweichen % und Regen. zu ANG – lassen sich per Gravur hinzufügen
• Gravuren fallen in Dungeons ab dem Land der Enden (garantiert bei Bossen)
• Herstellung über „Gravur" unten im Startbildschirm

[Behebung im Passivbaum und Entschuldigung]
• Ein Fehler wurde behoben, durch den Knoten unter Missachtung ihrer Voraussetzungen zurückgegeben werden konnten und der Baum unzusammenhängend blieb
• Betroffene Charaktere haben ihren Passivbaum zurückgesetzt bekommen, alle ausgegebenen Skillpunkte wurden vollständig erstattet
• Als Entschuldigung erhalten alle Spieler 80 Umskillungs-Marken
• Wir entschuldigen uns aufrichtig für die Unannehmlichkeiten`,
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
