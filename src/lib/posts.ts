import { getCollection, type CollectionEntry } from 'astro:content';
import { fetchPosts, type HashnodePostSummary } from './hashnode';

// Unified card shape shared by Hashnode-mirrored posts and local Markdown posts.
export type PostSummary = HashnodePostSummary & { source: 'hashnode' | 'local' };

const localToSummary = (entry: CollectionEntry<'blog'>): PostSummary => ({
  title: entry.data.title,
  slug: entry.slug,
  brief: entry.data.description,
  publishedAt: entry.data.date.toISOString(),
  coverImage: null,
  tags: entry.data.tags.map((name) => ({ name, slug: name.toLowerCase().replace(/\s+/g, '-') })),
  source: 'local',
});

// Drafts are hidden in production builds but visible in dev for previewing.
export const getLocalPosts = async (): Promise<CollectionEntry<'blog'>[]> =>
  await getCollection('blog', ({ data }) => import.meta.env.PROD ? data.draft !== true : true);

export const getMergedPosts = async (limit?: number): Promise<PostSummary[]> => {
  const [hashnode, local] = await Promise.all([fetchPosts(1000), getLocalPosts()]);
  const merged: PostSummary[] = [
    ...hashnode.map((post) => ({ ...post, source: 'hashnode' as const })),
    ...local.map(localToSummary),
  ].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return typeof limit === 'number' ? merged.slice(0, limit) : merged;
};
