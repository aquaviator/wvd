import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {validatePortalState} from '../state.mjs';
import {createBoundary} from '../boundary.mjs';
const clock=()=> '2026-10-02T19:00:00.000Z';
const seed=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:true},{id:'disabled',active:false,wvdAdmin:true}],projects:[{id:'p',businessId:'b'},{id:'other',businessId:'other'}],memberships:[{actorId:'owner',businessId:'b',active:true,role:'Owner',projectIds:['p']},{actorId:'member',businessId:'b',active:true,role:'Member',projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'},{id:'foreign',projectId:'other',currentVersionId:'x',status:'awaiting-client'}]});
const input={actorId:'admin',projectId:'p',milestoneId:'m',versionId:'v2',title:'Review',body:'Check the heading.',expectedVersionId:'v'};
const model=()=>new PortalProof(seed(),clock);
test('Admin publication reuses immutable text, records server actor/time and keeps client approval separate',()=>{
 const m=model(),review=m.publishReviewAsAdmin(input);assert.equal(review.publisherActorId,'admin');assert.equal(review.publishedAt,clock());
 const current=m.projectOverview('owner','p').awaitingClient[0].review;assert.equal(current.body,input.body);assert.equal(current.digest,review.digest);assert.equal(current.publisherActorId,undefined);assert.equal(current.publishedAt,undefined);
 assert.throws(()=>m.approve({actorId:'admin',projectId:'p',milestoneId:'m',versionId:'v2',reviewDigest:review.digest,operationId:'approval'}),/ACCESS_DENIED/);
 m.approve({actorId:'owner',projectId:'p',milestoneId:'m',versionId:'v2',reviewDigest:review.digest,operationId:'approval'});const history=m.projectOverview('member','p').approvalHistory[0].review;assert.equal(history.publisherActorId,undefined);assert.equal(history.body,input.body);validatePortalState(m.snapshot());
});
test('Client roles, disabled admins and foreign milestone references are denied without mutation',()=>{
 for(const patch of [{actorId:'owner'},{actorId:'member'},{actorId:'disabled'},{actorId:'missing'},{milestoneId:'foreign'}]){const m=model(),before=m.snapshot();assert.throws(()=>m.publishReviewAsAdmin({...input,...patch}),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);}
});
test('Stale publication cannot overwrite newer work and exact historical retry cannot restore an older current version',()=>{
 const m=model(),first=m.publishReviewAsAdmin(input);assert.throws(()=>m.publishReviewAsAdmin({...input,versionId:'stale'}),/VERSION_CONFLICT/);
 m.publishReviewAsAdmin({...input,versionId:'v3',expectedVersionId:'v2',body:'New text'});assert.deepEqual(m.publishReviewAsAdmin(input),first);assert.equal(m.projectOverview('owner','p').awaitingClient[0].currentVersionId,'v3');
 const before=m.snapshot();assert.throws(()=>m.publishReviewAsAdmin({...input,body:'Changed retry'}),/REVIEW_IMMUTABLE/);assert.deepEqual(m.snapshot(),before);
});
test('Clock/input failure and existing legacy approval never leave a partial publication',()=>{
 const m=new PortalProof(seed(),()=> 'invalid'),before=m.snapshot();assert.throws(()=>m.publishReviewAsAdmin(input),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);
 const legacy=model();legacy.approve({actorId:'owner',projectId:'p',milestoneId:'m',versionId:'v',operationId:'legacy'});assert.throws(()=>legacy.publishReviewAsAdmin({...input,versionId:'v'}),/REVIEW_IMMUTABLE/);
 const n=model(),original=n.snapshot();assert.throws(()=>n.publishReviewAsAdmin({...input,body:' '}),/INVALID_TEXT/);assert.deepEqual(n.snapshot(),original);
});
test('Publication survives reopen and corrupt publisher attribution fails validation',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd-admin-review-')),path=join(dir,'state.sqlite'),a=new DurablePortal(path,seed(),clock),b=new DurablePortal(path,undefined,clock);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const saved=a.publishReviewAsAdmin(input);assert.deepEqual(b.publishReviewAsAdmin(input),saved);
 for(const patch of [{publisherActorId:'missing'},{publishedAt:'bad'},{publisherActorId:undefined}]){const state=b.snapshot();Object.assign(state.milestones[0].reviews[0],patch);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);}
});
test('Publication HTTP accepts only authenticated admin with explicit current version and same origin',async()=>{
 const m=model(),handle=createBoundary({portal:m,resolveSession:async token=>({actorId:token}),allowedOrigin:'https://client.wearvalleydigital.com'}),{actorId,...payload}=input;
 const r={action:'publish-review',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'admin',rawBody:JSON.stringify(payload)};
 assert.equal((await handle({...r,sessionToken:'owner'})).status,403);assert.equal((await handle({...r,origin:'https://evil.test'})).status,403);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,publisherActorId:'admin'})})).status,400);assert.equal((await handle(r)).status,200);
 assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,body:'Changed'})})).status,409);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,versionId:'stale'})})).status,409);
});

test('Admin milestone creation commits immutable first review, attribution and exact retry without widening scope',()=>{
 const m=model(),request={...input,milestoneId:'new'},created=m.createMilestoneAsAdmin(request);assert.equal(created.review.publisherActorId,'admin');assert.deepEqual(m.createMilestoneAsAdmin(request),created);assert.equal(m.snapshot().milestones.length,3);
 const view=m.projectOverview('owner','p').awaitingClient.find(x=>x.id==='new');assert.equal(view.review.body,input.body);assert.equal(view.createdByActorId,undefined);assert.equal(view.createdAt,undefined);assert.equal(m.snapshot().receipts.length,0);assert.equal(m.snapshot().outbox.length,0);validatePortalState(m.snapshot());
 m.publishReviewAsAdmin({...input,milestoneId:'new',versionId:'v3',expectedVersionId:'v2'});assert.deepEqual(m.createMilestoneAsAdmin(request),created);assert.equal(m.projectOverview('owner','p').awaitingClient.find(x=>x.id==='new').currentVersionId,'v3');
 assert.throws(()=>m.createMilestoneAsAdmin({...request,body:'Changed'}),/REVIEW_IMMUTABLE/);assert.throws(()=>m.createMilestoneAsAdmin({...request,milestoneId:'foreign'}),/MILESTONE_CONFLICT/);assert.throws(()=>m.createMilestoneAsAdmin({...request,milestoneId:'m'}),/MILESTONE_CONFLICT/);
});
test('Client/disabled creation, invalid content and a second clock failure leave no partial milestone',()=>{
 for(const actorId of ['owner','member','disabled','missing']){const m=model(),before=m.snapshot();assert.throws(()=>m.createMilestoneAsAdmin({...input,milestoneId:'new',actorId}),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);}
 for(const patch of [{milestoneId:''},{title:' '},{versionId:' '},{body:'x'.repeat(10001)}]){const m=model(),before=m.snapshot();assert.throws(()=>m.createMilestoneAsAdmin({...input,milestoneId:'new',...patch}),/INVALID_/);assert.deepEqual(m.snapshot(),before);}
 let calls=0;const m=new PortalProof(seed(),()=>++calls===1?clock():'invalid'),before=m.snapshot();assert.throws(()=>m.createMilestoneAsAdmin({...input,milestoneId:'new'}),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);
});
test('Milestone creation persists across reopen; HTTP denies client creation and returns conflict for existing rows',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd-milestone-')),path=join(dir,'state.sqlite'),a=new DurablePortal(path,seed(),clock),b=new DurablePortal(path,undefined,clock);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const {actorId,expectedVersionId,...payload}=input,request={...payload,milestoneId:'new'},handle=createBoundary({portal:a,resolveSession:async token=>({actorId:token}),allowedOrigin:'https://client.wearvalleydigital.com'}),r={action:'create-milestone',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'admin',rawBody:JSON.stringify(request)};
 assert.equal((await handle({...r,sessionToken:'owner'})).status,403);assert.equal((await handle(r)).status,200);assert.equal(b.projectOverview('member','p').awaitingClient.find(x=>x.id==='new').review.body,input.body);assert.equal((await handle(r)).status,200);assert.equal((await handle({...r,rawBody:JSON.stringify({...request,milestoneId:'m'})})).status,409);
 const state=b.snapshot();state.milestones.find(x=>x.id==='new').createdByActorId='missing';assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);
});
