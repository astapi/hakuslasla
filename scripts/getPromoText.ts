/** 現在の各バージョン/ロケールの promotionalText を取得（テイスト把握用・読み取り専用） */
import { apiRequest, config } from './appStoreConnect';

interface VersionsResp {
  data: Array<{ id: string; attributes: { versionString: string; appStoreState: string } }>;
}
interface LocsResp {
  data: Array<{ id: string; attributes: { locale: string; promotionalText: string | null } }>;
}

async function main() {
  const versions = await apiRequest<VersionsResp>(`/apps/${config.appId}/appStoreVersions?limit=10`);
  for (const v of versions.data) {
    const locs = await apiRequest<LocsResp>(
      `/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`
    );
    const ja = locs.data.find((l) => l.attributes.locale === 'ja');
    const en = locs.data.find((l) => l.attributes.locale.startsWith('en'));
    console.log(`\n=== v${v.attributes.versionString} (${v.attributes.appStoreState}) ===`);
    console.log(`[ja] ${ja?.attributes.promotionalText ?? '(なし)'}`);
    console.log(`[en] ${en?.attributes.promotionalText ?? '(なし)'}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
