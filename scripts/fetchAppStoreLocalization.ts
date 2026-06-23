/**
 * App Store Connect から特定ロケールのメタデータ（タイトル、サブタイトル、キーワード等）を取得
 *
 * 使用:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/fetchAppStoreLocalization.ts [locale]
 * 例: npx tsx --tsconfig tsconfig.scripts.json scripts/fetchAppStoreLocalization.ts ko
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

// App Info Localizations（アプリ名、サブタイトル等）
interface AppInfoLocalizationsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      locale: string;
      name: string;
      subtitle: string | null;
      privacyPolicyUrl: string | null;
      privacyPolicyText: string | null;
    };
  }>;
}

// App Store Version Localizations（説明文、キーワード、whatsNew等）
interface VersionLocalizationsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: {
      locale: string;
      description: string | null;
      keywords: string | null;
      whatsNew: string | null;
      promotionalText: string | null;
      marketingUrl: string | null;
      supportUrl: string | null;
    };
  }>;
}

async function main() {
  const targetLocale = process.argv[2] || 'ko';

  console.log(
    `\n📱 App Store メタデータ取得（ロケール: ${targetLocale}）\n`
  );

  try {
    validateConfig();

    // 1. App Info Localizations（アプリ名・サブタイトル）
    console.log('--- App Info（アプリ名・サブタイトル） ---');
    const appInfosRes = await apiRequest<{
      data: Array<{ id: string }>;
    }>(`/apps/${config.appId}/appInfos?limit=1`);

    if (appInfosRes.data.length > 0) {
      const appInfoId = appInfosRes.data[0].id;
      const localizations =
        await apiRequest<AppInfoLocalizationsResponse>(
          `/appInfos/${appInfoId}/appInfoLocalizations`
        );

      const target = localizations.data.find(
        (l) => l.attributes.locale === targetLocale
      );

      if (target) {
        console.log(`  ロケール: ${target.attributes.locale}`);
        console.log(`  アプリ名: ${target.attributes.name}`);
        console.log(`  サブタイトル: ${target.attributes.subtitle || '(なし)'}`);
      } else {
        console.log(`  ⚠️ ロケール "${targetLocale}" が見つかりません`);
        console.log(
          `  利用可能: ${localizations.data.map((l) => l.attributes.locale).join(', ')}`
        );
      }
    }

    console.log();

    // 2. Version Localizations（キーワード・説明文）- 最新バージョン
    console.log('--- Version Info（キーワード・説明文） ---');
    const versions = await getAppStoreVersions();
    if (versions.data.length > 0) {
      const latestVersion = versions.data[0];
      console.log(
        `  バージョン: v${latestVersion.attributes.versionString} (${latestVersion.attributes.appStoreState})`
      );

      const versionLocalizations =
        await apiRequest<VersionLocalizationsResponse>(
          `/appStoreVersions/${latestVersion.id}/appStoreVersionLocalizations`
        );

      const target = versionLocalizations.data.find(
        (l) => l.attributes.locale === targetLocale
      );

      if (target) {
        console.log(`  ロケール: ${target.attributes.locale}`);
        console.log(
          `  キーワード: ${target.attributes.keywords || '(なし)'}`
        );
        console.log(
          `  プロモーションテキスト: ${target.attributes.promotionalText || '(なし)'}`
        );
        console.log(`  説明文:\n${target.attributes.description || '(なし)'}`);
        console.log(
          `\n  whatsNew: ${target.attributes.whatsNew || '(なし)'}`
        );
      } else {
        console.log(`  ⚠️ ロケール "${targetLocale}" が見つかりません`);
        console.log(
          `  利用可能: ${versionLocalizations.data.map((l) => l.attributes.locale).join(', ')}`
        );
      }
    }

    console.log('\n✅ 完了');
  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
