import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test,expect,type Page,type Route} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';

const endpoint='**/api/enquiries';
const fields={name:'Synthetic visitor',business:'Synthetic business',email:'visitor@example.test',need:'A clearer website',website:'',timing:'',budget:''};
const receipt={status:'RECEIVED',receiptId:'0123456789abcdef'.repeat(4),receivedAt:'2026-10-06T16:00:00.000Z'};
type Submission={requestId:string;fields:typeof fields;websiteTrap:string};
type RecordedPost={body:string;data:Submission};

async function respond(route:Route,status:number,value:unknown){
  await route.fulfill({status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':route.request().headers().origin??'http://127.0.0.1:4321','Vary':'Origin'},body:JSON.stringify(value)});
}

// Every matching endpoint request is intercepted; test fixtures never reach a
// live enquiry host or send mail. Origins remain independent of deployment URL.
async function mockEnquiries(page:Page,reply:(route:Route,index:number)=>Promise<void>){
  const posts:RecordedPost[]=[];
  await page.route(endpoint,async route=>{
    if(route.request().method()==='OPTIONS'){
      await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':route.request().headers().origin??'http://127.0.0.1:4321','Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
      return;
    }
    expect(route.request().method()).toBe('POST');
    const body=route.request().postData()??'';
    posts.push({body,data:JSON.parse(body) as Submission});
    await reply(route,posts.length-1);
  });
  return posts;
}

async function fillEnquiry(page:Page){
  await page.goto('/enquire/');
  await expect(page.locator('#enquiry-fields')).toBeEnabled();
  await page.getByLabel('Your name (required)',{exact:true}).fill(fields.name);
  await page.getByLabel('Business or organisation (required)',{exact:true}).fill(fields.business);
  await page.getByLabel('Your email (required)',{exact:true}).fill(fields.email);
  await page.getByLabel('What do you need? (required)',{exact:true}).fill(fields.need);
}

test('explicit send waits for a durable receipt, prevents duplicate clicks and leaves no personal browser storage',async({page},testInfo)=>{
  await page.addInitScript(()=>{
    const state=window as Window & {enquiryStorageWrites:string[]};state.enquiryStorageWrites=[];
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){state.enquiryStorageWrites.push(`${key}:${value}`);return original.call(this,key,value);};
  });
  let release:()=>void=()=>{};
  const pending=new Promise<void>(resolve=>{release=resolve;});
  const posts=await mockEnquiries(page,async route=>{await pending;await respond(route,201,receipt);});
  await fillEnquiry(page);
  expect(posts).toHaveLength(0);
  expect(await page.getByLabel('Budget context (optional)',{exact:true}).getAttribute('required')).toBeNull();
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();
  await expect.poll(()=>posts.length).toBe(1);
  await expect(page.locator('#enquiry-submit')).toBeDisabled();
  await expect(page.locator('#enquiry-clear')).toBeDisabled();
  await expect(page.locator('#enquiry-status')).toHaveText('Sending your enquiry…');
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  await page.locator('#enquiry-form').evaluate(form=>(form as HTMLFormElement).requestSubmit());
  expect(posts).toHaveLength(1);
  expect(posts[0].data).toEqual({requestId:expect.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),fields,websiteTrap:''});
  release();
  await expect(page.locator('#enquiry-confirmation')).toBeVisible();
  await expect(page.locator('#enquiry-reference')).toHaveText('WVD-0123456789AB');
  await expect(page.locator('#enquiry-status')).toHaveText('Thanks, your enquiry has been received.');
  await expect(page.locator('#enquiry-form')).toBeHidden();
  await expect(page.locator('#enquiry-email')).toHaveValue('');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  if(process.env.WVD_PUBLIC_EVIDENCE_DIR){
    mkdirSync(process.env.WVD_PUBLIC_EVIDENCE_DIR,{recursive:true});
    const image=await page.screenshot({type:'png',fullPage:true,scale:'css'});
    await sharp(image).png({palette:true,colours:128,effort:10}).toFile(join(process.env.WVD_PUBLIC_EVIDENCE_DIR,`enquiry-received-${testInfo.project.name}.png`));
  }
  expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
  expect(await page.evaluate(()=>(window as Window & {enquiryStorageWrites:string[]}).enquiryStorageWrites)).toEqual([]);
  expect(await page.evaluate(()=>indexedDB.databases())).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
  await page.getByRole('button',{name:'Send another enquiry',exact:true}).click();
  await expect(page.locator('#enquiry-form')).toBeVisible();
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  await expect(page.locator('#enquiry-reference')).toBeEmpty();
  await expect(page.locator('#enquiry-email')).toHaveValue('');
  expect(posts).toHaveLength(1);
});

for(const failure of ['network failure','service unavailable','malformed success receipt'] as const){
  test(`${failure} cannot confirm success and retry preserves the exact enquiry`,async({page})=>{
    const posts=await mockEnquiries(page,async(route,index)=>{
      if(index>0)return respond(route,200,receipt);
      if(failure==='network failure')return route.abort('failed');
      if(failure==='service unavailable')return respond(route,503,{error:'SERVICE_UNAVAILABLE'});
      return respond(route,201,{...receipt,status:'QUEUED'});
    });
    await fillEnquiry(page);
    await page.getByLabel('Budget context (optional)',{exact:true}).fill('Not sure yet');
    await page.getByRole('button',{name:'Send enquiry',exact:true}).click();
    await expect(page.locator('#enquiry-status')).toContainText(/confirm receipt/i);
    await expect(page.locator('#enquiry-confirmation')).toBeHidden();
    await expect(page.locator('#enquiry-reference')).toBeEmpty();
    await expect(page.locator('#enquiry-form')).toBeVisible();
    await expect(page.locator('#enquiry-email')).toHaveValue(fields.email);
    await expect(page.locator('#enquiry-need')).toHaveAttribute('readonly','');
    await expect(page.locator('#enquiry-clear')).toBeDisabled();
    await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled();
    expect(posts).toHaveLength(1);
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await expect(page.locator('#enquiry-confirmation')).toBeVisible();
    expect(posts).toHaveLength(2);
    expect(posts[1].body).toBe(posts[0].body);
    expect(posts[1].data.requestId).toBe(posts[0].data.requestId);
    expect(posts[1].data.fields.budget).toBe('Not sure yet');
    expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
  });
}

test('an unsuccessful retry cannot erase uncertainty about an earlier accepted request',async({page})=>{
  const posts=await mockEnquiries(page,async(route,index)=>{
    if(index===0)return route.abort('failed');
    if(index===1)return respond(route,429,{error:'ENQUIRY_RATE_LIMITED'});
    return respond(route,200,receipt);
  });
  await fillEnquiry(page);
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();
  await expect(page.locator('#enquiry-status')).toContainText(/confirm receipt/i);
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('#enquiry-status')).toContainText(/still.*confirm receipt/i);
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  await expect(page.locator('#enquiry-reference')).toBeEmpty();
  await expect(page.locator('#enquiry-need')).toHaveAttribute('readonly','');
  await expect(page.locator('#enquiry-clear')).toBeDisabled();
  await expect(page.getByRole('button',{name:'Try again',exact:true})).toBeEnabled();
  expect(posts).toHaveLength(2);
  expect(posts[1].body).toBe(posts[0].body);
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.locator('#enquiry-confirmation')).toBeVisible();
  expect(posts).toHaveLength(3);
  expect(posts[2].body).toBe(posts[0].body);
});

test('an admission rejection shows no confirmation and permits a corrected new enquiry',async({page})=>{
  const posts=await mockEnquiries(page,async(route,index)=>respond(route,index===0?429:201,index===0?{error:'ENQUIRY_RATE_LIMITED'}:receipt));
  await fillEnquiry(page);
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();
  await expect(page.locator('#enquiry-status')).toContainText('Please try again shortly');
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  await expect(page.locator('#enquiry-reference')).toBeEmpty();
  await expect(page.locator('#enquiry-need')).toBeEditable();
  await expect(page.locator('#enquiry-clear')).toBeEnabled();
  await page.getByLabel('Timing (optional)',{exact:true}).fill('Flexible');
  await page.getByRole('button',{name:'Send enquiry',exact:true}).click();
  await expect(page.locator('#enquiry-confirmation')).toBeVisible();
  expect(posts).toHaveLength(2);
  expect(posts[1].data.requestId).not.toBe(posts[0].data.requestId);
  expect(posts[1].data.fields.timing).toBe('Flexible');
});

test('clear removes an unsent enquiry without contacting the service',async({page})=>{
  const posts=await mockEnquiries(page,async route=>respond(route,201,receipt));
  await fillEnquiry(page);
  await page.getByRole('button',{name:'Clear details',exact:true}).click();
  await expect(page.locator('#enquiry-name')).toHaveValue('');
  await expect(page.locator('#enquiry-email')).toHaveValue('');
  await expect(page.locator('#enquiry-need')).toHaveValue('');
  await expect(page.locator('#enquiry-confirmation')).toBeHidden();
  expect(posts).toHaveLength(0);
});

test('without JavaScript the form remains disabled and a direct email fallback is available',async({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try{
    const page=await context.newPage(),posts=await mockEnquiries(page,async route=>respond(route,201,receipt));
    await page.goto(new URL('/enquire/',baseURL!).href);
    await expect(page.locator('#enquiry-fields')).toBeDisabled();
    await expect(page.locator('#enquiry-email')).toBeDisabled();
    await expect(page.locator('#enquiry-submit')).toBeDisabled();
    await expect(page.locator('#enquiry-confirmation')).toBeHidden();
    await expect(page.getByRole('link',{name:'Email a general enquiry directly',exact:true})).toHaveAttribute('href','mailto:hello@wearvalleydigital.com');
    await expect(page.locator('noscript')).toContainText('The online form needs JavaScript.');
    expect(posts).toHaveLength(0);
  }finally{await context.close();}
});
