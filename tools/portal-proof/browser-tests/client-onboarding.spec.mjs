import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {PortalProof} from '../domain.mjs';
import {createLivePortalApplication} from '../live-app.mjs';
import {createLiveOwnerResolver} from '../live-auth.mjs';
import {createLiveClientAccess,clientInvitationPolicy} from '../client-onboarding.mjs';

const origin='http://127.0.0.1:4706',owner={uid:'admin',email:'admin@example.test'};
let server;
test.beforeEach(async()=>{
  const portal=new PortalProof({identities:[{id:'admin',active:true,wvdAdmin:true}],projects:[{id:'Synthetic client project',businessId:'Synthetic client'},{id:'Other client secret',businessId:'Other client'}],memberships:[],milestones:[]},()=>new Date().toISOString(),clientInvitationPolicy);
  const email=uid=>uid==='admin'?owner.email:'client@example.test';
  const auth={verifyIdToken:async uid=>({uid,email:email(uid),email_verified:true,firebase:{sign_in_provider:'google.com'}}),getUser:async uid=>({uid,email:email(uid),emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]})};
  const resolveOwnerSession=createLiveOwnerResolver({auth,portal,owner,maxConcurrentRequests:8});
  const access=createLiveClientAccess({auth,portal,resolveOwnerSession});
  const sdk=Buffer.from(`let auth;export const inMemoryPersistence={},browserPopupRedirectResolver={};export function initializeApp(){return {}}export function initializeAuth(){return auth={currentUser:null}}export class GoogleAuthProvider{setCustomParameters(){}}export async function signInWithPopup(){const uid=globalThis.syntheticIdentity??'admin';const user={uid,emailVerified:true,getIdToken:async()=>uid};auth.currentUser=user;return {user}}export async function signOut(){auth.currentUser=null}`);
  server=createLivePortalApplication({portal,resolveOwnerSession,...access,config:{origin:'https://service.example.test',workspaces:{clientOrigin:'https://portal.example.test',adminOrigin:'https://admin.example.test',websiteOrigin:'https://wearvalleydigital.com'},firebase:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},web:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123:web:abc'},owner,maxConcurrentRequests:8},browserBundle:sdk});
  // The fixture preserves production origin validation while presenting loopback.
  server.prependListener('request',req=>{if(req.headers.origin===origin)req.headers.origin=req.headers['x-forwarded-host']==='admin.example.test'?'https://admin.example.test':req.headers['x-forwarded-host']==='portal.example.test'?'https://portal.example.test':'https://service.example.test';});
  await new Promise(resolve=>server.listen(4706,'127.0.0.1',resolve));
});
test.afterEach(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('owner creates link; invited client sees only scoped sections and can submit support',async({page})=>{
  await page.goto(origin);await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.getByRole('heading',{name:'Owner workspace',exact:true})).toBeVisible();
  const invite=page.locator('.client-invitation').filter({has:page.getByText('Invite client to Synthetic client project',{exact:true})});await invite.locator('summary').click();
  await invite.getByLabel('Client Google account email').fill('client@example.test');await invite.getByRole('button',{name:'Create invitation',exact:true}).click();
  const link=await invite.getByLabel('Client invitation link').inputValue();expect(link).toMatch(/^https:\/\/portal\.example\.test\/#member-invite=/);
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.addInitScript(()=>{globalThis.syntheticIdentity='client';});
  await page.evaluate(()=>{globalThis.syntheticIdentity='client';});await page.setExtraHTTPHeaders({'X-Forwarded-Host':'portal.example.test'});await page.goto(link.replace('https://portal.example.test',origin));
  await expect(page).toHaveURL(origin+'/');await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.getByRole('heading',{name:'Your project workspace'})).toBeVisible();
  await expect(page.locator('#admin-overview')).toBeHidden();await expect(page.locator('body')).not.toContainText('Other client secret');
  await expect(page.locator('#projects option')).toHaveCount(1);
  const navigation=page.getByRole('navigation',{name:'Project sections'});
  await expect(navigation.getByRole('button')).toHaveText(['Overview','Progress','Deliverables','Feedback','Support']);
  for(const name of ['Progress','Deliverables','Feedback']){await navigation.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();}
  await navigation.getByRole('button',{name:'Support',exact:true}).click();await page.getByLabel('Subject',{exact:true}).fill('Synthetic question');await page.getByLabel('Details',{exact:true}).fill('Synthetic support verification');await page.getByRole('button',{name:'Send ticket',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Ticket saved');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
  await page.getByRole('button',{name:'Sign out'}).click();await expect(page.locator('#overview')).toBeEmpty();
});

 test('admin hostname denies a client and offers the public return route',async({page})=>{
  await page.setExtraHTTPHeaders({'X-Forwarded-Host':'admin.example.test'});
  await page.addInitScript(()=>{globalThis.syntheticIdentity='client';});
  await page.goto(origin);
  await expect(page.getByRole('heading',{name:'Your WVD owner workspace'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Back to website'})).toHaveAttribute('href','https://wearvalleydigital.com/');
  await expect(page.getByRole('link',{name:'Go to Client Portal'})).toHaveAttribute('href','https://portal.example.test');
  await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.locator('#workspace')).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Please sign in again');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
