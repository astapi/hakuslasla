/**
 * スペイン語（スペイン・メキシコ）ローカライゼーション一括更新
 *
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateEsLocales.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const LOCALES = ['es-ES', 'es-MX'];

const NEW_NAME = 'Loot Dive: Hack&Slash Mazmorra';
const NEW_SUBTITLE = 'Idle Looter RPG × Build Craft';
const NEW_KEYWORDS =
  'Roguelike,Botín,Combate,Equipo,Infinito,Offline,Tesoro,Jefe,Aventura,Fantasía,Armas,Solo,Skill,Auto';

interface AppInfoLocalizationsResponse {
  data: Array<{
    id: string;
    attributes: { locale: string; name: string; subtitle: string | null };
  }>;
}

interface VersionLocalizationsResponse {
  data: Array<{
    id: string;
    attributes: { locale: string; keywords: string | null };
  }>;
}

async function main() {
  console.log(`\n🇪🇸 スペイン語メタデータ一括更新 (${LOCALES.join(', ')})\n`);
  console.log(`  タイトル: ${NEW_NAME} (${NEW_NAME.length}文字)`);
  console.log(`  サブタイトル: ${NEW_SUBTITLE} (${NEW_SUBTITLE.length}文字)`);
  console.log(`  キーワード: ${NEW_KEYWORDS}`);
  console.log(`  キーワード文字数: ${NEW_KEYWORDS.length}/100\n`);

  try {
    validateConfig();

    const appInfosRes = await apiRequest<{
      data: Array<{ id: string; attributes: { appStoreState: string } }>;
    }>(`/apps/${config.appId}/appInfos`);
    const editableInfo = appInfosRes.data.find(
      (d) => d.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const appInfoId = editableInfo!.id;

    const localizations = await apiRequest<AppInfoLocalizationsResponse>(
      `/appInfos/${appInfoId}/appInfoLocalizations`
    );

    const versions = await getAppStoreVersions();
    const editableVersion = versions.data.find(
      (v) => v.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const versionId = editableVersion!.id;

    const versionLocalizations =
      await apiRequest<VersionLocalizationsResponse>(
        `/appStoreVersions/${versionId}/appStoreVersionLocalizations`
      );

    for (const locale of LOCALES) {
      console.log(`--- ${locale} ---`);

      const info = localizations.data.find(
        (l) => l.attributes.locale === locale
      );
      if (info) {
        await apiRequest(`/appInfoLocalizations/${info.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              id: info.id,
              type: 'appInfoLocalizations',
              attributes: { name: NEW_NAME, subtitle: NEW_SUBTITLE },
            },
          }),
        });
        console.log('  ✅ タイトル・サブタイトル更新');
      } else {
        console.log(`  ⚠️ AppInfo localization not found`);
      }

      const ver = versionLocalizations.data.find(
        (l) => l.attributes.locale === locale
      );
      if (ver) {
        await apiRequest(`/appStoreVersionLocalizations/${ver.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              id: ver.id,
              type: 'appStoreVersionLocalizations',
              attributes: { keywords: NEW_KEYWORDS },
            },
          }),
        });
        console.log('  ✅ キーワード更新');
      } else {
        console.log(`  ⚠️ Version localization not found`);
      }
    }

    console.log('\n🎉 すべて更新完了！');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
