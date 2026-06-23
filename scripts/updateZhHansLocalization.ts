/**
 * 中国語(簡体字)ローカライゼーション更新
 *
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateZhHansLocalization.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const TARGET_LOCALE = 'zh-Hans';

const NEW_NAME = 'Loot Dive: 暗黑刷宝地下城';
const NEW_SUBTITLE = '放置挂机RPG × 肉鸽刷图';
const NEW_KEYWORDS =
  '装备,暴击,技能树,被动,无尽,Boss,宝物,冒险,奇幻,离线,单机,育成,强化,掉落,角色扮演,构建,砍杀,ARPG,build,技能,探险,Roguelike,战利品,刷怪,天赋,武器,防具';

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
  console.log(`\n🇨🇳 中国語(簡体字)メタデータ更新\n`);
  console.log(`  タイトル: ${NEW_NAME} (${NEW_NAME.length}文字)`);
  console.log(`  サブタイトル: ${NEW_SUBTITLE} (${NEW_SUBTITLE.length}文字)`);
  console.log(`  キーワード: ${NEW_KEYWORDS}`);
  console.log(`  キーワード文字数: ${NEW_KEYWORDS.length}/100\n`);

  try {
    validateConfig();

    // AppInfo（編集可能）を取得
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
          attributes: { name: NEW_NAME, subtitle: NEW_SUBTITLE },
        },
      }),
    });
    console.log('  ✅ タイトル・サブタイトル更新完了\n');

    // キーワード更新
    console.log('--- キーワード更新 ---');
    const versions = await getAppStoreVersions();
    const editableVersion = versions.data.find(
      (v) => v.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const latestVersion = editableVersion || versions.data[0];
    console.log(
      `  バージョン: v${latestVersion.attributes.versionString} (${latestVersion.attributes.appStoreState})`
    );

    const versionLocalizations =
      await apiRequest<VersionLocalizationsResponse>(
        `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`
      );
    const ver = versionLocalizations.data.find(
      (l) => l.attributes.locale === TARGET_LOCALE
    );

    if (!ver) {
      throw new Error(`バージョンロケール "${TARGET_LOCALE}" が見つかりません`);
    }

    console.log(`  現在のキーワード: ${ver.attributes.keywords}`);

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
    console.log('  ✅ キーワード更新完了\n');

    console.log('🎉 すべて更新完了！');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
