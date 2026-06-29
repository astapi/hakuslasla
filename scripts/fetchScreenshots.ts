/**
 * App Store Connect から実際に設定済みのスクリーンショットURLを取得し、ローカルに保存する。
 *
 * 使い方:
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/fetchScreenshots.ts [locale] [outDir]
 *   例: npx tsx --tsconfig tsconfig.scripts.json scripts/fetchScreenshots.ts ja /tmp/ss
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
} from './appStoreConnect';

const targetLocale = process.argv[2] || 'ja';
const outDir = process.argv[3] || path.join(process.cwd(), 'tmp-screenshots');

interface ListResp {
  data: Array<{ id: string; attributes: Record<string, any> }>;
}

// imageAsset.templateUrl は {w}x{h}{c}.{f} 形式 → 実URL化
function buildUrl(templateUrl: string, w: number, h: number, f = 'png') {
  return templateUrl
    .replace('{w}', String(w))
    .replace('{h}', String(h))
    .replace('{c}', 'bb')
    .replace('{f}', f);
}

async function main() {
  validateConfig();
  fs.mkdirSync(outDir, { recursive: true });

  // ライブ版（READY_FOR_SALE優先）
  const versions = await getAppStoreVersions();
  const live =
    versions.data.find((v) => v.attributes.appStoreState === 'READY_FOR_SALE') ??
    versions.data[0];
  console.log(
    `📦 v${live.attributes.versionString} (${live.attributes.appStoreState})`
  );

  // 対象ロケールの localization
  const locs = await apiRequest<ListResp>(
    `/appStoreVersions/${live.id}/appStoreVersionLocalizations?limit=50`
  );
  const loc = locs.data.find((l) => l.attributes.locale === targetLocale);
  if (!loc) {
    console.error(
      `ロケール ${targetLocale} なし。利用可能: ${locs.data
        .map((l) => l.attributes.locale)
        .join(', ')}`
    );
    process.exit(1);
  }

  // スクショセット（端末タイプ別）
  const sets = await apiRequest<ListResp>(
    `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`
  );
  console.log(
    `\n端末セット: ${sets.data
      .map((s) => s.attributes.screenshotDisplayType)
      .join(', ')}\n`
  );

  for (const set of sets.data) {
    const dtype = set.attributes.screenshotDisplayType;
    const shots = await apiRequest<ListResp>(
      `/appScreenshotSets/${set.id}/appScreenshots?limit=50`
    );
    console.log(`■ ${dtype}: ${shots.data.length}枚`);

    let i = 0;
    for (const shot of shots.data) {
      i++;
      const a = shot.attributes;
      const asset = a.imageAsset;
      if (!asset) {
        console.log(`  ${i}. (アセット未処理: ${a.assetDeliveryState?.state})`);
        continue;
      }
      const url = buildUrl(asset.templateUrl, asset.width, asset.height);
      // 端末タイプ別フォルダに全枚数を保存
      const dDir = path.join(outDir, dtype);
      fs.mkdirSync(dDir, { recursive: true });
      const fileName = `${String(i).padStart(2, '0')}.png`;
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(dDir, fileName), buf);
      console.log(`  ${i}. 保存: ${dtype}/${fileName} (${asset.width}x${asset.height})`);
    }
  }
  console.log(`\n✅ 保存先: ${outDir}`);
}

main().catch((e) => {
  console.error('❌ エラー:', e);
  process.exit(1);
});
