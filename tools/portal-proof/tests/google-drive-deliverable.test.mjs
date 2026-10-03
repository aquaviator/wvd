import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {createGoogleDriveDeliverableSource} from '../google-drive-deliverable.mjs';
import {createReviewDeliverableReader} from '../deliverable.mjs';
import {PortalProof} from '../domain.mjs';
const bytes=Buffer.from('Synthetic retained file.'),binding={projectId:'p',sourceId:'design',sourceVersion:'version-1',fileId:'file-1',revisionId:'revision-1',mediaType:'text/plain'};
const metadata=()=>({kind:'drive#revision',id:'revision-1',mimeType:'text/plain',size:String(bytes.length),keepForever:true});
const request=()=>({projectId:'p',sourceId:'design',sourceVersion:'version-1',maxBytes:1000,signal:new AbortController().signal});
function fixture(get,patch={}){const calls=[];const drive={revisions:{get:async(params,options)=>{calls.push({params,options});return get?get(params,options,calls.length):{status:200,data:params.alt?Readable.from([bytes.subarray(0,4),bytes.subarray(4)]):metadata()};}}};return {calls,source:createGoogleDriveDeliverableSource({drive,bindings:[binding],requestTimeoutMs:1000,maxConcurrentReads:1,...patch})};}
test('Drive adapter reads only registered retained revision, streams bounded bytes and rechecks metadata',async()=>{
 const {source,calls}=fixture();assert.deepEqual(await source.readVersion(request()),{sourceId:'design',sourceVersion:'version-1',mediaType:'text/plain',bytes});assert.equal(calls.length,3);
 for(const {params,options} of calls){assert.equal(params.fileId,'file-1');assert.equal(params.revisionId,'revision-1');assert.equal(options.retry,false);assert.equal(options.timeout,1000);assert.ok(options.signal instanceof AbortSignal);}
 assert.deepEqual(calls[1].params,{fileId:'file-1',revisionId:'revision-1',alt:'media',acknowledgeAbuse:false});assert.equal(calls[1].options.responseType,'stream');assert.equal(calls[1].options.maxContentLength,1000);assert.equal(calls[0].options.maxContentLength,8192);
});
test('unknown project/source/version and invalid bounds deny before any Google calls; configuration is copied',async()=>{
 const supplied={...binding},{source,calls}=fixture(null,{bindings:[supplied]});supplied.fileId='changed';
 for(const patch of [{projectId:'other'},{sourceId:'foreign'},{sourceVersion:'latest'}])await assert.rejects(()=>source.readVersion({...request(),...patch}),/DELIVERABLE_UNAVAILABLE/);
 for(const patch of [{maxBytes:0},{maxBytes:512*1024+1},{signal:undefined}])await assert.rejects(()=>source.readVersion({...request(),...patch}),/INVALID_DELIVERABLE/);
 assert.equal(calls.length,0);await source.readVersion(request());assert.equal(calls[0].params.fileId,'file-1');
});
test('purgeable, wrong revision/type/size, unavailable and native Workspace content never reach media download',async()=>{
 for(const patch of [{keepForever:false},{keepForever:undefined},{id:'other'},{mimeType:'application/vnd.google-apps.document'},{size:'0'},{size:'1001'},{size:bytes.length},{size:'1e3'},{kind:'other'}]){
  const {source,calls}=fixture(()=>({status:200,data:{...metadata(),...patch}}));await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_(CONTENT_CONFLICT|UNAVAILABLE)/);assert.equal(calls.length,1);
 }
 for(const status of [206,302,403,404]){const {source}=fixture(()=>({status,data:metadata()}));await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_SERVICE_UNAVAILABLE/);}
});
test('truncation, extra bytes, string streams, stream failures and changed retention/size discard bytes',async()=>{
 for(const streamed of [()=>Readable.from([bytes.subarray(1)]),()=>Readable.from([bytes,Buffer.from('extra')]),()=>Readable.from(['text']),()=>Readable.from((async function*(){yield bytes;throw Error('private provider failure');})())]){
  let stream;const {source}=fixture(params=>({status:200,data:params.alt?(stream=streamed()):metadata()}));await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_(CONTENT_CONFLICT|SERVICE_UNAVAILABLE)/);assert.equal(stream.destroyed,true);
 }
 for(const patch of [{keepForever:false},{size:String(bytes.length+1)}]){const {source}=fixture((params,options,n)=>({status:200,data:params.alt?Readable.from([bytes]):{...metadata(),...(n===3?patch:{})}}));await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_(CONTENT_CONFLICT|UNAVAILABLE)/);}
});
test('abort destroys an active stream and sanitises provider errors',async()=>{
 let stream,mediaReady;const ready=new Promise(resolve=>{mediaReady=resolve;});const {source}=fixture(params=>{if(params.alt){stream=new Readable({read(){}});mediaReady();}return {status:200,data:params.alt?stream:metadata()};});
 const controller=new AbortController(),pending=source.readVersion({...request(),signal:controller.signal});await ready;await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(()=>pending,error=>error.message==='DELIVERABLE_SERVICE_UNAVAILABLE');assert.equal(stream.destroyed,true);
 const failed=fixture(()=>{throw Error('secret token and Google file ID');});await assert.rejects(()=>failed.source.readVersion(request()),error=>error.message==='DELIVERABLE_SERVICE_UNAVAILABLE');
 const cancelled=fixture();await assert.rejects(()=>cancelled.source.readVersion({...request(),signal:AbortSignal.abort()}),/DELIVERABLE_SERVICE_UNAVAILABLE/);assert.equal(cancelled.calls.length,0);
});
test('timeout retains admission until stalled SDK request settles and cancels late streams',async()=>{
 let settle,late;const waiting=new Promise(resolve=>{settle=resolve;});let calls=0,stalled=true;const {source}=fixture(params=>{calls++;return params.alt?(stalled?waiting:{status:200,data:Readable.from([bytes])}):{status:200,data:metadata()};},{requestTimeoutMs:15});
 await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_SERVICE_UNAVAILABLE/);assert.equal(calls,2);await assert.rejects(()=>source.readVersion(request()),/DELIVERABLE_SERVICE_UNAVAILABLE/);assert.equal(calls,2);
 late=Readable.from([bytes]);settle({status:200,data:late});await new Promise(resolve=>setImmediate(resolve));assert.equal(late.destroyed,true);stalled=false;assert.deepEqual((await source.readVersion(request())).bytes,bytes);assert.equal(calls,5);
});
test('malformed adapter configurations fail without provider access',()=>{
 for(const patch of [{bindings:[]},{bindings:[binding,binding]},{bindings:[{...binding,fileId:'https://foreign.test'}]},{bindings:[{...binding,mediaType:'application/vnd.google-apps.document'}]},{bindings:[{...binding,credential:'secret'}]},{requestTimeoutMs:0},{maxConcurrentReads:0},{drive:{}}])assert.throws(()=>fixture(null,patch),/INVALID_CONFIGURATION/);
});
test('Drive bytes compose with exact actor/version approval proof and changed bytes never mint a proof',async()=>{
 const portal=new PortalProof({identities:[{id:'owner',active:true},{id:'foreign',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]},()=> '2026-10-03T13:00:00.000Z');
 const review=portal.publishReview({projectId:'p',milestoneId:'m',versionId:'v',title:'Review retained file',body:'Review exact bytes.',deliverable:{label:'Design',sourceId:binding.sourceId,sourceVersion:binding.sourceVersion,mediaType:binding.mediaType,contentSha256:createHash('sha256').update(bytes).digest('hex')}});
 const {source,calls}=fixture(),read=createReviewDeliverableReader({portal,source,maxBytes:1000,timeoutMs:1000,maxConcurrentReads:1,proofMaxAgeMs:1000}),input={projectId:'p',milestoneId:'m',versionId:'v',reviewDigest:review.digest};
 await assert.rejects(()=>read('foreign',input));assert.equal(calls.length,0);const proof=await read('owner',input);assert.equal(portal.approve({actorId:'owner',...input,operationId:'approve'},proof).reviewDigest,review.digest);
 const changed=fixture(params=>({status:200,data:params.alt?Readable.from([Buffer.alloc(bytes.length,65)]):metadata()}));const changedRead=createReviewDeliverableReader({portal,source:changed.source,maxBytes:1000,timeoutMs:1000,maxConcurrentReads:1,proofMaxAgeMs:1000});await assert.rejects(()=>changedRead('owner',input),/DELIVERABLE_CONTENT_CONFLICT/);
});
