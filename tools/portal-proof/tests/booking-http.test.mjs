import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createBookingHandler} from '../booking-http.mjs';
import {createApplication} from '../app.mjs';
const origin='https://example.test',start='2026-10-06T09:00:00.000Z',end='2026-10-06T09:30:00.000Z';
const requestKey='af30500f-8a91-4eec-8d89-fbd0cd3e9d45';
const confirmed=bound=>({...bound,status:'CONFIRMED',meetUrl:'https://meet.google.com/abc-defg-hij',private:'secret'});
const configure=(patch={})=>createBookingHandler({allowedOrigin:origin,productId:'test-product',calendarId:'private-calendar',maxConcurrentRequests:1,admit:async()=>true,book:async bound=>confirmed(bound),reconcile:async()=>assert.fail('unexpected recovery'),...patch});
async function invoke(handler,body={requestKey,start},patch={}){
 const request=Object.assign(Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]),{url:'/api/calls/book',method:'POST',headers:{origin,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},...patch});
 const result={},response={headersSent:false,writeHead(status,headers){Object.assign(result,{status,headers});this.headersSent=true;},end(raw){result.body=JSON.parse(raw);},destroy(){result.destroyed=true;}};
 await handler(request,response);return result;
}
test('private retry key derives a stable product/calendar binding and only public confirmation fields escape',async()=>{
 const calls=[];const handler=configure({book:async bound=>{calls.push(bound);return confirmed(bound);}});
 for(let i=0;i<2;i++){const result=await invoke(handler);assert.equal(result.status,200);assert.deepEqual(result.body,{status:'CONFIRMED',start,end,timeZone:'Europe/London',meetUrl:'https://meet.google.com/abc-defg-hij'});assert.equal(result.headers['Cache-Control'],'no-store');}
 assert.deepEqual(calls[0],calls[1]);assert.match(calls[0].reservationId,/^[a-f0-9]{64}$/);assert.notEqual(calls[0].reservationId,requestKey);
 const foreign=[];await invoke(configure({productId:'other-product',book:async bound=>{foreign.push(bound);return confirmed(bound);}}));assert.notEqual(calls[0].reservationId,foreign[0].reservationId);
});
test('malformed input, foreign origin and caller supplied bindings never reach durable booking',async()=>{
 let calls=0;const handler=configure({book:async()=>{calls++;assert.fail();}});
 for(const [body,patch,status]of [[{requestKey,start,productId:'foreign'},{},400],[{requestKey:'guess',start},{},400],[{requestKey,start:'tomorrow'},{},400],['{',{},400],[' '.repeat(1025),{},413],[{requestKey,start},{url:'/api/calls/book?key=private'},400],[{requestKey,start},{method:'GET'},405],[{requestKey,start},{headers:{origin:'https://foreign.test','content-type':'application/json'}},403],[{requestKey,start},{headers:{origin,'content-type':'text/plain'}},415]])assert.equal((await invoke(handler,body,patch)).status,status);
 assert.equal(calls,0);
});
test('pending retry uses read-only reconciliation and hides blocked reasons',async()=>{
 let recovered;const handler=configure({book:async bound=>({status:'PENDING',reservationId:bound.reservationId}),reconcile:async reservationId=>{recovered=reservationId;return {status:'BLOCKED',reservationId,reason:'private-calendar-detail'};}});
 assert.deepEqual((await invoke(handler)).body,{status:'PENDING'});assert.match(recovered,/^[a-f0-9]{64}$/);
 const ready=configure({book:async bound=>({status:'PENDING',reservationId:bound.reservationId}),reconcile:async reservationId=>confirmed({reservationId,start,end})});assert.equal((await invoke(ready)).status,200);
});
test('conflicts are distinct from uncertain outcomes and provider exceptions stay private',async()=>{
 for(const [message,status,body]of [['BOOKING_SLOT_RESERVED',409,{status:'UNAVAILABLE'}],['RESERVATION_BINDING_CONFLICT',409,{error:'REQUEST_CONFLICT'}],['secret token',503,{error:'SERVICE_UNAVAILABLE'}]]){const result=await invoke(configure({book:async()=>{throw Error(message);}}));assert.equal(result.status,status);assert.deepEqual(result.body,body);}
 for(const mutate of [r=>({...r,reservationId:'foreign'}),r=>({...r,start:end}),r=>({...r,meetUrl:'https://evil.test'})])assert.equal((await invoke(configure({book:async bound=>mutate(confirmed(bound))}))).status,503);
});
test('admission runs before body or writes, concurrency releases after failure',async()=>{
 let calls=0;assert.equal((await invoke(configure({admit:async()=>false,book:async()=>{calls++;}}))).status,429);assert.equal(calls,0);
 let release;const waiting=new Promise(resolve=>{release=resolve;});const handler=configure({book:async()=>{await waiting;throw Error('private');}});
 const first=invoke(handler);await new Promise(resolve=>setImmediate(resolve));assert.equal((await invoke(handler)).status,503);release();assert.equal((await first).status,503);assert.equal((await invoke(handler)).status,503);
});
test('all trusted bindings and shared admission must be explicit',()=>{
 for(const patch of [{admit:undefined},{reconcile:undefined},{allowedOrigin:'http://public.test'},{productId:'a/b'},{calendarId:''},{maxConcurrentRequests:0}])assert.throws(()=>configure(patch),/INVALID_CONFIGURATION/);
});
test('cancellation is optional, uses the same private binding and never falls through to booking',async()=>{
 assert.equal((await invoke(configure(),{requestKey,start},{url:'/api/calls/cancel'})).status,404);
 let bound,calls=0;const handler=configure({book:async()=>assert.fail(),cancel:async value=>{bound=value;calls++;return {status:'CANCELLED',reservationId:value.reservationId,private:'secret'};}});
 const result=await invoke(handler,{requestKey,start},{url:'/api/calls/cancel'});assert.equal(result.status,200);assert.deepEqual(result.body,{status:'CANCELLED'});assert.equal(bound.start,start);assert.match(bound.reservationId,/^[a-f0-9]{64}$/);
 assert.equal((await invoke(handler,{requestKey,start,confirmation:{status:'EVENT_ABSENT'}},{url:'/api/calls/cancel'})).status,400);assert.equal(calls,1);
 assert.equal((await invoke(configure({cancel:async value=>({status:'PENDING',reservationId:value.reservationId})}),{requestKey,start},{url:'/api/calls/cancel'})).status,202);
});
test('booking route is isolated and remains separate from protected portal routes',async t=>{
 assert.throws(()=>createApplication({allowedOrigin:origin,callBooking:{}}),/ISOLATED_EMULATORS_REQUIRED/);
 const saved={auth:process.env.FIREBASE_AUTH_EMULATOR_HOST,firestore:process.env.FIRESTORE_EMULATOR_HOST};
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
 let server;t.after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const [key,value]of [['FIREBASE_AUTH_EMULATOR_HOST',saved.auth],['FIRESTORE_EMULATOR_HOST',saved.firestore]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 const allowedOrigin='http://localhost';
 server=createApplication({portal:{},auth:{resolveSession:async()=>null},allowedOrigin,firebaseEmulator:{projectId:'demo-wvd-booking',productId:'wvd-booking',databaseId:'(default)',mode:'emulator'},callBooking:{productId:'test-product',calendarId:'synthetic-calendar',maxConcurrentRequests:1,admit:async()=>true,book:async bound=>confirmed(bound),reconcile:async()=>assert.fail()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+'/api/calls/book',{method:'POST',headers:{Origin:allowedOrigin,'Content-Type':'application/json'},body:JSON.stringify({requestKey,start})});assert.equal(response.status,200);assert.equal((await response.json()).status,'CONFIRMED');
 assert.equal((await fetch(base+'/api/portal/projects')).status,401);
});
