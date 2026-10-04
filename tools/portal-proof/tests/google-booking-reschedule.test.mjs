import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBookingRescheduler} from '../google-booking-reschedule.mjs';
import {createGoogleBookingEventWriter,createGoogleBookingCalendarClient} from '../google-booking-event.mjs';
const productId='test-booking',calendarId='synthetic@example.test';
const reservation={productId,reservationId:'one',start:'2026-10-06T12:00:00.000Z',end:'2026-10-06T12:30:00.000Z'},target={...reservation,start:'2026-10-06T14:00:00.000Z',end:'2026-10-06T14:30:00.000Z'};
async function setup(){
 let row,patches=0,reads=0,afterLoss=false,failRead=false,refuse=false,patchArgs;
 const calendar={events:{get:async()=>{reads++;if(failRead)throw Error('private outage');if(!row)throw Object.assign(Error(),{response:{status:404}});return {data:structuredClone(row)};},insert:async({requestBody})=>{row={...requestBody,etag:'"one"',status:'confirmed',conferenceData:{createRequest:{status:{statusCode:'success'}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};return {data:structuredClone(row)};},patch:async(params,options)=>{patches++;patchArgs={params,options};if(refuse)throw Error('412');Object.assign(row,structuredClone(params.requestBody));row.etag='"two"';if(afterLoss)throw Error('lost response');return {data:structuredClone(row)};}}};
 const confirmation=await createGoogleBookingEventWriter({calendar,calendarId,productId,requestTimeoutMs:1000})(reservation);
 const input={reservation,target,changeId:'move-one',confirmation},provider=createGoogleBookingRescheduler({calendar,calendarId,productId,requestTimeoutMs:1000});
 return {provider,input,get row(){return row;},get patches(){return patches;},get reads(){return reads;},get patchArgs(){return patchArgs;},lose:()=>afterLoss=true,offline:()=>failRead=true,refuse:()=>refuse=true};
}
test('conditional reschedule patches only time and private binding, preserves Meet and recovers a lost response',async()=>{
 const s=await setup();s.lose();const result=await s.provider.move(s.input);assert.equal(result.status,'EVENT_AND_MEET_READY');assert.equal(result.start,target.start);assert.equal(result.meetUrl,s.input.confirmation.meetUrl);assert.equal(s.patches,1);
 assert.deepEqual(Object.keys(s.patchArgs.params.requestBody).sort(),['end','extendedProperties','start']);assert.equal(s.patchArgs.params.sendUpdates,'none');assert.equal(s.patchArgs.options.headers['If-Match'],'"one"');assert.equal(s.patchArgs.options.retry,false);
 assert.deepEqual(await s.provider.read(s.input),result);assert.deepEqual(await s.provider.move(s.input),result);assert.equal(s.patches,1);
});
test('foreign event, guests, missing ETag and changed conference block without mutation',async()=>{
 for(const mutate of [r=>r.summary='foreign',r=>r.attendees=[{email:'private@example.test'}],r=>delete r.etag,r=>r.conferenceData.entryPoints[0].uri='https://meet.google.com/xxx-yyyy-zzz']){const s=await setup();mutate(s.row);assert.equal((await s.provider.move(s.input)).status,'RESCHEDULE_BLOCKED');assert.equal(s.patches,0);}
});
test('ambiguous patch and read failure never prove a move or cause recovery to write',async()=>{
 const s=await setup();s.refuse();assert.equal((await s.provider.move(s.input)).status,'RESCHEDULE_PENDING');for(let i=0;i<3;i++)assert.equal((await s.provider.read(s.input)).status,'RESCHEDULE_PENDING');assert.equal(s.patches,1);
 s.offline();assert.equal((await s.provider.read(s.input)).status,'RESCHEDULE_PENDING');assert.equal(s.patches,1);
});
test('target proof requires this exact change, product, booking and conference',async()=>{
 const s=await setup();await s.provider.move(s.input);s.row.extendedProperties.private.wvdChange='other';assert.equal((await s.provider.read(s.input)).status,'RESCHEDULE_PENDING');
 await assert.rejects(s.provider.move({...s.input,target:{...target,reservationId:'foreign'}}),/INVALID_BOOKING_CHANGE/);assert.equal(s.patches,1);
});
test('fixed-calendar patch bridge preserves conditional request and rejects expanded writes',async()=>{
 const s=await setup();await s.provider.move(s.input);const calls=[],client=createGoogleBookingCalendarClient({calendarId,authClient:{request:async value=>{calls.push(value);return {};}}});const {params,options}=s.patchArgs;
 await client.events.patch(params,options);assert.equal(calls[0].method,'PATCH');assert.equal(calls[0].headers['If-Match'],'"one"');assert.equal(calls[0].retry,false);assert.equal(calls[0].maxRedirects,0);
 for(const bad of [{...params,calendarId:'foreign'},{...params,sendUpdates:'all'},{...params,requestBody:{...params.requestBody,attendees:[]}},{...params,requestBody:{...params.requestBody,start:{...params.requestBody.start,dateTime:reservation.start}}}])assert.throws(()=>client.events.patch(bad,options),/INVALID_CONFIGURATION/);
 assert.throws(()=>client.events.patch(params,{...options,headers:{'If-Match':'*'}}),/INVALID_CONFIGURATION/);assert.equal(calls.length,1);
});
