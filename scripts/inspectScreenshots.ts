/**
 * v2.0.0 のスクショ構成を読み取る診断スクリプト（読み取り専用）
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/inspectScreenshots.ts
 */
import { apiRequest, config } from './appStoreConnect';

interface VersionsResp {
  data: Array<{ id: string; attributes: { versionString: string; appStoreState: string } }>;
}
interface LocsResp {
  data: Array<{ id: string; attributes: { locale: string } }>;
}
interface SetsResp {
  data: Array<{
    id: string;
    attributes: { screenshotDisplayType: string };
    relationships: { appScreenshots: { data?: Array<{ id: string }> } };
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: { fileName?: string; fileSize?: number; assetDeliveryState?: { state: string } };
  }>;
}
interface PreviewSetsResp {
  data: Array<{ id: string; attributes: { previewType: string } }>;
}

async function main() {
  console.log('App ID:', config.appId, '\n');

  const versions = await apiRequest<VersionsResp>(`/apps/${config.appId}/appStoreVersions?limit=10`);
  const v2 = versions.data.find((v) => v.attributes.versionString === '2.0.0');
  if (!v2) {
    console.log('v2.0.0 が見つかりません。存在するバージョン:');
    versions.data.forEach((v) => console.log(`  v${v.attributes.versionString} - ${v.attributes.appStoreState}`));
    return;
  }
  console.log(`v2.0.0 → id=${v2.id} state=${v2.attributes.appStoreState}\n`);

  const locs = await apiRequest<LocsResp>(
    `/appStoreVersions/${v2.id}/appStoreVersionLocalizations?limit=50`
  );
  console.log(`ロケール数: ${locs.data.length} →`, locs.data.map((l) => l.attributes.locale).join(', '), '\n');

  for (const loc of locs.data) {
    console.log(`\n===== ${loc.attributes.locale} (loc=${loc.id}) =====`);

    const previews = await apiRequest<PreviewSetsResp>(
      `/appStoreVersionLocalizations/${loc.id}/appPreviewSets`
    );
    if (previews.data.length > 0) {
      console.log('  [動画/プレビューセット]', previews.data.map((p) => p.attributes.previewType).join(', '));
    }

    const sets = await apiRequest<SetsResp>(
      `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`
    );
    const shotById = new Map((sets.included ?? []).map((i) => [i.id, i]));
    for (const set of sets.data) {
      const ids = set.relationships.appScreenshots.data ?? [];
      console.log(`  [${set.attributes.screenshotDisplayType}] set=${set.id} 枚数=${ids.length}`);
      ids.forEach((s, i) => {
        const meta = shotById.get(s.id);
        console.log(`     ${i + 1}. ${meta?.attributes.fileName ?? s.id} (${meta?.attributes.assetDeliveryState?.state ?? '?'})`);
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
