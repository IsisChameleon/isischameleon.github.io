import rss from '@astrojs/rss';
import { SITE } from '@/lib/site';
import { getMergedPosts } from '@/lib/posts';

export async function GET() {
  const posts = await getMergedPosts();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: SITE.url,
    items: posts.map((post) => ({
      title: post.title,
      description: post.brief,
      pubDate: new Date(post.publishedAt),
      link: `/blog/${post.slug}`,
    })),
  });
}
