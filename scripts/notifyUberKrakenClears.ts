/**
 * UberUberクラーケンの新規クリアを検知して Discord に通知する。
 *
 * Firestore の `uber_uber_kraken_clears` コレクションを REST API でポーリングし、
 * まだ通知していないドキュメント（discordNotified が未設定）を Discord Webhook へ送信する。
 * 通知済みのドキュメントには discordNotified=true を書き戻すため、
 * CI ランナー側に状態を持つ必要がなく、重複通知を防げる。
 *
 * 環境変数:
 *   DISCORD_WEBHOOK_URL  (必須) 通知先の Discord Webhook URL
 *   DRY_RUN=1            (任意) Discord送信・Firestore更新を行わずログ出力のみ
 *
 * 使用例:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx \
 *     TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/notifyUberKrakenClears.ts
 */

const PROJECT_ID = 'lootdiveapp';
const COLLECTION_NAME = 'uber_uber_kraken_clears';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const DRY_RUN = process.env.DRY_RUN === '1';

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

async function fetchClears(): Promise<{ docId: string; data: Record<string, any> }[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
      from: [{ collectionId: COLLECTION_NAME }],
      // 古いクリアから順に通知する
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
  return results
    .filter((r: any) => r.document)
    .map((r: any) => decodeDocument(r));
}

/**
 * 通知済みフラグを Firestore に書き戻す（他フィールドは updateMask で保持）。
 */
async function markNotified(docId: string, nowIso: string): Promise<void> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}/${docId}` +
    `?updateMask.fieldPaths=discordNotified&updateMask.fieldPaths=discordNotifiedAt`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        discordNotified: { booleanValue: true },
        discordNotifiedAt: { timestampValue: nowIso },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH error (${res.status}): ${text}`);
  }
}

// --- Discord ---

const CLASS_LABELS: Record<string, string> = {
  warrior: 'ウォリアー',
  elementalist: 'エレメンタリスト',
  ranger: 'レンジャー',
  frostmage: 'フロストメイジ',
  tamer: 'テイマー',
};

function buildDiscordPayload(data: Record<string, any>): unknown {
  const stats = data.stats || {};
  const classLabel = CLASS_LABELS[data.type] || data.type || '?';
  const name = data.name || '???';
  const level = data.level ?? stats.level ?? '?';
  const season = data.season ?? '?';

  return {
    embeds: [
      {
        title: '🦑 UberUberクラーケン 撃破！',
        description: `**${name}** (${classLabel} / Lv${level}) が UberUberクラーケンを初クリアしました！`,
        color: 0x1abc9c,
        fields: [
          { name: 'HP', value: String(stats.maxHp ?? '?'), inline: true },
          { name: 'ATK', value: String(stats.atk ?? '?'), inline: true },
          { name: 'DEF', value: String(stats.def ?? '?'), inline: true },
          { name: 'Season', value: String(season), inline: true },
        ],
        timestamp: data.updatedAt || undefined,
      },
    ],
  };
}

async function sendDiscord(payload: unknown): Promise<void> {
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook error (${res.status}): ${text}`);
  }
}

// --- Main ---

async function main() {
  if (!DISCORD_WEBHOOK_URL && !DRY_RUN) {
    console.error('環境変数 DISCORD_WEBHOOK_URL が未設定です');
    process.exit(1);
  }

  const docs = await fetchClears();
  const pending = docs.filter((d) => d.data.discordNotified !== true);

  console.log(`取得: ${docs.length}件 / 未通知: ${pending.length}件`);

  if (pending.length === 0) {
    console.log('新規クリアなし');
    process.exit(0);
  }

  // Firestore の timestampValue は "毎回同じ" を保証したいので固定。
  const nowIso = new Date().toISOString();

  let notified = 0;
  for (const doc of pending) {
    const label = `${doc.data.name || '???'} (${doc.docId})`;
    if (DRY_RUN) {
      console.log(`[DRY_RUN] 通知対象: ${label}`);
      continue;
    }

    try {
      await sendDiscord(buildDiscordPayload(doc.data));
      await markNotified(doc.docId, nowIso);
      notified++;
      console.log(`通知完了: ${label}`);
    } catch (err) {
      // 1件失敗しても他を止めない。未通知のまま残るので次回リトライされる。
      console.error(`通知失敗: ${label}`, err);
    }
  }

  console.log(`\n完了（${notified}/${pending.length}件 通知）`);
  process.exit(0);
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
