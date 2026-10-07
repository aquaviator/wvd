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
  server=createLivePortalApplication({portal,resolveOwnerSession,...access,config:{origin:'https://portal.example.test',firebase:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},web:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123:web:abc'},owner,maxConcurrentRequests:8},browserBundle:sdk});
  // The fixture preserves production origin validation while presenting loopback.
  server.prependListener('request',req=>{if(req.headers.origin===origin)req.headers.origin='https://portal.example.test';});
  await new Promise(resolve=>server.listen(4706,'127.0.0.1',resolve));
});
test.afterEach(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('owner creates link; invited client sees only scoped sections and can submit support',async({page})=>{
  await page.goto(origin);await page.getByRole('button',{name:'Continue with Google'}).click();
  await expect(page.getByRole('heading',{name:'Owner workspace',exact:true})).toBeVisible();
  const invite=page.locator('.client-invitation').filter({has:page.getByText('Invite client to Synthetic client project',{exact:true})});await invite.locator('summary').click();
  await invite.getByLabel('Client Google account email').fill('client@example.test');await invite.getByRole('button',{name:'Create invitation',exact:true}).click();
  const link=await invite.getByLabel('Client invitation link').inputValue();
  await page.getByRole('button',{name:'Sign out'}).click();
  await page.addInitScript(()=>{globalThis.syntheticIdentity='client';});
  await page.evaluate(()=>{globalThis.syntheticIdentity='client';});await page.goto(link);
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
