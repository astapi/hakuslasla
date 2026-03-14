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
  ja: `【バランス調整 - 新MOD】
・「乱軍の王」: HP30%以下で1度だけ発動し、攻撃速度+20%・攻撃時HP回復+300を得る
・「発火ダメージ吸収」: 発火ダメージの一定割合をHPとして回復する

【バランス調整 - ユニーク装備変更】
・マグマコア: 発火特化に変更（発火確率+60%、発火ダメージ+50%、発火吸収+10%）
・クラーケンの触腕: ATK+30、DEF+35、HP回復+50、HP回復+2%に変更
・Uber クラーケンの触腕: HP回復+120、HP回復+5%、HP+210、DEF+50に変更
・Uber ゴブリンの篭手: 乱軍の王、HP+200、ATK+80、ATK増加+20%に変更
・Uber クラーケンの遊泳: 攻撃速度-20%、HP回復+5%、DEF+80、HP+250に変更
・Uber クラーケンの眼: 毒ダメージ+50%、毒ダメージ軽減+5、HP+220、毒ダメージ5% moreに変更
・Uber 終焉の刃: 5秒毎ATK増加+10%、ATK増加+30%、攻撃速度+20%、HP+280に変更

【改善】
・図鑑でユニーク装備のMOD効果が表示されるようになりました

【不具合修正】
・図鑑詳細画面で不要なヘッダーが表示される問題を修正`,

  'en-US': `[Balance - New Mods]
• "Warlord's Enrage": Triggers once at 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[Balance - Unique Item Changes]
• Magma Core: Reworked to ignite-focused (Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal +10%)
• Kraken Tentacle: Changed to ATK +30, DEF +35, Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%
• Uber Kraken Fin: Changed to Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber End Blade: Changed to ATK Inc +10%/5s, ATK Increased +30%, Speed +20%, HP +280

[Improvements]
• Encyclopedia now displays mod effects for unique items

[Bug Fixes]
• Fixed an unnecessary header on the encyclopedia detail screen`,

  'en-GB': `[Balance - New Mods]
• "Warlord's Enrage": Triggers once at 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[Balance - Unique Item Changes]
• Magma Core: Reworked to ignite-focused (Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal +10%)
• Kraken Tentacle: Changed to ATK +30, DEF +35, Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%
• Uber Kraken Fin: Changed to Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber End Blade: Changed to ATK Inc +10%/5s, ATK Increased +30%, Speed +20%, HP +280

[Improvements]
• Encyclopedia now displays mod effects for unique items

[Bug Fixes]
• Fixed an unnecessary header on the encyclopedia detail screen`,

  'en-AU': `[Balance - New Mods]
• "Warlord's Enrage": Triggers once at 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[Balance - Unique Item Changes]
• Magma Core: Reworked to ignite-focused (Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal +10%)
• Kraken Tentacle: Changed to ATK +30, DEF +35, Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%
• Uber Kraken Fin: Changed to Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber End Blade: Changed to ATK Inc +10%/5s, ATK Increased +30%, Speed +20%, HP +280

[Improvements]
• Encyclopedia now displays mod effects for unique items

[Bug Fixes]
• Fixed an unnecessary header on the encyclopedia detail screen`,

  'en-CA': `[Balance - New Mods]
• "Warlord's Enrage": Triggers once at 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[Balance - Unique Item Changes]
• Magma Core: Reworked to ignite-focused (Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal +10%)
• Kraken Tentacle: Changed to ATK +30, DEF +35, Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%
• Uber Kraken Fin: Changed to Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber End Blade: Changed to ATK Inc +10%/5s, ATK Increased +30%, Speed +20%, HP +280

[Improvements]
• Encyclopedia now displays mod effects for unique items

[Bug Fixes]
• Fixed an unnecessary header on the encyclopedia detail screen`,

  'zh-Hans': `【平衡调整 - 新MOD】
• 「乱军之王」: HP低于30%时触发一次，获得攻击速度+20%和命中回复HP+300
• 「点燃伤害吸收」: 将点燃伤害的一定比例转化为HP回复

【平衡调整 - 唯一装备变更】
• 熔岩核心: 改为点燃特化（点燃概率+60%、点燃伤害+50%、点燃吸收+10%）
• 海妖触腕: 改为ATK+30、DEF+35、HP回复+50、HP回复+2%
• Uber 海妖触腕: 改为HP回复+120、HP回复+5%、HP+210、DEF+50
• Uber 哥布林护手: 改为乱军之王、HP+200、ATK+80、ATK增加+20%
• Uber 海妖之鳍: 改为攻击速度-20%、HP回复+5%、DEF+80、HP+250
• Uber 海妖之眼: 改为毒伤害+50%、毒伤害减免+5、HP+220、毒伤害5% more
• Uber 终焉之刃: 改为每5秒ATK增加+10%、ATK增加+30%、攻击速度+20%、HP+280

【改善】
• 图鉴现已显示唯一装备的MOD效果

【问题修复】
• 修复图鉴详情画面显示多余标题的问题`,

  ko: `[밸런스 - 새 MOD]
• "난군의 왕": HP 30% 이하에서 1회 발동, 공격 속도 +20% 및 공격 시 HP 회복 +300 획득
• "점화 피해 흡수": 점화 피해의 일정 비율을 HP로 회복

[밸런스 - 유니크 장비 변경]
• 마그마 코어: 점화 특화로 변경 (점화 확률 +60%, 점화 피해 +50%, 점화 흡수 +10%)
• 크라켄 촉완: ATK +30, DEF +35, HP 회복 +50, HP 회복 +2%로 변경
• Uber 크라켄 촉완: HP 회복 +120, HP 회복 +5%, HP +210, DEF +50으로 변경
• Uber 고블린 그립: 난군의 왕, HP +200, ATK +80, ATK 증가 +20%로 변경
• Uber 크라켄 핀: 공격 속도 -20%, HP 회복 +5%, DEF +80, HP +250으로 변경
• Uber 크라켄 아이: 독 피해 +50%, 독 피해 감소 +5, HP +220, 독 피해 5% more로 변경
• Uber 종언의 칼날: 5초당 ATK 증가 +10%, ATK 증가 +30%, 공격 속도 +20%, HP +280으로 변경

[개선]
• 도감에서 유니크 장비의 MOD 효과가 표시됩니다

[버그 수정]
• 도감 상세 화면에서 불필요한 헤더가 표시되는 문제 수정`,

  'es-ES': `[Balance - Nuevos Mods]
• "Furia del Señor de la Guerra": Se activa una vez al 30% de HP, otorgando +20% de velocidad de ataque y +300 de recuperación de HP al golpear
• "Robo de vida por ignición": Recupera un porcentaje del daño de ignición como HP

[Balance - Cambios en equipamiento único]
• Núcleo de Magma: Rediseñado con enfoque en ignición (Prob. ignición +60%, Daño ignición +50%, Robo ignición +10%)
• Tentáculo de Kraken: Cambiado a ATK +30, DEF +35, Regeneración +50, Regen HP +2%
• Uber Tentáculo de Kraken: Cambiado a Regeneración +120, Regen HP +5%, HP +210, DEF +50
• Uber Garra de Goblin: Cambiado a Furia del Señor de la Guerra, HP +200, ATK +80, ATK Aumentado +20%
• Uber Aleta de Kraken: Cambiado a Velocidad -20%, Regen HP +5%, DEF +80, HP +250
• Uber Ojo de Kraken: Cambiado a Daño veneno +50%, Reducción veneno +5, HP +220, Daño veneno 5% more
• Uber Hoja del Fin: Cambiado a ATK Inc +10%/5s, ATK Aumentado +30%, Velocidad +20%, HP +280

[Mejoras]
• La enciclopedia ahora muestra los efectos de MOD del equipamiento único

[Corrección de errores]
• Corregido un encabezado innecesario en la pantalla de detalle de la enciclopedia`,

  'es-MX': `[Balance - Nuevos Mods]
• "Furia del Señor de la Guerra": Se activa una vez al 30% de HP, otorgando +20% de velocidad de ataque y +300 de recuperación de HP al golpear
• "Robo de vida por ignición": Recupera un porcentaje del daño de ignición como HP

[Balance - Cambios en equipamiento único]
• Núcleo de Magma: Rediseñado con enfoque en ignición (Prob. ignición +60%, Daño ignición +50%, Robo ignición +10%)
• Tentáculo de Kraken: Cambiado a ATK +30, DEF +35, Regeneración +50, Regen HP +2%
• Uber Tentáculo de Kraken: Cambiado a Regeneración +120, Regen HP +5%, HP +210, DEF +50
• Uber Garra de Goblin: Cambiado a Furia del Señor de la Guerra, HP +200, ATK +80, ATK Aumentado +20%
• Uber Aleta de Kraken: Cambiado a Velocidad -20%, Regen HP +5%, DEF +80, HP +250
• Uber Ojo de Kraken: Cambiado a Daño veneno +50%, Reducción veneno +5, HP +220, Daño veneno 5% more
• Uber Hoja del Fin: Cambiado a ATK Inc +10%/5s, ATK Aumentado +30%, Velocidad +20%, HP +280

[Mejoras]
• La enciclopedia ahora muestra los efectos de MOD del equipamiento único

[Corrección de errores]
• Corregido un encabezado innecesario en la pantalla de detalle de la enciclopedia`,

  'fr-FR': `[Équilibre - Nouveaux Mods]
• « Rage du Seigneur de Guerre » : Se déclenche une fois à 30% de HP, accordant +20% de vitesse d'attaque et +300 de récupération de HP par coup
• « Vol de vie par embrasement » : Récupère un pourcentage des dégâts d'embrasement en HP

[Équilibre - Modifications d'équipement unique]
• Cœur de Magma : Refondu en spécialisation embrasement (Chance embrasement +60%, Dégâts embrasement +50%, Vol embrasement +10%)
• Tentacule de Kraken : Modifié en ATK +30, DEF +35, Régénération +50, Regen HP +2%
• Uber Tentacule de Kraken : Modifié en Régénération +120, Regen HP +5%, HP +210, DEF +50
• Uber Poigne de Gobelin : Modifié en Rage du Seigneur de Guerre, HP +200, ATK +80, ATK Augmenté +20%
• Uber Nageoire de Kraken : Modifié en Vitesse -20%, Regen HP +5%, DEF +80, HP +250
• Uber Œil de Kraken : Modifié en Dégâts poison +50%, Réduction poison +5, HP +220, Dégâts poison 5% more
• Uber Lame de la Fin : Modifié en ATK Inc +10%/5s, ATK Augmenté +30%, Vitesse +20%, HP +280

[Améliorations]
• L'encyclopédie affiche désormais les effets de MOD des équipements uniques

[Corrections de bugs]
• Correction d'un en-tête inutile sur l'écran de détail de l'encyclopédie`,

  'de-DE': `[Balance - Neue Mods]
• "Zorn des Kriegsherrn": Wird einmalig bei 30% HP ausgeloest und gewaehrt +20% Angriffsgeschwindigkeit und +300 HP-Heilung bei Treffer
• "Entzuendungs-Lebensraub": Stellt einen Prozentsatz des Entzuendungsschadens als HP wieder her

[Balance - Aenderungen an einzigartiger Ausruestung]
• Magmakern: Auf Entzuendung spezialisiert (Entzuendungschance +60%, Entzuendungsschaden +50%, Entzuendungs-Lebensraub +10%)
• Krakententakel: Geaendert zu ATK +30, DEF +35, Regeneration +50, HP-Regen +2%
• Uber Krakententakel: Geaendert zu Regeneration +120, HP-Regen +5%, HP +210, DEF +50
• Uber Goblin-Griff: Geaendert zu Zorn des Kriegsherrn, HP +200, ATK +80, ATK Erhoeht +20%
• Uber Krakenflosse: Geaendert zu Geschwindigkeit -20%, HP-Regen +5%, DEF +80, HP +250
• Uber Krakenauge: Geaendert zu Giftschaden +50%, Giftreduktion +5, HP +220, Giftschaden 5% more
• Uber Endklinge: Geaendert zu ATK Erh. +10%/5s, ATK Erhoeht +30%, Geschwindigkeit +20%, HP +280

[Verbesserungen]
• Enzyklopaedie zeigt jetzt MOD-Effekte fuer einzigartige Ausruestung an

[Fehlerbehebungen]
• Unnoetige Kopfzeile auf dem Enzyklopaedie-Detailbildschirm behoben`,
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
