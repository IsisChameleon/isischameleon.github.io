import { SITE } from './site';

const HASHNODE_API = 'https://gql.hashnode.com';

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

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function hashnodeFetch<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(HASHNODE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Hashnode API error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(', '));
  }

  if (!payload.data) {
    throw new Error('Hashnode API returned no data.');
  }

  return payload.data;
}

export async function fetchPosts(limit = 10): Promise<HashnodePostSummary[]> {
  const query = `
    query PublicationPosts($host: String!, $first: Int!) {
      publication(host: $host) {
        posts(first: $first) {
          edges {
            node {
              title
              slug
              brief
              publishedAt
              coverImage { url }
              tags { name slug }
            }
          }
        }
      }
    }
  `;

  const data = await hashnodeFetch<{
    publication: {
      posts: { edges: Array<{ node: HashnodePostSummary }> };
    } | null;
  }>(query, { host: SITE.hashnodeHost, first: limit });

  return data.publication?.posts.edges.map((edge) => edge.node) ?? [];
}

export async function fetchPost(slug: string): Promise<HashnodePost | null> {
  const query = `
    query PublicationPost($host: String!, $slug: String!) {
      publication(host: $host) {
        post(slug: $slug) {
          title
          slug
          brief
          publishedAt
          readTimeInMinutes
          coverImage { url }
          tags { name slug }
          content { html markdown }
        }
      }
    }
  `;

  const data = await hashnodeFetch<{
    publication: { post: HashnodePost | null } | null;
  }>(query, { host: SITE.hashnodeHost, slug });

  return data.publication?.post ?? null;
}
