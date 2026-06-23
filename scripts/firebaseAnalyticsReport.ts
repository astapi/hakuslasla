/**
 * Firebase Analytics (GA4) dungeon_clear イベント分析スクリプト
 *
 * 対象ダンジョン:
 * - uber_goblin_king (Uberゴブリンキング)
 * - uber_demon_lord (Uber魔王)
 * - uber_true_final_boss (Uber終焉の王)
 * - dimensional_rush_6 (異次元ラッシュ200F)
 *
 * 使用例:
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/firebaseAnalyticsReport.ts
 *
 * # 期間指定（デフォルト: 30日）
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/firebaseAnalyticsReport.ts --days 90
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// --- Config ---

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const GA4_KEY_FILE = process.env.GA4_KEY_FILE;

if (!GA4_PROPERTY_ID || !GA4_KEY_FILE) {
  console.error('❌ .env に GA4_PROPERTY_ID と GA4_KEY_FILE を設定してください');
  process.exit(1);
}

const keyFilePath = path.resolve(GA4_KEY_FILE);

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: keyFilePath,
});

const TARGET_DUNGEON_IDS = [
  'uber_goblin_king',
  'uber_demon_lord',
  'uber_true_final_boss',
  'dimensional_rush_6',
];

const DUNGEON_LABELS: Record<string, string> = {
  uber_goblin_king: 'Uberゴブリンキング',
  uber_demon_lord: 'Uber魔王',
  uber_true_final_boss: 'Uber終焉の王',
  dimensional_rush_6: '異次元ラッシュ200F',
};

// --- Helper ---

function getDaysFromArgs(): number {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  if (daysIdx >= 0 && args[daysIdx + 1]) {
    const days = parseInt(args[daysIdx + 1], 10);
    if (!isNaN(days) && days > 0) return days;
  }
  return 30;
}

function formatDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// --- Report Functions ---

async function fetchDungeonClearSummary(days: number): Promise<void> {
  console.log(`\n📊 dungeon_clear イベント サマリー（直近${days}日）`);
  console.log('━'.repeat(60));

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'customEvent:dungeon_id' }],
    metrics: [
      { name: 'eventCount' },
      { name: 'totalUsers' },
    ],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'dungeon_clear', matchType: 'EXACT' },
            },
          },
          {
            filter: {
              fieldName: 'customEvent:dungeon_id',
              inListFilter: { values: TARGET_DUNGEON_IDS },
            },
          },
        ],
      },
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
  });

  if (!response.rows || response.rows.length === 0) {
    console.log('\n  データなし\n');
    return;
  }

  console.log(
    '\n  ' +
      'ダンジョン'.padEnd(28) +
      'クリア回数'.padStart(10) +
      'ユニークユーザー'.padStart(16)
  );
  console.log('  ' + '-'.repeat(54));

  for (const row of response.rows) {
    const dungeonId = row.dimensionValues?.[0]?.value || '';
    const label = DUNGEON_LABELS[dungeonId] || dungeonId;
    const eventCount = row.metricValues?.[0]?.value || '0';
    const users = row.metricValues?.[1]?.value || '0';

    console.log(
      '  ' +
        label.padEnd(28) +
        eventCount.padStart(10) +
        users.padStart(16)
    );
  }
  console.log();
}

async function fetchDailyTrend(days: number): Promise<void> {
  console.log(`📈 日別クリア数推移（直近${days}日）`);
  console.log('━'.repeat(60));

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [
      { name: 'date' },
      { name: 'customEvent:dungeon_id' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'dungeon_clear', matchType: 'EXACT' },
            },
          },
          {
            filter: {
              fieldName: 'customEvent:dungeon_id',
              inListFilter: { values: TARGET_DUNGEON_IDS },
            },
          },
        ],
      },
    },
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  });

  if (!response.rows || response.rows.length === 0) {
    console.log('\n  データなし\n');
    return;
  }

  // 日付ごとにグループ化
  const dailyData: Record<string, Record<string, number>> = {};
  for (const row of response.rows) {
    const dateRaw = row.dimensionValues?.[0]?.value || '';
    const date = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    const dungeonId = row.dimensionValues?.[1]?.value || '';
    const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

    if (!dailyData[date]) dailyData[date] = {};
    dailyData[date][dungeonId] = count;
  }

  // ヘッダー
  const shortLabels: Record<string, string> = {
    uber_goblin_king: 'ゴブリン',
    uber_demon_lord: '魔王',
    uber_true_final_boss: '終焉',
    dimensional_rush_6: '異次元',
  };

  console.log(
    '\n  ' +
      '日付'.padEnd(14) +
      TARGET_DUNGEON_IDS.map((id) => (shortLabels[id] || id).padStart(8)).join('')
  );
  console.log('  ' + '-'.repeat(14 + 8 * TARGET_DUNGEON_IDS.length));

  const dates = Object.keys(dailyData).sort();
  for (const date of dates) {
    const row = dailyData[date];
    const values = TARGET_DUNGEON_IDS.map((id) =>
      String(row[id] || 0).padStart(8)
    ).join('');
    console.log(`  ${date}  ${values}`);
  }
  console.log();
}

async function fetchFloorStats(days: number): Promise<void> {
  console.log(`🏰 クリア階層分布（直近${days}日）`);
  console.log('━'.repeat(60));

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [
      { name: 'customEvent:dungeon_id' },
      { name: 'customEvent:floors_cleared' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'eventName',
              stringFilter: { value: 'dungeon_clear', matchType: 'EXACT' },
            },
          },
          {
            filter: {
              fieldName: 'customEvent:dungeon_id',
              inListFilter: { values: TARGET_DUNGEON_IDS },
            },
          },
        ],
      },
    },
    orderBys: [
      { dimension: { dimensionName: 'customEvent:dungeon_id' } },
      { dimension: { dimensionName: 'customEvent:floors_cleared' } },
    ],
  });

  if (!response.rows || response.rows.length === 0) {
    console.log('\n  データなし\n');
    return;
  }

  // ダンジョンごとにグループ化
  const floorData: Record<string, { floor: string; count: number }[]> = {};
  for (const row of response.rows) {
    const dungeonId = row.dimensionValues?.[0]?.value || '';
    const floor = row.dimensionValues?.[1]?.value || '';
    const count = parseInt(row.metricValues?.[0]?.value || '0', 10);

    if (!floorData[dungeonId]) floorData[dungeonId] = [];
    floorData[dungeonId].push({ floor, count });
  }

  for (const dungeonId of TARGET_DUNGEON_IDS) {
    const label = DUNGEON_LABELS[dungeonId] || dungeonId;
    const data = floorData[dungeonId];

    if (!data || data.length === 0) {
      console.log(`\n  ${label}: データなし`);
      continue;
    }

    const totalClears = data.reduce((sum, d) => sum + d.count, 0);
    console.log(`\n  ${label} (合計: ${totalClears}回)`);

    // 階層で数値ソート
    data.sort((a, b) => {
      const na = parseInt(a.floor, 10);
      const nb = parseInt(b.floor, 10);
      if (isNaN(na) || isNaN(nb)) return a.floor.localeCompare(b.floor);
      return na - nb;
    });

    for (const { floor, count } of data) {
      const bar = '█'.repeat(Math.min(count, 40));
      console.log(`    ${(floor + 'F').padStart(6)}: ${bar} ${count}`);
    }
  }
  console.log();
}

// --- Main ---

async function main() {
  const days = getDaysFromArgs();

  console.log('🔥 Firebase Analytics レポート');
  console.log(`   プロパティID: ${GA4_PROPERTY_ID}`);
  console.log(`   期間: ${formatDate(days)} 〜 ${formatDate(0)}`);

  try {
    await fetchDungeonClearSummary(days);
    await fetchDailyTrend(days);
    await fetchFloorStats(days);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ エラー: ${error.message}`);
      if (error.message.includes('PERMISSION_DENIED')) {
        console.error(
          '\n💡 サービスアカウントに「Google Analytics データ閲覧者」ロールが付与されているか確認してください。'
        );
      }
      if (error.message.includes('NOT_FOUND')) {
        console.error(
          `\n💡 GA4プロパティID (${GA4_PROPERTY_ID}) が正しいか確認してください。`
        );
      }
    } else {
      console.error('\n❌ エラー:', error);
    }
    process.exit(1);
  }
}

main();
