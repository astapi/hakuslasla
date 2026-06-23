/**
 * 韓国語ローカライゼーションのタイトル・サブタイトル・キーワードを更新
 *
 * npx tsx --tsconfig tsconfig.scripts.json scripts/updateKoLocalization.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const TARGET_LOCALE = 'ko';

// 新しいメタデータ
const NEW_NAME = 'Loot Dive | 루팅 빌드 파밍 RPG';
const NEW_SUBTITLE = '자동 전투 × 핵슬 로그라이크';
const NEW_KEYWORDS =
  '핵앤슬래시,던전,패시브,장비,육성,아이템,보스,ARPG,무한,전설,크리티컬,독,방치,액션,스킬트리,트레저,흡혈,화염,수집,레벨업,판타지,보스전,스킬,강화,오프라인,모험,탐험,싱글';

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
  console.log(`\n🇰🇷 韓国語メタデータ更新\n`);
  console.log(`  タイトル: ${NEW_NAME}`);
  console.log(`  サブタイトル: ${NEW_SUBTITLE}`);
  console.log(`  キーワード: ${NEW_KEYWORDS}`);
  console.log(`  キーワード文字数: ${NEW_KEYWORDS.length}/100\n`);

  try {
    validateConfig();

    // 1. App Info Localization（タイトル・サブタイトル）を更新
    console.log('--- タイトル・サブタイトル更新 ---');
    const appInfosRes = await apiRequest<{
      data: Array<{ id: string; attributes: { appStoreState: string } }>;
    }>(`/apps/${config.appId}/appInfos`);

    // 編集可能なappInfo（PREPARE_FOR_SUBMISSION等）を優先
    console.log(
      '  AppInfos:',
      appInfosRes.data.map((d) => `${d.id} (${d.attributes.appStoreState})`).join(', ')
    );
    const editableInfo = appInfosRes.data.find(
      (d) => d.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const appInfoId = editableInfo
      ? editableInfo.id
      : appInfosRes.data[0].id;
    console.log(`  使用するAppInfo: ${appInfoId} (${editableInfo?.attributes.appStoreState || 'fallback'})`);

    const localizations = await apiRequest<AppInfoLocalizationsResponse>(
      `/appInfos/${appInfoId}/appInfoLocalizations`
    );
    const koInfo = localizations.data.find(
      (l) => l.attributes.locale === TARGET_LOCALE
    );

    if (!koInfo) {
      throw new Error(`ロケール "${TARGET_LOCALE}" が見つかりません`);
    }

    console.log(`  現在のタイトル: ${koInfo.attributes.name}`);
    console.log(`  現在のサブタイトル: ${koInfo.attributes.subtitle}`);

    await apiRequest(`/appInfoLocalizations/${koInfo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: koInfo.id,
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
      versions.data.map((v) => `v${v.attributes.versionString} (${v.attributes.appStoreState})`).join(', ')
    );
    // 編集可能なバージョン（PREPARE_FOR_SUBMISSION等）を優先
    const editableVersion = versions.data.find(
      (v) => v.attributes.appStoreState !== 'READY_FOR_SALE'
    );
    const latestVersion = editableVersion || versions.data[0];
    console.log(
      `  使用するバージョン: v${latestVersion.attributes.versionString} (${latestVersion.attributes.appStoreState})`
    );

    const versionLocalizations = await apiRequest<VersionLocalizationsResponse>(
      `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`
    );
    const koVersion = versionLocalizations.data.find(
      (l) => l.attributes.locale === TARGET_LOCALE
    );

    if (!koVersion) {
      throw new Error(`バージョンロケール "${TARGET_LOCALE}" が見つかりません`);
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
