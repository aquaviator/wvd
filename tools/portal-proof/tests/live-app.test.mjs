import test from 'node:test';
import assert from 'node:assert/strict';
import {createLivePortalApplication} from '../live-app.mjs';
import {createLiveOwnerResolver} from '../live-auth.mjs';
import {createEnquiryHandler,enquiryRoute} from '../enquiry-http.mjs';
import {composeLiveService} from '../live-main.mjs';
import {PortalProof} from '../domain.mjs';

const owner={uid:'known-owner',email:'admin@example.test'},receiptId='a'.repeat(64);
const configuration=()=>({origin:'https://wvd-service.example.run.app',firebase:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},web:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123456789:web:abcdef123456'},owner,maxConcurrentRequests:8});
const enquiry={id:receiptId,createdAt:'2026-10-06T12:00:00.000Z',expiresAt:'2027-01-04T12:00:00.000Z',fields:{name:'Synthetic owner enquiry',business:'Test business',email:'visitor@example.test',need:'A private brief.',website:'',timing:'',budget:''},notification:{status:'PENDING',updatedAt:'2026-10-06T12:00:00.000Z'}};
async function fixture(t,{binding=owner}={}){
  const config={...configuration(),owner:binding},calls={auth:0,user:0,list:0,read:0,accept:0};
  const portal=new PortalProof({identities:[{id:owner.uid,active:true,wvdAdmin:true}],projects:[],memberships:[],milestones:[]});
  const auth={verifyIdToken:async(raw,revoked)=>{calls.auth++;assert.equal(revoked,true);return {uid:raw==='owner-token'?owner.uid:'foreign',email:owner.email,email_verified:true,firebase:{sign_in_provider:'google.com'}};},getUser:async()=>{calls.user++;return {uid:owner.uid,email:owner.email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]};}};
  const resolveOwnerSession=createLiveOwnerResolver({auth,portal,owner:binding,maxConcurrentRequests:8});
  const store={accept:async()=>{calls.accept++;return {receiptId,receivedAt:enquiry.createdAt,created:true};},list:async()=>{calls.list++;return {enquiries:[enquiry],nextCursor:null};},read:async id=>{calls.read++;return id===receiptId?enquiry:null;}};
  const enquiryHandler=createEnquiryHandler({store,resolveOwnerSession,allowedPublicOrigins:['https://wearvalleydigital.com','https://www.wearvalleydigital.com'],maxConcurrentRequests:2});
  const server=createLivePortalApplication({portal,resolveOwnerSession,config,enquiryHandler,enquiryRoute,browserBundle:Buffer.from('export const synthetic=true;')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{server.closeIdleConnections();await new Promise(resolve=>server.close(resolve));});
  const get=(path,headers={})=>fetch(base+path,{headers});
  return {base,get,calls,server,config};
}
test('live shell exposes only public web configuration, explicit liveness and protected assets',async t=>{
  const f=await fixture(t),home=await f.get('/');assert.equal(home.status,200);const html=await home.text();assert.match(html,/WVD project workspace/);assert.match(html,/Continue with Google/);assert.doesNotMatch(html,/synthetic development accounts/);
  for(const [name,pattern]of [['cache-control',/no-store/],['x-robots-tag',/noindex/],['content-security-policy',/frame-ancestors 'none'/],['content-security-policy',/connect-src 'self' https:\/\/identitytoolkit.googleapis.com https:\/\/securetoken.googleapis.com/],['cross-origin-opener-policy',/^same-origin-allow-popups$/]])assert.match(home.headers.get(name),pattern);
  assert.equal(home.headers.get('set-cookie'),null);assert.equal(home.headers.get('access-control-allow-origin'),null);
  const publicConfig=await(await f.get('/auth-config.json')).json();assert.deepEqual(Object.keys(publicConfig).sort(),['enquiriesEnabled','firebase','mode','ownerConfigured']);assert.equal(publicConfig.mode,'firebase-live');assert.equal(publicConfig.ownerConfigured,true);assert.ok(!JSON.stringify(publicConfig).includes(owner.uid)&&!JSON.stringify(publicConfig).includes(owner.email));
  assert.deepEqual(await(await f.get('/health')).json(),{status:'ok',mode:'live-portal',providerAccessChecked:false});assert.equal(await(await f.get('/robots.txt')).text(),'User-agent: *\nDisallow: /\n');
  for(const path of ['/app.js','/auth-client.js','/live-auth-client.js','/enquiries.js','/firebase-auth-sdk.js','/style.css','/brand-logo.png']){const response=await f.get(path);assert.equal(response.status,200);await response.arrayBuffer();}
  assert.deepEqual(f.calls,{auth:0,user:0,list:0,read:0,accept:0});
});
test('every private route requires exact owner proof and emits no cross-origin private data',async t=>{
  const f=await fixture(t);
  for(const path of ['/api/portal/projects','/api/admin/enquiries',`/api/admin/enquiries/${receiptId}`]){
    assert.equal((await f.get(path)).status,401);assert.equal((await f.get(path,{Authorization:'Bearer foreign-token'})).status,401);
    const denied=await f.get(path,{Authorization:'Bearer owner-token',Origin:'https://wearvalleydigital.com'});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
    assert.equal((await f.get(path,{Authorization:'Bearer owner-token','Sec-Fetch-Site':'cross-site'})).status,403);
  }
  assert.equal(f.calls.list,0);assert.equal(f.calls.read,0);
  assert.deepEqual(await(await f.get('/api/portal/projects',{Authorization:'Bearer owner-token'})).json(),[]);
  const list=await f.get('/api/admin/enquiries?limit=25',{Authorization:'Bearer owner-token',Origin:f.config.origin});assert.equal(list.status,200);assert.deepEqual(await list.json(),{enquiries:[enquiry],nextCursor:null});assert.equal(list.headers.get('access-control-allow-origin'),null);
  const read=await f.get(`/api/admin/enquiries/${receiptId}`,{Authorization:'Bearer owner-token'});assert.equal(read.status,200);assert.deepEqual(await read.json(),enquiry);
  assert.equal(f.calls.list,1);assert.equal(f.calls.read,1);
});
test('closed setup keeps private APIs denied even for a verified owner-shaped token',async t=>{
  const f=await fixture(t,{binding:null});assert.equal((await(await f.get('/auth-config.json')).json()).ownerConfigured,false);
  for(const path of ['/api/portal/projects','/api/portal/admin-overview','/api/admin/enquiries',`/api/admin/enquiries/${receiptId}`])assert.equal((await f.get(path,{Authorization:'Bearer owner-token'})).status,401);
  assert.deepEqual(f.calls,{auth:0,user:0,list:0,read:0,accept:0});
});
test('public contact route has exact CORS admission while legacy local auth routes remain unavailable',async t=>{
  const f=await fixture(t);const headers={Origin:'https://wearvalleydigital.com','Content-Type':'application/json'};
  const preflight=await fetch(f.base+'/api/enquiries',{method:'OPTIONS',headers:{Origin:headers.Origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),headers.Origin);assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
  const received=await fetch(f.base+'/api/enquiries',{method:'POST',headers,body:JSON.stringify({requestId:'11111111-1111-4111-8111-111111111111',websiteTrap:'',fields:enquiry.fields})});assert.equal(received.status,201);assert.deepEqual(await received.json(),{status:'RECEIVED',receiptId,receivedAt:enquiry.createdAt});assert.equal(f.calls.accept,1);assert.equal(f.calls.auth,0);
  assert.equal((await fetch(f.base+'/api/enquiries',{method:'POST',headers:{...headers,Origin:'https://foreign.example'},body:'{}'})).status,403);assert.equal(f.calls.accept,1);
  for(const path of ['/api/auth/login','/api/auth/redeem','/api/invitations/create','/api/admin/seed','/unknown','/auth-config.json?owner=other','/health?probe=live'])assert.equal((await f.get(path)).status,404);
});
test('runtime composition does not probe providers, initialize owner state or send mail',()=>{
  const config={authentication:{serviceAccount:'wvd-runtime@wvd-development.iam.gserviceaccount.com'},portal:{...configuration(),owner:null},enquiries:{allowedPublicOrigins:['https://wearvalleydigital.com'],admission:{minuteLimit:10,dailyLimit:50},maxConcurrentRequests:2,retentionDays:90},mail:{subject:'admin@example.test',senderEmail:'admin@example.test',recipientEmail:'hello@example.test',requestTimeoutMs:10000}};
  const noCall=()=>assert.fail('construction must not make a provider request'),backend={auth:{verifyIdToken:noCall,getUser:noCall},portal:{workspaceAccess:noCall,initialize:noCall},db:{collection:path=>({path}),doc:path=>({path}),runTransaction:noCall},close:async()=>{}};
  const runtime=composeLiveService({config,backend,signer:{request:noCall},clock:()=> '2026-10-06T12:00:00.000Z',browserBundle:Buffer.from('export {};')});assert.equal(runtime.server.listening,false);assert.equal(runtime.server.requestTimeout,15000);runtime.server.close();
});
