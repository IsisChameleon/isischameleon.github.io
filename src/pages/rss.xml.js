import rss from '@astrojs/rss';
import { SITE } from '@/lib/site';
import { fetchPosts } from '@/lib/hashnode';

export async function GET() {
  const posts = await fetchPosts(100);

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
