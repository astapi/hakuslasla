/**
 * 全ロケール一覧を取得
 */
import { validateConfig, apiRequest, config } from './appStoreConnect';

async function main() {
  validateConfig();
  const res = await apiRequest<{
    data: Array<{ id: string; attributes: { appStoreState: string } }>;
  }>(`/apps/${config.appId}/appInfos`);
  const editableInfo = res.data.find(
    (d) => d.attributes.appStoreState !== 'READY_FOR_SALE'
  );
  const localizations = await apiRequest<{
    data: Array<{ attributes: { locale: string; name: string; subtitle: string | null } }>;
  }>(`/appInfos/${editableInfo!.id}/appInfoLocalizations`);

  console.log(`全${localizations.data.length}ロケール:\n`);
  localizations.data.forEach((l) => {
    console.log(`  ${l.attributes.locale.padEnd(8)} | ${l.attributes.name} | ${l.attributes.subtitle || '(なし)'}`);
  });
}

main();
