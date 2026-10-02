import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const route of ['/', '/services/', '/about/', '/demos/', '/demos/hospitality/', '/demos/salon/', '/insights/', '/insights/website-brief/', '/insights/care-and-development/', '/insights/ownership-and-handover/']) {
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
      await page.screenshot({path:join(directory,`guide-${testInfo.project.name}-${route.split('/').filter(Boolean).join('-')}.png`),fullPage:true});
    }
  });
}
test('Hospitality enquiry stays simulated with no service calls or browser storage', async ({page})=>{
  const calls:string[]=[];
  page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType())) calls.push(r.url());});
  await page.goto('/demos/hospitality/');
  await expect(page.getByLabel('Demo notice')).toContainText('No enquiry is sent');
  await page.getByRole('button',{name:'Simulate enquiry',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('No booking has been made');
  await page.getByRole('button',{name:'Show example venue response'}).click();
  await expect(page.getByRole('status')).toContainText('not an availability check or reservation');
  expect(calls).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});
test('Salon treatment changes invalidate selection and slots fit treatment duration',async({page})=>{
  const calls:string[]=[];page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType())) calls.push(r.url());});
  await page.goto('/demos/salon/');
  const action=page.getByRole('button',{name:'Simulate appointment request'});
  await expect(action).toBeDisabled();
  await page.getByRole('button',{name:'09:00–09:30',exact:true}).click();
  await expect(action).toBeEnabled();
  await page.getByLabel('Treatment',{exact:true}).selectOption('90');
  await expect(action).toBeDisabled();
  const labels=await page.getByRole('group',{name:'Sample appointment start times'}).getByRole('button').allTextContents();
  for(const label of labels){const [a,b]=label.split('–').map(t=>{const [h,m]=t.split(':').map(Number);return h*60+m;});expect(b-a).toBe(90);expect(a<780&&b>720).toBe(false);expect(b).toBeLessThanOrEqual(1020);}
  await page.getByRole('button',{name:'09:00–10:30',exact:true}).click();
  await action.click();
  await expect(page.getByRole('status')).toContainText('No appointment was created');
  expect(calls).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});

test('Hospitality controls never submit a request with JavaScript disabled',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:4321/demos/hospitality/');
  const calls:string[]=[];page.on('request',r=>calls.push(r.url()));
  await page.getByRole('button',{name:'Simulate enquiry',exact:true}).click();
  await expect(page).toHaveURL(/\/demos\/hospitality\/$/);
  expect(calls).toEqual([]);await context.close();
});
