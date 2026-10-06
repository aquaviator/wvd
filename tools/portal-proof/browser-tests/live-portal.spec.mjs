import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createLivePortalApplication} from '../live-app.mjs';
import {createLiveOwnerResolver} from '../live-auth.mjs';
import {createEnquiryHandler,enquiryRoute} from '../enquiry-http.mjs';
import {PortalProof} from '../domain.mjs';

// Synthetic CI only: exercise the actual live shell, browser auth client and
// owner API boundary without contacting Google or creating Firebase accounts.
const owner={uid:'known-owner',email:'admin@example.test'},id='a'.repeat(64);
const config={origin:'https://wvd-service.example.run.app',firebase:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},web:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123456789:web:abcdef123456'},owner,maxConcurrentRequests:8};
const enquiry={id,createdAt:'2026-10-06T12:00:00.000Z',expiresAt:'2027-01-04T12:00:00.000Z',fields:{name:'Synthetic visitor',business:'Synthetic business',email:'visitor@example.test',need:'<img src=x onerror=alert(1)>\nA private website brief.',website:'https://example.test',timing:'Next month',budget:'To discuss'},notification:{status:'UNKNOWN',updatedAt:'2026-10-06T12:00:01.000Z'}};
const sdk=Buffer.from(`
  let auth,sequence=0;
  export const inMemoryPersistence={type:'NONE'},browserPopupRedirectResolver={};
  export function initializeApp(config,name){return {config,name};}
  export function initializeAuth(app,options){if(options.persistence!==inMemoryPersistence)throw Error('memory persistence required');auth={currentUser:null};return auth;}
  export class GoogleAuthProvider{setCustomParameters(parameters){if(parameters.prompt!=='select_account')throw Error('explicit account selection required');}}
  export async function signInWithPopup(){const user={uid:'known-owner',emailVerified:true,getIdToken:async()=> 'synthetic-owner-token-'+(++sequence)};auth.currentUser=user;return {user};}
  export async function signOut(){auth.currentUser=null;}
`);
let server,closedServer,privateCalls=0,seenTokens=[];
async function capture(page,testInfo,name){
  if(!process.env.WVD_PORTAL_EVIDENCE_DIR)return;
  if(!['mobile','desktop'].includes(testInfo.project.name))throw Error('UNKNOWN_EVIDENCE_VIEWPORT');
  const dir=resolve(process.env.WVD_PORTAL_EVIDENCE_DIR);await mkdir(dir,{recursive:true});
  await page.screenshot({path:join(dir,`${testInfo.project.name}-${name}.png`),fullPage:true,animations:'disabled'});
}
function application(binding){
  const portal=new PortalProof({identities:[{id:owner.uid,active:true,wvdAdmin:true}],projects:[],memberships:[],milestones:[]});
  const auth={verifyIdToken:async(raw,revoked)=>{privateCalls++;seenTokens.push(raw);if(!revoked||!/^synthetic-owner-token-[0-9]+$/.test(raw))throw Object.assign(Error(),{code:'auth/invalid-id-token'});return {uid:owner.uid,email:owner.email,email_verified:true,firebase:{sign_in_provider:'google.com'}};},getUser:async()=>({uid:owner.uid,email:owner.email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]})};
  const resolveOwnerSession=createLiveOwnerResolver({auth,portal,owner:binding,maxConcurrentRequests:8});
  const store={accept:async()=>{throw Error('public writes excluded from this browser fixture');},list:async()=>({enquiries:[enquiry],nextCursor:null}),read:async value=>value===id?enquiry:null};
  const enquiryHandler=createEnquiryHandler({store,resolveOwnerSession,allowedPublicOrigins:['https://wearvalleydigital.com'],maxConcurrentRequests:2});
  return createLivePortalApplication({portal,resolveOwnerSession,config:{...config,owner:binding},enquiryHandler,enquiryRoute,browserBundle:sdk});
}
test.beforeAll(async()=>{
  server=application(owner);closedServer=application(null);
  await new Promise(resolve=>server.listen(4702,'127.0.0.1',resolve));await new Promise(resolve=>closedServer.listen(4705,'127.0.0.1',resolve));
});
test.afterAll(async()=>{for(const item of [server,closedServer]){item?.closeIdleConnections();if(item)await new Promise(resolve=>item.close(resolve));}});
test('owner Google login, refreshed bearer inbox reads, accessibility and private-data sign-out',async({page},testInfo)=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'WVD owner workspace',exact:true})).toBeVisible();await expect(page.locator('#login input')).toHaveCount(0);await expect(page.locator('#invite-panel')).toBeHidden();
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to main content'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('#main-content')).toBeFocused();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await capture(page,testInfo,'owner-login');
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  const inbox=page.locator('.enquiry-inbox');await expect(inbox).toBeVisible();await expect(inbox).toContainText('Synthetic visitor');await expect(page.locator('#project-selector')).toBeHidden();await expect(page.locator('#support-tickets')).toBeHidden();
  await expect(inbox).toContainText('Reference: WVD-AAAAAAAAAAAA');await expect(inbox).toContainText('Owner notification outcome is uncertain');await inbox.getByRole('button',{name:'Read enquiry',exact:true}).click();
  await expect(inbox).toContainText(enquiry.fields.need);await expect(inbox).toContainText(enquiry.id);await expect(inbox.locator('img')).toHaveCount(0);await expect(inbox.getByRole('heading',{name:'Enquiry from Synthetic visitor',exact:true})).toBeFocused();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(new Set(seenTokens).size).toBeGreaterThan(2);
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);expect(await page.evaluate(()=>Object.keys(sessionStorage))).toEqual([]);expect(await page.context().cookies()).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,testInfo,'owner-enquiry-inbox');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#admin-overview')).toBeEmpty();await expect(page.locator('body')).not.toContainText(enquiry.fields.need);await expect(page.getByRole('status')).toContainText('Signed out');
});
test('closed owner setup allows Google identity setup without any private API access',async({page},testInfo)=>{
  const callsBefore=privateCalls;await page.goto('http://127.0.0.1:4705/');await expect(page.getByRole('status')).toContainText('Owner access is being set up');
  await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.getByRole('status')).toContainText('Owner workspace access is awaiting activation');await expect(page.locator('#workspace')).toBeHidden();await expect(page.locator('#admin-overview')).toBeEmpty();expect(privateCalls).toBe(callsBefore);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
  await capture(page,testInfo,'owner-setup-pending');
});
