import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createBookingConfirmationHandler} from '../booking-confirmation-http.mjs';
async function fixture(t,patch={}){
 let queued=0,sent=0;const token='reservation.'+'a'.repeat(64),origin='https://booking.example.test';
 const handler=createBookingConfirmationHandler({allowedOrigin:origin,maxConcurrentRequests:2,admit:async()=>true,management:{read:async value=>{if(value!==token)throw Error('MANAGEMENT_DENIED');return {status:'CONFIRMED'};}},resolveRecipient:async({proof,reservationId})=>{assert.equal(reservationId,'reservation');return {verified:proof==='verified-proof',email:'customer@example.test'};},delivery:{queue:async value=>{queued++;assert.equal(value.recipientEmail,'customer@example.test');assert.equal(value.managementUrl,origin+'/book/manage#'+token);return {reservationId:'reservation',intentId:'intent'};},dispatch:async()=>{sent++;return {status:'ACCEPTED',providerAccepted:true,delivered:false};}},...patch});
 const server=createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const body={token,recipientProof:'verified-proof',consent:true};
 return {url:'http://127.0.0.1:'+server.address().port+'/api/calls/manage/confirmation',origin,get queued(){return queued;},get sent(){return sent;},body,post:async(value=body,headers={})=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/calls/manage/confirmation',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(value)});return {status:response.status,body:await response.json()};}};
}
test('confirmation route requires current capability, verified recipient and explicit consent before queue/send',async t=>{
 const f=await fixture(t);
 for(const body of [{...f.body,consent:false},{...f.body,recipientEmail:'injected@example.test'}])assert.equal((await f.post(body)).status,400);
 assert.equal((await f.post({...f.body,recipientProof:'unverified'})).status,403);
 assert.equal((await f.post({...f.body,token:'reservation.'+'b'.repeat(64)})).status,403);
 assert.equal((await f.post(f.body,{Origin:'https://foreign.example'})).status,403);assert.equal(f.queued,0);
 const result=await f.post();assert.equal(result.status,200);assert.deepEqual(result.body,{status:'ACCEPTED',providerAccepted:true,delivered:false});assert.equal(f.queued,1);assert.equal(f.sent,1);assert.equal(JSON.stringify(result).includes('customer@example.test'),false);
});
test('admission denies provider work and unknown sends are never labelled delivered',async t=>{
 const limited=await fixture(t,{admit:async()=>false});assert.equal((await limited.post()).status,429);assert.equal(limited.queued,0);
 const pending=await fixture(t,{delivery:{queue:async()=>({reservationId:'reservation',intentId:'intent'}),dispatch:async()=>({status:'UNKNOWN',providerAccepted:false,delivered:false})}});assert.deepEqual(await pending.post(),{status:202,body:{status:'UNKNOWN',providerAccepted:false,delivered:false}});
});

test('transport rejects oversized, malformed and misplaced requests without queueing',async t=>{
 const f=await fixture(t);
 for(const [suffix,options,status] of [
  ['',{method:'GET'},405],['?token=private',{method:'POST'},400],
  ['',{method:'POST',body:'{}',headers:{'Content-Type':'text/plain'}},415],
  ['',{method:'POST',body:'{'},400],['',{method:'POST',body:'null'},400],
  ['',{method:'POST',body:JSON.stringify({...f.body,recipientProof:'x'.repeat(7000)})},413]
 ]){
  const response=await fetch(f.url+suffix,{...options,headers:{Origin:f.origin,'Content-Type':'application/json',...options.headers}});
  assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');
 }
 assert.equal(f.queued,0);assert.equal(f.sent,0);
});

test('bounded concurrent requests release capacity after a failed recipient check',async t=>{
 let release,entered;const blocked=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 const f=await fixture(t,{maxConcurrentRequests:1,resolveRecipient:async()=>{entered();await blocked;return {verified:false};}});
 const first=f.post();await started;
 try{assert.equal((await f.post()).status,503);}finally{release();}
 assert.equal((await first).status,403);assert.equal((await f.post()).status,403);assert.equal(f.queued,0);
});

test('provider failures are redacted and foreign queue intents never dispatch',async t=>{
 let dispatches=0;
 const foreign=await fixture(t,{delivery:{queue:async()=>({reservationId:'foreign',intentId:'intent'}),dispatch:async()=>{dispatches++;}}});
 assert.deepEqual(await foreign.post(),{status:503,body:{error:'SERVICE_UNAVAILABLE'}});assert.equal(dispatches,0);
 const privateFailure=await fixture(t,{resolveRecipient:async()=>{throw Error('private identity, proof and provider response');}});
 assert.deepEqual(await privateFailure.post(),{status:503,body:{error:'SERVICE_UNAVAILABLE'}});assert.equal(privateFailure.queued,0);
 const pending=await fixture(t,{management:{read:async()=>({status:'PENDING'})}});
 assert.equal((await pending.post()).status,409);assert.equal(pending.queued,0);
});

test('delivery results distinguish provider acceptance from delivery and reject contradictions',async t=>{
 for(const [result,status] of [
  [{status:'RETRYABLE',providerAccepted:false,delivered:false},202],
  [{status:'SUPERSEDED',providerAccepted:false,delivered:false},409],
  [{status:'ACCEPTED',providerAccepted:true,delivered:true},503],
  [{status:'UNKNOWN',providerAccepted:true,delivered:false},503]
 ]){
  const f=await fixture(t,{delivery:{queue:async()=>({reservationId:'reservation',intentId:'intent'}),dispatch:async()=>result}});
  assert.equal((await f.post()).status,status);
 }
});
