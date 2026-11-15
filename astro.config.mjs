import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Development-only UI gallery for /strandparken. The page lives outside src/pages and is injected only for
// `astro dev`, so a production build never contains it.
const strandparkenGallery = {
  name: 'strandparken-gallery',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev') injectRoute({ pattern: '/strandparken/galleri', entrypoint: './src/dev/strandparken/gallery.astro' });
    },
  },
};

export default defineConfig({
  site: 'https://jonasjlc.github.io',
  integrations: [
    react(),
    strandparkenGallery,
    // /ferie/ (with its subpages), /gave/ and /strandparken/ are unlisted, so keep them out of the sitemap.
    sitemap({ filter: (page) => !/\/(ferie|gave|strandparken)(\/|$)/.test(page) }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
