# Isis Chameleon — Engineering Site (Astro)

A minimal, production-minded personal site built with Astro + Tailwind. Content is local for experience/projects and remote for blog posts (Hashnode).

## Local development

```bash
pnpm i
pnpm dev
```

Build:

```bash
pnpm build
```

Output is generated in `dist/`.

## Content management

- **Experience**: `src/content/experience/*.md`
- **Projects**: `src/content/projects/*.md`
- **Site metadata + socials**: `src/lib/site.ts`

Every placeholder is marked `TODO` and should be replaced with real data.

## Hashnode integration

Hashnode posts are fetched at build time from the public GraphQL API:

- API client: `src/lib/hashnode.ts`
- Blog index: `src/pages/blog/index.astro`
- Blog post pages: `src/pages/blog/[slug].astro`

Set the publication host (default: `isabelle.hashnode.dev`) via:

```bash
PUBLIC_HASHNODE_HOST=isabelle.hashnode.dev
```

The GraphQL queries are defined inside `src/lib/hashnode.ts` and request:
- title, slug, brief, publishedAt
- coverImage
- tags
- content (html + markdown)

Markdown is rendered with the Astro Markdown pipeline via `@astropub/md` when HTML is not available.

## Deployment (Cloudflare Pages)

1. Push this repo to GitHub.
2. In Cloudflare Pages, create a new project and select the repo.
3. Build settings:
   - **Build command**: `pnpm build`
   - **Output directory**: `dist`
4. (Optional) set env vars:
   - `PUBLIC_SITE_URL` (e.g. `https://your-domain.com`)
   - `PUBLIC_HASHNODE_HOST` (e.g. `isabelle.hashnode.dev`)

A `wrangler.toml` is included for Pages.

## Custom domain (later)

1. Add your domain in Cloudflare Pages.
2. Update DNS records as prompted by Cloudflare.
3. Update `PUBLIC_SITE_URL` or `src/lib/site.ts` once the domain is live.

## Design + performance notes

- Minimal JS (only for theme toggle, tag filter, and blog search).
- Dark mode + light mode based on system preference.
- Tailwind typography styles via `src/styles/prose.css`.
- OpenGraph + Twitter metadata via `src/components/BaseHead.astro`.
- Sitemap + RSS feed enabled (`@astrojs/sitemap`, `src/pages/rss.xml.js`).
