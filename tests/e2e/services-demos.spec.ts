import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';

// Keep all full-page views within the existing 5 MiB evidence budget.
async function saveScreenshot(page: Page, path: string) {
  const buffer = await page.screenshot({type:'png',fullPage:true,scale:'css'});
  await sharp(buffer).png({palette:true,colours:128,effort:10}).toFile(path);
}

import AxeBuilder from '@axe-core/playwright';

for (const route of ['/', '/services/', '/enquire/', '/about/', '/products/', '/products/salon/', '/products/wedding/', '/products/hospitality/', '/demos/', '/demos/hospitality/', '/demos/salon/', '/insights/', '/insights/website-brief/', '/insights/care-and-development/', '/insights/ownership-and-handover/', '/insights/when-to-automate/']) {
  test(`${route} new delivery pages are accessible and fit narrow screens`, async ({page},testInfo) => {
    await page.goto(route);
    await expect(page.getByRole('heading', {level:1})).toBeVisible();
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    const originalViewport=page.viewportSize();
    await page.setViewportSize({width:320,height:700});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if(route.startsWith('/insights/')&&process.env.WVD_PUBLIC_EVIDENCE_DIR){
      if(originalViewport)await page.setViewportSize(originalViewport);
      const directory=process.env.WVD_PUBLIC_EVIDENCE_DIR;mkdirSync(directory,{recursive:true});
      await saveScreenshot(page, join(directory,`guide-${testInfo.project.name}-${route.split('/').filter(Boolean).join('-')}.png`));
    }
  });
}
test('retired demo routes offer current products without simulated booking controls', async ({page, request}) => {
  for (const route of ['/demos/', '/demos/hospitality/', '/demos/salon/']) {
    await page.goto(route);
    await expect(page.getByRole('link', {name: 'Explore current products', exact: true})).toHaveAttribute('href', /\/products\//);
    await expect(page.locator('main button, main input, main select, main form')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  }
  expect(await (await request.get('/sitemap-0.xml')).text()).not.toContain('/demos/');
});

test('primary product journeys preserve unavailable commerce and private preview boundaries', async ({page}, testInfo) => {
  await page.goto('/');
  await page.getByRole('navigation', {name: 'Primary', exact: true}).getByRole('link', {name: 'Products', exact: true}).click();
  await expect(page).toHaveURL(/\/products\/$/);
  await page.getByRole('link', {name: 'Explore Salon Platform', exact: true}).click();
  await expect(page.locator('main')).toContainText('Not yet available for customer subscriptions');
  await expect(page.locator('main')).toContainText('A hosted preview is not published yet');
  await expect(page.getByRole('link', {name: 'Prepare a salon enquiry', exact: true})).toHaveAttribute('href', '/enquire/');
  await expect(page.locator('main a[href*="chatgpt.site"]')).toHaveCount(0);
  await page.goto('/products/wedding/');
  await expect(page.locator('main')).toContainText('Customer hire is not open yet');
  await expect(page.getByRole('link', {name: 'Open the owner-only prototype →', exact: true})).toHaveAttribute('href', 'https://wvd-wedding-workspace.leatfield.chatgpt.site/');
  await expect(page.locator('main')).toContainText('Owner sign-in is required');
  for (const route of ['/products/', '/products/salon/', '/products/wedding/']) {
    await page.goto(route);
    await expect(page.locator('main a[href*="checkout"], main a[href*="stripe"], main form')).toHaveCount(0);
    if (process.env.WVD_PUBLIC_EVIDENCE_DIR) {
      mkdirSync(process.env.WVD_PUBLIC_EVIDENCE_DIR, {recursive: true});
      await saveScreenshot(page, join(process.env.WVD_PUBLIC_EVIDENCE_DIR, `platform-${testInfo.project.name}-${route.split('/').filter(Boolean).join('-')}.png`));
    }
  }
});

test('enquiry draft is reviewable, optional budget stays optional and changed details invalidate it without network/storage',async({page},testInfo)=>{
 const calls:string[]=[];page.on('request',request=>{if(['fetch','xhr'].includes(request.resourceType()))calls.push(request.url());});
 await page.goto('/enquire/');await page.getByLabel('Your name',{exact:true}).fill('Synthetic visitor');await page.getByLabel('Business or organisation',{exact:true}).fill('Synthetic business');await page.getByLabel('Your email',{exact:true}).fill('visitor@example.test');await page.getByLabel('What do you need?',{exact:true}).fill('A clearer website');
 await page.getByRole('button',{name:'Prepare email draft',exact:true}).click();await expect(page.locator('#enquiry-status')).toContainText('Nothing has been sent');await expect(page.getByLabel('Email draft',{exact:true})).toHaveValue(/A clearer website/);const href=await page.getByRole('link',{name:'Open email app',exact:true}).getAttribute('href');expect(new URL(href!).searchParams.get('body')).toContain('Email: visitor@example.test');expect(new URL(href!).searchParams.get('body')).not.toContain('Budget context:');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 if(process.env.WVD_PUBLIC_EVIDENCE_DIR){mkdirSync(process.env.WVD_PUBLIC_EVIDENCE_DIR,{recursive:true});await saveScreenshot(page, join(process.env.WVD_PUBLIC_EVIDENCE_DIR,`enquiry-draft-${testInfo.project.name}.png`));}
 await page.getByLabel('Timing (optional)',{exact:true}).fill('Flexible');await expect(page.locator('#enquiry-draft-panel')).toBeHidden();await expect(page.locator('#enquiry-draft')).toHaveValue('');await page.getByRole('button',{name:'Prepare email draft',exact:true}).click();await expect(page.locator('#enquiry-draft')).toHaveValue(/Timing: Flexible/);await page.getByRole('button',{name:'Clear details',exact:true}).click();await expect(page.locator('#enquiry-draft')).toHaveValue('');await expect(page.getByLabel('Your email',{exact:true})).toHaveValue('');expect(calls).toEqual([]);expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
});
test('enquiry cannot submit personal fields with JavaScript disabled',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});try{const page=await context.newPage();await page.goto('http://127.0.0.1:4321/enquire/');await expect(page.getByLabel('Your email',{exact:true})).toBeDisabled();await expect(page.getByRole('link',{name:'Email a general enquiry directly',exact:true})).toHaveAttribute('href','mailto:hello@wearvalleydigital.com');}finally{await context.close();}
});

 test('showcase routes connect every product and the existing services', async ({page},testInfo) => {
  await page.addInitScript(() => localStorage.setItem('wvd-analytics-consent','declined'));
  await page.goto('/');
  for (const [name,href] of [['Explore Human V1','/work/human-v1/'],['Explore PECP','/work/performance-engineering-control-plane/'],['Explore Salon Platform','/products/salon/'],['Explore Wedding Platform','/products/wedding/'],['Explore the direction →','/products/hospitality/'],['Website services →','/services/#websites'],['Software services →','/services/#software'],['Automation services →','/services/#automation']] as const) {
    await expect(page.getByRole('link',{name,exact:true})).toHaveAttribute('href',href);
  }
  if(process.env.WVD_PUBLIC_EVIDENCE_DIR){mkdirSync(process.env.WVD_PUBLIC_EVIDENCE_DIR,{recursive:true});await saveScreenshot(page, join(process.env.WVD_PUBLIC_EVIDENCE_DIR,`showcase-${testInfo.project.name}.png`));}
  await page.goto('/products/hospitality/');
  await expect(page.locator('main')).toContainText('In planning');
  await expect(page.locator('main')).toContainText('pricing and launch timing are not confirmed');
  await expect(page.locator('main form, main a[href*="checkout"], main a[href*="stripe"]')).toHaveCount(0);
 });
