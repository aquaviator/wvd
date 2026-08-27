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

test('Etsy fixture routes correctly and emits each event once with consent', async ({ page }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'granted'));
  await page.reload();
  const cta = page.getByRole('link', { name: 'Continue to Etsy fixture' });
  await expect(cta).toHaveAttribute('href', 'https://example.com/etsy-fixture');
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault(), true));
  await cta.click();
  const events = await page.evaluate(() => (window as unknown as { dataLayer?: Array<{ event: string }> }).dataLayer?.map(item => item.event) ?? []);
  expect(events.filter(name => name === 'cta_click')).toHaveLength(1);
  expect(events.filter(name => name === 'etsy_outbound')).toHaveLength(1);
});

test('Etsy routing works when analytics consent is declined', async ({ page }) => {
  await page.goto('/qa/etsy-checkout/');
  await page.evaluate(() => localStorage.setItem('wvd-analytics-consent', 'declined'));
  await page.reload();
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault(), true));
  await page.getByRole('link', { name: 'Continue to Etsy fixture' }).click();
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();
});
