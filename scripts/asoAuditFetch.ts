/**
 * ASO監査用：全ロケールのメタデータ（タイトル/サブタイトル/キーワード欄/プロモ）を
 * 文字数付きで一覧取得する。
 *
 * 使用:
 * npx tsx --tsconfig tsconfig.scripts.json scripts/asoAuditFetch.ts
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

// Apple文字数カウント（CJKも1文字）。サロゲートペア考慮で [...str]
const len = (s: string | null | undefined) => (s ? [...s].length : 0);
const LIMIT = { name: 30, subtitle: 30, keywords: 100 };

interface AppInfoLoc {
  data: Array<{
    attributes: { locale: string; name: string; subtitle: string | null };
  }>;
}
interface VersionLoc {
  data: Array<{
    attributes: {
      locale: string;
      keywords: string | null;
      promotionalText: string | null;
      whatsNew: string | null;
    };
  }>;
}

async function main() {
  validateConfig();

  // 1. App Info（名前・サブタイトル）
  const appInfos = await apiRequest<{ data: Array<{ id: string }> }>(
    `/apps/${config.appId}/appInfos?limit=1`
  );
  const appInfoLoc = await apiRequest<AppInfoLoc>(
    `/appInfos/${appInfos.data[0].id}/appInfoLocalizations?limit=50`
  );
  const infoByLocale = new Map(
    appInfoLoc.data.map((l) => [l.attributes.locale, l.attributes])
  );

  // 2. ライブ版（READY_FOR_SALE優先）のキーワード等
  const versions = await getAppStoreVersions();
  const live =
    versions.data.find((v) => v.attributes.appStoreState === 'READY_FOR_SALE') ??
    versions.data[0];
  const verLoc = await apiRequest<VersionLoc>(
    `/appStoreVersions/${live.id}/appStoreVersionLocalizations?limit=50`
  );
  const verByLocale = new Map(
    verLoc.data.map((l) => [l.attributes.locale, l.attributes])
  );

  console.log(
    `\n📦 対象バージョン: v${live.attributes.versionString} (${live.attributes.appStoreState})\n`
  );

  const locales = Array.from(
    new Set([...infoByLocale.keys(), ...verByLocale.keys()])
  ).sort();

  // サマリ表
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - [...s].length));
  console.log(
    pad('locale', 8),
    pad('title(len)', 12),
    pad('subtitle(len)', 14),
    pad('keywords(len)', 14),
    'promo'
  );
  console.log('-'.repeat(70));
  for (const loc of locales) {
    const info = infoByLocale.get(loc);
    const ver = verByLocale.get(loc);
    const nlen = len(info?.name);
    const slen = len(info?.subtitle);
    const klen = len(ver?.keywords);
    const flag = (v: number, max: number) => (v === 0 ? '⚠️0' : v < max * 0.7 ? `${v}` : `${v}`);
    console.log(
      pad(loc, 8),
      pad(`${flag(nlen, LIMIT.name)}/${LIMIT.name}`, 12),
      pad(`${flag(slen, LIMIT.subtitle)}/${LIMIT.subtitle}`, 14),
      pad(`${flag(klen, LIMIT.keywords)}/${LIMIT.keywords}`, 14),
      ver?.promotionalText ? 'あり' : '—'
    );
  }

  // 詳細（キーワード欄とサブタイトルの中身）
  console.log('\n\n===== 詳細 =====');
  for (const loc of locales) {
    const info = infoByLocale.get(loc);
    const ver = verByLocale.get(loc);
    console.log(`\n【${loc}】`);
    console.log(`  title    : ${info?.name ?? '(なし)'}`);
    console.log(`  subtitle : ${info?.subtitle ?? '(なし)'}  [${len(info?.subtitle)}/30]`);
    console.log(`  keywords : ${ver?.keywords ?? '(なし)'}  [${len(ver?.keywords)}/100]`);
    console.log(`  promo    : ${ver?.promotionalText ?? '(なし)'}`);
  }

  console.log('\n✅ 完了');
}

main().catch((e) => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
