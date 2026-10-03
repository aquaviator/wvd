import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {createBoundary} from '../boundary.mjs';
const state=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:false}],projects:[{id:'p',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'member',businessId:'b',role:'Member',active:false,projectIds:[]},{actorId:'owner',businessId:'other',role:'Member',active:true,projectIds:['foreign']}],milestones:[]});
const clock=()=> '2026-10-03T09:15:00Z';
test('Admin account projection is scoped, includes revoked access, and does not mutate or expose unrelated records',()=>{
 const portal=new PortalProof(state(),clock),before=portal.snapshot(),result=portal.adminAccounts('admin','b');
 assert.deepEqual(result,{businessId:'b',accounts:[{accountId:'owner',role:'Owner',identityActive:true,membershipActive:true,projectIds:['p']},{accountId:'member',role:'Member',identityActive:false,membershipActive:false,projectIds:[]}]});
 result.accounts[0].projectIds.push('foreign');assert.deepEqual(portal.snapshot(),before);
 assert.equal(JSON.stringify(portal.adminAccounts('admin','b')).includes('wvdAdmin'),false);
});
test('Clients, disabled admins and unknown businesses cannot inspect accounts',()=>{
 const portal=new PortalProof(state(),clock);for(const actor of ['owner','member','missing'])assert.throws(()=>portal.adminAccounts(actor,'b'),/ACCESS_DENIED/);
 assert.throws(()=>portal.adminAccounts('admin','missing'),/BUSINESS_SCOPE_DENIED/);assert.throws(()=>portal.adminAccounts('admin',' '),/INVALID_TEXT/);
 const revoked=state();revoked.identities[0].active=false;assert.throws(()=>new PortalProof(revoked,clock).adminAccounts('admin','b'),/ACCESS_DENIED/);
});
test('Account read uses verified actor, exact GET schema and no-store responses',async()=>{
 const portal=new PortalProof(state(),clock),handle=createBoundary({portal,resolveSession:async token=>token?{actorId:token}:null,allowedOrigin:'https://portal.example'});
 const request={action:'admin-accounts',method:'GET',sessionToken:'admin',rawBody:JSON.stringify({businessId:'b'})};
 const result=await handle(request);assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');
 for(const [patch,status] of [[{sessionToken:'owner'},403],[{sessionToken:null},401],[{method:'POST'},405],[{rawBody:JSON.stringify({businessId:'b',actorId:'admin'})},400],[{rawBody:JSON.stringify({businessId:'missing'})},403]])assert.equal((await handle({...request,...patch})).status,status);
});
test('Durable account inspection retains scope and creates no revision or data change',()=>{
 const portal=new DurablePortal(':memory:',state(),clock);try{const before=portal.snapshot();assert.deepEqual(portal.adminAccounts('admin','b'),new PortalProof(before,clock).adminAccounts('admin','b'));assert.deepEqual(portal.snapshot(),before);}finally{portal.close();}
});
