import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadProducts } from './src/lib/validation/load';
import { isPubliclyIndexable } from './src/lib/product/visibility';

const hiddenProductPaths = loadProducts().filter(({ product }) => !isPubliclyIndexable(product)).map(({ seo }) => new URL(seo.canonical).pathname.replace(/\/+$/, ''));
// Use the verified public origin until the custom domain completes DNS/TLS setup.
const publicSiteUrl = process.env.WVD_PUBLIC_SITE_URL || 'https://wear-valley-digital.leatfield.chatgpt.site';

export default defineConfig({
  site: publicSiteUrl,
  output: 'static',
  integrations: [sitemap({ filter: (page) => { const path = new URL(page).pathname; return !['/qa/', '/demos/', '/legal/', '/products/property/'].some(prefix => path.startsWith(prefix)) && !hiddenProductPaths.includes(path.replace(/\/+$/, '')); } })],
  build: { format: 'directory' }
});
