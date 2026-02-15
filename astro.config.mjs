import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import sitemap from '@astrojs/sitemap';
import markdownIntegration from '@astropub/md';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  site: 'https://isischameleon.github.io',
  output: 'static',
  integrations: [
    markdownIntegration(),
    sitemap(),
  ],
  vite: {
    resolve: {
      alias: {
        '@': srcDir,
      },
    },
  },
});
