/**
 * v2.1.0（審査準備中）の promotionalText を全ロケールに設定。
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/updatePromoV2.ts            # dry-run
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/updatePromoV2.ts --execute  # 設定
 */
import { apiRequest, config } from './appStoreConnect';

const ja = `新エンドコンテンツ「UberUber魔王」降臨！時間とともに際限なく激化する“滅びの刻限”に挑め。狙ったMODを確定で刻む新クラフト「刻印」も実装、レア装備に新たな活路。最強ビルドで次元を超えた魔王を討て！`;
const en = `New endgame boss: UberUber Demon Lord! Face the Hour of Ruin, escalating endlessly. New crafting "Engraving" adds a mod you choose, guaranteed. Forge your ultimate build!`;
const zh = `新终局内容「UberUber魔王」降临！挑战随时间无止境激化的「灭亡之刻」。新制作系统「刻印」登场，确定刻入你想要的MOD，为稀有装备开辟新路。以最强build讨伐魔王！`;
const ko = `신규 엔드 콘텐츠 'UberUber 마왕' 강림! 시간이 갈수록 끝없이 격화되는 '멸망의 시각'에 도전하라. 원하는 MOD를 확정으로 새기는 신규 제작 '각인'도 구현. 최강 빌드로 마왕을 토벌하라!`;
const es = `¡Nuevo jefe final: UberUber Señor Demonio! Afronta la Hora de la Ruina, que crece sin fin. Nuevo Grabado: añade el mod que elijas. ¡Forja tu build definitiva!`;
const fr = `Nouveau boss final : UberUber Seigneur Démon ! Affrontez l'Heure de la Ruine, sans fin croissante. Nouvelle Gravure : ajoutez le mod de votre choix !`;
const de = `Neuer Endboss: UberUber Dämonenherrscher! Trotze der endlos eskalierenden Stunde des Untergangs. Neue Gravur: Füge einen Mod deiner Wahl hinzu!`;

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
  const v2 = versions.data.find((v) => v.attributes.versionString === '2.1.0');
  if (!v2) throw new Error('v2.1.0 が見つかりません');
  if (v2.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    throw new Error(`v2.1.0 が編集可能状態ではありません: ${v2.attributes.appStoreState}`);
  }
  const locs = await apiRequest<LocsResp>(
    `/appStoreVersions/${v2.id}/appStoreVersionLocalizations?limit=50`
  );
  console.log(`\nモード: ${execute ? '🔴 設定' : '🟢 dry-run'}  v2.1.0 ロケール: ${locs.data.length}\n`);

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
