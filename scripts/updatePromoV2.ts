/**
 * v2.0.0（審査準備中）の promotionalText を全ロケールに設定。
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/updatePromoV2.ts            # dry-run
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/updatePromoV2.ts --execute  # 設定
 */
import { apiRequest, config } from './appStoreConnect';

const ja = '大型アプデ「シーズン3」開幕！新クラス「テイマー」とペット（ミニモンスター）システム登場！パッシブツリーも全面刷新し、ブロック・シールド・回避を追加。完全オートバトルで仲間を集め、最強ビルドを構築せよ';
const en = 'Major update—Season 3 begins! New class "Tamer" & a Pet (mini-monster) system arrive! Passive Tree fully reworked. Auto-battle, gather pets and craft your ultimate build!';
const zh = '大型更新「第三赛季」开幕！新职业「驯兽师」与宠物（迷你怪物）系统登场！天赋树全面重做，新增格挡、护盾、闪避。完全自动战斗，收集宠物，打造最强build！';
const ko = "대형 업데이트 '시즌 3' 개막! 새 클래스 '테이머'와 펫(미니 몬스터) 시스템 등장! 패시브 트리도 전면 개편, 블록·실드·회피 추가. 완전 자동 전투로 펫을 모아 최강 빌드를 완성하라!";
const es = '¡Actualización: empieza la Temporada 3! Nueva clase «Domador» y sistema de Mascotas (mini-monstruos). Árbol renovado. ¡Reúne mascotas y crea tu build en combate auto!';
const fr = 'Grosse mise à jour : la Saison 3 commence ! Nouvelle classe « Dresseur » et système de Familiers (mini-monstres). Arbre refondu. Combat auto, collectionnez et optimisez !';
const de = 'Großes Update: Season 3 startet! Neue Klasse „Zähmer" & Haustier-System (Mini-Monster)! Fähigkeitenbaum komplett neu. Auto-Kampf: Haustiere sammeln, Build optimieren!';

const promoByLocale: Record<string, string> = {
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
  data: Array<{ id: string; attributes: { locale: string } }>;
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
  console.log(`\nモード: ${execute ? '🔴 設定' : '🟢 dry-run'}  v2.0.0 ロケール: ${locs.data.length}\n`);

  for (const loc of locs.data) {
    const locale = loc.attributes.locale;
    const text = promoByLocale[locale];
    if (!text) {
      console.log(`⚠️  ${locale}: 翻訳未定義スキップ`);
      continue;
    }
    if ([...text].length > 170) {
      console.log(`⚠️  ${locale}: ${[...text].length}文字（170超）スキップ`);
      continue;
    }
    console.log(`--- ${locale} (${[...text].length}文字) ---`);
    if (!execute) continue;
    await apiRequest(`/appStoreVersionLocalizations/${loc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { promotionalText: text } },
      }),
    });
    console.log('  ✅ 設定完了');
  }
  console.log(execute ? '\n✅ 完了' : '\n（--execute で設定）');
}
main().catch((e) => { console.error('\n❌ エラー:', e); process.exit(1); });
