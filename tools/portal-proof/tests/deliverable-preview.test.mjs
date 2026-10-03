import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deliverablePreview} from '../deliverable-preview.mjs';
import {createReviewDeliverableReader} from '../deliverable.mjs';
import {createBoundary} from '../boundary.mjs';
import {PortalProof} from '../domain.mjs';
import {designPng,oversizedPng,animatedPng} from './fixtures/png.mjs';
const png=bytes=>deliverablePreview({manifest:{mediaType:'image/png'},bytes});
test('pinned PNG preview preserves exact bytes and bounded dimensions; text stays inert and other formats stay unavailable',()=>{
 assert.deepEqual(png(designPng),{mediaType:'image/png',contentBase64:designPng.toString('base64'),width:240,height:120});
 assert.deepEqual(deliverablePreview({manifest:{mediaType:'text/plain'},bytes:Buffer.from('<script>unsafe()</script>')}),{contentText:'<script>unsafe()</script>'});
 assert.throws(()=>deliverablePreview({manifest:{mediaType:'text/plain'},bytes:Buffer.from([255])}),/DELIVERABLE_CONTENT_CONFLICT/);
 for(const mediaType of ['image/jpeg','application/pdf','application/zip','text/html'])assert.throws(()=>deliverablePreview({manifest:{mediaType},bytes:designPng}),/DELIVERABLE_UNAVAILABLE/);
});
test('PNG preview rejects corrupt, truncated, appended, excessive-dimension and animated content before browser decoding',()=>{
 const changed=Buffer.from(designPng);changed[50]^=1;
 for(const bytes of [Buffer.from('<svg/>'),designPng.subarray(0,56),designPng.subarray(0,designPng.length-1),Buffer.concat([designPng,Buffer.from('extra')]),changed,oversizedPng,animatedPng,Buffer.alloc(512*1024+1)])assert.throws(()=>png(bytes),/DELIVERABLE_CONTENT_CONFLICT/);
});
test('PNG HTTP reads and approval use actor-scoped byte proofs; malformed images cannot save approval even with matching hash',async()=>{
 const run=async(bytes)=>{
  const portal=new PortalProof({identities:[{id:'owner',active:true},{id:'member',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'member',businessId:'b',role:'Member',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]},()=> '2026-10-03T13:00:00.000Z');
  const manifest={label:'Design',sourceId:'image',sourceVersion:'revision-1',mediaType:'image/png',contentSha256:createHash('sha256').update(bytes).digest('hex')},review=portal.publishReview({projectId:'p',milestoneId:'m',versionId:'v',title:'Design',body:'Review image',deliverable:manifest});
  const deliverableReader=createReviewDeliverableReader({portal,source:{readVersion:async()=>({...manifest,bytes})},maxBytes:1000,timeoutMs:1000,maxConcurrentReads:1,proofMaxAgeMs:1000});
  const handle=createBoundary({portal,allowedOrigin:'http://localhost',resolveSession:async actorId=>({actorId}),deliverableReader}),request={projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest};
  const send=(action,actorId,input)=>handle({action,method:'POST',origin:'http://localhost',sessionToken:actorId,rawBody:JSON.stringify(input)});
  const viewed=await send('deliverable','member',request);
  assert.equal((await send('approve','member',{...request,operationId:'member'})).status,403);
  const approved=await send('approve','owner',{...request,operationId:'owner'});
  return {viewed,approved,state:portal.snapshot()};
 };
 const valid=await run(designPng);assert.equal(valid.viewed.status,200);assert.equal(valid.viewed.data.contentBase64,designPng.toString('base64'));assert.equal(valid.approved.status,200);assert.equal(valid.state.receipts.length,1);
 const invalid=await run(Buffer.from('Not PNG'));assert.equal(invalid.viewed.status,409);assert.equal(invalid.approved.status,409);assert.equal(invalid.state.receipts.length,0);
});
