const RSS_URL = 'https://astapi.net/rss/lootdive.xml';

export type RssItem = {
  title: string;
  link: string;
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
      pubDate: extractTag(itemXml, 'pubDate'),
    });
  }
  return items;
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
