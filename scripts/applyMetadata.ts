/**
 * ASOメタデータ一括反映スクリプト（全ロケール）
 *
 * docs/aso-metadata-proposal-v2.md の最終案を、編集可能バージョン
 * （PREPARE_FOR_SUBMISSION 等の非 READY_FOR_SALE）に一括反映する。
 *
 * 使い方:
 *   # 差分プレビューのみ（デフォルト・安全）
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/applyMetadata.ts
 *
 *   # 実際に反映（要 --apply）。特定ロケールのみは --only で絞り込み
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/applyMetadata.ts --apply
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/applyMetadata.ts --apply --only de-DE,fr-FR
 *
 * 注意:
 *   - タイトル/サブ/キーワードの変更は審査対象。先に ASC で v2.0.0 の新バージョンを
 *     作成（PREPARE_FOR_SUBMISSION）しておくこと。編集可能バージョンが無ければ中断する。
 *   - READY_FOR_SALE（公開中）には絶対に書き込まない。
 */

import {
  validateConfig,
  apiRequest,
  getAppStoreVersions,
  config,
} from './appStoreConnect';

const LIMIT = { name: 30, subtitle: 30, keywords: 100 };
const len = (s: string) => [...s].length;

interface Meta {
  name: string;
  subtitle: string;
  keywords: string;
}

// ロケール → メタデータ（docs/aso-metadata-proposal-v2.md と一致）
const EN: Meta = {
  name: 'Loot Dive: Idle ARPG Dungeon',
  subtitle: 'Auto-Battle Looter Rogue-lite',
  keywords:
    'incremental,action,rpg,roguelike,diablo,clicker,crawler,grind,farm,slayer,offline,boss,gear,afk',
};
const ES: Meta = {
  name: 'Loot Dive: Idle ARPG Mazmorra',
  subtitle: 'Auto-Battle Looter Roguelike',
  keywords:
    'clicker,accion,rpg,roguelike,diablo,incremental,hack,slash,grind,farm,boss,crawler,rol,botin,tesoro',
};

const METADATA: Record<string, Meta> = {
  ja: {
    name: 'ハクスラダンジョン周回ビルドRPG | ルートダイブ',
    subtitle: '放置×トレハン×オートバトル×やり込み',
    keywords:
      '放置RPG,ローグライク,アクションRPG,ディアブロ,厳選,idle,loot,build,ハックスラッシュ,装備,スキルツリー,ドロップ,育成,ボス,無限,オフライン,レア,ファンタジー,冒険',
  },
  'en-US': EN,
  'en-GB': EN,
  'en-AU': EN,
  'en-CA': EN,
  'de-DE': {
    name: 'Loot Dive: Idle ARPG Dungeon',
    subtitle: 'Auto-Battle Looter Hack&Slay',
    keywords:
      'clicker,offline,rpg,diablo,roguelike,incremental,crawler,grind,farm,boss,gear,skilltree,afk,beute',
  },
  'fr-FR': {
    name: 'Loot Dive: Idle ARPG Donjon',
    subtitle: 'Auto-Battle Looter Incrémental',
    keywords:
      'incrémental,roguelike,clicker,diablo,rogue,lite,action,rpg,hack,slash,grind,farm,boss,crawler,butin',
  },
  'es-ES': ES,
  'es-MX': ES,
  ko: {
    name: 'Loot Dive | 루팅 빌드 파밍 RPG',
    subtitle: '자동전투 방치형 로그라이크 디아블로',
    keywords:
      '방치,수집형,파밍,핵앤슬래시,ARPG,던전,패시브,장비,육성,아이템,보스,무한,크리티컬,스킬트리,트레저,흡혈,강화,오프라인,모험,싱글,레벨업,판타지',
  },
  'zh-Hans': {
    name: 'Loot Dive: 暗黑放置刷宝地下城',
    subtitle: '放置挂机RPG × 砍杀刷宝肉鸽刷图',
    keywords:
      '放置RPG,暗黑像素,ARPG,Roguelike,装备,暴击,技能树,被动,无尽,Boss,宝物,冒险,奇幻,离线,单机,育成,强化,掉落,角色扮演,构建,战利品,刷怪,天赋,武器,防具',
  },
};

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

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const onlyIdx = argv.indexOf('--only');
  const only =
    onlyIdx >= 0 && argv[onlyIdx + 1]
      ? argv[onlyIdx + 1].split(',').map((s) => s.trim())
      : null;
  return { apply, only };
}

// 文字数バリデーション（超過があれば反映を止める）
function validateMeta(): string[] {
  const errs: string[] = [];
  for (const [loc, m] of Object.entries(METADATA)) {
    if (len(m.name) > LIMIT.name) errs.push(`${loc} name ${len(m.name)}/30`);
    if (len(m.subtitle) > LIMIT.subtitle)
      errs.push(`${loc} subtitle ${len(m.subtitle)}/30`);
    if (len(m.keywords) > LIMIT.keywords)
      errs.push(`${loc} keywords ${len(m.keywords)}/100`);
  }
  return errs;
}

async function main() {
  const { apply, only } = parseArgs(process.argv.slice(2));
  validateConfig();

  console.log(
    `\n🛠️  ASOメタデータ${apply ? '反映' : 'プレビュー（dry-run）'}\n`
  );

  // 文字数チェック
  const errs = validateMeta();
  if (errs.length) {
    console.error('❌ 文字数超過のため中断:\n  ' + errs.join('\n  '));
    process.exit(1);
  }

  // 編集可能な appInfo / version を取得（READY_FOR_SALE は除外）
  const appInfosRes = await apiRequest<{
    data: Array<{ id: string; attributes: { appStoreState: string } }>;
  }>(`/apps/${config.appId}/appInfos`);
  const editableInfo = appInfosRes.data.find(
    (d) => d.attributes.appStoreState !== 'READY_FOR_SALE'
  );

  const versions = await getAppStoreVersions();
  const editableVersion = versions.data.find(
    (v) => v.attributes.appStoreState !== 'READY_FOR_SALE'
  );

  if (!editableInfo || !editableVersion) {
    console.error(
      '❌ 編集可能なバージョンが見つかりません。\n' +
        '   先に App Store Connect で新バージョン（例 v2.0.0）を作成してください。\n' +
        `   現在のバージョン: ${versions.data
          .map((v) => `v${v.attributes.versionString}(${v.attributes.appStoreState})`)
          .join(', ')}`
    );
    process.exit(1);
  }

  console.log(
    `📦 対象バージョン: v${editableVersion.attributes.versionString} (${editableVersion.attributes.appStoreState})`
  );
  console.log(`🔒 公開中(READY_FOR_SALE)には書き込みません\n`);

  // 現状のローカライズを取得
  const infoLocs = await apiRequest<AppInfoLocalizationsResponse>(
    `/appInfos/${editableInfo.id}/appInfoLocalizations?limit=50`
  );
  const verLocs = await apiRequest<VersionLocalizationsResponse>(
    `/appStoreVersions/${editableVersion.id}/appStoreVersionLocalizations?limit=50`
  );
  const infoByLocale = new Map(infoLocs.data.map((l) => [l.attributes.locale, l]));
  const verByLocale = new Map(verLocs.data.map((l) => [l.attributes.locale, l]));

  const targets = Object.keys(METADATA).filter((loc) => !only || only.includes(loc));
  let applied = 0;
  let skipped = 0;

  for (const loc of targets) {
    const m = METADATA[loc];
    const info = infoByLocale.get(loc);
    const ver = verByLocale.get(loc);

    console.log(`\n【${loc}】`);
    if (!info || !ver) {
      console.log(
        `  ⚠️ ロケール未作成のためスキップ（ASCに ${loc} のローカライズが必要）`
      );
      skipped++;
      continue;
    }

    // 差分表示
    const diff = (label: string, before: string | null, after: string, max: number) => {
      const changed = (before ?? '') !== after;
      console.log(
        `  ${changed ? '✏️ ' : '   '}${label} [${len(after)}/${max}]`
      );
      if (changed) {
        console.log(`      - ${before ?? '(なし)'}`);
        console.log(`      + ${after}`);
      }
    };
    diff('title   ', info.attributes.name, m.name, LIMIT.name);
    diff('subtitle', info.attributes.subtitle, m.subtitle, LIMIT.subtitle);
    diff('keywords', ver.attributes.keywords, m.keywords, LIMIT.keywords);

    if (!apply) continue;

    // appInfoLocalization（name / subtitle）
    await apiRequest(`/appInfoLocalizations/${info.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: info.id,
          type: 'appInfoLocalizations',
          attributes: { name: m.name, subtitle: m.subtitle },
        },
      }),
    });
    // appStoreVersionLocalization（keywords）
    await apiRequest(`/appStoreVersionLocalizations/${ver.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: ver.id,
          type: 'appStoreVersionLocalizations',
          attributes: { keywords: m.keywords },
        },
      }),
    });
    console.log('  ✅ 反映完了');
    applied++;

    // レート制限対策
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(
    `\n${apply ? `🎉 反映 ${applied}件 / スキップ ${skipped}件` : `👀 プレビュー完了（実反映は --apply）／ スキップ ${skipped}件`}`
  );
}

main().catch((e) => {
  console.error('\n❌ エラー:', e);
  process.exit(1);
});
