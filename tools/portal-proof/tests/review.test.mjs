import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {validatePortalState} from '../state.mjs';
const seed=()=>({identities:[{id:'o',active:true},{id:'x',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const model=()=>new PortalProof(seed(),()=> '2026-10-02T15:00:00Z');
const content={projectId:'p',milestoneId:'m',versionId:'v',title:'Design review',body:'Check the heading and contact form.'};
const approval={actorId:'o',projectId:'p',milestoneId:'m',versionId:'v',operationId:'a'};
test('approval requires exact published content, persists digest and rejects changed retries',()=>{
 const m=model(),review=m.publishReview(content),before=m.snapshot();
 for(const reviewDigest of [undefined,'0'.repeat(64)]){assert.throws(()=>m.approve({...approval,reviewDigest}),/REVIEW_CONFLICT/);assert.deepEqual(m.snapshot(),before);}
 const saved=m.approve({...approval,reviewDigest:review.digest});assert.equal(saved.reviewDigest,review.digest);assert.deepEqual(m.approve({...approval,reviewDigest:review.digest}),saved);
 assert.throws(()=>m.approve(approval),/OPERATION_CONFLICT/);assert.equal(validatePortalState(m.snapshot()).receipts.length,1);
});
test('version content cannot change and a new version requires fresh approval',()=>{
 const m=model(),first=m.publishReview(content);m.approve({...approval,reviewDigest:first.digest});
 assert.throws(()=>m.publishReview({...content,body:'Changed'}),/REVIEW_IMMUTABLE/);
 const second=m.publishReview({...content,versionId:'v2',body:'Check the revised heading.'});assert.notEqual(second.digest,first.digest);
 assert.throws(()=>m.approve({...approval,operationId:'b',reviewDigest:first.digest}),/VERSION_CONFLICT/);
 m.approve({...approval,versionId:'v2',operationId:'b',reviewDigest:second.digest});assert.deepEqual(m.snapshot().receipts.map(x=>x.reviewDigest),[first.digest,second.digest]);
});
test('overview returns current content only, with normal tenant authorisation',()=>{
 const m=model();m.publishReview(content);m.publishReview({...content,versionId:'v2',body:'New text'});
 const milestone=m.projectOverview('o','p').awaitingClient[0];assert.equal(milestone.review.body,'New text');assert.equal(milestone.reviews,undefined);assert.throws(()=>m.projectOverview('x','p'),/ACCESS_DENIED/);
});
test('corrupt content and receipt digest fail closed',()=>{
 const m=model(),review=m.publishReview(content);m.approve({...approval,reviewDigest:review.digest});
 for(const alter of [s=>s.milestones[0].reviews[0].body='Tampered',s=>s.receipts[0].reviewDigest='0'.repeat(64),s=>s.milestones[0].reviews.push(s.milestones[0].reviews[0])]){const state=m.snapshot();alter(state);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);}
});
test('missing current review pauses approval and legacy approvals cannot be reinterpreted',()=>{
 const m=model(),review=m.publishReview(content);m.replaceVersion('m','v2');assert.equal(m.projectOverview('o','p').awaitingClient[0].review,null);assert.throws(()=>m.approve({...approval,versionId:'v2',reviewDigest:review.digest}),/REVIEW_CONFLICT/);
 const legacy=model();legacy.approve(approval);assert.throws(()=>legacy.publishReview(content),/REVIEW_IMMUTABLE/);
});

test('HTTP approval accepts only the exact digest and rejects identity injection',async()=>{
 const {createBoundary}=await import('../boundary.mjs');const portal=model(),review=portal.publishReview(content);
 const handle=createBoundary({portal,resolveSession:async()=>({actorId:'o'}),allowedOrigin:'http://localhost'});
 const {actorId,...request}=approval;
 const send=payload=>handle({action:'approve',method:'POST',origin:'http://localhost',rawBody:JSON.stringify(payload),sessionToken:'synthetic'});
 assert.equal((await send(request)).status,409);
 assert.equal((await send({...request,reviewDigest:'bad'})).status,400);
 assert.equal((await send({...request,reviewDigest:review.digest,actorId:'x'})).status,400);
 assert.equal((await send({...request,reviewDigest:review.digest})).data.reviewDigest,review.digest);
});

test('approval history retains exact reviewed text after a replacement and omits private operator data',()=>{
 const m=model(),first=m.publishReview(content);m.approve({...approval,reviewDigest:first.digest});
 m.publishReview({...content,versionId:'v2',body:'New review text'});
 const view=m.projectOverview('o','p');assert.equal(view.awaitingClient[0].review.body,'New review text');
 assert.equal(view.approvalHistory[0].review.body,content.body);assert.equal(view.approvalHistory[0].reviewDigest,first.digest);
 assert.deepEqual(Object.keys(view.approvalHistory[0]).sort(),['id','milestoneId','review','reviewDigest','timestamp','versionId']);
 assert.throws(()=>m.projectOverview('x','p'),/ACCESS_DENIED/);
 view.approvalHistory[0].review.body='Injected';assert.equal(m.projectOverview('o','p').approvalHistory[0].review.body,content.body);
});
test('legacy approvals have explicitly unavailable review content',()=>{
 const m=model();m.approve(approval);const history=m.projectOverview('o','p').approvalHistory;
 assert.equal(history[0].review,null);assert.equal(history[0].reviewDigest,null);assert.equal(history[0].versionId,'v');
});

test('saved review feedback remains version-bound and readable after approval and replacement',()=>{
 const m=model(),review=m.publishReview(content);m.submitFeedback({...approval,operationId:'f',body:'Check the heading.'});m.approve({...approval,reviewDigest:review.digest});m.publishReview({...content,versionId:'v2'});
 const view=m.projectOverview('o','p');assert.equal(view.feedbackHistory[0].versionId,'v');assert.equal(view.feedbackHistory[0].body,'Check the heading.');
 assert.deepEqual(Object.keys(view.feedbackHistory[0]).sort(),['body','id','milestoneId','timestamp','versionId']);
 view.feedbackHistory[0].body='Injected';assert.equal(m.projectOverview('o','p').feedbackHistory[0].body,'Check the heading.');
 m.revokeMembership('o','b');assert.throws(()=>m.projectOverview('o','p'),/ACCESS_DENIED/);
});
