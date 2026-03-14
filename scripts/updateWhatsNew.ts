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
  ja: `【新規MOD】
・「HP回復変換」: 毎秒HP回復量の一定%をATKに加算
・「乱軍の王」: HP30%以下で1度だけ発動し、攻撃速度+20%・攻撃時HP回復+300を得る
・「発火ダメージ吸収」: 発火ダメージの一定割合をHPとして回復

【新規ユニーク装備】
・双撃の指輪: クリティカル追撃（クリティカル時に追加攻撃）
・Uber 双撃の指輪: クリ率+30%、クリティカル追撃、HIT時HP回復+80、攻撃速度+15%

【ユニーク装備のMOD変更】
・失われた魔導書: 発火確率+50%、毒確率+50%、DEF+40に変更
・チャンピオンアクス: 攻撃速度-20%、クリ率+30%、ATK+60、HP+100に変更
・竜の心臓: HP回復+100、HP回復+10%、HP回復変換50%に変更
・マグマコア: 発火確率+60%、発火ダメージ+50%、発火ダメージ吸収10%に変更

【Uber装備のMOD変更】
・Uber 終焉の刃: ATK増加+30%に変更
・クラーケンの触腕: ATK+30、DEF+35、HP回復+50、HP回復+2%に変更
・Uber クラーケンの触腕: HP回復+120、HP回復+5%、HP+210、DEF+50に変更
・Uber クラーケンの遊泳: 攻撃速度-20%、HP回復+5%、DEF+80、HP+250に変更
・Uber クラーケンの眼: 毒ダメージ+50%、毒ダメージ軽減+5、HP+220、毒ダメージ5% moreに変更
・Uber ゴブリンの篭手: 乱軍の王、HP+200、ATK+80、ATK増加+20%に変更

【改善】
・図鑑でユニーク装備のMOD効果が表示されるようになりました
・攻撃速度に最低値0.1を保証

【不具合修正】
・図鑑でボスと同一モンスターが通常枠に重複表示されるバグを修正`,

  'en-US': `[New Mods]
• "HP Regen Conversion": Adds a percentage of HP regen per second to ATK
• "Warlord's Enrage": Triggers once below 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[New Unique Items]
• Double Strike Ring: Critical Follow-up Attack (additional attack on critical hit)
• Uber Double Strike Ring: Crit Rate +30%, Critical Follow-up Attack, HP on Hit +80, Attack Speed +15%

[Unique Item MOD Changes]
• Lost Grimoire: Changed to Ignite Chance +50%, Poison Chance +50%, DEF +40
• Champion Axe: Changed to Attack Speed -20%, Crit Rate +30%, ATK +60, HP +100
• Dragon Heart: Changed to HP Regen +100, HP Regen +10%, HP Regen Conversion 50%
• Magma Core: Changed to Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal 10%

[Uber Item MOD Changes]
• Uber End Blade: Changed to ATK Increased +30%
• Kraken Tentacle: Changed to ATK +30, DEF +35, HP Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to HP Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Kraken Fin: Changed to Attack Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%

[Improvements]
• Encyclopedia now displays MOD effects for unique items
• Attack speed now has a minimum floor of 0.1

[Bug Fixes]
• Fixed boss monsters appearing as duplicates in the normal monster list in the encyclopedia`,

  'en-GB': `[New Mods]
• "HP Regen Conversion": Adds a percentage of HP regen per second to ATK
• "Warlord's Enrage": Triggers once below 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[New Unique Items]
• Double Strike Ring: Critical Follow-up Attack (additional attack on critical hit)
• Uber Double Strike Ring: Crit Rate +30%, Critical Follow-up Attack, HP on Hit +80, Attack Speed +15%

[Unique Item MOD Changes]
• Lost Grimoire: Changed to Ignite Chance +50%, Poison Chance +50%, DEF +40
• Champion Axe: Changed to Attack Speed -20%, Crit Rate +30%, ATK +60, HP +100
• Dragon Heart: Changed to HP Regen +100, HP Regen +10%, HP Regen Conversion 50%
• Magma Core: Changed to Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal 10%

[Uber Item MOD Changes]
• Uber End Blade: Changed to ATK Increased +30%
• Kraken Tentacle: Changed to ATK +30, DEF +35, HP Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to HP Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Kraken Fin: Changed to Attack Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%

[Improvements]
• Encyclopedia now displays MOD effects for unique items
• Attack speed now has a minimum floor of 0.1

[Bug Fixes]
• Fixed boss monsters appearing as duplicates in the normal monster list in the encyclopedia`,

  'en-AU': `[New Mods]
• "HP Regen Conversion": Adds a percentage of HP regen per second to ATK
• "Warlord's Enrage": Triggers once below 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[New Unique Items]
• Double Strike Ring: Critical Follow-up Attack (additional attack on critical hit)
• Uber Double Strike Ring: Crit Rate +30%, Critical Follow-up Attack, HP on Hit +80, Attack Speed +15%

[Unique Item MOD Changes]
• Lost Grimoire: Changed to Ignite Chance +50%, Poison Chance +50%, DEF +40
• Champion Axe: Changed to Attack Speed -20%, Crit Rate +30%, ATK +60, HP +100
• Dragon Heart: Changed to HP Regen +100, HP Regen +10%, HP Regen Conversion 50%
• Magma Core: Changed to Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal 10%

[Uber Item MOD Changes]
• Uber End Blade: Changed to ATK Increased +30%
• Kraken Tentacle: Changed to ATK +30, DEF +35, HP Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to HP Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Kraken Fin: Changed to Attack Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%

[Improvements]
• Encyclopedia now displays MOD effects for unique items
• Attack speed now has a minimum floor of 0.1

[Bug Fixes]
• Fixed boss monsters appearing as duplicates in the normal monster list in the encyclopedia`,

  'en-CA': `[New Mods]
• "HP Regen Conversion": Adds a percentage of HP regen per second to ATK
• "Warlord's Enrage": Triggers once below 30% HP, granting +20% attack speed and +300 HP on hit
• "Ignite Lifesteal": Recover a percentage of ignite damage as HP

[New Unique Items]
• Double Strike Ring: Critical Follow-up Attack (additional attack on critical hit)
• Uber Double Strike Ring: Crit Rate +30%, Critical Follow-up Attack, HP on Hit +80, Attack Speed +15%

[Unique Item MOD Changes]
• Lost Grimoire: Changed to Ignite Chance +50%, Poison Chance +50%, DEF +40
• Champion Axe: Changed to Attack Speed -20%, Crit Rate +30%, ATK +60, HP +100
• Dragon Heart: Changed to HP Regen +100, HP Regen +10%, HP Regen Conversion 50%
• Magma Core: Changed to Ignite Chance +60%, Ignite DMG +50%, Ignite Lifesteal 10%

[Uber Item MOD Changes]
• Uber End Blade: Changed to ATK Increased +30%
• Kraken Tentacle: Changed to ATK +30, DEF +35, HP Regen +50, HP Regen +2%
• Uber Kraken Tentacle: Changed to HP Regen +120, HP Regen +5%, HP +210, DEF +50
• Uber Kraken Fin: Changed to Attack Speed -20%, HP Regen +5%, DEF +80, HP +250
• Uber Kraken Eye: Changed to Poison DMG +50%, Poison Reduction +5, HP +220, Poison DMG 5% more
• Uber Goblin Grip: Changed to Warlord's Enrage, HP +200, ATK +80, ATK Increased +20%

[Improvements]
• Encyclopedia now displays MOD effects for unique items
• Attack speed now has a minimum floor of 0.1

[Bug Fixes]
• Fixed boss monsters appearing as duplicates in the normal monster list in the encyclopedia`,

  'zh-Hans': `【新MOD】
• 「回复转换」: 将每秒HP回复量的一定比例加算到ATK
• 「战神之怒」: HP低于30%时触发一次，获得攻击速度+20%和命中回复HP+300
• 「点燃伤害吸收」: 将点燃伤害的一定比例转化为HP回复

【新唯一装备】
• 连击戒指: 暴击追击（暴击时追加攻击）
• Uber 连击戒指: 暴击率+30%、暴击追击、命中回复HP+80、攻击速度+15%

【唯一装备MOD变更】
• 失落魔典: 改为点燃概率+50%、中毒概率+50%、DEF+40
• 冠军之斧: 改为攻击速度-20%、暴击率+30%、ATK+60、HP+100
• 龙之心: 改为HP回复+100、HP回复+10%、回复转换50%
• 熔岩核心: 改为点燃概率+60%、点燃伤害+50%、点燃吸收10%

【Uber装备MOD变更】
• Uber 终焉之刃: 改为ATK增加+30%
• 海妖触手: 改为ATK+30、DEF+35、HP回复+50、HP回复+2%
• Uber 海妖触手: 改为HP回复+120、HP回复+5%、HP+210、DEF+50
• Uber 海妖之鳍: 改为攻击速度-20%、HP回复+5%、DEF+80、HP+250
• Uber 海妖之眼: 改为毒伤害+50%、毒伤害减免+5、HP+220、毒伤害5% more
• Uber 哥布林握套: 改为战神之怒、HP+200、ATK+80、ATK增加+20%

【改善】
• 图鉴现已显示唯一装备的MOD效果
• 攻击速度增加最低值0.1的保障

【问题修复】
• 修复图鉴中Boss与普通怪物重复显示的问题`,

  ko: `[새 MOD]
• "회복 전환": 초당 HP 회복량의 일정 비율을 ATK에 가산
• "전쟁군주": HP 30% 이하에서 1회 발동, 공격 속도 +20% 및 적중 시 HP 회복 +300 획득
• "점화 피해 흡수": 점화 피해의 일정 비율을 HP로 회복

[새 유니크 장비]
• 이중 타격 반지: 크리티컬 추격 (크리티컬 시 추가 공격)
• Uber 이중 타격 반지: 크리티컬률 +30%, 크리티컬 추격, 적중 시 HP 회복 +80, 공격 속도 +15%

[유니크 장비 MOD 변경]
• 잃어버린 마도서: 점화 확률 +50%, 독 확률 +50%, DEF +40으로 변경
• 챔피언 도끼: 공격 속도 -20%, 크리티컬률 +30%, ATK +60, HP +100으로 변경
• 용의 심장: HP 회복 +100, HP 회복 +10%, 회복 전환 50%로 변경
• 마그마 핵: 점화 확률 +60%, 점화 피해 +50%, 점화 흡수 10%로 변경

[Uber 장비 MOD 변경]
• Uber 종말의 블레이드: ATK 증가 +30%로 변경
• 크라켄 촉수: ATK +30, DEF +35, HP 회복 +50, HP 회복 +2%로 변경
• Uber 크라켄 촉수: HP 회복 +120, HP 회복 +5%, HP +210, DEF +50으로 변경
• Uber 크라켄 지느러미: 공격 속도 -20%, HP 회복 +5%, DEF +80, HP +250으로 변경
• Uber 크라켄 눈: 독 피해 +50%, 독 피해 감소 +5, HP +220, 독 피해 5% more로 변경
• Uber 고블린 그립: 전쟁군주, HP +200, ATK +80, ATK 증가 +20%로 변경

[개선]
• 도감에서 유니크 장비의 MOD 효과가 표시됩니다
• 공격 속도에 최소값 0.1 보장 추가

[버그 수정]
• 도감에서 보스와 일반 몬스터가 중복 표시되는 문제 수정`,

  'es-ES': `[Nuevos Mods]
• "Conversión de Regeneración": Añade un porcentaje de la regeneración de HP por segundo al ATK
• "Furia del Señor de la Guerra": Se activa una vez por debajo del 30% de HP, otorgando +20% de velocidad de ataque y +300 de HP al golpear
• "Robo de vida por ignición": Recupera un porcentaje del daño de ignición como HP

[Nuevo equipamiento único]
• Anillo de Golpe Doble: Ataque de seguimiento crítico (ataque adicional en golpe crítico)
• Uber Anillo de Golpe Doble: Prob. crítica +30%, Ataque de seguimiento crítico, HP al golpear +80, Vel. ataque +15%

[Cambios de MOD en equipamiento único]
• Grimorio Perdido: Cambiado a Prob. ignición +50%, Prob. veneno +50%, DEF +40
• Hacha del Campeón: Cambiado a Vel. ataque -20%, Prob. crítica +30%, ATK +60, HP +100
• Corazón de Dragón: Cambiado a Regen HP +100, Regen HP +10%, Conversión de regen 50%
• Núcleo de Magma: Cambiado a Prob. ignición +60%, Daño ignición +50%, Robo ignición 10%

[Cambios de MOD en equipamiento Uber]
• Uber Espada del Final: Cambiado a ATK Aumentado +30%
• Tentáculo de Kraken: Cambiado a ATK +30, DEF +35, Regen HP +50, Regen HP +2%
• Uber Tentáculo de Kraken: Cambiado a Regen HP +120, Regen HP +5%, HP +210, DEF +50
• Uber Aleta de Kraken: Cambiado a Vel. ataque -20%, Regen HP +5%, DEF +80, HP +250
• Uber Ojo de Kraken: Cambiado a Daño veneno +50%, Reducción veneno +5, HP +220, Daño veneno 5% more
• Uber Agarre Goblin: Cambiado a Furia del Señor de la Guerra, HP +200, ATK +80, ATK Aumentado +20%

[Mejoras]
• La enciclopedia ahora muestra los efectos de MOD del equipamiento único
• La velocidad de ataque ahora tiene un valor mínimo de 0.1

[Corrección de errores]
• Corregido que los monstruos jefe aparecían duplicados en la lista normal de la enciclopedia`,

  'es-MX': `[Nuevos Mods]
• "Conversión de Regeneración": Añade un porcentaje de la regeneración de HP por segundo al ATK
• "Furia del Señor de la Guerra": Se activa una vez por debajo del 30% de HP, otorgando +20% de velocidad de ataque y +300 de HP al golpear
• "Robo de vida por ignición": Recupera un porcentaje del daño de ignición como HP

[Nuevo equipamiento único]
• Anillo de Golpe Doble: Ataque de seguimiento crítico (ataque adicional en golpe crítico)
• Uber Anillo de Golpe Doble: Prob. crítica +30%, Ataque de seguimiento crítico, HP al golpear +80, Vel. ataque +15%

[Cambios de MOD en equipamiento único]
• Grimorio Perdido: Cambiado a Prob. ignición +50%, Prob. veneno +50%, DEF +40
• Hacha del Campeón: Cambiado a Vel. ataque -20%, Prob. crítica +30%, ATK +60, HP +100
• Corazón de Dragón: Cambiado a Regen HP +100, Regen HP +10%, Conversión de regen 50%
• Núcleo de Magma: Cambiado a Prob. ignición +60%, Daño ignición +50%, Robo ignición 10%

[Cambios de MOD en equipamiento Uber]
• Uber Espada del Final: Cambiado a ATK Aumentado +30%
• Tentáculo de Kraken: Cambiado a ATK +30, DEF +35, Regen HP +50, Regen HP +2%
• Uber Tentáculo de Kraken: Cambiado a Regen HP +120, Regen HP +5%, HP +210, DEF +50
• Uber Aleta de Kraken: Cambiado a Vel. ataque -20%, Regen HP +5%, DEF +80, HP +250
• Uber Ojo de Kraken: Cambiado a Daño veneno +50%, Reducción veneno +5, HP +220, Daño veneno 5% more
• Uber Agarre Goblin: Cambiado a Furia del Señor de la Guerra, HP +200, ATK +80, ATK Aumentado +20%

[Mejoras]
• La enciclopedia ahora muestra los efectos de MOD del equipamiento único
• La velocidad de ataque ahora tiene un valor mínimo de 0.1

[Corrección de errores]
• Corregido que los monstruos jefe aparecían duplicados en la lista normal de la enciclopedia`,

  'fr-FR': `[Nouveaux Mods]
• « Conversion de régénération » : Ajoute un pourcentage de la régénération HP par seconde à l'ATK
• « Rage du Seigneur de Guerre » : Se déclenche une fois sous 30% de HP, accordant +20% de vitesse d'attaque et +300 HP par coup
• « Vol de vie par embrasement » : Récupère un pourcentage des dégâts d'embrasement en HP

[Nouvel équipement unique]
• Anneau de double frappe : Attaque de suivi critique (attaque supplémentaire sur coup critique)
• Uber Anneau de double frappe : Taux crit. +30%, Attaque de suivi critique, HP par coup +80, Vitesse d'attaque +15%

[Modifications de MOD d'équipement unique]
• Grimoire perdu : Modifié en Chance embrasement +50%, Chance poison +50%, DEF +40
• Hache du champion : Modifié en Vitesse d'attaque -20%, Taux crit. +30%, ATK +60, HP +100
• Cœur de dragon : Modifié en Regen HP +100, Regen HP +10%, Conversion regen 50%
• Noyau de magma : Modifié en Chance embrasement +60%, Dégâts embrasement +50%, Vol embrasement 10%

[Modifications de MOD d'équipement Uber]
• Uber Lame de la fin : Modifié en ATK Augmenté +30%
• Tentacule de Kraken : Modifié en ATK +30, DEF +35, Regen HP +50, Regen HP +2%
• Uber Tentacule de Kraken : Modifié en Regen HP +120, Regen HP +5%, HP +210, DEF +50
• Uber Nageoire du Kraken : Modifié en Vitesse d'attaque -20%, Regen HP +5%, DEF +80, HP +250
• Uber Œil du Kraken : Modifié en Dégâts poison +50%, Réduction poison +5, HP +220, Dégâts poison 5% more
• Uber Poigne gobeline : Modifié en Rage du Seigneur de Guerre, HP +200, ATK +80, ATK Augmenté +20%

[Améliorations]
• L'encyclopédie affiche désormais les effets de MOD des équipements uniques
• La vitesse d'attaque a maintenant un minimum de 0.1

[Corrections de bugs]
• Correction des monstres boss apparaissant en double dans la liste normale de l'encyclopédie`,

  'de-DE': `[Neue Mods]
• "Regenerationsumwandlung": Addiert einen Prozentsatz der HP-Regeneration pro Sekunde zum ATK
• "Zorn des Kriegsherrn": Wird einmalig unter 30% HP ausgeloest und gewaehrt +20% Angriffsgeschwindigkeit und +300 HP bei Treffer
• "Entzuendungs-Lebensraub": Stellt einen Prozentsatz des Entzuendungsschadens als HP wieder her

[Neue einzigartige Ausruestung]
• Doppelschlag-Ring: Kritischer Folgeangriff (zusaetzlicher Angriff bei kritischem Treffer)
• Uber Doppelschlag-Ring: Krit-Rate +30%, Kritischer Folgeangriff, HP bei Treffer +80, Angriffsgeschwindigkeit +15%

[MOD-Aenderungen an einzigartiger Ausruestung]
• Verlorenes Grimoire: Geaendert zu Entzuendungschance +50%, Giftchance +50%, DEF +40
• Champion-Axt: Geaendert zu Angriffsgeschwindigkeit -20%, Krit-Rate +30%, ATK +60, HP +100
• Drachenherz: Geaendert zu HP-Regen +100, HP-Regen +10%, Regen-Umwandlung 50%
• Magmakern: Geaendert zu Entzuendungschance +60%, Entzuendungsschaden +50%, Entzuendungs-Lebensraub 10%

[MOD-Aenderungen an Uber-Ausruestung]
• Uber Endzeit-Klinge: Geaendert zu ATK Erhoeht +30%
• Kraken-Tentakel: Geaendert zu ATK +30, DEF +35, HP-Regen +50, HP-Regen +2%
• Uber Kraken-Tentakel: Geaendert zu HP-Regen +120, HP-Regen +5%, HP +210, DEF +50
• Uber Kraken-Flosse: Geaendert zu Angriffsgeschwindigkeit -20%, HP-Regen +5%, DEF +80, HP +250
• Uber Kraken-Auge: Geaendert zu Giftschaden +50%, Giftreduktion +5, HP +220, Giftschaden 5% more
• Uber Goblin-Griff: Geaendert zu Zorn des Kriegsherrn, HP +200, ATK +80, ATK Erhoeht +20%

[Verbesserungen]
• Enzyklopaedie zeigt jetzt MOD-Effekte fuer einzigartige Ausruestung an
• Angriffsgeschwindigkeit hat jetzt einen Mindestwert von 0.1

[Fehlerbehebungen]
• Behebung der doppelten Anzeige von Bossmonsters in der normalen Monsterliste der Enzyklopaedie`,
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
