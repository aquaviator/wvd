import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {validatePortalState} from '../state.mjs';
import {createBoundary} from '../boundary.mjs';
const clock=()=> '2026-10-02T19:20:00.000Z';
const seed=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:true},{id:'disabled',active:false,wvdAdmin:true}],projects:[{id:'p',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'owner',businessId:'b',active:true,role:'Owner',projectIds:['p']},{actorId:'member',businessId:'b',active:true,role:'Member',projectIds:['p']}],milestones:[]});
const input={actorId:'admin',businessId:'b',projectId:'new',stage:'Discovery',nextStep:'Agree scope'};
const model=()=>new PortalProof(seed(),clock);
test('Admin creates only an explicit existing-client project with initial history and no widened grants',()=>{
 const m=model(),before=m.snapshot(),created=m.createProjectAsAdmin(input),state=m.snapshot();assert.equal(created.businessId,'b');assert.equal(created.initialProgress.actorId,'admin');assert.equal(created.initialProgress.timestamp,clock());assert.deepEqual(state.identities,before.identities);assert.deepEqual(state.memberships,before.memberships);assert.equal(state.outbox.length,0);assert.deepEqual(m.projectsFor('owner').map(x=>x.id),['p']);assert.throws(()=>m.projectOverview('owner','new'),/ACCESS_DENIED/);
 assert.equal(m.adminOverview('admin').businesses.find(x=>x.businessId==='b').projects.length,2);assert.equal(m.projectOverview('admin','new').stage,input.stage);validatePortalState(state);
});
test('Resource-bound exact creation retries return initial history without rolling back later progress',()=>{
 const m=model(),created=m.createProjectAsAdmin(input);assert.deepEqual(m.createProjectAsAdmin(input),created);assert.equal(m.snapshot().projects.length,3);
 m.updateProjectProgress({actorId:'admin',projectId:'new',stage:'Build',nextStep:'Check preview',expectedDigest:m.projectOverview('admin','new').progressDigest,operationId:'later'});assert.deepEqual(m.createProjectAsAdmin(input),created);assert.equal(m.projectOverview('admin','new').stage,'Build');
 const before=m.snapshot();assert.throws(()=>m.createProjectAsAdmin({...input,nextStep:'Changed retry'}),/OPERATION_CONFLICT/);assert.deepEqual(m.snapshot(),before);
});
test('Client/disabled accounts, unknown businesses and existing project identifiers fail without mutation',()=>{
 for(const patch of [{actorId:'owner'},{actorId:'member'},{actorId:'disabled'},{actorId:'missing'},{businessId:'unconfigured'},{projectId:'p'},{projectId:'foreign'},{businessId:'other',projectId:'p'}]){const m=model(),before=m.snapshot();assert.throws(()=>m.createProjectAsAdmin({...input,...patch}),/ACCESS_DENIED|BUSINESS_SCOPE_DENIED|PROJECT_CONFLICT/);assert.deepEqual(m.snapshot(),before);}
});
test('Invalid text and a second clock failure leave no partial project or initial progress',()=>{
 for(const patch of [{businessId:' '},{projectId:'x'.repeat(129)},{stage:' '},{nextStep:'x'.repeat(2001)}]){const m=model(),before=m.snapshot();assert.throws(()=>m.createProjectAsAdmin({...input,...patch}),/INVALID_TEXT/);assert.deepEqual(m.snapshot(),before);}
 let calls=0;const m=new PortalProof(seed(),()=>++calls===1?clock():'bad'),before=m.snapshot();assert.throws(()=>m.createProjectAsAdmin(input),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);
});
test('Created project survives reopen with strict creator/history validation',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd-project-')),path=join(dir,'state.sqlite'),a=new DurablePortal(path,seed(),clock),b=new DurablePortal(path,undefined,clock);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const created=a.createProjectAsAdmin(input);assert.deepEqual(b.createProjectAsAdmin(input),created);assert.equal(b.projectsFor('admin').length,3);assert.equal(b.projectsFor('member').length,1);
 for(const patch of [{createdByActorId:'missing'},{createdAt:'bad'},{progressHistory:[]}]){const state=b.snapshot();Object.assign(state.projects.find(x=>x.id==='new'),patch);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);}
});
test('Project creation HTTP enforces origin, server-owned admin, exact scope and request schema',async()=>{
 const m=model(),handle=createBoundary({portal:m,resolveSession:async token=>({actorId:token}),allowedOrigin:'https://client.wearvalleydigital.com'}),{actorId,...payload}=input;
 const r={action:'create-project',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'admin',rawBody:JSON.stringify(payload)};
 assert.equal((await handle({...r,sessionToken:'owner'})).status,403);assert.equal((await handle({...r,origin:'https://evil.test'})).status,403);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,actorId:'admin'})})).status,400);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,businessId:'unconfigured'})})).status,403);assert.equal((await handle(r)).status,200);assert.equal((await handle(r)).status,200);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,projectId:'p'})})).status,409);
});
