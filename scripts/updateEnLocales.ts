/**
 * 英語ロケール（GB, AU, CA）をUS同様に一括更新
 *
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateEnLocales.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const LOCALES = ['en-GB', 'en-AU', 'en-CA'];

const NEW_NAME = 'Loot Dive: Hack&Slash Dungeon';
const NEW_SUBTITLE = 'Idle Looter RPG × Build Craft';
const NEW_KEYWORDS =
  'auto battle,roguelike,equipment,offline,crawler,skill tree,boss,fantasy,treasure,afk,endless,gear';

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
  console.log(`\n🌍 英語ロケール一括更新 (${LOCALES.join(', ')})\n`);

  try {
    validateConfig();

    // AppInfo（編集可能なもの）を取得
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

    // バージョン（編集可能なもの）を取得
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

      // タイトル・サブタイトル更新
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

      // キーワード更新
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
