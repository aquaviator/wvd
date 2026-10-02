import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {createBoundary} from '../boundary.mjs';

function setup(resolveSession = async token => token === 'valid' ? {actorId:'owner'} : null) {
  const portal = new PortalProof({
    identities:[{id:'owner',active:true}], projects:[{id:'p',businessId:'b'},{id:'foreign',businessId:'other'}],
    memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']}],
    milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]
  }, () => '2026-10-02T11:00:00Z');
  const handle = createBoundary({portal,resolveSession,allowedOrigin:'https://client.wearvalleydigital.com'});
  const request = patch => ({action:'approve',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'valid',rawBody:JSON.stringify({projectId:'p',milestoneId:'m',versionId:'v',operationId:'o'}),...patch});
  return {portal,handle,request};
}
test('Verified server session supplies approval actor and retries return same receipt',async()=>{
  const {handle,request,portal}=setup(); const first=await handle(request());
  assert.equal(first.status,200);assert.equal(first.data.actorId,'owner');assert.equal(first.headers['Cache-Control'],'no-store');
  assert.deepEqual(await handle(request()),first);assert.equal(portal.snapshot().receipts.length,1);
});
for(const [label,patch,status] of [
  ['missing origin',{origin:undefined},403],['cross-site origin',{origin:'https://evil.example'},403],
  ['wrong method',{method:'GET'},405],['missing session',{sessionToken:undefined},401],
  ['invalid JSON',{rawBody:'{'},400],['null payload',{rawBody:'null'},400],
  ['oversized multibyte body',{rawBody:'é'.repeat(17000)},413],
  ['actor injection',{rawBody:JSON.stringify({projectId:'p',milestoneId:'m',versionId:'v',operationId:'o',actorId:'admin'})},400],
  ['inherited operation name',{action:'toString'},404],
  ['stale version',{rawBody:JSON.stringify({projectId:'p',milestoneId:'m',versionId:'old',operationId:'o'})},409],
  ['foreign project',{rawBody:JSON.stringify({projectId:'foreign',milestoneId:'m',versionId:'v',operationId:'o'})},403]
]) test(`${label} fails without mutation`,async()=>{const {handle,request,portal}=setup();const before=portal.snapshot();assert.equal((await handle(request(patch))).status,status);assert.deepEqual(portal.snapshot(),before);});
test('Session adapter failure does not expose error details',async()=>{const {handle,request}=setup(async()=>{throw new Error('secret provider detail');});assert.deepEqual((await handle(request())).data,{error:'SERVICE_UNAVAILABLE'});});
test('Revocation is checked again after session verification',async()=>{const {handle,request,portal}=setup();portal.revokeMembership('owner','b');assert.equal((await handle(request())).status,403);});
test('Ticket creation/read/reply routes use same tenant checks',async()=>{const {handle,request}=setup();const ticket=await handle(request({action:'ticket',rawBody:JSON.stringify({projectId:'p',type:'question',subject:'Question',body:'Help',operationId:'t'})}));assert.equal(ticket.status,200);const read=await handle(request({action:'read-ticket',method:'GET',rawBody:JSON.stringify({projectId:'p',ticketId:ticket.data.id})}));assert.equal(read.data.ticket.body,'Help');const reply=await handle(request({action:'reply',rawBody:JSON.stringify({projectId:'p',ticketId:ticket.data.id,body:'Update',operationId:'r'})}));assert.equal(reply.status,200);});

for (const value of [null,undefined,'private detail']) test('Non-Error adapter rejection is sanitised: '+String(value),async()=>{const {handle,request,portal}=setup(async()=>{throw value;});const before=portal.snapshot();assert.deepEqual((await handle(request())).data,{error:'SERVICE_UNAVAILABLE'});assert.deepEqual(portal.snapshot(),before);});

test('Admin overview requires server-owned capability and rejects role/actor injection',async()=>{
 const {handle,request}=setup();
 assert.equal((await handle(request({action:'admin-overview',method:'GET',rawBody:'{}'}))).status,403);
 assert.deepEqual((await handle(request({action:'workspace-access',method:'GET',rawBody:'{}'}))).data,{admin:false});
 for(const input of [{actorId:'admin'},{admin:true},{role:'Admin'}])assert.equal((await handle(request({action:'admin-overview',method:'GET',rawBody:JSON.stringify(input)}))).status,400);
 assert.equal((await handle(request({action:'admin-overview',method:'GET',rawBody:'{}',sessionToken:null}))).status,401);
 const portal=new PortalProof({identities:[{id:'a',active:true,wvdAdmin:true}],projects:[{id:'p',businessId:'b'}],memberships:[],milestones:[]},()=> '2026-10-02T12:00:00Z');
 const admin=createBoundary({portal,resolveSession:async()=>({actorId:'a',admin:false}),allowedOrigin:'https://client.wearvalleydigital.com'});
 const result=await admin(request({action:'admin-overview',method:'GET',rawBody:'{}'}));assert.equal(result.status,200);assert.equal(result.data.businesses[0].businessId,'b');assert.equal(result.headers['Cache-Control'],'no-store');
});
