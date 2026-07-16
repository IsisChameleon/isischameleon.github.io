import { getCollection, type CollectionEntry } from 'astro:content';
import { fetchPosts, slugifyTag, type HashnodePostSummary } from './hashnode';

// Unified card shape shared by Hashnode-mirrored posts and local Markdown posts.
export type PostSummary = HashnodePostSummary & { source: 'hashnode' | 'local' };

const localToSummary = (entry: CollectionEntry<'blog'>): PostSummary => ({
  title: entry.data.title,
  slug: entry.slug,
  brief: entry.data.description,
  publishedAt: entry.data.date.toISOString(),
  coverImage: entry.data.cover ? { url: entry.data.cover } : null,
  tags: entry.data.tags.map((name) => ({ name, slug: slugifyTag(name) })),
  source: 'local',
});

// Drafts are hidden in production builds but visible in dev for previewing.
export const getLocalPosts = async (): Promise<CollectionEntry<'blog'>[]> =>
  await getCollection('blog', ({ data }) => import.meta.env.PROD ? data.draft !== true : true);

// The single source of the slug-collision rule: local posts win, so a
// Hashnode post shadowed by a local one is dropped here for BOTH the list
// views (getMergedPosts) and the route set (blog/[slug] getStaticPaths).
export const getPostSources = async () => {
  const [hashnode, local] = await Promise.all([fetchPosts(1000), getLocalPosts()]);
  const localSlugs = new Set(local.map((entry) => entry.slug));
  return { local, hashnode: hashnode.filter((post) => !localSlugs.has(post.slug)) };
};

export const getMergedPosts = async (limit?: number): Promise<PostSummary[]> => {
  const { hashnode, local } = await getPostSources();
  const merged: PostSummary[] = [
    ...hashnode.map((post) => ({ ...post, source: 'hashnode' as const })),
    ...local.map(localToSummary),
  ].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return typeof limit === 'number' ? merged.slice(0, limit) : merged;
};
