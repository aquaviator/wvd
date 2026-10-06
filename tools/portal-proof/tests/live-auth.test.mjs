import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveOwnerResolver} from '../live-auth.mjs';
import {bootstrapPortalOwner} from '../owner-bootstrap.mjs';
import {PortalProof} from '../domain.mjs';

const owner={uid:'known-owner',email:'admin@example.test'};
const decoded=()=>({uid:owner.uid,email:owner.email,email_verified:true,firebase:{sign_in_provider:'google.com'}});
const account=()=>({uid:owner.uid,email:owner.email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]});
function fixture(patch={}){
  const calls={verify:0,user:0,access:0};
  const auth={verifyIdToken:async(raw,revoked)=>{calls.verify++;assert.equal(raw,'verified');assert.equal(revoked,true);return decoded();},getUser:async uid=>{calls.user++;assert.equal(uid,owner.uid);return account();},...patch.auth};
  const portal={workspaceAccess:async uid=>{calls.access++;assert.equal(uid,owner.uid);return {admin:true};},...patch.portal};
  return {calls,auth,portal,resolve:createLiveOwnerResolver({auth,portal,owner:patch.owner===undefined?owner:patch.owner,maxConcurrentRequests:1})};
}
test('live owner requires revoked-token check, current exact Google account and current admin binding',async()=>{
  const f=fixture();assert.deepEqual(await f.resolve('verified'),{actorId:owner.uid});assert.deepEqual(f.calls,{verify:1,user:1,access:1});
});
test('owner:null denies all private sessions without auth or storage calls',async()=>{
  const f=fixture({owner:null});assert.equal(await f.resolve('verified'),null);assert.deepEqual(f.calls,{verify:0,user:0,access:0});
});
test('foreign or unverified token claims cannot request a current owner data lookup',async()=>{
  for(const patch of [{uid:'other',role:'admin'},{email_verified:false},{firebase:{sign_in_provider:'password'}},{firebase:{sign_in_provider:'anonymous'}}]){
    const f=fixture({auth:{verifyIdToken:async()=>({...decoded(),...patch})}});assert.equal(await f.resolve('verified'),null);assert.equal(f.calls.access,0);assert.equal(f.calls.user,0);
  }
});
test('disabled, changed email and unverified current Firebase accounts are denied',async()=>{
  for(const patch of [{disabled:true},{email:'changed@example.test'},{emailVerified:false},{uid:'other'},{providerData:[]}]){
    const f=fixture({auth:{getUser:async()=>({...account(),...patch})}});assert.equal(await f.resolve('verified'),null);assert.equal(f.calls.access,0);
  }
  const f=fixture({auth:{verifyIdToken:async()=>({...decoded(),email:'different@example.test'}),getUser:async()=>({...account(),email:'different@example.test'})}});assert.equal(await f.resolve('verified'),null);assert.equal(f.calls.access,0);
});
test('missing admin grant, revocation and identity outage fail closed without a role fallback',async()=>{
  for(const access of [async()=>({admin:false}),async()=>{throw Error('ACCESS_DENIED');}])assert.equal(await fixture({portal:{workspaceAccess:access}}).resolve('verified'),null);
  assert.equal(await fixture({auth:{verifyIdToken:async()=>{throw Object.assign(Error('private'),{code:'auth/id-token-revoked'});}}}).resolve('verified'),null);
  await assert.rejects(()=>fixture({auth:{getUser:async()=>{throw Error('private-detail');}}}).resolve('verified'),error=>error.message==='IDENTITY_SERVICE_UNAVAILABLE');
  await assert.rejects(()=>fixture({portal:{workspaceAccess:async()=>{throw Error('private-detail');}}}).resolve('verified'),error=>error.message==='IDENTITY_SERVICE_UNAVAILABLE');
  const f=fixture();for(const value of [undefined,'','two tokens','x'.repeat(8193)])assert.equal(await f.resolve(value),null);assert.equal(f.calls.verify,0);
});
test('owner proof concurrency is bounded and releases its slot after completion',async()=>{
  let release;const f=fixture({auth:{verifyIdToken:()=>new Promise(resolve=>{release=()=>resolve(decoded());})}});
  const first=f.resolve('verified');await assert.rejects(()=>f.resolve('verified'),/IDENTITY_SERVICE_UNAVAILABLE/);release();assert.deepEqual(await first,{actorId:owner.uid});
  const next=f.resolve('verified');release();assert.deepEqual(await next,{actorId:owner.uid});
});
test('owner bootstrap creates a valid empty admin state once, then verifies the existing binding',async()=>{
  let current=null,initializations=0;
  const portal={initialize:async state=>{initializations++;if(current)return {created:false};current=new PortalProof(state);return {created:true};},workspaceAccess:async uid=>current.workspaceAccess(uid)};
  const context={operatorRef:'approved-owner-setup',changeRef:'service-launch'};
  const call=()=>bootstrapPortalOwner({auth:{getUser:async()=>account()},portal,owner,context});
  assert.equal((await call()).status,'OWNER_BOOTSTRAP_CREATED');assert.equal((await call()).status,'OWNER_ALREADY_BOUND');assert.equal(initializations,2);
  const state=current.snapshot();assert.deepEqual(state.identities,[{id:owner.uid,active:true,wvdAdmin:true}]);for(const key of ['projects','memberships','milestones','tickets','receipts'])assert.deepEqual(state[key],[]);
});
test('owner bootstrap refuses unknown accounts, missing attribution or existing conflicting state',async()=>{
  const base={auth:{getUser:async()=>account()},portal:{initialize:async()=>({created:false}),workspaceAccess:async()=>({admin:false})},owner,context:{operatorRef:'owner',changeRef:'launch'}};
  await assert.rejects(()=>bootstrapPortalOwner(base),/OWNER_BOOTSTRAP_CONFLICT/);
  await assert.rejects(()=>bootstrapPortalOwner({...base,owner:null}),/OWNER_BINDING_REQUIRED/);
  await assert.rejects(()=>bootstrapPortalOwner({...base,context:{}}),/OPERATOR_CONTEXT_REQUIRED/);
  for(const value of [null,{...account(),disabled:true},{...account(),email:'foreign@example.test'},{...account(),providerData:[{providerId:'password'}]}])await assert.rejects(()=>bootstrapPortalOwner({...base,auth:{getUser:async()=>value},portal:{...base.portal,initialize:()=>assert.fail('must not create state')}}),/VERIFIED_OWNER_ACCOUNT_REQUIRED/);
});
