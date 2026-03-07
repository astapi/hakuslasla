/**
 * App Store Connect に新しい言語のローカライゼーションを追加
 *
 * 使用例:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/addLocalizations.ts
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

// API リクエスト (POST)
async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const token = await generateToken();
  const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
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
    description: string | null;
    keywords: string | null;
    whatsNew: string | null;
    promotionalText: string | null;
    marketingUrl: string | null;
    supportUrl: string | null;
  };
}

interface LocalizationsResponse<T> {
  data: T[];
}

interface VersionsResponse {
  data: AppStoreVersion[];
}

interface AppInfoResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      appStoreState: string;
    };
  }>;
}

// 各言語のローカライゼーションデータ
interface LocaleData {
  locale: string;
  name: string;
  subtitle: string;
  description: string;
  keywords: string;
}

// 追加する言語のデータ
const newLocales: LocaleData[] = [
  {
    locale: 'zh-Hans',
    name: '简体中文',
    subtitle: '自动战斗×构筑系统',
    description: `一款采用「准备与判断」玩法的刷宝Roguelike自动战斗RPG！
你的角色在地下城中自动进行战斗。作为玩家，你的职责是装备掉落的战利品、解锁并分配技能点、构建角色的Build。

【自动战斗系统】
采用类似ATB的行动槽机制。玩家与敌人拥有各自的行动槽，满槽即可发动攻击。角色会自动进行战斗，你需要通过装备、技能和被动天赋来打造最强Build！

【丰富的Build构建】
- 毒系Build：利用毒伤叠加和吸血效果持续造成高额伤害
- 暴击Build：追求高暴击率与暴击伤害的爆发型路线
- 防御Build：凭借高血量与减伤能力打造持久战型角色
- 吸血Build：平衡攻防，以吸血效果实现稳定续航
- 回复Build：依靠HP回复持续作战
- 速度Build：通过极速攻击压制敌人
- 点燃Build：利用灼烧持续伤害击败敌人

【多样的被动技能树】
超过100个被动节点可供选择！
每个节点都能强化你的Build，探索属于你的最优路线。选择错误？使用重置道具即可重新规划！

【装备MOD系统】
掉落的装备带有随机MOD效果。
探索各种MOD组合，打造你的专属Build！

【Boss特殊技能】
每个Boss都拥有独特的技能体系。
部分技能会在HP降至50%以下时追加发动。
请针对性地调整装备与被动天赋！

【挑战性更强的Uber内容】
首次击败Boss后，将解锁该Boss的Uber难度模式。
Uber Boss拥有大幅强化的技能效果——挑战你的极限Build！

【次元回廊（无限地下城）】
层数无限、敌人不断强化的挑战模式。
挑战你的Build能走多远！

本游戏无体力系统，无抽卡系统。
适合热爱「装备/技能搭配×挑战强敌」的玩家！`,
    keywords: '放置,刷宝,Roguelike,自动战斗,RPG,地下城,Build,被动天赋,毒,暴击',
  },
  {
    locale: 'zh-Hant',
    name: '繁體中文',
    subtitle: '自動戰鬥×構築系統',
    description: `一款採用「準備與判斷」玩法的刷寶Roguelike自動戰鬥RPG！
你的角色在地下城中自動進行戰鬥。作為玩家，你的職責是裝備掉落的戰利品、解鎖並分配技能點、構建角色的Build。

【自動戰鬥系統】
採用類似ATB的行動槽機制。玩家與敵人擁有各自的行動槽，滿槽即可發動攻擊。角色會自動進行戰鬥，你需要通過裝備、技能和被動天賦來打造最強Build！

【豐富的Build構建】
- 毒系Build：利用毒傷疊加和吸血效果持續造成高額傷害
- 暴擊Build：追求高暴擊率與暴擊傷害的爆發型路線
- 防禦Build：憑藉高血量與減傷能力打造持久戰型角色
- 吸血Build：平衡攻防，以吸血效果實現穩定續航
- 回復Build：依靠HP回復持續作戰
- 速度Build：通過極速攻擊壓制敵人
- 點燃Build：利用灼燒持續傷害擊敗敵人

【多樣的被動技能樹】
超過100個被動節點可供選擇！
每個節點都能強化你的Build，探索屬於你的最優路線。選擇錯誤？使用重置道具即可重新規劃！

【裝備MOD系統】
掉落的裝備帶有隨機MOD效果。
探索各種MOD組合，打造你的專屬Build！

【Boss特殊技能】
每個Boss都擁有獨特的技能體系。
部分技能會在HP降至50%以下時追加發動。
請針對性地調整裝備與被動天賦！

【挑戰性更強的Uber內容】
首次擊敗Boss後，將解鎖該Boss的Uber難度模式。
Uber Boss擁有大幅強化的技能效果——挑戰你的極限Build！

【次元迴廊（無限地下城）】
層數無限、敵人不斷強化的挑戰模式。
挑戰你的Build能走多遠！

本遊戲無體力系統，無抽卡系統。
適合熱愛「裝備/技能搭配×挑戰強敵」的玩家！`,
    keywords: '放置,刷寶,Roguelike,自動戰鬥,RPG,地下城,Build,被動天賦,毒,暴擊',
  },
  {
    locale: 'ko',
    name: '한국어',
    subtitle: '자동 전투 × 빌드 구축',
    description: `「준비와 판단」이 플레이의 전부인 핵앤슬래시 로그라이크 자동 전투 RPG!
캐릭터는 던전에서 자동으로 전투합니다. 플레이어는 드롭된 장비를 장착하고, 스킬 포인트를 배분하며, 자신만의 빌드를 구축하세요.

【자동 전투 시스템】
ATB 게이지 방식의 전투! 플레이어와 적 모두 개별 행동 게이지를 가지고 있으며, 게이지가 차면 공격합니다. 장비, 스킬, 패시브 트리로 최강의 빌드를 만드세요!

【다양한 빌드 구축】
- 독 빌드: 독 데미지 중첩과 흡혈로 고데미지 달성
- 크리티컬 빌드: 높은 크리율과 크리 데미지로 폭발적인 딜링
- 방어 빌드: 높은 HP와 데미지 감소로 탱킹 특화
- 흡혈 빌드: 공수 밸런스와 흡혈로 안정적인 지속 플레이
- 회복 빌드: HP 재생으로 장기전 가능
- 속도 빌드: 빠른 공격 속도로 적을 압도
- 점화 빌드: 화염 지속 데미지로 적을 처치

【방대한 패시브 트리】
100개 이상의 패시브 노드!
노드를 조합해 나만의 빌드를 완성하세요. 잘못 찍었다면 리스펙 아이템으로 초기화 가능!

【장비 MOD 시스템】
드롭 장비에는 랜덤 MOD가 붙어있습니다.
MOD 조합을 탐구해 최적의 빌드를 찾아보세요!

【보스 전용 스킬】
각 보스는 고유한 스킬을 가지고 있습니다.
일부 스킬은 HP 50% 이하에서 추가 발동!
장비와 패시브를 조정해 대응하세요!

【Uber 엔드게임 콘텐츠】
보스 첫 클리어 시 Uber 버전이 해금됩니다.
Uber 보스는 대폭 강화된 스킬을 사용 — 빌드의 한계에 도전하세요!

【차원 회랑 (무한 던전)】
층수 무제한, 적이 계속 강해지는 도전 모드.
당신의 빌드가 어디까지 갈 수 있는지 시험해보세요!

스태미나 시스템 없음. 가챠 시스템 없음.
「장비/스킬 조합 × 강적 격파」를 즐기는 분께 추천!`,
    keywords: '방치형,핵슬,로그라이크,자동전투,RPG,던전,빌드,패시브,독,크리티컬',
  },
  {
    locale: 'es-ES',
    name: 'Español (España)',
    subtitle: 'Batallas Auto × Builds',
    description: `¡Un RPG de combate automático roguelike donde "Preparación y Juicio" son todo!
Tu personaje lucha automáticamente en mazmorras. Como jugador, equipas el botín, desbloqueas habilidades, asignas puntos y construyes tu build.

【Sistema de Combate Automático】
¡Combate estilo barra ATB! Jugador y enemigo tienen sus propios medidores; atacan cuando están llenos. ¡Crea el mejor build con equipo, habilidades y árbol pasivo!

【Construcción de Builds Variada】
- Build Veneno: Alto daño con acumulación de veneno y robo de vida
- Build Crítico: Daño explosivo con alta probabilidad y multiplicador crítico
- Build Defensa: Tanque con alto HP y reducción de daño
- Build Vampiro: Balance ofensa-defensa con robo de vida constante
- Build Regeneración: Combate sostenido con regeneración de HP
- Build Velocidad: Abruma enemigos con ataques rápidos
- Build Ignición: Derrota enemigos con daño de quemadura

【Extenso Árbol Pasivo】
¡Más de 100 nodos pasivos!
Combina nodos para crear tu build único. ¿Te equivocaste? ¡Usa items de respec!

【Sistema de MODs de Equipo】
El equipo viene con MODs aleatorios.
¡Explora combinaciones de MODs para optimizar tu build!

【Habilidades de Jefe】
Cada jefe tiene habilidades únicas.
¡Algunas se activan cuando su HP baja del 50%!
¡Ajusta equipo y pasivos para contrarrestar!

【Contenido Endgame Uber】
Al derrotar un jefe, se desbloquea su versión Uber.
Los jefes Uber tienen habilidades muy mejoradas — ¡pon a prueba tu build!

【Corredor Dimensional (Mazmorra Infinita)】
Modo desafío con pisos infinitos y enemigos que se fortalecen.
¡Descubre hasta dónde puede llegar tu build!

Sin sistema de energía. Sin gacha.
¡Recomendado para fans de "Builds × Derrotar enemigos poderosos"!`,
    keywords: 'idle,loot,roguelike,auto,RPG,mazmorra,build,pasivo,veneno,crítico',
  },
  {
    locale: 'es-MX',
    name: 'Español (México)',
    subtitle: 'Batallas Auto × Builds',
    description: `¡Un RPG de combate automático roguelike donde "Preparación y Juicio" son todo!
Tu personaje lucha automáticamente en mazmorras. Como jugador, equipas el botín, desbloqueas habilidades, asignas puntos y construyes tu build.

【Sistema de Combate Automático】
¡Combate estilo barra ATB! Jugador y enemigo tienen sus propios medidores; atacan cuando están llenos. ¡Crea el mejor build con equipo, habilidades y árbol pasivo!

【Construcción de Builds Variada】
- Build Veneno: Alto daño con acumulación de veneno y robo de vida
- Build Crítico: Daño explosivo con alta probabilidad y multiplicador crítico
- Build Defensa: Tanque con alto HP y reducción de daño
- Build Vampiro: Balance ofensa-defensa con robo de vida constante
- Build Regeneración: Combate sostenido con regeneración de HP
- Build Velocidad: Abruma enemigos con ataques rápidos
- Build Ignición: Derrota enemigos con daño de quemadura

【Extenso Árbol Pasivo】
¡Más de 100 nodos pasivos!
Combina nodos para crear tu build único. ¿Te equivocaste? ¡Usa items de respec!

【Sistema de MODs de Equipo】
El equipo viene con MODs aleatorios.
¡Explora combinaciones de MODs para optimizar tu build!

【Habilidades de Jefe】
Cada jefe tiene habilidades únicas.
¡Algunas se activan cuando su HP baja del 50%!
¡Ajusta equipo y pasivos para contrarrestar!

【Contenido Endgame Uber】
Al derrotar un jefe, se desbloquea su versión Uber.
Los jefes Uber tienen habilidades muy mejoradas — ¡pon a prueba tu build!

【Corredor Dimensional (Mazmorra Infinita)】
Modo desafío con pisos infinitos y enemigos que se fortalecen.
¡Descubre hasta dónde puede llegar tu build!

Sin sistema de energía. Sin gacha.
¡Recomendado para fans de "Builds × Derrotar enemigos poderosos"!`,
    keywords: 'idle,loot,roguelike,auto,RPG,mazmorra,build,pasivo,veneno,crítico',
  },
  {
    locale: 'fr-FR',
    name: 'Français',
    subtitle: 'Combat Auto × Build',
    description: `Un RPG roguelike à combat automatique où "Préparation et Jugement" sont essentiels !
Votre personnage combat automatiquement dans les donjons. En tant que joueur, vous équipez le butin, débloquez des compétences, attribuez des points et construisez votre build.

【Système de Combat Automatique】
Combat style jauge ATB ! Joueur et ennemi ont leurs propres jauges ; ils attaquent une fois pleines. Créez le meilleur build avec équipement, compétences et arbre passif !

【Construction de Builds Variée】
- Build Poison : Hauts dégâts avec accumulation de poison et vol de vie
- Build Critique : Dégâts explosifs avec haute chance et multiplicateur critique
- Build Défense : Tank avec HP élevé et réduction de dégâts
- Build Vampire : Équilibre offense-défense avec vol de vie constant
- Build Régénération : Combat soutenu avec régénération de HP
- Build Vitesse : Submerge les ennemis avec des attaques rapides
- Build Ignition : Vainc les ennemis avec des dégâts de brûlure

【Arbre Passif Étendu】
Plus de 100 nœuds passifs !
Combinez les nœuds pour créer votre build unique. Erreur ? Utilisez des items de respec !

【Système de MODs d'Équipement】
L'équipement a des MODs aléatoires.
Explorez les combinaisons de MODs pour optimiser votre build !

【Compétences de Boss】
Chaque boss a des compétences uniques.
Certaines s'activent quand ses HP passent sous 50% !
Ajustez équipement et passifs pour contrer !

【Contenu Endgame Uber】
Battre un boss débloque sa version Uber.
Les boss Uber ont des compétences améliorées — testez votre build !

【Couloir Dimensionnel (Donjon Infini)】
Mode défi avec étages infinis et ennemis qui se renforcent.
Découvrez jusqu'où votre build peut aller !

Pas de système d'énergie. Pas de gacha.
Recommandé pour les fans de "Builds × Vaincre des ennemis puissants" !`,
    keywords: 'idle,loot,roguelike,auto,RPG,donjon,build,passif,poison,critique',
  },
  {
    locale: 'de-DE',
    name: 'Deutsch',
    subtitle: 'Auto-Kampf × Build',
    description: `Ein Roguelike-Auto-Kampf-RPG, wo "Vorbereitung und Urteil" alles sind!
Dein Charakter kämpft automatisch in Dungeons. Als Spieler rüstest du Beute aus, schaltest Fähigkeiten frei, verteilst Punkte und baust deinen Build.

【Auto-Kampf-System】
ATB-Leisten-Kampf! Spieler und Feind haben eigene Leisten; Angriff bei vollem Stand. Erstelle den besten Build mit Ausrüstung, Fähigkeiten und Passiv-Baum!

【Vielfältiger Build-Aufbau】
- Gift-Build: Hoher Schaden durch Gift-Stapelung und Lebensraub
- Krit-Build: Explosiver Schaden mit hoher Krit-Chance und Multiplikator
- Verteidigung-Build: Tank mit hohen HP und Schadensreduktion
- Vampir-Build: Ausgewogene Offensive-Defensive mit konstantem Lebensraub
- Regeneration-Build: Ausdauernder Kampf mit HP-Regeneration
- Geschwindigkeit-Build: Überwältige Feinde mit schnellen Angriffen
- Entzündung-Build: Besiege Feinde mit Brandschaden

【Umfangreicher Passiv-Baum】
Über 100 passive Knoten!
Kombiniere Knoten für deinen einzigartigen Build. Fehler gemacht? Nutze Respec-Items!

【Ausrüstungs-MOD-System】
Ausrüstung hat zufällige MODs.
Erkunde MOD-Kombinationen für optimale Builds!

【Boss-Fähigkeiten】
Jeder Boss hat einzigartige Fähigkeiten.
Einige aktivieren sich unter 50% HP!
Passe Ausrüstung und Passive an!

【Uber-Endgame-Inhalt】
Boss-Sieg schaltet Uber-Version frei.
Uber-Bosse haben verstärkte Fähigkeiten — teste deinen Build!

【Dimensional-Korridor (Unendlicher Dungeon)】
Herausforderungsmodus mit unendlichen Etagen und stärkeren Feinden.
Entdecke, wie weit dein Build kommt!

Kein Energie-System. Keine Gacha.
Empfohlen für Fans von "Builds × Starke Feinde besiegen"!`,
    keywords: 'idle,loot,roguelike,auto,RPG,dungeon,build,passiv,gift,kritisch',
  },
];

// メイン処理
async function main() {
  console.log('🌐 App Store Connect ローカライゼーション追加\n');

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

  // 2. 既存のローカライゼーションを取得
  console.log('📝 既存のローカライゼーションを確認中...');
  const existingLocalizations = await apiGet<
    LocalizationsResponse<AppStoreVersionLocalization>
  >(`/appStoreVersions/${prepareForSubmission.id}/appStoreVersionLocalizations`);

  const existingLocales = existingLocalizations.data.map(
    (l) => l.attributes.locale
  );
  console.log(`   既存: ${existingLocales.join(', ')}\n`);

  // 3. App Info IDを取得
  console.log('📱 App Info IDを取得中...');
  const appInfos = await apiGet<AppInfoResponse>(
    `/apps/${config.appId}/appInfos`
  );
  const appInfoId = appInfos.data[0]?.id;
  console.log(`   App Info ID: ${appInfoId}\n`);

  // 4. 新しいローカライゼーションを追加
  console.log('🔄 新しいローカライゼーションを追加中...\n');

  for (const localeData of newLocales) {
    if (existingLocales.includes(localeData.locale)) {
      console.log(`   ⏭️  ${localeData.locale}: 既に存在するためスキップ`);
      continue;
    }

    try {
      // バージョンローカライゼーションを追加
      console.log(`   📝 ${localeData.locale} (${localeData.name}):`);

      await apiPost('/appStoreVersionLocalizations', {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: localeData.locale,
            description: localeData.description,
            keywords: localeData.keywords,
          },
          relationships: {
            appStoreVersion: {
              data: {
                type: 'appStoreVersions',
                id: prepareForSubmission.id,
              },
            },
          },
        },
      });
      console.log(`      ✅ バージョンローカライゼーション追加完了`);

      // App Infoローカライゼーションを追加
      if (appInfoId) {
        await apiPost('/appInfoLocalizations', {
          data: {
            type: 'appInfoLocalizations',
            attributes: {
              locale: localeData.locale,
              name: 'LootDive',
              subtitle: localeData.subtitle,
            },
            relationships: {
              appInfo: {
                data: {
                  type: 'appInfos',
                  id: appInfoId,
                },
              },
            },
          },
        });
        console.log(`      ✅ App Infoローカライゼーション追加完了`);
      }
    } catch (error) {
      console.log(`      ❌ エラー: ${error}`);
    }
  }

  console.log('\n✅ 処理完了！');
}

main().catch((error) => {
  console.error('\n❌ エラー:', error);
  process.exit(1);
});
