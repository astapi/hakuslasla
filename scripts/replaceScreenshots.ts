/**
 * v2.0.0 の iPhone 6.5" (APP_IPHONE_65) スクショを差し替える。
 *
 * スロット1〜5を新確定版に差し替え、6枚目以降は維持。動画(appPreviewSets)は触らない。
 *
 * 使い方:
 *   # 計画表示のみ（何もアップロードしない）
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/replaceScreenshots.ts
 *   # 1ロケールだけ実行
 *   ... tsx scripts/replaceScreenshots.ts --execute --locale=ja
 *   # 全ロケール実行
 *   ... tsx scripts/replaceScreenshots.ts --execute --all
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { apiRequest, generateToken, config } from './appStoreConnect';

const DISPLAY_TYPE = 'APP_IPHONE_65';
const FINAL_DIR = path.join(__dirname, '..', 'tools', 'screenshots', 'final');

// 新スクショ（スロット1〜5の順序）
const NEW_ORDER = [
  'store-goblin-king.png',
  'class_select.png',
  'skills.png',
  'inventory.png',
  'dungeon-select.png',
];

// ASCロケール → final/<lang>
const LOCALE_TO_LANG: Record<string, string> = {
  ja: 'ja',
  'en-US': 'en',
  'en-GB': 'en',
  'en-CA': 'en',
  'en-AU': 'en',
  'zh-Hans': 'zh',
  ko: 'ko',
  'es-ES': 'es',
  'es-MX': 'es',
  'fr-FR': 'fr',
  'de-DE': 'de',
};

const baseUrl = 'https://api.appstoreconnect.apple.com/v1';

async function authFetch(url: string, init: RequestInit): Promise<Response> {
  const token = await generateToken();
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
}

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
  included?: Array<{ id: string; type: string; attributes: { fileName?: string } }>;
}

async function getVersionId(): Promise<string> {
  const versions = await apiRequest<VersionsResp>(`/apps/${config.appId}/appStoreVersions?limit=10`);
  const v2 = versions.data.find((v) => v.attributes.versionString === '2.0.0');
  if (!v2) throw new Error('v2.0.0 が見つかりません');
  if (v2.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    throw new Error(`v2.0.0 が編集可能状態ではありません: ${v2.attributes.appStoreState}`);
  }
  return v2.id;
}

// 新スクショ1枚をアップロード（予約→PUT→コミット）
async function uploadScreenshot(setId: string, filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // 1) 予約
  const reserveRes = await authFetch(`${baseUrl}/appScreenshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        type: 'appScreenshots',
        attributes: { fileName, fileSize: buffer.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } },
      },
    }),
  });
  if (!reserveRes.ok) throw new Error(`予約失敗 ${reserveRes.status}: ${await reserveRes.text()}`);
  const reserved = (await reserveRes.json()) as {
    data: {
      id: string;
      attributes: {
        uploadOperations: Array<{
          method: string;
          url: string;
          length: number;
          offset: number;
          requestHeaders: Array<{ name: string; value: string }>;
        }>;
      };
    };
  };
  const screenshotId = reserved.data.id;

  // 2) アップロード（チャンクごと）
  for (const op of reserved.data.attributes.uploadOperations) {
    const chunk = buffer.subarray(op.offset, op.offset + op.length);
    const headers: Record<string, string> = {};
    op.requestHeaders.forEach((h) => (headers[h.name] = h.value));
    const putRes = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!putRes.ok) throw new Error(`PUT失敗 ${putRes.status}: ${await putRes.text()}`);
  }

  // 3) コミット
  const checksum = crypto.createHash('md5').update(buffer).digest('hex');
  const commitRes = await authFetch(`${baseUrl}/appScreenshots/${screenshotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: { uploaded: true, sourceFileChecksum: checksum },
      },
    }),
  });
  if (!commitRes.ok) throw new Error(`コミット失敗 ${commitRes.status}: ${await commitRes.text()}`);

  return screenshotId;
}

async function deleteScreenshot(id: string): Promise<void> {
  const res = await authFetch(`${baseUrl}/appScreenshots/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`削除失敗 ${res.status}: ${await res.text()}`);
}

async function reorder(setId: string, orderedIds: string[]): Promise<void> {
  const res = await authFetch(`${baseUrl}/appScreenshotSets/${setId}/relationships/appScreenshots`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: orderedIds.map((id) => ({ type: 'appScreenshots', id })) }),
  });
  if (!res.ok) throw new Error(`並び替え失敗 ${res.status}: ${await res.text()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const all = args.includes('--all');
  const localeArg = args.find((a) => a.startsWith('--locale='))?.split('=')[1];
  // --only=inventory.png,dungeon-select.png 指定時はそのスロットだけ差し替え（他は維持）
  const onlyArg = args.find((a) => a.startsWith('--only='))?.split('=')[1];
  const onlyFiles = onlyArg ? onlyArg.split(',') : null;
  // --insert=pets.png --at=6 指定時は、既存を消さず指定位置に1枚挿入する
  const insertFile = args.find((a) => a.startsWith('--insert='))?.split('=')[1];
  const insertAt = parseInt(args.find((a) => a.startsWith('--at='))?.split('=')[1] ?? '6', 10);

  // 新画像の存在チェック
  const checkFiles = insertFile ? [insertFile] : NEW_ORDER;
  for (const lang of new Set(Object.values(LOCALE_TO_LANG))) {
    for (const f of checkFiles) {
      const p = path.join(FINAL_DIR, lang, f);
      if (!fs.existsSync(p)) throw new Error(`画像が見つかりません: ${p}`);
    }
  }

  const versionId = await getVersionId();
  const locs = await apiRequest<LocsResp>(
    `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`
  );

  let targets = locs.data.filter((l) => LOCALE_TO_LANG[l.attributes.locale]);
  if (!all && localeArg) targets = targets.filter((l) => l.attributes.locale === localeArg);
  else if (!all && !localeArg) {
    // dry-run時は全ロケールの計画を表示
  }

  console.log(`\nモード: ${execute ? '🔴 実行' : '🟢 計画表示(dry-run)'}  対象ロケール: ${targets.length}\n`);

  for (const loc of targets) {
    const locale = loc.attributes.locale;
    const lang = LOCALE_TO_LANG[locale];
    const sets = await apiRequest<SetsResp>(
      `/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?include=appScreenshots&limit=50`
    );
    const shotById = new Map((sets.included ?? []).map((i) => [i.id, i.attributes.fileName]));
    const set = sets.data.find((s) => s.attributes.screenshotDisplayType === DISPLAY_TYPE);
    if (!set) {
      console.log(`⚠️  ${locale}: ${DISPLAY_TYPE} セットなし。スキップ`);
      continue;
    }
    const existing = set.relationships.appScreenshots.data ?? [];

    // 挿入モード: 既存を消さず insertAt 位置に1枚追加
    if (insertFile) {
      const idx = Math.max(0, insertAt - 1);
      console.log(`--- ${locale} (lang=${lang}, set=${set.id}) ---`);
      console.log(`  現在 ${existing.length} 枚 → ${existing.length + 1} 枚`);
      console.log(`  挿入位置 ${insertAt}: ${lang}/${insertFile}`);
      console.log(`  既存: ${existing.map((s, i) => `${i + 1}.${shotById.get(s.id)}`).join(' / ')}`);
      if (existing.length + 1 > 10) {
        console.log('  ⚠️  10枚を超えるためスキップ');
        continue;
      }
      if (!execute) {
        console.log('');
        continue;
      }
      const newId = await uploadScreenshot(set.id, path.join(FINAL_DIR, lang, insertFile));
      const ids = existing.map((s) => s.id);
      const ordered = [...ids.slice(0, idx), newId, ...ids.slice(idx)];
      await reorder(set.id, ordered);
      console.log(`  ✅ 挿入完了（合計 ${ordered.length} 枚）\n`);
      continue;
    }

    // スロット0..4（NEW_ORDER対応）と、6枚目以降の維持分に分ける
    const slotExisting = existing.slice(0, NEW_ORDER.length);
    const keepIds = existing.slice(NEW_ORDER.length).map((s) => s.id);

    // 各スロットを「差し替え」か「維持」か判定
    const plan = NEW_ORDER.map((f, i) => {
      const replace = !onlyFiles || onlyFiles.includes(f);
      return { index: i, file: f, replace, oldId: slotExisting[i]?.id };
    });
    const toReplace = plan.filter((p) => p.replace);

    console.log(`--- ${locale} (lang=${lang}, set=${set.id}) ---`);
    console.log(`  現在 ${existing.length} 枚`);
    plan.forEach((p) => {
      const old = p.oldId ? shotById.get(p.oldId) : '(なし)';
      console.log(`  ${p.index + 1}. ${p.replace ? `差替→ ${lang}/${p.file}` : `維持  ${old}`}`);
    });
    console.log(`  6+ 維持: ${existing.slice(NEW_ORDER.length).map((s) => shotById.get(s.id)).join(', ') || '(なし)'}`);

    if (!execute) {
      console.log('');
      continue;
    }

    // 実行: 差し替え対象のみ 削除 → アップロード → 全体並び替え
    for (const p of toReplace) {
      if (p.oldId) await deleteScreenshot(p.oldId);
    }
    const slotIds: string[] = [];
    for (const p of plan) {
      if (p.replace) {
        const id = await uploadScreenshot(set.id, path.join(FINAL_DIR, lang, p.file));
        slotIds.push(id);
        console.log(`  ⬆️  ${p.file} アップロード完了`);
      } else if (p.oldId) {
        slotIds.push(p.oldId);
      }
    }
    await reorder(set.id, [...slotIds, ...keepIds]);
    console.log(`  ✅ 完了: 差替${toReplace.length}枚 / 維持${slotIds.length - toReplace.length + keepIds.length}枚\n`);
  }

  console.log(execute ? '\n✅ 完了' : '\n（--execute で実行。--locale=ja で1ロケール、--all で全ロケール）');
}

main().catch((e) => {
  console.error('\n❌ エラー:', e);
  process.exit(1);
});
