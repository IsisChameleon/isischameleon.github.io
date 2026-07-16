import { SITE } from './site';

// Hashnode retired free GraphQL API access (May 2026), so posts are sourced
// from the publication's public RSS feed instead.
// NOTE: the RSS feed only exposes the most recent posts (a bounded window),
// so older posts fall off the feed as new ones are published. Mirror any post
// that must stay up as local markdown in src/content/blog/ to keep its page.
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
  } | null;
};

export const slugifyTag = (name: string): string => name.toLowerCase().replace(/\s+/g, '-');

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

// RSS <description> may carry HTML; cards render briefs as plain text.
const stripTags = (value: string): string => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const field = (block: string, tag: string): string => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeField(match[1]).trim() : '';
};

// Returns null on a malformed item so one bad entry is skipped instead of
// aborting the whole feed (new URL / toISOString both throw on bad input).
const parseItem = (block: string): HashnodePost | null => {
  try {
    const link = field(block, 'link');
    const tags = Array.from(block.matchAll(/<category>([\s\S]*?)<\/category>/g)).map((match) => {
      const name = decodeField(match[1]).trim();
      return { name, slug: slugifyTag(name) };
    });
    const enclosure = block.match(/<enclosure[^>]*url="([^"]+)"/);
    const html = field(block, 'content:encoded');

    return {
      title: field(block, 'title'),
      slug: new URL(link).pathname.replace(/^\//, ''),
      brief: stripTags(field(block, 'description')),
      publishedAt: new Date(field(block, 'pubDate')).toISOString(),
      coverImage: enclosure ? { url: enclosure[1] } : null,
      tags,
      content: html ? { html } : null,
    };
  } catch (error) {
    console.warn('[hashnode] Skipping malformed RSS item.', error);
    return null;
  }
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
      .map((block) => parseItem(block.split('</item>')[0]))
      .filter((post): post is HashnodePost => post !== null);
  } catch (error) {
    console.warn(`[hashnode] Failed to load ${FEED_URL} — building without blog posts.`, error);
    return [];
  }
};

const getFeed = (): Promise<HashnodePost[]> => {
  feedPromise ??= loadFeed();
  return feedPromise;
};

export const fetchPosts = async (limit = 10): Promise<HashnodePostSummary[]> => {
  const posts = await getFeed();
  return posts.slice(0, Math.max(0, Math.trunc(limit)));
};

export const fetchPost = async (slug: string): Promise<HashnodePost | null> => {
  const posts = await getFeed();
  return posts.find((post) => post.slug === slug) ?? null;
};
