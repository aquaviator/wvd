import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function secureForm(page: import('@playwright/test').Page) {
  await page.route('**/api/contact', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: { enabled: true, siteKey: 'browser-test-public-key' } });
    else await route.fallback();
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({ contentType: 'application/javascript', body: `window.turnstile={render:(el,opts)=>{el.textContent='Bot check complete';window.botOptions=opts;opts.callback('browser-test-token');return 'widget-id';},reset:()=>{window.botOptions.callback('browser-test-token');}};` }));
  await page.goto('/legal/contact/');
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeEnabled();
  await page.getByLabel('Your name').fill('Visitor');
  await page.getByLabel('Your email', { exact: true }).fill('visitor@example.com');
  await page.getByLabel('Message', { exact: true }).fill('My enquiry');
}

test('direct send awaits acceptance; duplicate clicks are blocked and no credentials are posted', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const posts: unknown[] = [];
  await page.route('**/api/contact', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    posts.push(route.request().postDataJSON());
    await wait;
    await route.fulfill({ json: { ok: true } });
  });
  await secureForm(page);
  await expect(page.locator('#email-fallback')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.locator('#contact-status')).toHaveText('Sending your enquiry…');
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeDisabled();
  await expect(page.locator('#contact-name')).toHaveAttribute('readonly');
  await expect(page.locator('#contact-status')).not.toContainText('submitted');
  expect(posts).toHaveLength(1);
  expect(Object.keys(posts[0] as object).sort()).toEqual(['email','message','name','submissionId','token','website']);
  release();
  await expect(page.locator('#contact-status')).toHaveText('Thank you—your enquiry has been submitted.');
  await expect(page.locator('#contact-status')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const failure of ['rejected', 'malformed', 'network', 'verification']) {
  test(`direct ${failure} failure preserves message and encoded email fallback`, async ({ page }) => {
    await page.route('**/api/contact', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      if (failure === 'network') return route.abort();
      if (failure === 'malformed') return route.fulfill({ contentType: 'text/plain', body: 'not JSON' });
      await route.fulfill({ status: failure === 'verification' ? 403 : 502, json: { ok: false, error: failure === 'verification' ? 'verification_failed' : 'delivery_failed' } });
    });
    await secureForm(page);
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    await expect(page.locator('#email-fallback')).toHaveAttribute('open');
    await expect(page.locator('#contact-status')).not.toContainText('submitted');
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('My enquiry');
    await page.getByRole('button', { name: 'Prepare email draft', exact: true }).click();
    const uri = new URL(await page.locator('#draft-link').getAttribute('href') ?? '');
    expect(uri.pathname).toBe('hello@wearvalleydigital.com');
    expect(uri.searchParams.get('body')).toContain('My enquiry');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('expired challenge disables direct sending; script failure and missing configuration provide fallback', async ({ page }) => {
  await secureForm(page);
  await page.evaluate(() => (window as unknown as { botOptions: { 'expired-callback': () => void } }).botOptions['expired-callback']());
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeDisabled();
  await page.unrouteAll();
  await page.route('**/api/contact', route => route.fulfill({ json: { enabled: false, siteKey: null } }));
  await page.reload();
  await expect(page.locator('#email-fallback')).toHaveAttribute('open');
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeDisabled();
  await page.unrouteAll();
  await page.route('**/api/contact', route => route.fulfill({ json: { enabled: true, siteKey: 'browser-test-public-key' } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.abort());
  await page.reload();
  await expect(page.locator('#email-fallback')).toHaveAttribute('open');
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeDisabled();
});
