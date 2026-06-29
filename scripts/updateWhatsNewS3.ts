/**
 * v2.0.0（審査準備中）の「このバージョンの最新情報」を全ロケールに設定。
 * 用語は locales/*.json のゲーム内用語に合わせて翻訳済み。
 *
 *   # 計画表示（送信しない）
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/updateWhatsNewS3.ts
 *   # 実際に設定
 *   ... tsx scripts/updateWhatsNewS3.ts --execute
 */
import { apiRequest, config } from './appStoreConnect';

const ja = `ルートダイブ ver2.0.0「シーズン3」アップデート情報

■ ペット（ミニモンスター）システム
・モンスター撃破時に低確率でペットがドロップする新コレクション要素（通常0.5%／ボス3%）
・ペットは固有バフを付与（ATK／DEF／最大HP／クリティカル率／ライフスティール／フリーズ上限など）
・重複ペットで段階強化（最大Lv6で基礎値2倍）、不要な重複は破棄可能
・戦闘画面でプレイヤーの足元に表示、図鑑で収集状況を確認

■ 新プレイアブルクラス「テイマー」
・ペットに特化した新クラス（初期HP100／ATK10／DEF4）
・固有能力：ペット入手率+0.5%・ペット効果2倍
・キャラクター作成画面を刷新し、各クラスの初期ステータス・固有能力を表示

■ パッシブツリーの全面刷新
・スキルツリーを円形メッシュ構造に全面リニューアル（251ノード規模）
・クラスごとに専用スタート地点を導入、得意系統へ伸ばしやすく
・キーストーン（強力ノード）は前提12〜15ノードの奥地に配置

■ シーズン3スタート
・ランキングをリセットして新シーズン開始（次元回廊ランキング・記録がシーズン別に）
・キャラクター選択画面にシーズンバッジ（S2／S3）を表示

■ 防御システムの拡張
・ブロック・シールド・回避（Evasion）を新たに追加`;

const en = `LootDive ver 2.0.0 "Season 3" Update

■ Pet (Mini-Monster) System
- A new collection feature: defeating monsters has a low chance to drop a Pet (0.5% normal / 3% bosses)
- Pets grant unique buffs (ATK / DEF / Max HP / Crit Chance / Lifesteal / Freeze Chance Cap, and more)
- Power them up with duplicates (up to Lv6 for 2x base stats); unwanted duplicates can be discarded
- Pets appear at your character's feet in battle; check your collection progress in the encyclopedia

■ New Playable Class: Tamer
- A new class specialized in Pets (starting HP 100 / ATK 10 / DEF 4)
- Class ability: Pet Drop Rate +0.5%, Pet Effect x2
- The character creation screen has been redesigned to show each class's starting stats and class ability

■ Complete Passive Tree Overhaul
- The skill tree has been fully reworked into a circular mesh structure (around 251 nodes)
- Each class now has its own dedicated starting point, making it easier to grow toward its strengths
- Keystones (powerful nodes) are placed deep behind 12-15 prerequisite nodes

■ Season 3 Begins
- Rankings have been reset to start the new season (Dimensional Corridor rankings and records are now tracked per season)
- Season badges (S2 / S3) are now shown on the character select screen

■ Expanded Defense System
- Added Block, Shield, and Evasion`;

const zh = `LootDive ver 2.0.0「第三赛季」更新内容

■ 宠物（迷你怪物）系统
- 全新收集要素：击败怪物时有低概率掉落宠物（普通0.5%／Boss 3%）
- 宠物提供专属增益（ATK／DEF／最大HP／暴击几率／生命偷取／冻结几率上限等）
- 通过重复宠物进行阶段强化（最高Lv6时基础值翻倍），多余的重复宠物可丢弃
- 战斗画面中显示在角色脚边，可在图鉴中查看收集进度

■ 全新可选职业「驯兽师」
- 专精宠物的全新职业（初始HP100／ATK10／DEF4）
- 专属能力：宠物入手率+0.5%、宠物效果2倍
- 全面革新角色创建画面，显示各职业的初始属性与专属能力

■ 天赋树全面重做
- 技能树全面革新为环形网状结构（约251个节点）
- 为每个职业引入专属起点，更易向擅长的方向发展
- 关键节点（强力节点）配置在需12～15个前置节点的深处

■ 第三赛季开启
- 重置排行榜，开启新赛季（次元回廊排行榜与记录改为按赛季区分）
- 角色选择画面显示赛季徽章（S2／S3）

■ 防御系统扩展
- 新增格挡、护盾、闪避（Evasion）`;

const ko = `LootDive ver 2.0.0 '시즌 3' 업데이트 안내

■ 펫(미니 몬스터) 시스템
- 몬스터 처치 시 낮은 확률로 펫이 드롭되는 새로운 수집 요소(일반 0.5% / 보스 3%)
- 펫은 고유 버프를 부여(ATK / DEF / 최대 HP / 치명타 확률 / 생명력 흡수 / 동결 확률 상한 등)
- 중복 펫으로 단계 강화(최대 Lv6에서 기본치 2배), 불필요한 중복은 분해 가능
- 전투 화면에서 캐릭터 발밑에 표시되며, 도감에서 수집 현황을 확인

■ 새로운 플레이 가능 클래스 '테이머'
- 펫에 특화된 새 클래스(초기 HP100 / ATK10 / DEF4)
- 고유 능력: 펫 입수율 +0.5%, 펫 효과 2배
- 캐릭터 생성 화면을 개편하여 각 클래스의 초기 스탯과 고유 능력을 표시

■ 패시브 트리 전면 개편
- 스킬 트리를 원형 메시 구조로 전면 리뉴얼(약 251개 노드 규모)
- 클래스별 전용 시작 지점을 도입하여 특화 계열로 뻗어 나가기 쉽게 개선
- 키스톤(강력 노드)은 선행 12~15개 노드 너머 깊은 곳에 배치

■ 시즌 3 시작
- 랭킹을 초기화하고 새 시즌 시작(차원 회랑 랭킹과 기록이 시즌별로 구분)
- 캐릭터 선택 화면에 시즌 배지(S2 / S3) 표시

■ 방어 시스템 확장
- 블록·실드·회피(Evasion) 신규 추가`;

const es = `LootDive ver 2.0.0: actualización «Temporada 3»

■ Sistema de Mascotas (mini-monstruos)
- Nuevo elemento de colección: al derrotar monstruos hay una baja probabilidad de conseguir una Mascota (0,5 % normal / 3 % jefes)
- Las Mascotas otorgan bonificaciones únicas (ATK / DEF / HP Máx / Prob. Crítico / Robo de Vida / Límite de Congelación, etc.)
- Mejóralas con duplicados (hasta Lv6 para duplicar los valores base); los duplicados que no necesites se pueden descartar
- Aparecen a los pies de tu personaje en combate; consulta tu progreso en el álbum

■ Nueva clase jugable: «Domador»
- Una nueva clase especializada en Mascotas (inicial HP100 / ATK10 / DEF4)
- Habilidad de clase: prob. de obtener Mascotas +0,5 %, efecto de Mascotas x2
- Se ha rediseñado la pantalla de creación de personaje para mostrar las estadísticas iniciales y la habilidad de cada clase

■ Renovación total del árbol de habilidades
- El árbol de habilidades se ha rehecho por completo con una estructura de malla circular (unos 251 nodos)
- Cada clase tiene ahora su propio punto de inicio, lo que facilita avanzar hacia sus puntos fuertes
- Los nodos clave (nodos poderosos) se sitúan en lo más profundo, tras 12-15 nodos previos

■ Comienza la Temporada 3
- Se han reiniciado las clasificaciones para empezar la nueva temporada (las clasificaciones y récords del Corredor Dimensional ahora son por temporada)
- Las insignias de temporada (S2 / S3) se muestran en la pantalla de selección de personaje

■ Sistema de defensa ampliado
- Se han añadido Bloqueo, Escudo y Evasión`;

const fr = `LootDive ver 2.0.0 : mise à jour « Saison 3 »

■ Système de Familiers (mini-monstres)
- Nouvel élément de collection : vaincre des monstres offre une faible chance d'obtenir un Familier (0,5 % normal / 3 % boss)
- Les Familiers confèrent des bonus uniques (ATK / DEF / PV Max / Chance Critique / Vol de Vie / Limite de Gel, etc.)
- Renforcez-les avec les doublons (jusqu'au niv. 6 pour doubler les valeurs de base) ; les doublons inutiles peuvent être jetés
- Ils apparaissent aux pieds de votre personnage en combat ; suivez votre progression dans l'encyclopédie

■ Nouvelle classe jouable : « Dresseur »
- Une nouvelle classe spécialisée dans les Familiers (départ PV100 / ATK10 / DEF4)
- Capacité de classe : taux d'obtention de Familiers +0,5 %, effet des Familiers x2
- L'écran de création de personnage a été repensé pour afficher les statistiques de départ et la capacité de chaque classe

■ Refonte complète de l'arbre de compétences
- L'arbre de compétences a été entièrement repensé en une structure en maillage circulaire (environ 251 nœuds)
- Chaque classe dispose désormais de son propre point de départ, ce qui facilite l'évolution vers ses points forts
- Les nœuds-clés (nœuds puissants) sont placés au plus profond, derrière 12 à 15 nœuds prérequis

■ Début de la Saison 3
- Les classements ont été réinitialisés pour lancer la nouvelle saison (les classements et records du Couloir dimensionnel sont désormais par saison)
- Les badges de saison (S2 / S3) s'affichent sur l'écran de sélection de personnage

■ Système de défense étendu
- Ajout du Blocage, du Bouclier et de l'Esquive (Evasion)`;

const de = `LootDive ver 2.0.0 – „Season 3"-Update

■ Haustier-System (Mini-Monster)
- Neues Sammelelement: Beim Besiegen von Monstern besteht eine geringe Chance, ein Haustier zu erhalten (0,5 % normal / 3 % Bosse)
- Haustiere gewähren einzigartige Boni (ATK / DEF / Max. HP / Krit-Chance / Lebensraub / Frier-Limit usw.)
- Verstärke sie mit Duplikaten (bis Lv6 für doppelte Basiswerte); nicht benötigte Duplikate können entsorgt werden
- Sie erscheinen im Kampf zu Füßen deines Charakters; verfolge deinen Sammelfortschritt im Kompendium

■ Neue spielbare Klasse „Zähmer"
- Eine neue, auf Haustiere spezialisierte Klasse (Start HP100 / ATK10 / DEF4)
- Klassenfähigkeit: Haustier-Droprate +0,5 %, Haustier-Effekt x2
- Der Charaktererstellungs-Bildschirm wurde überarbeitet und zeigt nun die Startwerte und Klassenfähigkeit jeder Klasse

■ Komplette Überarbeitung des Fähigkeitenbaums
- Der Fähigkeitenbaum wurde vollständig zu einer kreisförmigen Netzstruktur umgebaut (rund 251 Knoten)
- Jede Klasse hat nun ihren eigenen Startpunkt, was den Ausbau ihrer Stärken erleichtert
- Keystones (starke Knoten) liegen tief hinter 12-15 vorausgesetzten Knoten

■ Season 3 beginnt
- Die Ranglisten wurden für die neue Season zurückgesetzt (Ranglisten und Rekorde des Dimensionskorridors sind nun pro Season)
- Season-Abzeichen (S2 / S3) werden im Charakterauswahl-Bildschirm angezeigt

■ Erweitertes Verteidigungssystem
- Block, Schild und Ausweichen (Evasion) hinzugefügt`;

const whatsNewByLocale: Record<string, string> = {
  ja,
  'en-US': en,
  'en-GB': en,
  'en-AU': en,
  'en-CA': en,
  'zh-Hans': zh,
  ko,
  'es-ES': es,
  'es-MX': es,
  'fr-FR': fr,
  'de-DE': de,
};

interface VersionsResp {
  data: Array<{ id: string; attributes: { versionString: string; appStoreState: string } }>;
}
interface LocsResp {
  data: Array<{ id: string; attributes: { locale: string; whatsNew: string | null } }>;
}

async function main() {
  const execute = process.argv.includes('--execute');

  const versions = await apiRequest<VersionsResp>(`/apps/${config.appId}/appStoreVersions?limit=10`);
  const v2 = versions.data.find((v) => v.attributes.versionString === '2.0.0');
  if (!v2) throw new Error('v2.0.0 が見つかりません');
  if (v2.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    throw new Error(`v2.0.0 が編集可能状態ではありません: ${v2.attributes.appStoreState}`);
  }

  const locs = await apiRequest<LocsResp>(
    `/appStoreVersions/${v2.id}/appStoreVersionLocalizations?limit=50`
  );

  console.log(`\nモード: ${execute ? '🔴 設定' : '🟢 計画表示(dry-run)'}  v2.0.0 ロケール: ${locs.data.length}\n`);

  for (const loc of locs.data) {
    const locale = loc.attributes.locale;
    const text = whatsNewByLocale[locale];
    if (!text) {
      console.log(`⚠  ${locale}: 翻訳未定義のためスキップ`);
      continue;
    }
    if (text.length > 4000) {
      console.log(`⚠  ${locale}: ${text.length}文字（4000超）スキップ`);
      continue;
    }
    console.log(`--- ${locale} (${text.length}文字) ---`);
    if (!execute) continue;
    await apiRequest(`/appStoreVersionLocalizations/${loc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: text } },
      }),
    });
    console.log('  ✅ 設定完了');
  }
  console.log(execute ? '\n✅ 完了' : '\n（--execute で設定）');
}

main().catch((e) => {
  console.error('\n❌ エラー:', e);
  process.exit(1);
});
