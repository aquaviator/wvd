import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [path, heading] of [
  ['/', 'Practical digital tools for real-world problems'],
  ['/products/', 'Useful tools, clearly explained'],
  ['/products/property/', 'Property'],
  ['/products/property/uk-landlord-mtd-ledger/', 'Keep your landlord bookkeeping organised'],
] as const) {
  test(`${path} renders accessibly`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

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
  const data = await page.locator('script[type="application/ld+json"]').first().textContent();
  const product = JSON.parse(data ?? '{}');
  expect(product.offers).toBeUndefined();
  expect(product.subjectOf).toHaveLength(2);
  expect(product.subjectOf.every((video: { '@type': string; duration: string }) => video['@type'] === 'VideoObject' && /^PT\d{2}M\d{2}S$/.test(video.duration))).toBe(true);
});

test('product view fires once with canonical product context after consent', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  const events = await page.evaluate(() => (window as unknown as { dataLayer?: Array<Record<string,string>> }).dataLayer ?? []);
  const views = events.filter(item => item.event === 'product_view');
  expect(views).toHaveLength(1);
  expect(views[0]).toMatchObject({ product_id:'WVD-PROP-001', product_slug:'uk-landlord-mtd-ledger', category:'property', funnel_version:'1.0.1' });
});

test('public legal pages contain no drafting markers', async ({ page }) => {
  for (const route of ['privacy','cookies','terms','digital-product-terms','refunds','contact']) {
    await page.goto(`/legal/${route}/`);
    await expect(page.locator('main')).not.toContainText(/TODO|PLACEHOLDER|TBC|FOUNDER REVIEW|LEGAL REVIEW REQUIRED|HUMAN REVIEW/i);
  }
});

test('Etsy fixture routes correctly and emits each event once with consent', async ({ page }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  const cta = page.getByRole('link', { name: 'Continue to Etsy fixture' });
  await expect(cta).toHaveAttribute('href', 'https://example.com/etsy-fixture');
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault(), true));
  await cta.click();
  const events = await page.evaluate(() => (window as unknown as { dataLayer?: Array<Record<string,string>> }).dataLayer ?? []);
  expect(events.filter(item => item.event === 'cta_click')).toHaveLength(1);
  expect(events.filter(item => item.event === 'etsy_outbound')).toHaveLength(1);
  expect(events.find(item => item.event === 'etsy_outbound')).toMatchObject({product_id:'WVD-QA-001',product_slug:'etsy-checkout-fixture',category:'qa',funnel_version:'fixture-1'});
});

test('Etsy routing works when analytics consent is declined', async ({ page }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'declined'));
  await page.reload();
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault(), true));
  await page.getByRole('link', { name: 'Continue to Etsy fixture' }).click();
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});

test('media facades defer video loading and emit start and complete events', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  expect(await page.locator('video').count()).toBe(0);
  await page.getByRole('button', { name: 'Play video: Landlord Bookkeeping Made Practical' }).click();
  const video = page.locator('video').first();
  await expect(video).toBeVisible();
  await expect(video.locator('track')).toHaveAttribute('src', /promo-v1\.0\.1\.vtt$/);
  await video.dispatchEvent('ended');
  const events = await page.evaluate(() => (window as unknown as { dataLayer?: Array<{ event: string }> }).dataLayer?.map(item => item.event) ?? []);
  expect(events.filter(name => name === 'promo_video_start')).toHaveLength(1);
  expect(events.filter(name => name === 'promo_video_complete')).toHaveLength(1);
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
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  }
});
