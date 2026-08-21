/**
 * UberUber魔王のクリア記録を Firestore から取得してローカルに保存する。
 *
 * Firestoreルールが allow read: true のため認証不要（REST API）。
 * 保存先は .gitignore 済みの local-data/ 配下。
 *
 * 使用例:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchUberUberDemonLordClears.ts
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchUberUberDemonLordClears.ts --collection uber_uber_kraken_clears
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchUberUberDemonLordClears.ts --out local-data/foo.json
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID = 'lootdiveapp';
const DEFAULT_COLLECTION = 'uber_uber_demon_lord_clears';
const DEFAULT_OUT_DIR = 'local-data';

// --- Args ---

function parseArgs() {
  const args = process.argv.slice(2);

  const collectionIdx = args.indexOf('--collection');
  const collection =
    collectionIdx >= 0 && args[collectionIdx + 1] ? args[collectionIdx + 1] : DEFAULT_COLLECTION;

  const outIdx = args.indexOf('--out');
  const out =
    outIdx >= 0 && args[outIdx + 1]
      ? args[outIdx + 1]
      : path.join(DEFAULT_OUT_DIR, `${collection}.json`);

  return { collection, out };
}

// --- Firestore REST API ---

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
  timestampValue?: string;
  nullValue?: string;
}

function decodeValue(val: FirestoreValue): any {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  // 装備のfixedMods等がネストした配列で入るため arrayValue も展開する
  if (val.arrayValue) return (val.arrayValue.values || []).map(decodeValue);
  if (val.mapValue) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = decodeValue(v);
    }
    return obj;
  }
  return null;
}

function decodeDocument(doc: any): { docId: string; data: Record<string, any> } {
  const name: string = doc.document?.name || doc.name || '';
  const docId = name.split('/').pop() || '';
  const fields = doc.document?.fields || doc.fields || {};
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = decodeValue(v as FirestoreValue);
  }
  return { docId, data };
}

async function fetchClears(collection: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'ASCENDING' }],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore API error (${res.status}): ${text}`);
  }

  const results = await res.json();
  return results.filter((r: any) => r.document).map((r: any) => decodeDocument(r));
}

// --- Main ---

const CLASS_LABELS: Record<string, string> = {
  warrior: 'ウォリアー',
  elementalist: 'エレメンタリスト',
  ranger: 'レンジャー',
  frostmage: 'フロストメイジ',
  tamer: 'テイマー',
};

async function main() {
  const { collection, out } = parseArgs();

  const docs = await fetchClears(collection);

  const outPath = path.resolve(out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        collection,
        fetchedAt: new Date().toISOString(),
        count: docs.length,
        entries: docs.map((d: { docId: string; data: Record<string, any> }) => ({
          docId: d.docId,
          ...d.data,
        })),
      },
      null,
      2
    )
  );

  console.log(`\n📥 ${collection}: ${docs.length}件`);
  console.log('━'.repeat(78));
  console.log(
    '  ' +
      '名前'.padEnd(16) +
      'クラス'.padEnd(16) +
      'Lv'.padStart(5) +
      'HP'.padStart(9) +
      'ATK'.padStart(8) +
      'DEF'.padStart(8) +
      '  クリア日時'
  );
  console.log('  ' + '-'.repeat(74));

  for (const doc of docs as { docId: string; data: Record<string, any> }[]) {
    const d = doc.data;
    const stats = d.stats || {};
    console.log(
      '  ' +
        String(d.name || '???').padEnd(16) +
        String(CLASS_LABELS[d.type] || d.type || '?').padEnd(16) +
        String(d.level ?? stats.level ?? '?').padStart(5) +
        String(stats.maxHp ?? '?').padStart(9) +
        String(stats.atk ?? '?').padStart(8) +
        String(stats.def ?? '?').padStart(8) +
        '  ' +
        String(d.updatedAt || '?')
    );
  }

  console.log(`\n保存: ${out}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
