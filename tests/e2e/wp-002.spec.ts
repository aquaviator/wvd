import { test, expect } from '@playwright/test';

test('WP-002 portfolio discovery excludes paused commerce and labels development', async ({ page }) => {
  for (const route of ['/', '/products/', '/products/property/']) {
    await page.goto(route);
    await expect(page.locator('main a[href="/products/property/uk-landlord-mtd-ledger/"]')).toHaveCount(0);
  }
  await page.goto('/products/');
  await expect(page.getByRole('heading', { name: 'Products in development' })).toBeVisible();
  for (const route of ['/work/human-v1/', '/work/performance-engineering-control-plane/']) {
    const link = page.locator(`main a[href="${route}"]`);
    await expect(link).toBeVisible();
    await expect(link.locator('..')).toContainText('In development');
  }
});

test('WP-002 retains historical safeguards and bounded product claims', async ({ page }) => {
  await page.goto('/products/property/uk-landlord-mtd-ledger/');
  await expect(page.getByText('Historical product · Paused · Unavailable to purchase.')).toBeVisible();
  const cta = page.locator('#hero-cta');
  await expect(cta).toHaveAttribute('aria-disabled', 'true');
  await cta.click({ force: true });
  await expect(page).toHaveURL(/\/products\/property\/uk-landlord-mtd-ledger\/$/);
  await page.goto('/work/human-v1/');
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
  expect(data.isAccessibleForFree).toBeUndefined();
  await expect(page.getByText('Proposed future capability', { exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('Protocol V1 scope and sequencing remain unapproved.');
  await expect(page.locator('main')).toContainText('955');
  await page.goto('/work/performance-engineering-control-plane/');
  await expect(page.locator('main')).toContainText('M5.1’s local identity, permissions and audit scope is accepted.');
  await expect(page.locator('main')).toContainText('Real-source end-to-end acceptance is not claimed.');
  await expect(page.locator('main')).toContainText('Existing enterprise customers and production readiness are not claimed.');
});

