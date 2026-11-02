import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://jonasjlc.github.io',
  integrations: [
    react(),
    // /ferie/ (with its subpages) and /gave/ are unlisted, so keep them out of the sitemap.
    sitemap({ filter: (page) => !/\/(ferie|gave)(\/|$)/.test(page) }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
