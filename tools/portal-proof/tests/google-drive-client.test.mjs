import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createGoogleDriveRevisionClient} from '../google-drive-client.mjs';
import {createGoogleDriveDeliverableSource} from '../google-drive-deliverable.mjs';
test('Google Auth bridge fixes endpoint, method and revision and forwards bounded streaming without ambient credentials',async()=>{
 const calls=[],bytes=Buffer.from('Retained content'),authClient={request:async request=>{calls.push(request);return {status:200,data:request.params.alt?Readable.from([bytes]):{id:'r1',kind:'drive#revision',mimeType:'text/plain',size:String(bytes.length),keepForever:true}};}};
 const source=createGoogleDriveDeliverableSource({drive:createGoogleDriveRevisionClient({authClient}),bindings:[{projectId:'p',sourceId:'s',sourceVersion:'v',fileId:'f1',revisionId:'r1',mediaType:'text/plain'}],requestTimeoutMs:1000,maxConcurrentReads:1});
 assert.deepEqual((await source.readVersion({projectId:'p',sourceId:'s',sourceVersion:'v',maxBytes:1000,signal:new AbortController().signal})).bytes,bytes);assert.equal(calls.length,3);
 for(const call of calls){assert.equal(call.url,'https://www.googleapis.com/drive/v3/files/f1/revisions/r1');assert.equal(call.method,'GET');assert.equal(call.retry,false);assert.equal(call.maxRedirects,0);assert.equal(Object.hasOwn(call,'headers'),false);}
 assert.equal(calls[1].responseType,'stream');assert.deepEqual(calls[1].params,{alt:'media',acknowledgeAbuse:false});
});
test('Google Auth bridge rejects URL/path injection, arbitrary fields, abuse override and unbounded options',async()=>{
 let calls=0;const client=createGoogleDriveRevisionClient({authClient:{request:async()=>{calls++;}}}),params={fileId:'f1',revisionId:'r1',fields:'id,kind,mimeType,size,keepForever'},options={timeout:1000,retry:false,signal:new AbortController().signal,maxContentLength:8192};
 for(const patch of [{fileId:'../foreign'},{revisionId:'r1?alt=media'},{fields:'*'},{url:'https://foreign.test'},{alt:'media',acknowledgeAbuse:true}])await assert.rejects(()=>client.revisions.get({...params,...patch},options),/INVALID_CONFIGURATION/);
 for(const patch of [{timeout:0},{retry:true},{maxContentLength:Infinity},{signal:undefined}])await assert.rejects(()=>client.revisions.get(params,{...options,...patch}),/INVALID_CONFIGURATION/);
 assert.equal(calls,0);assert.throws(()=>createGoogleDriveRevisionClient({authClient:{}}),/INVALID_CONFIGURATION/);
});
