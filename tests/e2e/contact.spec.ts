import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('company contact prepares a safe draft to the approved mailbox', async ({ page }) => {
  await page.goto('/legal/contact/');
  await expect(page.locator('form')).toBeVisible();
  await expect(page.getByRole('link', { name: 'hello@wearvalleydigital.com', exact: true }).first()).toHaveAttribute('href', 'mailto:hello@wearvalleydigital.com');
  await page.getByRole('button', { name: 'Prepare email draft' }).click();
  await expect(page.locator('#draft-ready')).toBeHidden();
  await page.getByLabel('Your name').fill('A & B');
  await page.getByLabel('Your email', { exact: true }).fill('visitor@example.com');
  const message = 'Hello & thanks\n?bcc=other@example.com#test';
  await page.getByLabel('Message', { exact: true }).fill(message);
  await page.getByRole('button', { name: 'Prepare email draft' }).click();
  const uri = new URL(await page.getByRole('link', { name: 'Open email draft', exact: true }).getAttribute('href') ?? '');
  expect(uri.protocol).toBe('mailto:');
  expect(uri.pathname).toBe('hello@wearvalleydigital.com');
  expect([...uri.searchParams.keys()]).toEqual(['subject', 'body']);
  expect(uri.searchParams.get('subject')).toBe('WVD general enquiry');
  expect(uri.searchParams.get('body')).toBe(`Name: A & B\nReply email: visitor@example.com\n\n${message}`);
  await expect(page.getByRole('link', { name: 'Open email draft', exact: true })).toBeFocused();
  await expect(page.locator('main')).toContainText('No message is sent or stored by this website.');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel('Message', { exact: true }).fill('Changed');
  await expect(page.locator('#draft-ready')).toBeHidden();
  await expect(page.locator('#draft-link')).not.toHaveAttribute('href');
});

test('general enquiry CTAs and historical order support stay separate', async ({ page }) => {
  for (const route of ['/', '/products/', '/work/human-v1/', '/work/performance-engineering-control-plane/']) {
    await page.goto(route);
    const contact = page.locator('a[href="/legal/contact/"]').first();
    await contact.click();
    await expect(page).toHaveURL(/\/legal\/contact\/$/);
    await expect(page.getByRole('heading', { name: 'Contact', exact: true })).toBeVisible();
    await expect(page.locator('main a[href*="etsy.com/uk/listing/"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Etsy purchase and order conversation' })).toHaveAttribute('href', 'https://www.etsy.com/your/purchases');
  }
});

test('contact without scripts offers email without exposing form fields in the URL', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/legal/contact/');
  await expect(page.locator('form')).toBeHidden();
  await expect(page.getByRole('link', { name: 'hello@wearvalleydigital.com', exact: true }).first()).toBeVisible();
  await context.close();
});
