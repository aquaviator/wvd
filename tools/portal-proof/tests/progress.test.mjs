import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {validatePortalState} from '../state.mjs';
import {createBoundary} from '../boundary.mjs';
const clock=()=> '2026-10-02T18:00:00.000Z';
const seed=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:true},{id:'disabled',active:false,wvdAdmin:true}],projects:[{id:'p',businessId:'b',stage:'Discovery',nextStep:'Agree scope'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'member',businessId:'b',role:'Member',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const model=()=>new PortalProof(seed(),clock);
const request=m=>({actorId:'admin',projectId:'p',stage:'Design review',nextStep:'Review navigation',expectedDigest:m.projectOverview('admin','p').progressDigest,operationId:'progress-op'});
test('Admin progress binds actor, scope, server time and retained immutable history',()=>{
 const m=model(),input=request(m),saved=m.updateProjectProgress(input);assert.equal(saved.actorId,'admin');assert.equal(saved.businessId,'b');assert.equal(saved.timestamp,clock());assert.deepEqual(m.updateProjectProgress(input),saved);
 const view=m.projectOverview('owner','p');assert.equal(view.stage,input.stage);assert.deepEqual(view.progressHistory,[{stage:input.stage,nextStep:input.nextStep,timestamp:clock()}]);assert.equal(view.progressDigest,saved.digest);
 assert.equal(m.snapshot().receipts.length,0);assert.equal(m.snapshot().outbox.length,0);assert.equal(m.snapshot().milestones[0].status,'awaiting-client');
 view.progressHistory[0].stage='injected';saved.stage='injected';assert.equal(m.projectOverview('owner','p').stage,input.stage);validatePortalState(m.snapshot());
});
test('Owner, Member, disabled admin and unknown actors cannot update project progress',()=>{
 for(const actorId of ['owner','member','disabled','missing']){const m=model(),before=m.snapshot();assert.throws(()=>m.updateProjectProgress({...request(m),actorId}),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);}
});
test('Stale edit cannot overwrite a later edit; exact old retry does not roll progress back',()=>{
 const m=model(),input=request(m),saved=m.updateProjectProgress(input);assert.throws(()=>m.updateProjectProgress({...input,stage:'Stale',operationId:'stale'}),/PROGRESS_CONFLICT/);
 m.updateProjectProgress({...request(m),stage:'Build',nextStep:'Check preview',operationId:'next'});assert.deepEqual(m.updateProjectProgress(input),saved);assert.equal(m.projectOverview('member','p').stage,'Build');assert.equal(m.projectOverview('member','p').progressHistory.length,2);
 assert.throws(()=>m.updateProjectProgress({...input,nextStep:'Changed retry'}),/OPERATION_CONFLICT/);validatePortalState(m.snapshot());
});
test('Progress operation IDs cannot cross into approval or tickets',()=>{
 const m=model();m.updateProjectProgress(request(m));assert.throws(()=>m.approve({actorId:'owner',projectId:'p',milestoneId:'m',versionId:'v',operationId:'progress-op'}),/OPERATION_CONFLICT/);
 assert.throws(()=>m.createTicket({actorId:'owner',projectId:'p',type:'question',subject:'Test',body:'Test',operationId:'progress-op'}),/OPERATION_CONFLICT/);
 const n=model();n.createTicket({actorId:'owner',projectId:'p',type:'question',subject:'Test',body:'Test',operationId:'progress-op'});assert.throws(()=>n.updateProjectProgress(request(n)),/OPERATION_CONFLICT/);
});
test('Invalid progress inputs and failed clock leave state unchanged',()=>{
 for(const patch of [{stage:' '},{stage:'x'.repeat(201)},{nextStep:'x'.repeat(2001)},{expectedDigest:'bad'},{operationId:''}]){const m=model(),before=m.snapshot();assert.throws(()=>m.updateProjectProgress({...request(m),...patch}),/INVALID_/);assert.deepEqual(m.snapshot(),before);}
 const m=new PortalProof(seed(),()=> 'invalid'),before=m.snapshot();assert.throws(()=>m.updateProjectProgress(request(m)),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);
});
test('Progress persists across disk reopen and stale second-connection writes fail',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd-progress-')),path=join(dir,'state.sqlite'),a=new DurablePortal(path,seed(),clock),b=new DurablePortal(path,undefined,clock);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const input=request(a);a.updateProjectProgress(input);assert.equal(b.projectOverview('owner','p').stage,'Design review');assert.throws(()=>b.updateProjectProgress({...input,operationId:'stale'}),/PROGRESS_CONFLICT/);
});
test('Progress history corruption fails persistence validation',()=>{
 const m=model();m.updateProjectProgress(request(m));m.updateProjectProgress({...request(m),stage:'Build',operationId:'second'});
 for(const mutate of [s=>s.projects[0].stage='Tampered',s=>s.projects[0].progressHistory[0].nextStep='Tampered',s=>s.projects[0].progressHistory[0].actorId='missing',s=>s.projects[0].progressHistory[0].businessId='other',s=>s.projects[0].progressHistory[1].expectedDigest='0'.repeat(64),s=>s.projects[0].progressHistory[1].operationId='progress-op']){const s=m.snapshot();mutate(s);assert.throws(()=>validatePortalState(s),/CORRUPT_PORTAL_STATE/);}
});
test('HTTP progress writes enforce origin, server-owned admin, exact fields and conflict status',async()=>{
 const m=model(),handle=createBoundary({portal:m,resolveSession:async token=>({actorId:token}),allowedOrigin:'https://client.wearvalleydigital.com'}),{actorId,...input}=request(m);
 const r={action:'update-progress',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'admin',rawBody:JSON.stringify(input)};
 assert.equal((await handle({...r,sessionToken:'owner'})).status,403);assert.equal((await handle({...r,origin:'https://evil.test'})).status,403);assert.equal((await handle({...r,rawBody:JSON.stringify({...input,actorId:'admin'})})).status,400);
 assert.equal((await handle(r)).status,200);assert.equal((await handle({...r,rawBody:JSON.stringify({...input,operationId:'stale'})})).status,409);
});
