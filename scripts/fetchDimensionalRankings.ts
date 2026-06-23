/**
 * Firestore dimensional_rankings コレクションから上位ランキングを取得
 * REST APIを使用（Firestoreルールが allow read: true のため認証不要）
 *
 * 使用例:
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchDimensionalRankings.ts
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchDimensionalRankings.ts --top 10
 *   TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/fetchDimensionalRankings.ts --json
 */

const PROJECT_ID = 'lootdiveapp';
const COLLECTION_NAME = 'dimensional_rankings';

// --- Args ---

function parseArgs() {
  const args = process.argv.slice(2);
  let top = 7;
  let jsonOutput = false;

  const topIdx = args.indexOf('--top');
  if (topIdx >= 0 && args[topIdx + 1]) {
    const n = parseInt(args[topIdx + 1], 10);
    if (!isNaN(n) && n > 0) top = n;
  }

  if (args.includes('--json')) {
    jsonOutput = true;
  }

  return { top, jsonOutput };
}

// --- Firestore REST API ---

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  mapValue?: { fields: Record<string, FirestoreValue> };
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
  if (val.mapValue) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields)) {
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

async function fetchRankings(topN: number) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION_NAME }],
      orderBy: [{ field: { fieldPath: 'floorReached' }, direction: 'DESCENDING' }],
      limit: topN,
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
  return results
    .filter((r: any) => r.document)
    .map((r: any) => decodeDocument(r));
}

// --- Main ---

async function main() {
  const { top, jsonOutput } = parseArgs();

  const docs = await fetchRankings(top);

  if (docs.length === 0) {
    console.log('ランキングデータなし');
    process.exit(0);
  }

  // ランク計算
  const entries = docs.map((doc: { docId: string; data: Record<string, any> }, index: number) => {
    let rank = index + 1;
    if (index > 0 && docs[index - 1].data.floorReached === doc.data.floorReached) {
      rank = (entries as any)[index - 1]?.rank ?? rank;
    }
    return { rank, docId: doc.docId, ...doc.data };
  });

  // 同率順位を再計算
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].floorReached === entries[i - 1].floorReached) {
      entries[i].rank = entries[i - 1].rank;
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(entries, null, 2));
  } else {
    console.log(`\n🏆 次元回廊ランキング TOP${top}`);
    console.log('━'.repeat(70));
    console.log(
      '  ' +
        '#'.padEnd(4) +
        '名前'.padEnd(16) +
        '到達階'.padStart(8) +
        'Lv'.padStart(5) +
        'ATK'.padStart(8) +
        'DEF'.padStart(8) +
        'HP'.padStart(8) +
        'CritC%'.padStart(8)
    );
    console.log('  ' + '-'.repeat(65));

    for (const entry of entries) {
      const stats = entry.stats || {};
      console.log(
        '  ' +
          String(entry.rank).padEnd(4) +
          (entry.name || '???').padEnd(16) +
          String(entry.floorReached || 0).padStart(8) +
          String(stats.level || entry.level || '?').padStart(5) +
          String(stats.atk || 0).padStart(8) +
          String(stats.def || 0).padStart(8) +
          String(stats.maxHp || 0).padStart(8) +
          String(stats.critChance || 0).padStart(8)
      );
    }
    console.log();

    // 詳細表示
    for (const entry of entries) {
      const stats = entry.stats || {};
      console.log(`\n--- ${entry.rank}位: ${entry.name} (${entry.type || '?'}) / 到達: ${entry.floorReached}F ---`);
      console.log(`  基本: Lv${stats.level || '?'} HP:${stats.maxHp} ATK:${stats.atk} DEF:${stats.def}`);
      console.log(`  クリ: ${stats.critChance}% / ${stats.critDamage}%ダメージ / HP回復:${stats.hpOnCrit}`);
      console.log(`  毒: ${stats.poisonChance}%付与 / ${stats.poisonDamagePct}%ダメ / more:${stats.poisonDamageMore}%`);
      console.log(`  発火: ${stats.igniteChance}%付与 / ${stats.igniteDamagePct}%ダメ / more:${stats.igniteDamageMore}%`);
      console.log(`  回復: regen:${stats.hpRegen} / onHit:${stats.hpOnHit} / onCrit:${stats.hpOnCrit}`);
      console.log(`  防御: DR:${stats.damageReduction ?? stats.damageDefer ?? 0}% / 毒DR:${stats.poisonDamageReduction}%`);
      console.log(`  速度: ${stats.attackSpeedPct}% increased / more:${stats.attackSpeedMore}% / 実効:${stats.attackSpeed?.toFixed(2)}`);
      if (stats.noDirectDamage) console.log(`  ⚡ 通常ダメージ無効`);
    }
  }

  console.log('\n完了');
  process.exit(0);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
