import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function structuredDataOfType(page: Page, type: string) {
  const records = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .map(text => JSON.parse(text));
  const matching = records.filter(record => [record['@type']].flat().includes(type));
  expect(matching, `one ${type} structured-data record`).toHaveLength(1);
  return matching[0];
}

for (const [path, heading] of [
  ['/', /Built with purpose\.\s*Engineered to perform\./],
  ['/services/', 'Build around your business'],
  ['/about/', 'Meet Andy Clarke'],
  ['/products/', 'Products with a purpose.'],
  ['/products/property/', 'Property'],
  ['/products/property/uk-landlord-mtd-ledger/', 'Keep your landlord bookkeeping organised'],
  ['/work/', 'Specialist knowledge, shaped into software'],
  ['/work/human-v1/', 'Human V1 — the athlete’s companion'],
  ['/work/performance-engineering-control-plane/', 'Performance Engineering starts with questions, not scripts.'],
] as const) {
  test(`${path} renders accessibly`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('case studies expose truthful software structured data', async ({ page }) => {
  for (const [route, name] of [
    ['/work/human-v1/', 'Human V1'],
    ['/work/performance-engineering-control-plane/', 'Performance Engineering Control Plane'],
  ] as const) {
    await page.goto(route);
    const data = await structuredDataOfType(page, 'SoftwareApplication');
    expect(data.name).toBe(name);
    expect(data.creator.name).toBe('Wear Valley Digital');
    expect(data.url).toBe(await page.locator('link[rel="canonical"]').getAttribute('href'));
    expect(data.aggregateRating).toBeUndefined();
    expect(data.offers).toBeUndefined();
  }
});

test('portfolio pages have no horizontal overflow at release viewports', async ({ page }) => {
  for (const route of ['/', '/products/', '/products/hospitality/', '/work/', '/work/human-v1/', '/work/performance-engineering-control-plane/']) {
    for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(viewport);
      await page.goto(route);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(sizes.client);
    }
  }
});

test('paused product keeps the live Etsy destination unavailable', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await expect(page.getByText('Currently unavailable').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Currently unavailable').first()).toHaveAttribute('href', '#');
});

test('paused product is noindex, absent from sitemap, and has no structured-data offer', async ({ page, request }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  const sitemapIndex = await (await request.get('/sitemap-index.xml')).text();
  const sitemapName = sitemapIndex.match(/<loc>[^<]*\/(sitemap-[^<]+)<\/loc>/)?.[1];
  expect(sitemapName).toBeTruthy();
  const sitemap = await (await request.get(`/${sitemapName}`)).text();
  expect(sitemap).not.toContain('/products/property/uk-landlord-mtd-ledger/');
  const product = await structuredDataOfType(page, 'Product');
  expect(product.offers).toBeUndefined();
  expect(product.subjectOf).toHaveLength(2);
  expect(product.subjectOf.every((video: { '@type': string; duration: string }) => video['@type'] === 'VideoObject' && /^PT\d{2}M\d{2}S$/.test(video.duration))).toBe(true);
});

test('product viewing keeps analytics disabled despite a legacy consent grant', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
  await expect(page.locator('#consent')).toHaveCount(0);
  await expect(page.locator('[data-product-page]')).toHaveAttribute('data-product-id', 'WVD-PROP-001');
});

test('public legal pages contain no drafting markers', async ({ page }) => {
  for (const route of ['privacy','cookies','terms','digital-product-terms','refunds','contact']) {
    await page.goto(`/legal/${route}/`);
    await expect(page.locator('main')).not.toContainText(/TODO|PLACEHOLDER|TBC|FOUNDER REVIEW|LEGAL REVIEW REQUIRED|HUMAN REVIEW/i);
  }
});

test('retired checkout routes visitors to services without commerce or tracking', async ({ page, request }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page has been retired');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.locator('main form, main input, main select, main button')).toHaveCount(0);
  await expect(page.locator('main a[href*="etsy"], main a[href*="checkout"], main a[href*="example.com"]')).toHaveCount(0);
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/qa/');
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
  const cta = page.getByRole('link', { name: 'Explore services', exact: true });
  await expect(cta).toHaveAttribute('href', '/services/');
  await cta.click();
  await expect(page).toHaveURL(/\/services\/$/);
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});

test('retired checkout enquiry route works when legacy analytics consent is declined', async ({ page }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'declined'));
  await page.reload();
  const cta = page.getByRole('link', { name: 'Start a conversation →', exact: true });
  await expect(cta).toHaveAttribute('href', '/enquire/');
  await cta.click();
  await expect(page).toHaveURL(/\/enquire\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});

test('media facades retain deferred loading and captions with analytics disabled', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  expect(await page.locator('video').count()).toBe(0);
  await page.getByRole('button', { name: 'Play video: Landlord Bookkeeping Made Practical' }).click();
  const video = page.locator('video').first();
  await expect(video).toBeVisible();
  await expect(video.locator('track')).toHaveAttribute('src', /promo-v1\.0\.1\.vtt$/);
  await video.dispatchEvent('ended');
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});

test('media playback is independent of analytics consent', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'declined'));
  await page.reload();
  await page.getByRole('button', { name: 'Play video: UK Landlord Ledger v1.0.1 Demonstration' }).click();
  await expect(page.locator('video')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});

test('product media has no horizontal overflow across release viewports', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/products/property/uk-landlord-mtd-ledger/');
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll, `Product media at ${viewport.width}px`).toBeLessThanOrEqual(sizes.client);
  }
});
