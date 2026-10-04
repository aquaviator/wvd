import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {FirestoreBookingReservations,createReservedIntroCallBooking} from '../booking-reservations.mjs';
import {googleBookingEventId} from '../google-booking-event.mjs';
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
