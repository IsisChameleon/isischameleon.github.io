import { SITE } from './site';

const HASHNODE_API = 'https://gql.hashnode.com';
const HASHNODE_MAX_PAGE_SIZE = 50;

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

  const responseText = await response.text();

  if (!response.ok) {
    let details = responseText;
    try {
      const errorPayload = JSON.parse(responseText) as GraphQLResponse<unknown>;
      if (errorPayload.errors?.length) {
        details = errorPayload.errors.map((error) => error.message).join(', ');
      }
    } catch {
      // Preserve raw response text when JSON parsing is not possible.
    }

    const suffix = details ? ` - ${details}` : '';
    throw new Error(`Hashnode API error: ${response.status} ${response.statusText}${suffix}`);
  }

  const payload = JSON.parse(responseText) as GraphQLResponse<T>;

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
    query PublicationPosts($host: String!, $first: Int!, $after: String) {
      publication(host: $host) {
        posts(first: $first, after: $after) {
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
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const safeLimit = Math.max(0, Math.trunc(limit));
  if (safeLimit === 0) {
    return [];
  }

  const posts: HashnodePostSummary[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (posts.length < safeLimit && hasNextPage) {
    const first = Math.min(HASHNODE_MAX_PAGE_SIZE, safeLimit - posts.length);
    const data = await hashnodeFetch<{
      publication: {
        posts: {
          edges: Array<{ node: HashnodePostSummary }>;
          pageInfo?: { hasNextPage?: boolean | null; endCursor?: string | null } | null;
        };
      } | null;
    }>(query, { host: SITE.hashnodeHost, first, after });

    const connection = data.publication?.posts;
    if (!connection) {
      break;
    }

    posts.push(...connection.edges.map((edge) => edge.node));
    hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    after = connection.pageInfo?.endCursor ?? null;

    if (!after) {
      break;
    }
  }

  return posts;
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
