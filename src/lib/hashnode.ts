import { SITE } from './site';

// Hashnode retired free GraphQL API access (May 2026), so posts are sourced
// from the publication's public RSS feed instead.
const FEED_URL = `https://${SITE.hashnodeHost}/rss.xml`;

export type HashnodeTag = {
  name: string;
  slug: string;
};

export type HashnodePostSummary = {
  title: string;
  slug: string;
  brief: string;
  publishedAt: string;
  coverImage?: { url?: string | null } | null;
  tags: HashnodeTag[];
};

export type HashnodePost = HashnodePostSummary & {
  content?: {
    html?: string | null;
    markdown?: string | null;
  } | null;
  readTimeInMinutes?: number | null;
};

const decodeField = (value: string): string => {
  const cdata = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) return cdata[1];
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
};

const field = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeField(match[1]).trim() : '';
};

const parseItem = (block: string): HashnodePost => {
  const link = field(block, 'link');
  const tags = Array.from(block.matchAll(/<category>([\s\S]*?)<\/category>/g)).map((match) => {
    const name = decodeField(match[1]).trim();
    return { name, slug: name.toLowerCase().replace(/\s+/g, '-') };
  });
  const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"/);
  const html = field(block, 'content:encoded');

  return {
    title: field(block, 'title'),
    slug: new URL(link).pathname.replace(/^\//, ''),
    brief: field(block, 'description'),
    publishedAt: new Date(field(block, 'pubDate')).toISOString(),
    coverImage: enclosure ? { url: enclosure[1] } : null,
    tags,
    content: html ? { html } : null,
  };
};

let feedPromise: Promise<HashnodePost[]> | null = null;

const loadFeed = async (): Promise<HashnodePost[]> => {
  try {
    const response = await fetch(FEED_URL);
    if (!response.ok) {
      throw new Error(`Hashnode RSS error: ${response.status} ${response.statusText}`);
    }
    const xml = await response.text();
    return xml
      .split('<item>')
      .slice(1)
      .map((block) => parseItem(block.split('</item>')[0]));
  } catch (error) {
    console.warn(`[hashnode] Failed to load ${FEED_URL} — building without blog posts.`, error);
    return [];
  }
};

const getFeed = (): Promise<HashnodePost[]> => {
  feedPromise ??= loadFeed();
  return feedPromise;
};

export async function fetchPosts(limit = 10): Promise<HashnodePostSummary[]> {
  const posts = await getFeed();
  return posts.slice(0, Math.max(0, Math.trunc(limit)));
}

export async function fetchPost(slug: string): Promise<HashnodePost | null> {
  const posts = await getFeed();
  return posts.find((post) => post.slug === slug) ?? null;
}
