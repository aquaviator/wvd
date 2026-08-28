import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadProducts } from './src/lib/validation/load';
import { isPubliclyIndexable } from './src/lib/product/visibility';

const productUrls = loadProducts().map(({ product, seo }) => ({ url: seo.canonical, indexable: isPubliclyIndexable(product) }));

export default defineConfig({
  site: 'https://wearvalleydigital.com',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/qa/') && !productUrls.some(product => page === product.url && !product.indexable) })],
  build: { format: 'directory' }
});
