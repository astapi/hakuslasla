/**
 * 英語(US)ローカライゼーションのタイトル・サブタイトル・キーワードを更新
 *
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateUsLocalization.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const TARGET_LOCALE = 'en-US';

const NEW_NAME = 'Loot Dive: Hack&Slash Dungeon';
const NEW_SUBTITLE = 'Idle Looter RPG × Build Craft';
const NEW_KEYWORDS =
  'auto battle,roguelike,equipment,offline,crawler,skill tree,boss,fantasy,treasure,afk,endless,gear';

interface AppInfoLocalizationsResponse {
  data: Array<{
    id: string;
    attributes: {
      locale: string;
      name: string;
      subtitle: string | null;
    };
  }>;
}

interface VersionLocalizationsResponse {
  data: Array<{
    id: string;
    attributes: {
      locale: string;
      keywords: string | null;
    };
  }>;
}

async function main() {
  console.log(`\n🇺🇸 英語(US)メタデータ更新\n`);
  console.log(`  タイトル: ${NEW_NAME} (${NEW_NAME.length}文字)`);
  console.log(`  サブタイトル: ${NEW_SUBTITLE} (${NEW_SUBTITLE.length}文字)`);
  console.log(`  キーワード: ${NEW_KEYWORDS}`);
  console.log(`  キーワード文字数: ${NEW_KEYWORDS.length}/100\n`);

  try {
    validateConfig();

    // 1. App Info Localization（タイトル・サブタイトル）を更新
    console.log('--- タイトル・サブタイトル更新 ---');
    const appInfosRes = await apiRequest<{
      data: Array<{ id: string; attributes: { appStoreState: string } }>;
    }>(`/apps/${config.appId}/appInfos`);

    console.log(
      '  AppInfos:',
      appInfosRes.data
        .map((d) => `${d.id} (${d.attributes.appStoreState})`)
        .join(', ')
    );
    const editableInfo = appInfosRes.data.find(
      (d) => d.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const appInfoId = editableInfo ? editableInfo.id : appInfosRes.data[0].id;
    console.log(
      `  使用するAppInfo: ${appInfoId} (${editableInfo?.attributes.appStoreState || 'fallback'})`
    );

    const localizations = await apiRequest<AppInfoLocalizationsResponse>(
      `/appInfos/${appInfoId}/appInfoLocalizations`
    );
    const target = localizations.data.find(
      (l) => l.attributes.locale === TARGET_LOCALE
    );

    if (!target) {
      throw new Error(`ロケール "${TARGET_LOCALE}" が見つかりません`);
    }

    console.log(`  現在のタイトル: ${target.attributes.name}`);
    console.log(`  現在のサブタイトル: ${target.attributes.subtitle}`);

    await apiRequest(`/appInfoLocalizations/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: target.id,
          type: 'appInfoLocalizations',
          attributes: {
            name: NEW_NAME,
            subtitle: NEW_SUBTITLE,
          },
        },
      }),
    });
    console.log('  ✅ タイトル・サブタイトル更新完了\n');

    // 2. Version Localization（キーワード）を更新
    console.log('--- キーワード更新 ---');
    const versions = await getAppStoreVersions();
    console.log(
      '  バージョン一覧:',
      versions.data
        .map(
          (v) =>
            `v${v.attributes.versionString} (${v.attributes.appStoreState})`
        )
        .join(', ')
    );
    const editableVersion = versions.data.find(
      (v) => v.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const latestVersion = editableVersion || versions.data[0];
    console.log(
      `  使用するバージョン: v${latestVersion.attributes.versionString} (${latestVersion.attributes.appStoreState})`
    );

    const versionLocalizations =
      await apiRequest<VersionLocalizationsResponse>(
        `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`
      );
    const koVersion = versionLocalizations.data.find(
      (l) => l.attributes.locale === TARGET_LOCALE
    );

    if (!koVersion) {
      throw new Error(
        `バージョンロケール "${TARGET_LOCALE}" が見つかりません`
      );
    }

    console.log(`  現在のキーワード: ${koVersion.attributes.keywords}`);

    await apiRequest(`/appStoreVersionLocalizations/${koVersion.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: koVersion.id,
          type: 'appStoreVersionLocalizations',
          attributes: {
            keywords: NEW_KEYWORDS,
          },
        },
      }),
    });
    console.log('  ✅ キーワード更新完了\n');

    console.log('🎉 すべて更新完了！');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
