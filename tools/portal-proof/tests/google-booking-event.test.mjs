import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBookingEventWriter} from '../google-booking-event.mjs';
const reservation=()=>({productId:'synthetic-wvd',reservationId:'synthetic-reservation',start:'2026-10-05T09:00:00.000Z',end:'2026-10-05T09:30:00.000Z'});
const missing=()=>{throw {response:{status:404}};};
const confirmed=body=>({...structuredClone(body),status:'confirmed',conferenceData:{createRequest:{status:{statusCode:'success'}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}});
const writer=(events,patch={})=>createGoogleBookingEventWriter({calendar:{events},calendarId:'synthetic-calendar',productId:'synthetic-wvd',requestTimeoutMs:10000,...patch});
test('new reserved slot creates a private opaque event with stable identity and unique Meet request, without guests or delivery',async()=>{
 let sent;const write=writer({get:missing,insert:async(input,options)=>{sent=input;assert.deepEqual(options,{timeout:10000,retry:false});return {data:confirmed(input.requestBody)};}});
 const result=await write(reservation());assert.equal(result.status,'EVENT_AND_MEET_READY');assert.match(result.eventId,/^[a-v0-9]{5,1024}$/);assert.equal(sent.calendarId,'synthetic-calendar');assert.equal(sent.conferenceDataVersion,1);assert.equal(sent.sendUpdates,'none');assert.equal(sent.requestBody.attendees,undefined);assert.deepEqual(sent.requestBody.reminders,{useDefault:false});assert.equal(sent.requestBody.transparency,'opaque');assert.equal(sent.requestBody.start.timeZone,'Europe/London');
 const first=sent.requestBody.conferenceData.createRequest.requestId;await write({...reservation(),reservationId:'another-reservation'});assert.notEqual(first,sent.requestBody.conferenceData.createRequest.requestId);
});
test('exact retries read the same event; timeout after successful insertion recovers without a second insert',async()=>{
 let stored,inserts=0,reads=0;const write=writer({get:async()=>{reads++;if(!stored)return missing();return {data:stored};},insert:async({requestBody})=>{inserts++;stored=confirmed(requestBody);throw Error('private provider timeout');}});
 const first=await write(reservation()),second=await write(reservation());assert.deepEqual(first,second);assert.equal(inserts,1);assert.equal(reads,3);
});
test('same reservation with changed times, foreign event bindings, cancelled, transparent or guest-bearing events are never overwritten',async()=>{
 let stored,inserts=0;const write=writer({get:async()=>stored?{data:stored}:missing(),insert:async({requestBody})=>{inserts++;stored=confirmed(requestBody);return {data:stored};}});
 await write(reservation());const original=structuredClone(stored);
 for(const alter of [r=>r.status='cancelled',r=>r.transparency='transparent',r=>r.attendees=[{email:'private@example.test'}],r=>r.extendedProperties.private.wvdProduct='foreign',r=>r.recurrence=['RRULE:FREQ=DAILY'],r=>r.summary='Changed event']){stored=structuredClone(original);alter(stored);await assert.rejects(()=>write(reservation()),/BOOKING_EVENT_CONFLICT/);}
 stored=original;await assert.rejects(()=>write({...reservation(),start:'2026-10-05T10:00:00.000Z',end:'2026-10-05T10:30:00.000Z'}),/BOOKING_EVENT_CONFLICT/);assert.equal(inserts,1);
});
test('Meet pending/failure or untrusted conference URLs cannot become confirmed invitations',async()=>{
 for(const [change,status]of [[r=>r.conferenceData.createRequest.status.statusCode='pending','MEET_PENDING'],[r=>r.conferenceData.createRequest.status.statusCode='failure','MEET_FAILED'],[r=>r.conferenceData.entryPoints[0].uri='https://foreign.test/secret','MEET_FAILED'],[r=>r.conferenceData.conferenceSolution.key.type='foreign','MEET_FAILED']]){
  const write=writer({get:missing,insert:async({requestBody})=>{const data=confirmed(requestBody);change(data);return {data};}});const result=await write(reservation());assert.equal(result.status,status);assert.equal(result.meetUrl,undefined);
 }
});
test('malformed, foreign-product and unreserved client-shaped inputs cannot reach the provider',async()=>{
 const write=writer({get:()=>assert.fail('no provider read'),insert:()=>assert.fail('no provider write')});
 for(const patch of [{productId:'foreign'},{reservationId:'bad/id'},{start:'2026-10-05T09:00:00'},{end:'2026-10-05T10:00:00.000Z'},{approved:true}])await assert.rejects(()=>write({...reservation(),...patch}),/INVALID_BOOKING_RESERVATION/);
 for(const patch of [{calendarId:''},{productId:'bad/id'},{requestTimeoutMs:60000}])assert.throws(()=>writer({},patch),/INVALID_CONFIGURATION/);
});
test('permission errors make no write; ambiguous insertion without a recoverable event stays unavailable and sanitised',async()=>{
 const denied=writer({get:async()=>{throw Error('private credential');},insert:()=>assert.fail('no insert')});await assert.rejects(()=>denied(reservation()),error=>error.message==='BOOKING_EVENT_UNAVAILABLE');
 let inserts=0;const ambiguous=writer({get:missing,insert:async()=>{inserts++;throw Error('private provider error');}});await assert.rejects(()=>ambiguous(reservation()),error=>error.message==='BOOKING_EVENT_UNAVAILABLE');assert.equal(inserts,1);
});

test('concurrent attempts for the same reservation recover one provider event after a collision',async()=>{
 let stored,reads=0,inserts=0,release;const both=new Promise(resolve=>{release=resolve;});
 const write=writer({get:async()=>{if(++reads<=2){if(reads===2)release();await both;return missing();}return {data:stored};},insert:async({requestBody})=>{inserts++;if(stored)throw {response:{status:409}};stored=confirmed(requestBody);return {data:stored};}});
 const results=await Promise.all([write(reservation()),write(reservation())]);assert.deepEqual(results[0],results[1]);assert.equal(inserts,2);assert.equal(reads,3);
});

test('Google Auth bridge locks the target and requests; no discovery, redirects, retries or attendee payloads',async()=>{
 const {createGoogleBookingCalendarClient}=await import('../google-booking-event.mjs');let calls=[];
 const client=createGoogleBookingCalendarClient({calendarId:'synthetic-calendar',authClient:{request:async options=>{calls.push(options);if(options.method==='GET')return missing();return {data:confirmed(options.data)};}}});
 const result=await writer(client.events)(reservation());assert.equal(result.status,'EVENT_AND_MEET_READY');assert.equal(calls.length,2);assert.equal(calls[0].url,`https://www.googleapis.com/calendar/v3/calendars/synthetic-calendar/events/${result.eventId}`);assert.equal(calls[1].url,'https://www.googleapis.com/calendar/v3/calendars/synthetic-calendar/events');assert.deepEqual(calls[1].params,{fields:'id,etag,status,summary,visibility,transparency,start,end,recurrence,attendees,extendedProperties,conferenceData',conferenceDataVersion:1,sendUpdates:'none'});
 for(const call of calls){assert.equal(call.retry,false);assert.equal(call.maxRedirects,0);assert.equal(call.maxContentLength,65536);assert.ok(call.signal instanceof AbortSignal);}
 assert.throws(()=>client.events.get({calendarId:'foreign',eventId:result.eventId},{timeout:10000,retry:false}),/INVALID_CONFIGURATION/);
 assert.throws(()=>client.events.insert({calendarId:'synthetic-calendar',conferenceDataVersion:1,sendUpdates:'all',requestBody:calls[1].data},{timeout:10000,retry:false}),/INVALID_CONFIGURATION/);
 assert.throws(()=>client.events.insert({calendarId:'synthetic-calendar',conferenceDataVersion:1,sendUpdates:'none',requestBody:{...calls[1].data,attendees:[{email:'private@example.test'}]}},{timeout:10000,retry:false}),/INVALID_CONFIGURATION/);assert.equal(calls.length,2);
});
