import test from 'node:test';
import assert from 'node:assert/strict';
import {DurablePortal} from '../durable.mjs';
import {createBoundary} from '../boundary.mjs';
import {createFirebaseAdminAccessUpdater} from '../firebase-provisioning.mjs';
import {validatePortalState} from '../state.mjs';
const state=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'m',active:true}],projects:[{id:'p',businessId:'b'},{id:'q',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'m',businessId:'b',role:'Member',active:true,projectIds:['p']},{actorId:'m',businessId:'other',role:'Owner',active:true,projectIds:['foreign']}],milestones:[]});
const request={actorId:'admin',uid:'m',businessId:'b',role:'Member',projectIds:['p','q'],expectedRevision:0};
const clock=()=> '2026-10-03T10:00:00Z';
const verified={uid:'m',disabled:false,emailVerified:true,email:'m@example.test',providerData:[{providerId:'password'}]};
test('Admin project access writes a single before/after audit and revision while preserving roles and other businesses',()=>{
 const portal=new DurablePortal(':memory:',state(),clock);try{
  assert.equal(portal.updateAccessAsAdmin(request).changed,true);const after=portal.snapshot();validatePortalState(after);
  assert.deepEqual(after.memberships[0].projectIds,['p','q']);assert.equal(after.memberships[0].role,'Member');assert.equal(after.memberships[1].role,'Owner');assert.deepEqual(after.memberships[1].projectIds,['foreign']);assert.equal(after.identities[1].wvdAdmin,undefined);
  assert.deepEqual(after.operatorAudit[0],{id:'operator-1',revision:1,action:'updateAccess',operatorRef:'admin',changeRef:'portal-project-access',timestamp:clock(),uid:'m',businessId:'b',role:'Member',projectIds:['p','q'],previousProjectIds:['p']});
  assert.equal(portal.adminAccounts('admin','b').revision,1);assert.throws(()=>portal.updateAccessAsAdmin({...request,projectIds:[]}),/ACCESS_REVISION_CONFLICT/);assert.deepEqual(portal.snapshot(),after);
  assert.equal(portal.updateAccessAsAdmin({...request,expectedRevision:1}).changed,false);assert.deepEqual(portal.snapshot(),after);
 }finally{portal.close();}
});
test('Current admin and exact existing membership role are required; rejected writes preserve state',()=>{
 const portal=new DurablePortal(':memory:',state(),clock);try{const before=portal.snapshot();for(const [patch,error] of [[{actorId:'m'},'ACCESS_DENIED'],[{role:'Owner'},'ACCESS_ROLE_CONFLICT'],[{projectIds:['foreign']},'PROJECT_SCOPE_DENIED'],[{wvdAdmin:true},'INVALID_ACCESS_GRANT'],[{projectIds:['p','p']},'INVALID_ACCESS_GRANT'],[{expectedRevision:-1},'ACCESS_REVISION_REQUIRED']])assert.throws(()=>portal.updateAccessAsAdmin({...request,...patch}),new RegExp(error));assert.deepEqual(portal.snapshot(),before);}finally{portal.close();}
 const revoked=state();revoked.identities[0].active=false;const disabled=new DurablePortal(':memory:',revoked,clock);try{assert.throws(()=>disabled.updateAccessAsAdmin(request),/ACCESS_DENIED/);}finally{disabled.close();}
});
test('Admin HTTP access updates enforce current session, origin, typed exact schema and conflict status',async()=>{
 const portal=new DurablePortal(':memory:',state(),clock);try{const handle=createBoundary({portal,resolveSession:async token=>token?{actorId:token}:null,allowedOrigin:'https://portal.example'});const {actorId,...body}=request;
 const call=patch=>handle({action:'admin-update-access',method:'POST',origin:'https://portal.example',sessionToken:'admin',rawBody:JSON.stringify(body),...patch});
 for(const [patch,status] of [[{sessionToken:'m'},403],[{sessionToken:null},401],[{origin:'https://evil.example'},403],[{method:'GET'},405],[{rawBody:JSON.stringify({...body,actorId:'admin'})},400],[{rawBody:JSON.stringify({...body,projectIds:'p'})},400],[{rawBody:JSON.stringify({...body,expectedRevision:'0'})},400],[{rawBody:JSON.stringify({...body,projectIds:['foreign']})},403]])assert.equal((await call(patch)).status,status);
 const result=await call({});assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal((await call({})).status,409);
 }finally{portal.close();}
});
test('Google admin update reuses fresh verified target checks only for added grants',async()=>{
 const portal=new DurablePortal(':memory:',state(),clock);let reads=0;try{const update=createFirebaseAdminAccessUpdater({portal,auth:{getUser:async uid=>{reads++;assert.equal(uid,'m');return verified;}}});await update(request);assert.equal(reads,1);await update({...request,projectIds:[],expectedRevision:1});assert.equal(reads,1);assert.equal(portal.snapshot().operatorAudit.at(-1).operatorRef,'admin');}finally{portal.close();}
});
test('Google target failure and revoked admin during Auth read cannot commit a grant',async()=>{
 for(const user of [{...verified,emailVerified:false},{...verified,disabled:true}]){const portal=new DurablePortal(':memory:',state(),clock);try{const before=portal.snapshot(),update=createFirebaseAdminAccessUpdater({portal,auth:{getUser:async()=>user}});await assert.rejects(()=>update(request),/VERIFIED_FIREBASE_USER_REQUIRED/);assert.deepEqual(portal.snapshot(),before);}finally{portal.close();}}
 const portal=new DurablePortal(':memory:',state(),clock);let reads=0;try{const update=createFirebaseAdminAccessUpdater({portal,auth:{getUser:async()=>{reads++;throw Error('private failure');}}});await assert.rejects(()=>update({...request,actorId:'m'}),/ACCESS_DENIED/);assert.equal(reads,0);await assert.rejects(()=>update(request),/IDENTITY_SERVICE_UNAVAILABLE/);assert.equal(portal.snapshot().operatorAudit,undefined);}finally{portal.close();}
 let active=true,commits=0;const fake={workspaceAccess:async()=>({admin:active}),snapshot:async()=>state(),updateAccessAsAdmin:async()=>{if(!active)throw Error('ACCESS_DENIED');commits++;}};const update=createFirebaseAdminAccessUpdater({portal:fake,auth:{getUser:async()=>{active=false;return verified;}}});await assert.rejects(()=>update(request),/ACCESS_DENIED/);assert.equal(commits,0);
});
