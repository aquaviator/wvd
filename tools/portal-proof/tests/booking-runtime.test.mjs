import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {composeBookingRuntime} from '../booking-runtime.mjs';
import {createBookingServer} from '../booking-server.mjs';
import {createGoogleBookingRuntimeCalendar} from '../google-booking-read-client.mjs';
import {createFirestoreBookingAdmission} from '../booking-admission.mjs';
function database(){const rows=new Map();let tail=Promise.resolve();return {doc:path=>({path}),runTransaction(fn){const work=tail.then(async()=>{const next=structuredClone(rows),set=(ref,data)=>next.set(ref.path,structuredClone(data));const value=await fn({get:async ref=>({exists:next.has(ref.path),data:()=>structuredClone(next.get(ref.path))}),set,create:set});rows.clear();for(const pair of next)rows.set(...pair);return value;});tail=work.catch(()=>{});return work;}};}
const clock=()=> '2026-10-04T12:00:00.000Z';
const config={firebase:{projectId:'wvd-runtime-test',productId:'wvd-test',databaseId:'(default)',mode:'live'},calendarId:'owned@example.test',calendarIds:['owned@example.test','personal@example.test'],origin:'https://booking.example.test',policy:{ref:'runtime-test',bufferBoundary:'between-events',maxEvidenceAgeMs:60000,holidayMaxEvidenceAgeMs:3600000},maxQueryWindowMs:86400000,requestTimeoutMs:1000,linkLifetimeMs:86400000,maxConcurrentRequests:2,admission:{windowMs:60000,maxRequests:100}};
const holidays={bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2027-12-31',bankHolidays:[],sourceRef:'https://www.gov.uk/bank-holidays.json#england-and-wales',observedAt:clock()};
function runtimeFixture(){
 const records=new Map();let personal=[];const calls=[];
 const eventAuthClient={request:async request=>{calls.push(request);const id=request.url.split('/').at(-1);
  if(request.method==='POST'){const row={...structuredClone(request.data),status:'confirmed',etag:'"v1"',conferenceData:{createRequest:{status:{statusCode:'success'}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};records.set(row.id,row);return {data:structuredClone(row)};}
  if(request.method==='GET'&&id==='events')return {data:{kind:'calendar#events',accessRole:'writer',items:[...records.values()].map(x=>structuredClone(x))}};
  const row=records.get(id);if(!row)throw {response:{status:404}};
  if(request.method==='PATCH'){assert.equal(request.headers['If-Match'],row.etag);Object.assign(row,structuredClone(request.data));row.etag='"v2"';}
  if(request.method==='DELETE'){assert.equal(request.headers['If-Match'],row.etag);records.delete(id);return {data:{}};}
  return {data:structuredClone(row)};
 }};
 const freeBusyAuthClient={request:async request=>{calls.push(request);const body=request.data;return {data:{kind:'calendar#freeBusy',timeMin:body.timeMin,timeMax:body.timeMax,calendars:{'owned@example.test':{busy:[...records.values()].map(row=>({start:row.start.dateTime,end:row.end.dateTime}))},'personal@example.test':{busy:personal}}}};}};
 const runtime=composeBookingRuntime({db:database(),config,eventAuthClient,freeBusyAuthClient,clock,readHolidays:async()=>holidays});return {runtime,calls,records,setPersonal:value=>personal=value};
}
test('composed HTTP runtime books, offers self-overlapping replacement, moves and cancels with fixed credentials',async t=>{
 const f=runtimeFixture(),server=createBookingServer(f.runtime);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,body)=>{const r=await fetch(base+'/api/calls/'+path,{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const html=await (await fetch(base+'/book')).text();assert.match(html,/data-runtime-mode="live"/);assert.equal(html.includes('uses synthetic availability'),false);assert.match(html,/email confirmations are not enabled yet/);assert.equal((await fetch(base+'/api/auth/login')).status,404);
 const start='2026-10-06T09:00:00.000Z',target='2026-10-06T09:15:00.000Z',key=randomUUID();assert.equal((await post('availability',{starts:[start]})).data.slots.length,1);
 assert.equal((await post('book',{start,requestKey:key})).data.status,'CONFIRMED');assert.equal(f.records.size,1);
 const link=await post('manage/issue',{start,requestKey:key,managementKey:'a'.repeat(64)}),token=new URL(link.data.managementUrl).hash.slice(1);
 assert.equal((await post('availability',{starts:[target]})).data.slots.length,0);
 const candidate={token,start,revision:0,starts:[target]};assert.equal((await post('manage/availability',candidate)).data.slots.length,1);
 f.setPersonal([{start:'2026-10-05T23:00:00.000Z',end:'2026-10-06T23:00:00.000Z'}]);assert.equal((await post('manage/availability',candidate)).data.slots.length,0);f.setPersonal([]);
 assert.equal((await post('manage/reschedule',{token,start,revision:0,targetStart:target,changeKey:randomUUID()})).data.status,'RESCHEDULED');assert.equal((await post('manage/cancel',{token,start:target,revision:1})).data.status,'CANCELLED');assert.equal(f.records.size,0);
 assert.ok(f.calls.every(x=>x.retry===false&&x.maxRedirects===0));assert.ok(f.calls.filter(x=>x.url.endsWith('/freeBusy')).every(x=>x.method==='POST'));assert.ok(f.calls.filter(x=>!x.url.endsWith('/freeBusy')).every(x=>x.url.includes(encodeURIComponent(config.calendarId))));
});
test('shared admission serializes workers and denies exhausted, corrupt, foreign or backwards windows',async()=>{
 const db=database();let at=clock();const options={db,productId:'wvd-test',calendarId:'owned',clock:()=>at,windowMs:60000,maxRequests:2},a=createFirestoreBookingAdmission(options),b=createFirestoreBookingAdmission(options);
 assert.deepEqual((await Promise.all([a(),b(),a()])).sort(),[false,true,true]);at='2026-10-04T11:59:00.000Z';assert.equal(await b(),false);at='2026-10-04T12:01:00.000Z';assert.equal(await b(),true);
 await assert.rejects(createFirestoreBookingAdmission({...options,productId:'foreign'})(),/ADMISSION_UNAVAILABLE/);
});
test('read client rejects caller-selected calendars, windows, fields or credential overrides',()=>{
 let requests=0;const client=createGoogleBookingRuntimeCalendar({eventAuthClient:{request:()=>requests++},freeBusyAuthClient:{request:()=>requests++},calendarId:config.calendarId,calendarIds:config.calendarIds,maxQueryWindowMs:86400000});
 const params={calendarId:config.calendarId,timeMin:clock(),timeMax:'2026-10-04T13:00:00.000Z',timeZone:'UTC',singleEvents:true,showDeleted:false,showHiddenInvitations:true,maxResults:250},options={timeout:1000,retry:false};
 for(const patch of [{calendarId:'foreign'},{maxResults:2500},{showHiddenInvitations:false},{timeMax:'2027-10-04T13:00:00.000Z'},{fields:'attendees'},{syncToken:'unbounded'}])assert.throws(()=>client.events.list({...params,...patch},options),/INVALID_CONFIGURATION/);
 assert.throws(()=>client.events.list(params,{...options,headers:{Authorization:'foreign'}}),/INVALID_CONFIGURATION/);assert.throws(()=>client.freebusy.query({requestBody:{timeMin:clock(),timeMax:params.timeMax,timeZone:'UTC',items:[{id:'foreign'}]}},options),/INVALID_CONFIGURATION/);assert.equal(requests,0);
});
