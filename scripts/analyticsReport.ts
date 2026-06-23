/**
 * App Store Connect Analytics Report 取得・分析スクリプト
 *
 * 使用例:
 * # レポートリクエスト作成（初回のみ）
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/analyticsReport.ts --create
 *
 * # レポート取得・分析（デフォルト）
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/analyticsReport.ts
 *
 * # 特定カテゴリのみ
 * TSX_TSCONFIG_PATH=tsconfig.scripts.json tsx scripts/analyticsReport.ts --category APP_USAGE
 */

import { apiRequest, validateConfig, config } from './appStoreConnect';
import * as zlib from 'zlib';

// --- Types ---

type ReportCategory = 'APP_USAGE' | 'APP_STORE_ENGAGEMENT' | 'COMMERCE';

interface AnalyticsReportRequestData {
  id: string;
  type: string;
  attributes: {
    accessType: 'ONGOING' | 'ONE_TIME_SNAPSHOT';
    stoppedDueToInactivity: boolean;
  };
}

interface AnalyticsReportRequestsResponse {
  data: AnalyticsReportRequestData[];
  links?: { next?: string };
}

interface AnalyticsReportData {
  id: string;
  type: string;
  attributes: {
    category: ReportCategory;
    name: string;
  };
}

interface AnalyticsReportsResponse {
  data: AnalyticsReportData[];
  links?: { next?: string };
}

interface AnalyticsReportInstanceData {
  id: string;
  type: string;
  attributes: {
    granularity: string;
    processingDate: string;
  };
}

interface AnalyticsReportInstancesResponse {
  data: AnalyticsReportInstanceData[];
  links?: { next?: string };
}

interface AnalyticsReportSegmentData {
  id: string;
  type: string;
  attributes: {
    checksum: string;
    sizeInBytes: number;
    url: string;
  };
}

interface AnalyticsReportSegmentsResponse {
  data: AnalyticsReportSegmentData[];
}

// --- Helper Functions ---

function parseTSV(tsvContent: string): Record<string, string>[] {
  const lines = tsvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header.trim()] = values[i]?.trim() || '';
    });
    return record;
  });
}

async function downloadGzipTSV(
  url: string
): Promise<Record<string, string>[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  let content: string;
  try {
    content = zlib.gunzipSync(buffer).toString('utf-8');
  } catch {
    // gzip展開に失敗した場合、生データとして扱う
    content = buffer.toString('utf-8');
  }

  return parseTSV(content);
}

function getDateNDaysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().split('T')[0];
}

// --- API Functions ---

async function createReportRequest(): Promise<void> {
  console.log('📊 Analytics レポートリクエストを作成中...\n');

  // 既存リクエストをチェック
  const existing = await apiRequest<AnalyticsReportRequestsResponse>(
    `/apps/${config.appId}/analyticsReportRequests`
  );

  if (existing.data.length > 0) {
    console.log('既存のレポートリクエスト:');
    existing.data.forEach((req) => {
      console.log(`  ID: ${req.id}`);
      console.log(`  accessType: ${req.attributes.accessType}`);
      console.log(
        `  stoppedDueToInactivity: ${req.attributes.stoppedDueToInactivity}`
      );
      console.log();
    });

    const hasSnapshot = existing.data.some(
      (req) => req.attributes.accessType === 'ONE_TIME_SNAPSHOT'
    );
    if (hasSnapshot) {
      console.log('⚠️  ONE_TIME_SNAPSHOT リクエストが既に存在します。');
      return;
    }
  }

  // 新規リクエスト作成
  const body = {
    data: {
      type: 'analyticsReportRequests',
      attributes: {
        accessType: 'ONE_TIME_SNAPSHOT',
      },
      relationships: {
        app: {
          data: {
            type: 'apps',
            id: config.appId,
          },
        },
      },
    },
  };

  const result = await apiRequest<{ data: AnalyticsReportRequestData }>(
    '/analyticsReportRequests',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  console.log('✅ レポートリクエストを作成しました');
  console.log(`   ID: ${result.data.id}`);
  console.log(`   accessType: ${result.data.attributes.accessType}`);
  console.log('\n⏳ データが利用可能になるまで1-2日かかる場合があります。');
}

async function fetchReports(category?: string): Promise<void> {
  const categories: ReportCategory[] = category
    ? [category as ReportCategory]
    : ['APP_USAGE', 'APP_STORE_ENGAGEMENT', 'COMMERCE'];

  console.log('📊 Analytics レポートを取得中...\n');

  // レポートリクエスト一覧を取得
  const requests = await apiRequest<AnalyticsReportRequestsResponse>(
    `/apps/${config.appId}/analyticsReportRequests`
  );

  if (requests.data.length === 0) {
    console.log('⚠️  レポートリクエストが見つかりません。');
    console.log('   まず --create でリクエストを作成してください。');
    return;
  }

  console.log(`${requests.data.length} 件のレポートリクエストが見つかりました\n`);

  const thirtyDaysAgo = getDateNDaysAgo(30);

  for (const request of requests.data) {
    console.log(
      `━━━ リクエスト ${request.id} (${request.attributes.accessType}) ━━━\n`
    );

    for (const cat of categories) {
      try {
        await fetchCategoryReport(request.id, cat, thirtyDaysAgo);
      } catch (error) {
        console.log(
          `⚠️  ${cat}: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }
  }
}

async function fetchCategoryReport(
  requestId: string,
  category: ReportCategory,
  sinceDate: string
): Promise<void> {
  // カテゴリ別レポート一覧を取得
  const reports = await apiRequest<AnalyticsReportsResponse>(
    `/analyticsReportRequests/${requestId}/reports?filter[category]=${category}`
  );

  if (reports.data.length === 0) {
    console.log(`📭 ${category}: レポートなし\n`);
    return;
  }

  console.log(`📈 ${category} (${reports.data.length} レポート)`);

  for (const report of reports.data) {
    console.log(`\n  📋 ${report.attributes.name}`);

    // 日次インスタンスを取得
    const instances = await apiRequest<AnalyticsReportInstancesResponse>(
      `/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=200`
    );

    if (instances.data.length === 0) {
      console.log('     データなし');
      continue;
    }

    // 日付でソート・フィルタ（直近30日）
    const filtered = instances.data
      .filter((inst) => inst.attributes.processingDate >= sinceDate)
      .sort((a, b) =>
        a.attributes.processingDate.localeCompare(b.attributes.processingDate)
      );

    if (filtered.length === 0) {
      console.log('     直近30日のデータなし');
      continue;
    }

    console.log(`     ${filtered.length} 日分のデータ`);

    // 最新インスタンスのセグメントを取得してダウンロード
    const latest = filtered[filtered.length - 1];
    console.log(`     最新日付: ${latest.attributes.processingDate}`);

    try {
      const segments = await apiRequest<AnalyticsReportSegmentsResponse>(
        `/analyticsReportInstances/${latest.id}/segments`
      );

      if (segments.data.length === 0) {
        console.log('     セグメントなし');
        continue;
      }

      for (const segment of segments.data) {
        console.log(
          `     ダウンロード中... (${(segment.attributes.sizeInBytes / 1024).toFixed(1)} KB)`
        );
        const records = await downloadGzipTSV(segment.attributes.url);

        if (records.length === 0) {
          console.log('     データが空です');
          continue;
        }

        analyzeData(category, report.attributes.name, records);
      }
    } catch (error) {
      console.log(
        `     ⚠️  セグメント取得エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log();
}

// --- Analysis ---

function analyzeData(
  _category: ReportCategory,
  reportName: string,
  records: Record<string, string>[]
): void {
  console.log(`\n     --- ${reportName} 分析結果 (${records.length} 行) ---`);

  const columns = Object.keys(records[0]);
  console.log(`     カラム: ${columns.join(', ')}`);

  // 数値カラムを特定
  const numericColumns: string[] = [];
  for (const col of columns) {
    const sampleValues = records
      .slice(0, 10)
      .map((r) => r[col])
      .filter((v) => v !== '');
    if (
      sampleValues.length > 0 &&
      sampleValues.every((v) => !isNaN(Number(v)))
    ) {
      numericColumns.push(col);
    }
  }

  if (numericColumns.length === 0) {
    // 数値カラムがない場合はサンプルデータを表示
    console.log('\n     サンプルデータ:');
    records.slice(0, 5).forEach((record) => {
      const entries = columns.map((col) => `${col}=${record[col]}`).join(', ');
      console.log(`       ${entries}`);
    });
    return;
  }

  // 数値カラムのサマリー
  console.log('\n     数値サマリー:');
  for (const col of numericColumns) {
    const values = records.map((r) => Number(r[col])).filter((v) => !isNaN(v));
    if (values.length === 0) continue;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    console.log(`       ${col}:`);
    console.log(`         合計: ${sum.toLocaleString()}`);
    console.log(`         平均: ${avg.toFixed(1)}`);
    console.log(
      `         最大: ${max.toLocaleString()} / 最小: ${min.toLocaleString()}`
    );
  }

  // 日付カラムがあれば直近データを表示
  const dateCol = columns.find(
    (c) =>
      c.toLowerCase().includes('date') || c.toLowerCase().includes('day')
  );

  if (dateCol) {
    console.log(`\n     直近5件:`);
    const recentRecords = records.slice(-5);
    for (const record of recentRecords) {
      const metrics = numericColumns
        .map((col) => `${col}: ${Number(record[col]).toLocaleString()}`)
        .join(' | ');
      console.log(`       ${record[dateCol]} → ${metrics}`);
    }
  }
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);

  try {
    validateConfig();
  } catch (error) {
    console.error(
      `❌ ${error instanceof Error ? error.message : String(error)}`
    );
    console.error('   .env ファイルに必要な環境変数を設定してください。');
    process.exit(1);
  }

  try {
    if (args.includes('--create')) {
      await createReportRequest();
    } else {
      const categoryIdx = args.indexOf('--category');
      const category =
        categoryIdx >= 0 ? args[categoryIdx + 1] : undefined;
      await fetchReports(category);
    }
  } catch (error) {
    console.error(
      '\n❌ エラー:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
