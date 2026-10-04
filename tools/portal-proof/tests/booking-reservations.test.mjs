import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {FirestoreBookingReservations,createReservedIntroCallBooking,createIntroCallBookingReconciler,createReservedIntroCallCancellation} from '../booking-reservations.mjs';
import {googleBookingEventId,createGoogleBookingEventWriter} from '../google-booking-event.mjs';
import {createBookingManagement} from '../booking-management.mjs';
import {createBookingConfirmationPreparation} from '../booking-confirmation.mjs';
import {createReservedIntroCallRescheduler} from '../booking-reschedule.mjs';
import {createIntroCallScreening} from '../call-screening.mjs';
const productId='wvd-booking-test',calendarId='calendar@example.test';
const reservation=(reservationId='first',start='2026-10-06T12:00:00.000Z')=>({productId,reservationId,start,end:new Date(Date.parse(start)+1800000).toISOString()});
class Database {
  rows=new Map();tail=Promise.resolve();context=new AsyncLocalStorage();failConfirmation=false;
  get active(){return this.context.getStore()===true;}
  doc(path){return {path};}
  runTransaction(callback){
    const run=()=>this.context.run(true,async()=>{
      const next=structuredClone(this.rows);
      const put=(ref,data)=>{if(this.failConfirmation&&data.reservations.some(x=>x.phase==='CONFIRMED'))throw Error('disk failure');next.set(ref.path,structuredClone(data));};
      const result=await callback({get:async ref=>({exists:next.has(ref.path),data:()=>structuredClone(next.get(ref.path))}),set:put,create:put});this.rows=next;return result;
    });
    const task=this.tail.then(run);this.tail=task.catch(()=>{});return task;
  }
}
function setup(){
  const db=new Database(),store=new FirestoreBookingReservations({db,productId,calendarId});
  let busy=[],outage=false,writes=0,reads=0,providerFailure=false;
  const screening=createIntroCallScreening({clock:()=> '2026-10-01T12:00:00.000Z',policy:{ref:'synthetic',bufferBoundary:'between-events',maxEvidenceAgeMs:1000},readEvidence:async window=>{
    assert.equal(db.active,false);reads++;if(outage)throw Error('provider unavailable');
    return {complete:true,observedAt:'2026-10-01T12:00:00.000Z',requiredCalendarIds:[calendarId],calendars:[{id:calendarId,status:'ok',busy,coveredStart:window.coveredStart,coveredEnd:window.coveredEnd}],...window.holidayEvidence};
  }});
  const screen=({starts})=>screening({starts,holidayEvidence:{bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2026-12-31',bankHolidays:[]}});
  const writeEvent=async value=>{
    assert.equal(db.active,false);writes++;
    if(providerFailure)throw Error('timeout after write');
    return {eventId:googleBookingEventId(productId,calendarId,value.reservationId),status:'EVENT_AND_MEET_READY',meetUrl:'https://meet.google.com/abc-defg-hij'};
  };
  const book=createReservedIntroCallBooking({store,screen,writeEvent,productId});
  return {db,store,screen,book,get writes(){return writes;},get reads(){return reads;},setBusy:x=>busy=x,setOutage:x=>outage=x,setProviderFailure:x=>providerFailure=x};
}
test('competing reservations for the same time have one durable winner',async()=>{
  const s=setup(),results=await Promise.allSettled([s.book(reservation('a')),s.book(reservation('b'))]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.match(results.find(x=>x.status==='rejected').reason.message,/BOOKING_SLOT_RESERVED/);
  assert.equal(s.writes,1);assert.equal(results.find(x=>x.status==='fulfilled').value.status,'CONFIRMED');
});
test('concurrent exact retries write once and confirmation survives reopening',async()=>{
  const s=setup();await Promise.all([s.book(reservation()),s.book(reservation())]);
  assert.equal(s.writes,1);
  const reopened=new FirestoreBookingReservations({db:s.db,productId,calendarId});
  const record=await reopened.reserve(reservation());assert.equal(record.phase,'CONFIRMED');
  assert.equal((await s.book(reservation())).status,'CONFIRMED');assert.equal(s.writes,1);
  await assert.rejects(s.store.reserve(reservation('first','2026-10-06T13:00:00.000Z')),/RESERVATION_BINDING_CONFLICT/);
});
test('final live conflict rejects before event write and allows a new reservation',async()=>{
  const s=setup();s.setBusy([{start:'2026-10-06T11:55:00Z',end:'2026-10-06T12:05:00Z'}]);
  assert.equal((await s.book(reservation())).status,'UNAVAILABLE');assert.equal(s.writes,0);
  s.setBusy([]);assert.equal((await s.book(reservation('second'))).status,'CONFIRMED');
});
test('evidence outage retains a retryable hold without provider writes',async()=>{
  const s=setup();s.setOutage(true);assert.equal((await s.book(reservation())).status,'PENDING');assert.equal(s.writes,0);
  await assert.rejects(s.store.reserve(reservation('other')),/BOOKING_SLOT_RESERVED/);
  s.setOutage(false);assert.equal((await s.book(reservation())).status,'CONFIRMED');assert.equal(s.writes,1);
});
test('ambiguous event outcome persists WRITING and never expires or blindly retries',async()=>{
  const s=setup();s.setProviderFailure(true);assert.equal((await s.book(reservation())).status,'PENDING');
  assert.equal((await s.store.reserve(reservation())).phase,'WRITING');
  assert.equal((await s.book(reservation())).status,'PENDING');assert.equal(s.writes,1);
  assert.equal((await s.store.rejectBeforeWrite('first')).phase,'WRITING');
  await assert.rejects(s.store.reserve(reservation('other')),/BOOKING_SLOT_RESERVED/);
});
test('confirmation commit failure holds the slot after successful provider write',async()=>{
  const s=setup();s.db.failConfirmation=true;assert.equal((await s.book(reservation())).status,'PENDING');
  assert.equal(s.writes,1);assert.equal((await s.store.reserve(reservation())).phase,'WRITING');
  await assert.rejects(s.store.reserve(reservation('other')),/BOOKING_SLOT_RESERVED/);
});
test('exact fifteen minute gap is allowed; shorter gaps and overlaps are blocked',async()=>{
  const s=setup();await s.store.reserve(reservation('a'));
  await assert.rejects(s.store.reserve(reservation('b','2026-10-06T12:44:00.000Z')),/BOOKING_SLOT_RESERVED/);
  assert.equal((await s.store.reserve(reservation('c','2026-10-06T12:45:00.000Z'))).phase,'RESERVED');
});
test('foreign owner and corrupt persisted state fail closed without replacement',async()=>{
  const s=setup();await s.store.reserve(reservation());
  const other=new FirestoreBookingReservations({db:s.db,productId:'other',calendarId});
  await assert.rejects(other.reserve({...reservation(),productId:'other'}),/SCHEDULE_OWNERSHIP_CONFLICT/);
  const saved=structuredClone(s.db.rows);const row=[...s.db.rows.values()][0];row.reservations[0].phase='UNKNOWN';
  await assert.rejects(s.store.reserve(reservation('new')),/CORRUPT_BOOKING_SCHEDULE/);
  assert.equal(row.reservations.length,1);s.db.rows=saved;
  const claim=await s.store.beginWrite('first');
  await assert.rejects(s.store.confirm('first','foreign',{eventId:googleBookingEventId(productId,calendarId,'first'),status:'EVENT_AND_MEET_READY',meetUrl:'https://meet.google.com/abc-defg-hij'}),/RESERVATION_CLAIM_CONFLICT/);
  assert.equal((await s.store.reserve(reservation())).claimId,claim.reservation.claimId);
});
test('malformed screening cannot release or write a held slot',async()=>{
  const s=setup(),book=createReservedIntroCallBooking({store:s.store,screen:async()=>({slots:[{start:'foreign'}],provisional:true}),writeEvent:()=>assert.fail('no provider write'),productId});
  assert.equal((await book(reservation())).status,'PENDING');assert.equal((await s.store.reserve(reservation())).phase,'RESERVED');
});
function provider(){
  let row=null,posts=0,gets=0,unavailable=false;
  const calendar={events:{
    get:async()=>{gets++;if(unavailable)throw Error('private provider failure');if(!row)throw Object.assign(Error('missing'),{response:{status:404}});return {data:structuredClone(row)};},
    insert:async({requestBody})=>{posts++;row={...requestBody,status:'confirmed',conferenceData:{createRequest:{status:{statusCode:'success'}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};return {data:structuredClone(row)};}
  }};
  return {calendar,get row(){return row;},get posts(){return posts;},get gets(){return gets;},setOutage:value=>unavailable=value};
}
test('read-only reconciliation finishes a provider success whose durable confirmation failed',async()=>{
  const s=setup(),p=provider(),writeEvent=createGoogleBookingEventWriter({calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});
  const book=createReservedIntroCallBooking({store:s.store,screen:s.screen,writeEvent,productId});
  s.db.failConfirmation=true;assert.equal((await book(reservation())).status,'PENDING');assert.equal(p.posts,1);
  s.db.failConfirmation=false;
  const reconcile=createIntroCallBookingReconciler({store:s.store,calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});
  assert.equal((await reconcile('first')).status,'CONFIRMED');
  const before=p.gets;assert.equal((await reconcile('first')).status,'CONFIRMED');assert.equal(p.gets,before);assert.equal(p.posts,1);
});
test('missing, unavailable or pending Meet events never release uncertain holds',async()=>{
  const s=setup(),p=provider();await s.store.reserve(reservation());await s.store.beginWrite('first');
  const reconcile=createIntroCallBookingReconciler({store:s.store,calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});
  assert.equal((await reconcile('first')).status,'PENDING');
  p.setOutage(true);assert.equal((await reconcile('first')).status,'PENDING');p.setOutage(false);
  const writer=createGoogleBookingEventWriter({calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});await writer(reservation());
  p.row.conferenceData.createRequest.status.statusCode='pending';assert.equal((await reconcile('first')).status,'PENDING');
  assert.equal((await s.store.rejectBeforeWrite('first')).phase,'WRITING');
  await assert.rejects(s.store.reserve(reservation('second')),/BOOKING_SLOT_RESERVED/);
  p.row.conferenceData.createRequest.status.statusCode='success';assert.equal((await reconcile('first')).status,'CONFIRMED');
});
test('changed event or guest injection blocks reconciliation without mutation',async()=>{
  const s=setup(),p=provider();await s.store.reserve(reservation());await s.store.beginWrite('first');
  const writer=createGoogleBookingEventWriter({calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});await writer(reservation());
  p.row.attendees=[{email:'foreign@example.test'}];
  const reconcile=createIntroCallBookingReconciler({store:s.store,calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000});
  assert.deepEqual(await reconcile('first'),{status:'BLOCKED',reservationId:'first',reason:'EVENT_BINDING_CONFLICT'});
  assert.equal((await s.store.read('first')).phase,'WRITING');assert.equal(p.posts,1);
});
test('event binding identity ignores JSON property order across retries',async()=>{
  const p=provider(),writer=createGoogleBookingEventWriter({calendar:p.calendar,calendarId,productId,requestTimeoutMs:1000}),a=reservation();
  const first=await writer({end:a.end,start:a.start,reservationId:a.reservationId,productId:a.productId});
  assert.deepEqual(await writer(a),first);assert.equal(p.posts,1);
});
test('cancellation releases a confirmed slot only after verified provider absence and durable commit',async()=>{
 const s=setup();await s.book(reservation());let absent=false,calls=0;
 const cancel=createReservedIntroCallCancellation({store:s.store,productId,clock:()=> '2026-10-02T12:00:00.000Z',cancelEvent:async()=>{assert.equal(s.db.active,false);calls++;return {status:absent?'EVENT_ABSENT':'CANCELLATION_PENDING',eventId:googleBookingEventId(productId,calendarId,'first')};}});
 assert.equal((await cancel(reservation())).status,'PENDING');assert.equal((await s.store.read('first')).phase,'CANCELLING');await assert.rejects(s.store.reserve(reservation('other')),/BOOKING_SLOT_RESERVED/);
 absent=true;const result=await cancel(reservation());assert.deepEqual(result,{status:'CANCELLED',reservationId:'first',cancelledAt:'2026-10-02T12:00:00.000Z'});
 assert.deepEqual(await cancel(reservation()),result);assert.equal(calls,2);assert.equal((await s.book(reservation())).status,'CANCELLED');assert.equal((await s.book(reservation('replacement'))).status,'CONFIRMED');
 const reopened=new FirestoreBookingReservations({db:s.db,productId,calendarId});assert.equal((await reopened.read('first')).phase,'CANCELLED');
});
test('cancellation commit failure and wrong absence proof never release an uncertain slot',async()=>{
 const s=setup();await s.book(reservation());await s.store.beginCancellation('first');const original=s.store.confirmCancellation.bind(s.store);s.store.confirmCancellation=async()=>{throw Error('disk failure');};
 const cancel=createReservedIntroCallCancellation({store:s.store,productId,clock:()=> '2026-10-02T12:00:00.000Z',cancelEvent:async()=>({status:'EVENT_ABSENT',eventId:googleBookingEventId(productId,calendarId,'first')})});
 assert.equal((await cancel(reservation())).status,'PENDING');await assert.rejects(s.store.reserve(reservation('other')),/BOOKING_SLOT_RESERVED/);s.store.confirmCancellation=original;
 assert.throws(()=>s.store.confirmCancellation('first',{status:'EVENT_ABSENT',eventId:'foreign'},'2026-10-02T12:00:00.000Z'),/INVALID_CANCELLATION_CONFIRMATION/);
 assert.equal((await cancel(reservation())).status,'CANCELLED');
});
test('unconfirmed and foreign product cancellation cannot mutate or call the provider',async()=>{
 const s=setup();await s.store.reserve(reservation());await assert.rejects(s.store.beginCancellation('first'),/CANCELLATION_NOT_READY/);await s.book(reservation());
 const before=structuredClone(s.db.rows);const cancel=createReservedIntroCallCancellation({store:s.store,productId:'foreign-product',clock:()=> '2026-10-02T12:00:00.000Z',cancelEvent:async()=>assert.fail()});await assert.rejects(cancel({...reservation(),productId:'foreign-product'}),/RESERVATION_BINDING_CONFLICT/);assert.deepEqual(s.db.rows,before);
 const own=createReservedIntroCallCancellation({store:s.store,productId,clock:()=> '2026-10-02T12:00:00.000Z',cancelEvent:async()=>assert.fail()});await assert.rejects(own(reservation('first','2026-10-06T13:00:00.000Z')),/RESERVATION_BINDING_CONFLICT/);assert.deepEqual(s.db.rows,before);
});

test('rescheduling holds both times, blocks cancellation and competing changes, and claims a provider write once',async()=>{
 const s=setup(),old=reservation(),start='2026-10-06T14:00:00.000Z';await s.book(old);
 const request={expectedRevision:0,changeId:'change-a',start};await s.store.beginReschedule(old,request);
 assert.deepEqual(await s.store.beginReschedule(old,request),await s.store.read('first'));
 for(const time of [old.start,start,'2026-10-06T14:44:00.000Z'])await assert.rejects(s.store.reserve(reservation('competitor',time)),/BOOKING_SLOT_RESERVED/);
 await assert.rejects(s.store.beginCancellation('first'),/CANCELLATION_NOT_READY/);
 await assert.rejects(s.store.beginReschedule(old,{expectedRevision:0,changeId:'other',start:'2026-10-06T15:00:00.000Z'}),/RESCHEDULE_NOT_READY/);
 const claims=await Promise.all([s.store.claimReschedule('first','change-a'),s.store.claimReschedule('first','change-a')]);assert.equal(claims.filter(x=>x.claimed).length,1);
 assert.equal((await s.store.rejectRescheduleBeforeWrite('first','change-a')).phase,'RESCHEDULING');
 assert.equal((await s.book(old)).status,'PENDING');assert.equal(s.writes,1);
});
test('successful rescheduling retains event and Meet identity, releases only the old time and supports exact replay',async()=>{
 const s=setup(),old=reservation(),request={expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'};await s.book(old);await s.store.beginReschedule(old,request);await s.store.claimReschedule('first','move');
 const proof={status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start:request.start,end:'2026-10-06T14:30:00.000Z'};
 const done=await s.store.confirmReschedule('first','move',proof);assert.equal(done.phase,'CONFIRMED');assert.equal(done.start,request.start);
 assert.deepEqual(await s.store.beginReschedule(old,request),done);assert.deepEqual(await s.store.confirmReschedule('first','move',proof),done);
 assert.equal((await s.store.reserve(reservation('old-time'))).phase,'RESERVED');await assert.rejects(s.store.reserve(reservation('new-time',request.start)),/BOOKING_SLOT_RESERVED/);
 const reopened=new FirestoreBookingReservations({db:s.db,productId,calendarId});assert.deepEqual(await reopened.read('first'),done);
 await assert.rejects(s.store.beginReschedule(old,{...request,start:'2026-10-06T15:00:00.000Z'}),/RESERVATION_BINDING_CONFLICT/);
});
test('unavailable replacement preserves the original and an overlapping move only ignores its own hold',async()=>{
 const s=setup(),old=reservation();await s.book(old);await s.store.reserve(reservation('other','2026-10-06T14:00:00.000Z'));
 await assert.rejects(s.store.beginReschedule(old,{expectedRevision:0,changeId:'busy',start:'2026-10-06T14:00:00.000Z'}),/BOOKING_SLOT_RESERVED/);assert.equal((await s.store.read('first')).phase,'CONFIRMED');
 await s.store.beginReschedule(old,{expectedRevision:0,changeId:'overlap',start:'2026-10-06T12:15:00.000Z'});
 const released=await s.store.rejectRescheduleBeforeWrite('first','overlap');assert.equal(released.phase,'CONFIRMED');assert.equal(released.start,old.start);
 await assert.rejects(s.store.reserve(reservation('collision',old.start)),/BOOKING_SLOT_RESERVED/);
 assert.equal((await s.store.claimReschedule('first','overlap')).claimed,false);
});
test('reschedule confirmation failure, wrong proof and foreign operation keep both holds',async()=>{
 const s=setup(),old=reservation(),target='2026-10-06T14:00:00.000Z';await s.book(old);await s.store.beginReschedule(old,{expectedRevision:0,changeId:'move',start:target});await s.store.claimReschedule('first','move');
 const proof={status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start:target,end:'2026-10-06T14:30:00.000Z'};
 for(const patch of [{start:old.start},{meetUrl:'https://meet.google.com/xxx-yyyy-zzz'}])await assert.rejects(s.store.confirmReschedule('first','move',{...proof,...patch}),/RESERVATION_BINDING_CONFLICT/);
 await assert.rejects(s.store.confirmReschedule('first','foreign',proof),/RESERVATION_CLAIM_CONFLICT/);
 s.db.failConfirmation=true;await assert.rejects(s.store.confirmReschedule('first','move',proof),/disk failure/);s.db.failConfirmation=false;
 for(const time of [old.start,target])await assert.rejects(s.store.reserve(reservation('competitor',time)),/BOOKING_SLOT_RESERVED/);
 assert.equal((await s.store.read('first')).change.phase,'WRITING');
});
test('corrupt reschedule metadata and target overlaps fail closed on reopening',async()=>{
 const s=setup(),old=reservation();await s.book(old);await s.store.beginReschedule(old,{expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'});
 const saved=structuredClone(s.db.rows);
 for(const corrupt of [r=>delete r.change,r=>r.change.start='invalid',r=>r.change.phase='COMPLETED',r=>r.change.extra=true,r=>r.change.fromStart='2026-10-06T11:00:00.000Z']){
  s.db.rows=structuredClone(saved);corrupt([...s.db.rows.values()][0].reservations[0]);await assert.rejects(s.store.read('first'),/CORRUPT_BOOKING_SCHEDULE/);
 }
 s.db.rows=structuredClone(saved);[...s.db.rows.values()][0].reservations.push({...reservation('foreign','2026-10-06T14:00:00.000Z'),phase:'RESERVED'});await assert.rejects(s.store.read('first'),/CORRUPT_BOOKING_SCHEDULE/);
});
test('reschedule binding checks run before mutation and cancellation remains possible after completion',async()=>{
 const s=setup(),old=reservation();await s.book(old);const before=structuredClone(s.db.rows);
 await assert.rejects(s.store.beginReschedule(reservation('first','2026-10-06T11:00:00.000Z'),{expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'}),/RESERVATION_BINDING_CONFLICT/);
 assert.throws(()=>s.store.beginReschedule({...old,productId:'foreign'},{expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'}),/INVALID_BOOKING_RESERVATION/);assert.deepEqual(s.db.rows,before);
 const start='2026-10-06T14:00:00.000Z';await s.store.beginReschedule(old,{expectedRevision:0,changeId:'move',start});await s.store.claimReschedule('first','move');await s.store.confirmReschedule('first','move',{status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start,end:'2026-10-06T14:30:00.000Z'});
 await s.store.beginCancellation('first');await s.store.confirmCancellation('first',{status:'EVENT_ABSENT',eventId:googleBookingEventId(productId,calendarId,'first')},'2026-10-04T12:00:00.000Z');assert.equal((await s.store.read('first')).phase,'CANCELLED');
});

test('revision prevents an old change from replaying when a later change returns to the original time',async()=>{
 const s=setup(),old=reservation();await s.book(old);
 const apply=async(value,change)=>{await s.store.beginReschedule(value,change);await s.store.claimReschedule('first',change.changeId);return s.store.confirmReschedule('first',change.changeId,{status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start:change.start,end:new Date(Date.parse(change.start)+1800000).toISOString()});};
 const first={expectedRevision:0,changeId:'out',start:'2026-10-06T14:00:00.000Z'};await apply(old,first);
 const next=reservation('first',first.start);await apply(next,{expectedRevision:1,changeId:'back',start:old.start});
 await assert.rejects(s.store.beginReschedule(old,first),/RESERVATION_BINDING_CONFLICT/);assert.equal((await s.store.read('first')).revision,2);
});

test('reschedule composition screens outside the transaction, claims one move, and recovers commit failure read-only',async()=>{
 const s=setup(),old=reservation(),change={expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'};await s.book(old);let moves=0,reads=0,ready=false;
 const proof={status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start:change.start,end:'2026-10-06T14:30:00.000Z'};
 const move=createReservedIntroCallRescheduler({store:s.store,productId,screen:async({target})=>{assert.equal(s.db.active,false);return {provisional:true,slots:[target]};},provider:{move:async()=>{assert.equal(s.db.active,false);moves++;ready=true;return proof;},read:async()=>{assert.equal(s.db.active,false);reads++;return ready?proof:{status:'RESCHEDULE_PENDING'};}}});
 s.db.failConfirmation=true;const initial=await Promise.all([move({reservation:old,change}),move({reservation:old,change})]);assert.equal(initial.every(x=>x.status==='PENDING'),true);assert.equal(moves,1);
 s.db.failConfirmation=false;assert.equal((await move({reservation:old,change})).status,'RESCHEDULED');assert.equal(moves,1);assert.ok(reads>=1);
 const count=reads;assert.equal((await move({reservation:old,change})).status,'RESCHEDULED');assert.equal(reads,count);
 await s.store.beginCancellation('first');assert.equal((await move({reservation:old,change})).status,'PENDING');
 await s.store.confirmCancellation('first',{status:'EVENT_ABSENT',eventId:proof.eventId},'2026-10-04T12:00:00.000Z');assert.equal((await move({reservation:old,change})).status,'CANCELLED');
});
test('target unavailability preserves original confirmation and malformed evidence holds without provider writes',async()=>{
 for(const evidence of [{provisional:true,slots:[]},{provisional:false,slots:[]},{provisional:true,slots:[{start:'foreign'}]},null]){
  const s=setup(),old=reservation(),change={expectedRevision:0,changeId:'move',start:'2026-10-06T14:00:00.000Z'};await s.book(old);
  const move=createReservedIntroCallRescheduler({store:s.store,productId,screen:async()=>evidence,provider:{move:async()=>assert.fail(),read:async()=>assert.fail()}});
  const result=await move({reservation:old,change});assert.equal(result.status,evidence?.provisional===true&&evidence.slots.length===0?'UNAVAILABLE':'PENDING');assert.equal((await s.store.read('first')).start,old.start);
 }
});

function managementSetup(s,patch={}){return createBookingManagement({store:s.store,productId,calendarId,managementOrigin:'https://example.test',clock:()=> '2026-10-04T12:00:00.000Z',linkLifetimeMs:86400000,cancel:createReservedIntroCallCancellation({store:s.store,productId,clock:()=> '2026-10-04T12:00:00.000Z',cancelEvent:async({confirmation})=>({status:'EVENT_ABSENT',eventId:confirmation.eventId})}),reschedule:createReservedIntroCallRescheduler({store:s.store,productId,screen:async({target})=>({provisional:true,slots:[target]}),provider:{move:async({target,confirmation})=>({...confirmation,start:target.start,end:target.end}),read:async()=>({status:'RESCHEDULE_PENDING'})}}),...patch});}
test('management issuance persists only a bound digest, retries without extending expiry and rejects replacement secrets',async()=>{
 const s=setup(),value=reservation();await s.book(value);const management=managementSetup(s),managementKey='a'.repeat(64);
 const link=await management.issue({reservation:value,managementKey});assert.equal(link.managementUrl,'https://example.test/book/manage#first.'+managementKey);assert.equal(link.expiresAt,'2026-10-05T12:00:00.000Z');assert.equal(JSON.stringify([...s.db.rows.values()]).includes(managementKey),false);
 const later=managementSetup(s,{clock:()=> '2026-10-04T13:00:00.000Z'});assert.deepEqual(await later.issue({reservation:value,managementKey}),link);
 await assert.rejects(management.issue({reservation:value,managementKey:'b'.repeat(64)}),/MANAGEMENT_ALREADY_ISSUED/);
 const view=await management.read('first.'+managementKey);assert.equal(view.status,'CONFIRMED');assert.equal(view.revision,0);assert.equal(Object.hasOwn(view,'reservationId'),false);assert.equal(Object.hasOwn(view,'management'),false);
});
test('management denies guessed, expired and foreign scope capabilities without writes',async()=>{
 const s=setup();await s.book(reservation());const management=managementSetup(s);await management.issue({reservation:reservation(),managementKey:'a'.repeat(64)});const before=structuredClone(s.db.rows);
 for(const token of ['first.'+'b'.repeat(64),'missing.'+'a'.repeat(64),'first.a','first.'+'a'.repeat(65)])await assert.rejects(management.read(token),/MANAGEMENT_DENIED/);
 for(const patch of [{productId:'foreign'},{calendarId:'foreign@example.test'},{managementOrigin:'https://foreign.test'},{clock:()=> '2026-10-05T12:00:00.000Z'}])await assert.rejects(managementSetup(s,patch).read('first.'+'a'.repeat(64)),/MANAGEMENT_DENIED/);
 assert.deepEqual(s.db.rows,before);
});
test('same private link follows a reschedule, rejects stale cancellation and reports cancellation without Meet',async()=>{
 const s=setup(),value=reservation();await s.book(value);const management=managementSetup(s),key='a'.repeat(64),token='first.'+key;await management.issue({reservation:value,managementKey:key});
 const input={token,start:value.start,revision:0,targetStart:'2026-10-06T14:00:00.000Z',changeId:'managed-move'};assert.equal((await management.reschedule(input)).status,'RESCHEDULED');assert.equal((await management.reschedule(input)).status,'RESCHEDULED');
 const current=await management.read(token);assert.equal(current.start,input.targetStart);assert.equal(current.revision,1);
 await assert.rejects(management.cancel({token,start:value.start,revision:0}),/RESERVATION_BINDING_CONFLICT/);
 assert.equal((await management.cancel({token,start:current.start,revision:current.revision})).status,'CANCELLED');const cancelled=await management.read(token);assert.equal(cancelled.status,'CANCELLED');assert.equal(Object.hasOwn(cancelled,'meetUrl'),false);
});
test('cancellation precondition is enforced atomically after the earlier read',async()=>{
 const s=setup();await s.book(reservation());const original=s.store.beginCancellation.bind(s.store);
 s.store.beginCancellation=async(id,expected)=>{await s.store.beginReschedule(reservation(),{expectedRevision:0,changeId:'race',start:'2026-10-06T14:00:00.000Z'});await s.store.rejectRescheduleBeforeWrite('first','race');return original(id,expected);};
 const cancel=createReservedIntroCallCancellation({store:s.store,productId,clock:()=> '2026-10-04T12:00:00.000Z',cancelEvent:async()=>assert.fail('no provider delete after stale revision')});
 await assert.rejects(cancel(reservation(),{revision:0}),/RESERVATION_BINDING_CONFLICT/);assert.equal((await s.store.read('first')).phase,'CONFIRMED');
});
test('confirmation preparation uses current managed state and UK time, never sends or claims recipient verification',async()=>{
 const s=setup();await s.book(reservation());const management=managementSetup(s),link=await management.issue({reservation:reservation(),managementKey:'a'.repeat(64)});
 const prepare=createBookingConfirmationPreparation({management,managementOrigin:'https://example.test',clock:()=> '2026-10-04T12:00:00.000Z'});
 const draft=await prepare({recipientEmail:'synthetic@example.test',managementUrl:link.managementUrl});assert.equal(draft.sent,false);assert.equal(draft.recipientVerified,false);assert.match(draft.text,/Tuesday, 6 October 2026 at 13:00/);assert.equal(draft.bookingVersion.revision,0);assert.match(draft.text,/Change or cancel your booking:/);
 await assert.rejects(prepare({recipientEmail:'a@example.test\r\nBcc: hidden@example.test',managementUrl:link.managementUrl}),/INVALID_CONFIRMATION/);
 await assert.rejects(prepare({recipientEmail:'synthetic@example.test',managementUrl:link.managementUrl.replace('example.test','foreign.test')}),/INVALID_CONFIRMATION/);
 await management.cancel({token:link.managementUrl.split('#')[1],start:reservation().start,revision:0});await assert.rejects(prepare({recipientEmail:'synthetic@example.test',managementUrl:link.managementUrl}),/CONFIRMATION_NOT_READY/);
});

test('a second device can recover the existing uncertain action without its original change key',async()=>{
 const s=setup(),value=reservation();await s.book(value);let fail=true,moves=0;
 const proof={status:'EVENT_AND_MEET_READY',eventId:googleBookingEventId(productId,calendarId,'first'),meetUrl:'https://meet.google.com/abc-defg-hij',start:'2026-10-06T14:00:00.000Z',end:'2026-10-06T14:30:00.000Z'};
 const reschedule=createReservedIntroCallRescheduler({store:s.store,productId,screen:async({target})=>({provisional:true,slots:[target]}),provider:{move:async()=>{moves++;return {status:'RESCHEDULE_PENDING'};},read:async()=>fail?{status:'RESCHEDULE_PENDING'}:proof}});
 const management=managementSetup(s,{reschedule}),token='first.'+'a'.repeat(64);await management.issue({reservation:value,managementKey:'a'.repeat(64)});
 assert.equal((await management.reschedule({token,start:value.start,revision:0,targetStart:proof.start,changeId:'existing-change'})).status,'PENDING');const pending=await management.read(token);assert.deepEqual(pending.pendingAction,{kind:'reschedule',id:'existing-change'});
 await assert.rejects(management.recover({token,revision:0,actionId:'other-change'}),/RESERVATION_BINDING_CONFLICT/);fail=false;const recovered=await management.recover({token,revision:0,actionId:pending.pendingAction.id});assert.equal(recovered.status,'CONFIRMED');assert.equal(recovered.start,proof.start);assert.equal(moves,1);
});
test('corrupt capability metadata cannot survive journal validation',async()=>{
 const s=setup();await s.book(reservation());const management=managementSetup(s);await management.issue({reservation:reservation(),managementKey:'a'.repeat(64)});const before=structuredClone(s.db.rows);
 for(const corrupt of [m=>m.tokenHash='raw-secret',m=>m.expiresAt='tomorrow',m=>m.secret='extra']){s.db.rows=structuredClone(before);corrupt([...s.db.rows.values()][0].reservations[0].management);await assert.rejects(s.store.read('first'),/CORRUPT_BOOKING_SCHEDULE/);}
});
