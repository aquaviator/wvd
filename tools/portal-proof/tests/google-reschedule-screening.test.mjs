import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleRescheduleScreening} from '../google-reschedule-screening.mjs';
import {createGoogleBookingEventWriter} from '../google-booking-event.mjs';
const productId='test-product',calendarId='owned',now='2026-10-01T08:00:00.000Z';
const reservation={productId,reservationId:'original',start:'2026-10-06T12:00:00.000Z',end:'2026-10-06T12:30:00.000Z'},target={...reservation,start:'2026-10-06T12:15:00.000Z',end:'2026-10-06T12:45:00.000Z'};
const holidays={bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2026-12-31',bankHolidays:[],sourceRef:'synthetic'};
async function fixture(){
 let own,personal=[],others=[],pages=null,lists=0,gets=0,freeReads=0,role='writer';const requests=[];
 const calendar={events:{get:async()=>{gets++;return {data:structuredClone(own)};},insert:async({requestBody})=>{own={...requestBody,status:'confirmed',conferenceData:{createRequest:{status:{statusCode:'success'}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};return {data:own};},list:async(params,options)=>{lists++;requests.push({params,options});return {data:pages?pages(params):{kind:'calendar#events',accessRole:role,items:structuredClone([own,...others])}};}},freebusy:{query:async({requestBody})=>{freeReads++;return {data:{kind:'calendar#freeBusy',timeMin:requestBody.timeMin,timeMax:requestBody.timeMax,calendars:{owned:{busy:[{start:reservation.start,end:target.end}]},personal:{busy:personal}}}};}}};
 const confirmation=await createGoogleBookingEventWriter({calendar,calendarId,productId,requestTimeoutMs:1000})(reservation);
 const config={calendar,calendarIds:['owned','personal'],calendarId,productId,clock:()=>now,policy:{ref:'test',bufferBoundary:'between-events',maxEvidenceAgeMs:60000},maxQueryWindowMs:86400000,requestTimeoutMs:1000,readHolidays:async()=>holidays};
 const screen=createGoogleRescheduleScreening(config),input={reservation,target,eventId:confirmation.eventId};
 return {screen,input,config,requests,get own(){return own;},get lists(){return lists;},get freeReads(){return freeReads;},setPersonal:v=>personal=v,setOthers:v=>others=v,setPages:v=>pages=v,setRole:v=>role=v};
}
const event=(id,start=target.start,end=target.end)=>({id,status:'confirmed',start:{dateTime:start},end:{dateTime:end},summary:'private title'});
test('owned overlapping event is excluded exactly while complete other calendar evidence remains required',async()=>{
 const s=await fixture();assert.equal((await s.screen(s.input)).slots.length,1);assert.equal(s.requests[0].params.singleEvents,true);assert.equal(s.requests[0].params.showHiddenInvitations,true);assert.equal(s.requests[0].options.retry,false);
 s.setPersonal([{start:target.start,end:target.end}]);assert.deepEqual((await s.screen(s.input)).slots,[]);
});
test('another event inside the merged original free/busy range cannot disappear through self-exclusion',async()=>{
 const s=await fixture();s.setOthers([event('other')]);const result=await s.screen(s.input);assert.deepEqual(result.slots,[]);assert.equal(JSON.stringify(result).includes('private title'),false);
 s.setOthers([{...event('free'),transparency:'transparent'}]);assert.equal((await s.screen(s.input)).slots.length,1);
});
test('personal work day and opaque all-day event both block rescheduling',async()=>{
 const s=await fixture();s.setPersonal([{start:'2026-10-05T23:00:00.000Z',end:'2026-10-06T23:00:00.000Z'}]);assert.deepEqual((await s.screen(s.input)).slots,[]);
 s.setPersonal([]);s.setOthers([{id:'all-day',status:'confirmed',start:{date:'2026-10-06'},end:{date:'2026-10-07'}}]);assert.deepEqual((await s.screen(s.input)).slots,[]);
});
test('pagination is complete and bounded; a later page conflict cannot be omitted',async()=>{
 const s=await fixture();s.setPages(params=>({kind:'calendar#events',accessRole:'writer',items:params.pageToken?[event('late')]:[s.own],...(!params.pageToken?{nextPageToken:'next'}:{})}));assert.deepEqual((await s.screen(s.input)).slots,[]);assert.equal(s.lists,2);
 s.setPages(()=>({kind:'calendar#events',accessRole:'writer',items:[],nextPageToken:'repeat'}));await assert.rejects(s.screen(s.input),/CALL_EVIDENCE_UNAVAILABLE/);
});
test('missing original, insufficient role, changed binding and malformed busy events fail closed',async()=>{
 for(const configure of [s=>s.setPages(()=>({kind:'calendar#events',accessRole:'writer',items:[]})),s=>s.setRole('freeBusyReader'),s=>s.own.summary='foreign',s=>s.setOthers([event('bad','2026-02-30T12:00:00Z')])]){const s=await fixture();configure(s);await assert.rejects(s.screen(s.input),/CALL_EVIDENCE_UNAVAILABLE/);}
});
test('holiday and notice policy still preflight before provider evidence, and foreign binding cannot query',async()=>{
 const s=await fixture();const screen=createGoogleRescheduleScreening({...s.config,readHolidays:async()=>({...holidays,bankHolidays:['2026-10-06']})});assert.deepEqual((await screen(s.input)).slots,[]);assert.equal(s.freeReads,0);
 await assert.rejects(s.screen({...s.input,eventId:'foreign'}),/RESERVATION_BINDING_CONFLICT/);assert.equal(s.freeReads,0);
});
test('batch picker reuses one complete evidence read and keeps personal conflicts',async()=>{
 const s=await fixture(),later='2026-10-06T14:00:00.000Z';
 const input={reservation,eventId:s.input.eventId,starts:[target.start,later]};
 assert.deepEqual((await s.screen(input)).slots.map(x=>x.start),[target.start,later]);assert.equal(s.freeReads,1);assert.equal(s.lists,1);
 s.setPersonal([{start:target.start,end:target.end}]);assert.deepEqual((await s.screen(input)).slots.map(x=>x.start),[later]);
 await assert.rejects(s.screen({...input,target}),/INVALID_BOOKING_INPUT/);
});
