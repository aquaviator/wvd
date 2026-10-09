import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {reviewDigest} from '../review.mjs';
import {validatePortalState} from '../state.mjs';
import {reviewDeliverable,createReviewDeliverableReader} from '../deliverable.mjs';
const bytes=Buffer.from('Synthetic design snapshot.');
const manifest={label:'Design file',sourceId:'synthetic-design',sourceVersion:'revision-1',contentSha256:createHash('sha256').update(bytes).digest('hex'),mediaType:'text/plain'};
const content={projectId:'p',milestoneId:'m',versionId:'v',title:'Review',body:'Check the design.'};
const seed=()=>({identities:[{id:'owner',active:true},{id:'member',active:true},{id:'foreign',active:true},{id:'admin',active:true,wvdAdmin:true}],projects:[{id:'p',businessId:'b'},{id:'other',businessId:'different'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'member',businessId:'b',role:'Member',active:true,projectIds:['p']},{actorId:'foreign',businessId:'different',role:'Owner',active:true,projectIds:['other']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const clock=()=> '2026-10-03T13:00:00.000Z';
function fixture(){const portal=new PortalProof(seed(),clock),review=portal.publishReview({...content,deliverable:manifest});return {portal,review,request:{projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest}};}
// Synthetic already-approved imported state exercises historical compatibility.
// Current runtime approval stays blocked until preview composition is ready.
function archived(){const portal=new PortalProof(seed(),clock);portal.publishReview(content);const receipt=portal.approve({actorId:'owner',...content,operationId:'approve',reviewDigest:reviewDigest(content)});const state=portal.snapshot(),review=state.milestones[0].reviews[0];review.deliverable=reviewDeliverable(manifest);review.digest=reviewDigest(review);state.receipts[0].reviewDigest=review.digest;validatePortalState(state);return {portal:new PortalProof(state,clock),review,request:{projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest}};}
const result=()=>({sourceId:manifest.sourceId,sourceVersion:manifest.sourceVersion,mediaType:manifest.mediaType,bytes:Buffer.from(bytes)});
const reader=(portal,readVersion,patch={})=>createReviewDeliverableReader({portal,source:{readVersion},maxBytes:1000,timeoutMs:1000,maxConcurrentReads:1,proofMaxAgeMs:1000,...patch});

test('deliverable manifest binds exact review/approval, preserves legacy digests and cannot change under a version',()=>{
 const {portal,review}=fixture();
 assert.equal(reviewDigest(content),createHash('sha256').update(JSON.stringify(['p','m','v','Review','Check the design.'])).digest('hex'));
 assert.notEqual(reviewDigest(content),review.digest);
 for(const patch of [{sourceVersion:'revision-2'},{sourceId:'another-file'},{contentSha256:'0'.repeat(64)},{label:'Another file'}])assert.throws(()=>portal.publishReview({...content,deliverable:{...manifest,...patch}}),/REVIEW_IMMUTABLE/);
 assert.throws(()=>portal.approve({actorId:'owner',...content,operationId:'approve',reviewDigest:reviewDigest(content)}),/REVIEW_CONFLICT/);
 assert.throws(()=>portal.approve({actorId:'owner',...content,operationId:'approve',reviewDigest:review.digest}),/DELIVERABLE_UNAVAILABLE/);
 const history=archived().portal;
 history.publishReview({...content,versionId:'v2',deliverable:{...manifest,sourceVersion:'revision-2'}});
 assert.deepEqual(history.projectOverview('member','p').approvalHistory[0].review.deliverable,reviewDeliverable(manifest));
 assert.throws(()=>portal.approve({actorId:'member',...content,versionId:'v2',operationId:'member'}),/ACCESS_DENIED/);
});

test('only scoped current/approved review bindings can retrieve bytes; request mutation cannot replace an in-flight source',async()=>{
 const {portal,request}=fixture();let reads=0;
 const read=reader(portal,async input=>{reads++;assert.equal(input.projectId,'p');assert.equal(input.sourceId,manifest.sourceId);assert.equal(input.sourceVersion,manifest.sourceVersion);request.projectId='other';return result();});
 await assert.rejects(()=>read('foreign',request),/ACCESS_DENIED/);assert.equal(reads,0);
 const output=await read('member',request);assert.deepEqual(output.bytes,bytes);assert.deepEqual(output.manifest,reviewDeliverable(manifest));assert.equal(reads,1);
 output.bytes.fill(0);assert.deepEqual(bytes,Buffer.from('Synthetic design snapshot.'));
});

test('wrong revision, content, media type, empty/oversized data and private provider errors fail closed',async()=>{
 for(const patch of [{sourceId:'foreign'},{sourceVersion:'latest'},{mediaType:'text/html'},{bytes:Buffer.from('Changed')},{bytes:Buffer.alloc(0)},{bytes:Buffer.alloc(1001)},{bytes:'Synthetic design snapshot.'}]){
  const {portal,request}=fixture();await assert.rejects(()=>reader(portal,async()=>({...result(),...patch}))('owner',request),/DELIVERABLE_CONTENT_CONFLICT/);
 }
 const {portal,request}=fixture();await assert.rejects(()=>reader(portal,async()=>{throw Error('private source token');})('owner',request),error=>error.message==='DELIVERABLE_SERVICE_UNAVAILABLE');
});

test('revocation or pending-version replacement during provider retrieval suppresses the snapshot',async()=>{
 for(const change of ['revocation','version']){
  const {portal,request}=fixture();const read=reader(portal,async()=>{if(change==='revocation')portal.revokeMembership('owner','b');else portal.publishReview({...content,versionId:'v2',deliverable:manifest});return result();});
  await assert.rejects(()=>read('owner',request),new RegExp(change==='revocation'?'ACCESS_DENIED':'DELIVERABLE_UNAVAILABLE'));
 }
});

test('approved original snapshot remains readable after replacement while exact content is still checked',async()=>{
 const {portal,request}=archived();portal.publishReview({...content,versionId:'v2',deliverable:{...manifest,sourceVersion:'revision-2'}});
 assert.deepEqual((await reader(portal,async()=>result())('member',request)).bytes,bytes);
});

test('timeout aborts provider and keeps admission occupied until an uncooperative provider settles',async()=>{
 const {portal,request}=fixture();let release,signal,reads=0;const waiting=new Promise(resolve=>{release=resolve;});
 const read=reader(portal,async input=>{reads++;signal=input.signal;return reads===1?waiting:result();},{timeoutMs:20});
 await assert.rejects(()=>read('owner',request),/DELIVERABLE_SERVICE_UNAVAILABLE/);assert.equal(signal.aborted,true);
 await assert.rejects(()=>read('owner',request),/DELIVERABLE_SERVICE_UNAVAILABLE/);assert.equal(reads,1);
 release(result());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual((await read('owner',request)).bytes,bytes);assert.equal(reads,2);
});

test('malformed sources/configuration and tampered persistent manifest fail before retrieval',()=>{
 for(const patch of [{sourceId:'https://untrusted.test/file'},{sourceVersion:'latest\n'},{label:'secret\u0000'},{mediaType:'text/html'},{contentSha256:'bad'},{url:'https://untrusted.test'}])assert.throws(()=>reviewDeliverable({...manifest,...patch}),/INVALID_DELIVERABLE/);
 const {portal}=fixture();for(const patch of [{maxBytes:0},{maxBytes:512*1024+1},{timeoutMs:0},{maxConcurrentReads:0},{source:{}}])assert.throws(()=>createReviewDeliverableReader({portal,source:{readVersion:async()=>result()},maxBytes:1000,timeoutMs:1000,maxConcurrentReads:1,proofMaxAgeMs:1000,...patch}),/INVALID_CONFIGURATION/);
 for(const patch of [{sourceVersion:'another'},{contentSha256:'0'.repeat(64)},{sourceId:'https://foreign.test'}]){const state=portal.snapshot();Object.assign(state.milestones[0].reviews[0].deliverable,patch);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);}
});

test('manifest and reader survive disk reopen without new HTTP acceptance',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'wvd-deliverable-')),path=join(directory,'portal.sqlite');let portal=new DurablePortal(path,seed(),clock);t.after(()=>{portal.close();rmSync(directory,{recursive:true,force:true});});
 const review=portal.publishReviewAsAdmin({actorId:'admin',...content,deliverable:manifest,expectedVersionId:'v'});
 portal.close();portal=new DurablePortal(path,undefined,clock);
 const request={projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest};assert.deepEqual((await reader(portal,async()=>result())('owner',request)).bytes,bytes);
 const {createBoundary}=await import('../boundary.mjs');const handle=createBoundary({portal,resolveSession:async()=>({actorId:'admin'}),allowedOrigin:'http://localhost'});
 const ownerHandle=createBoundary({portal,resolveSession:async()=>({actorId:'owner'}),allowedOrigin:'http://localhost'});const rejected=await ownerHandle({action:'approve',method:'POST',origin:'http://localhost',sessionToken:'synthetic',rawBody:JSON.stringify({...request,operationId:'a'})});assert.equal(rejected.status,409);assert.equal(rejected.data.error,'DELIVERABLE_UNAVAILABLE');assert.equal(portal.snapshot().receipts.length,0);
 const response=await handle({action:'publish-review',method:'POST',origin:'http://localhost',sessionToken:'synthetic',rawBody:JSON.stringify({...content,versionId:'v2',expectedVersionId:'v',deliverable:manifest})});assert.equal(response.status,400);
});

test('only a fresh reader capability for this actor and adapter can authorise the exact deliverable approval',async()=>{
 const {portal,request}=fixture(),read=reader(portal,async()=>result()),proof=await read('owner',request),approval={actorId:'owner',...request,operationId:'approved-file'};
 const other=new PortalProof(portal.snapshot(),clock);
 for(const fake of [{...proof},structuredClone(proof),await read('member',request)])assert.throws(()=>portal.approve(approval,fake),/DELIVERABLE_UNAVAILABLE/);
 assert.throws(()=>other.approve(approval,proof),/DELIVERABLE_UNAVAILABLE/);
 proof.bytes.fill(0);assert.throws(()=>portal.approve(approval,proof),/DELIVERABLE_UNAVAILABLE/);proof.bytes=Buffer.from(bytes);
 const receipt=portal.approve(approval,proof);assert.equal(receipt.reviewDigest,request.reviewDigest);assert.deepEqual(portal.approve(approval),receipt);
 portal.publishReview({...content,versionId:'v2',deliverable:{...manifest,sourceVersion:'revision-2'}});
 assert.deepEqual(portal.projectOverview('member','p').approvalHistory[0].review.deliverable,reviewDeliverable(manifest));
 const fresh=fixture(),expired=await reader(fresh.portal,async()=>result(),{proofMaxAgeMs:1})('owner',fresh.request);await new Promise(resolve=>setTimeout(resolve,5));assert.throws(()=>fresh.portal.approve({...approval,...fresh.request},expired),/DELIVERABLE_UNAVAILABLE/);
});

test('configured boundary retrieves safe text and re-verifies bytes before approval; unconfigured and forged requests remain denied',async()=>{
 const {portal,request}=fixture();let reads=0;const {createBoundary}=await import('../boundary.mjs');
 const handle=createBoundary({portal,resolveSession:async()=>({actorId:'owner'}),allowedOrigin:'http://localhost',deliverableReader:reader(portal,async()=>{reads++;return result();})});
 const send=(action,input)=>handle({action,method:'POST',origin:'http://localhost',sessionToken:'synthetic',rawBody:JSON.stringify(input)});
 const viewed=await send('deliverable',request);assert.equal(viewed.status,200);assert.equal(viewed.data.contentText,bytes.toString());assert.equal(JSON.stringify(viewed).includes(manifest.sourceId),false);
 const forged=await send('approve',{...request,operationId:'a',verified:true});assert.equal(forged.status,400);
 const approved=await send('approve',{...request,operationId:'a'});assert.equal(approved.status,200);assert.equal(reads,2);assert.equal(portal.snapshot().receipts.length,1);
 const retry=await send('approve',{...request,operationId:'a'});assert.deepEqual(retry,approved);assert.equal(reads,2);
});

test('disk transaction accepts this adapter proof and rejects reuse in a reopened adapter',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'wvd-deliverable-proof-')),path=join(directory,'portal.sqlite'),portal=new DurablePortal(path,seed(),clock),other=new DurablePortal(path,undefined,clock);t.after(()=>{portal.close();other.close();rmSync(directory,{recursive:true,force:true});});
 const review=portal.publishReviewAsAdmin({actorId:'admin',...content,deliverable:manifest,expectedVersionId:'v'}),request={projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest},proof=await reader(portal,async()=>result())('owner',request),approval={actorId:'owner',...request,operationId:'a'};
 assert.throws(()=>other.approve(approval,proof),/DELIVERABLE_UNAVAILABLE/);assert.equal(other.snapshot().receipts.length,0);
 assert.equal(portal.approve(approval,proof).reviewDigest,review.digest);assert.equal(other.snapshot().receipts.length,1);
});
