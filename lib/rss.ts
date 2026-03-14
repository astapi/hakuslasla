const RSS_URL = 'https://astapi.net/rss/lootdive.xml';

export type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
};

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim() ?? '';
}

function parseItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const regex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link'),
      guid: extractTag(itemXml, 'guid'),
      pubDate: extractTag(itemXml, 'pubDate'),
    });
  }
  return items;
}

/**
 * 同一guidの記事を言語で絞り込む
 * - 日本語: guidがそのまま（/enなし）の記事を優先
 * - それ以外: /en付きの記事を優先
 */
export function filterItemsByLocale(items: RssItem[], locale: string): RssItem[] {
  const isJa = locale.startsWith('ja');

  // guidでグループ化
  const grouped = new Map<string, RssItem[]>();
  for (const item of items) {
    const group = grouped.get(item.guid) ?? [];
    group.push(item);
    grouped.set(item.guid, group);
  }

  const result: RssItem[] = [];
  for (const group of grouped.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // 日本語版: linkが/enで終わらないもの、英語版: /enで終わるもの
    const jaItem = group.find((i) => !i.link.endsWith('/en'));
    const enItem = group.find((i) => i.link.endsWith('/en'));
    const preferred = isJa ? (jaItem ?? enItem) : (enItem ?? jaItem);
    if (preferred) result.push(preferred);
  }

  return result;
}

export async function fetchRssItems(): Promise<RssItem[]> {
  const response = await fetch(RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }
  const xml = await response.text();
  return parseItems(xml);
}
