import {createHash,randomUUID} from 'node:crypto';
import {googleBookingEventId,googleBookingReservation,inspectGoogleBookingEvent} from './google-booking-event.mjs';
import {normaliseIntroCallCandidates} from './booking.mjs';
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const meet=v=>typeof v==='string'&&/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(v);
const phases=['RESERVED','WRITING','CONFIRMED','REJECTED','CANCELLING','CANCELLED'];
export function bookingReservation(value,productId) {
  if(!value||Object.keys(value).sort().join(',')!=='end,productId,reservationId,start'||value.productId!==productId||!ref(value.reservationId)||!instant(value.start)||!instant(value.end)||Date.parse(value.end)-Date.parse(value.start)!==1800000)throw Error('INVALID_BOOKING_RESERVATION');
  try{normaliseIntroCallCandidates([value.start]);}catch{throw Error('INVALID_BOOKING_RESERVATION');}
  return googleBookingReservation(value,productId);
}
const same=(a,b)=>['productId','reservationId','start','end'].every(k=>a[k]===b[k]);
// Trusted backend only. One calendar has one owner product in this database.
// Calendar-derived path prevents a second product creating an independent lock
// for the same calendar. No client reads, customer details or provider calls.
export class FirestoreBookingReservations {
  #db;#ref;#binding;
  constructor({db,productId,calendarId}) {
    if(typeof db?.doc!=='function'||typeof db?.runTransaction!=='function'||!ref(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId))throw Error('INVALID_CONFIGURATION');
    this.#db=db;this.#binding={productId,calendarId};
    const id=createHash('sha256').update(calendarId).digest('hex');
    this.#ref=db.doc('wvd_calendar_schedules/'+id);
  }
  #decode(document) {
    if(!document.exists)return {schemaVersion:1,binding:structuredClone(this.#binding),reservations:[]};
    const data=document.data();
    if(data?.binding?.productId!==this.#binding.productId||data?.binding?.calendarId!==this.#binding.calendarId)throw Error('SCHEDULE_OWNERSHIP_CONFLICT');
    if(data.schemaVersion!==1||!Array.isArray(data.reservations)||data.reservations.length>400||Buffer.byteLength(JSON.stringify(data))>131072)throw Error('CORRUPT_BOOKING_SCHEDULE');
    const seen=new Set();
    for(const row of data.reservations){
      try{bookingReservation({productId:row.productId,reservationId:row.reservationId,start:row.start,end:row.end},this.#binding.productId);}catch{throw Error('CORRUPT_BOOKING_SCHEDULE');}
      const confirmed=['CONFIRMED','CANCELLING','CANCELLED'].includes(row.phase);
      if(seen.has(row.reservationId)||!phases.includes(row.phase)||Object.keys(row).some(k=>!['productId','reservationId','start','end','phase','claimId','eventId','meetUrl','cancelledAt'].includes(k))||(row.phase==='RESERVED'||row.phase==='REJECTED')&&(row.claimId!==undefined||row.eventId!==undefined||row.meetUrl!==undefined)||(row.phase==='WRITING'||confirmed)&&!ref(row.claimId)||row.phase==='WRITING'&&(row.eventId!==undefined||row.meetUrl!==undefined)||confirmed&&(row.eventId!==googleBookingEventId(row.productId,this.#binding.calendarId,row.reservationId)||!meet(row.meetUrl))||(row.phase==='CANCELLED'?!instant(row.cancelledAt):row.cancelledAt!==undefined))throw Error('CORRUPT_BOOKING_SCHEDULE');
      seen.add(row.reservationId);
    }
    const active=data.reservations.filter(x=>!['REJECTED','CANCELLED'].includes(x.phase));
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(Date.parse(active[i].start)<Date.parse(active[j].end)+900000&&Date.parse(active[i].end)+900000>Date.parse(active[j].start))throw Error('CORRUPT_BOOKING_SCHEDULE');
    return structuredClone(data);
  }
  async #transaction(operation) {
    return this.#db.runTransaction(async tx=>{
      const document=await tx.get(this.#ref),state=this.#decode(document),before=JSON.stringify(state);
      const result=operation(state);
      if(JSON.stringify(state)!==before){
        if(Buffer.byteLength(JSON.stringify(state))>131072)throw Error('BOOKING_CAPACITY');
        if(document.exists)tx.set(this.#ref,state);else tx.create(this.#ref,state);
      }
      return structuredClone(result);
    },{maxAttempts:5});
  }
  reserve(value) {
    const bound=bookingReservation(value,this.#binding.productId);
    return this.#transaction(state=>{
      const existing=state.reservations.find(x=>x.reservationId===bound.reservationId);
      if(existing){if(!same(existing,bound))throw Error('RESERVATION_BINDING_CONFLICT');return existing;}
      if(state.reservations.some(x=>!['REJECTED','CANCELLED'].includes(x.phase)&&Date.parse(bound.start)<Date.parse(x.end)+900000&&Date.parse(bound.end)+900000>Date.parse(x.start)))throw Error('BOOKING_SLOT_RESERVED');
      if(state.reservations.length>=400)throw Error('BOOKING_CAPACITY');
      const row={...bound,phase:'RESERVED'};state.reservations.push(row);return row;
    });
  }
  read(reservationId) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    return this.#transaction(state=>state.reservations.find(x=>x.reservationId===reservationId)??null);
  }
  beginWrite(reservationId) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    // Stable across Firestore transaction retries, never generated inside one.
    const claimId=randomUUID();
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row)throw Error('RESERVATION_NOT_FOUND');
      if(row.phase!=='RESERVED')return {claimed:false,reservation:row};
      row.phase='WRITING';row.claimId=claimId;return {claimed:true,reservation:row};
    });
  }
  rejectBeforeWrite(reservationId) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row)throw Error('RESERVATION_NOT_FOUND');
      if(row.phase==='RESERVED')row.phase='REJECTED';
      return row;
    });
  }
  confirm(reservationId,claimId,result) {
    if(!ref(reservationId)||!ref(claimId)||!result||Object.keys(result).sort().join(',')!=='eventId,meetUrl,status'||result.status!=='EVENT_AND_MEET_READY'||result.eventId!==googleBookingEventId(this.#binding.productId,this.#binding.calendarId,reservationId)||!meet(result.meetUrl))throw Error('INVALID_EVENT_CONFIRMATION');
    const bound=structuredClone(result);
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||row.claimId!==claimId||!['WRITING','CONFIRMED'].includes(row.phase))throw Error('RESERVATION_CLAIM_CONFLICT');
      if(row.phase==='CONFIRMED'&&(row.eventId!==bound.eventId||row.meetUrl!==bound.meetUrl))throw Error('RESERVATION_BINDING_CONFLICT');
      row.phase='CONFIRMED';row.eventId=bound.eventId;row.meetUrl=bound.meetUrl;return row;
    });
  }
  beginCancellation(reservationId) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||!['CONFIRMED','CANCELLING','CANCELLED'].includes(row.phase))throw Error('CANCELLATION_NOT_READY');
      if(row.phase==='CONFIRMED')row.phase='CANCELLING';return row;
    });
  }
  confirmCancellation(reservationId,result,checkedAt) {
    if(!ref(reservationId)||!instant(checkedAt)||!result||Object.keys(result).sort().join(',')!=='eventId,status'||result.status!=='EVENT_ABSENT'||result.eventId!==googleBookingEventId(this.#binding.productId,this.#binding.calendarId,reservationId))throw Error('INVALID_CANCELLATION_CONFIRMATION');
    const bound=structuredClone(result);return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||!['CANCELLING','CANCELLED'].includes(row.phase)||row.eventId!==bound.eventId)throw Error('RESERVATION_CLAIM_CONFLICT');
      if(row.phase==='CANCELLING'){row.phase='CANCELLED';row.cancelledAt=checkedAt;}
      return row;
    });
  }
}

// Internal composition only. Reuses the existing complete-calendar screening
// and provider writer. No network call occurs inside a Firestore transaction.
// An uncertain provider/write/commit outcome retains its durable hold; no TTL
// or automatic release can allow a second booking after an ambiguous write.
export function createReservedIntroCallBooking({store,screen,writeEvent,productId}) {
  if(!ref(productId)||['reserve','beginWrite','rejectBeforeWrite','confirm'].some(k=>typeof store?.[k]!=='function')||typeof screen!=='function'||typeof writeEvent!=='function')throw Error('INVALID_CONFIGURATION');
  const reply=row=>row.phase==='CONFIRMED'?{status:'CONFIRMED',reservationId:row.reservationId,start:row.start,end:row.end,meetUrl:row.meetUrl}:{status:row.phase==='REJECTED'?'UNAVAILABLE':row.phase==='CANCELLED'?'CANCELLED':'PENDING',reservationId:row.reservationId};
  return async reservation=>{
    const bound=bookingReservation(reservation,productId),held=await store.reserve(bound);
    if(!same(held,bound))throw Error('RESERVATION_BINDING_CONFLICT');
    if(held.phase!=='RESERVED')return reply(held);
    let checked;
    try{checked=await screen({starts:[bound.start]});}catch{
      // Evidence failure is not proof the slot is safe to release. Retry can
      // recheck this RESERVED hold; never create an event from missing evidence.
      return reply(held);
    }
    if(checked?.provisional!==true||!Array.isArray(checked.slots)||checked.slots.length>1)return reply(held);
    if(checked.slots.length===0){
      return reply(await store.rejectBeforeWrite(bound.reservationId));
    }
    if(checked.slots[0]?.start!==bound.start||checked.slots[0]?.end!==bound.end)return reply(held);
    const claim=await store.beginWrite(bound.reservationId);
    if(!claim.claimed)return reply(claim.reservation);
    try{
      const event=await writeEvent(bound);
      if(event.status!=='EVENT_AND_MEET_READY')return reply(claim.reservation);
      return reply(await store.confirm(bound.reservationId,claim.reservation.claimId,event));
    }catch{return reply(claim.reservation);}
  };
}

// Recover only by reading the existing deterministic event. A missing event is
// not enough to release an uncertain hold, and recovery never inserts/deletes.
export function createIntroCallBookingReconciler({store,calendar,calendarId,productId,requestTimeoutMs}) {
  if(typeof store?.read!=='function'||typeof store?.confirm!=='function'||typeof calendar?.events?.get!=='function'||!ref(productId)||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
  googleBookingEventId(productId,calendarId,'configuration-check');
  const options=Object.freeze({timeout:requestTimeoutMs,retry:false});
  return async reservationId=>{
    const row=await store.read(reservationId);
    if(!row)throw Error('RESERVATION_NOT_FOUND');
    if(row.productId!==productId)throw Error('RESERVATION_BINDING_CONFLICT');
    const pending={status:'PENDING',reservationId};
    const confirmed=value=>({status:'CONFIRMED',reservationId,start:value.start,end:value.end,meetUrl:value.meetUrl});
    if(row.phase==='CONFIRMED')return confirmed(row);
    if(row.phase!=='WRITING')return {...pending,status:row.phase==='REJECTED'?'UNAVAILABLE':row.phase==='CANCELLED'?'CANCELLED':'PENDING'};
    let data;
    try{({data}=await calendar.events.get({calendarId,eventId:googleBookingEventId(productId,calendarId,reservationId)},options));}catch{return pending;}
    let result;
    try{result=inspectGoogleBookingEvent({productId,calendarId,reservation:{productId,reservationId,start:row.start,end:row.end}},data);}catch{
      return {status:'BLOCKED',reservationId,reason:'EVENT_BINDING_CONFLICT'};
    }
    if(result.status!=='EVENT_AND_MEET_READY')return pending;
    try{return confirmed(await store.confirm(reservationId,row.claimId,result));}catch{return pending;}
  };
}

// Trusted cancellation composition only. A durable CANCELLING record blocks
// competing bookings until provider absence and the final commit both succeed.
export function createReservedIntroCallCancellation({store,cancelEvent,productId,clock}) {
  if(!ref(productId)||['read','beginCancellation','confirmCancellation'].some(k=>typeof store?.[k]!=='function')||typeof cancelEvent!=='function'||typeof clock!=='function')throw Error('INVALID_CONFIGURATION');
  return async value=>{
    const requested=bookingReservation(value,productId),reservationId=requested.reservationId;
    const before=await store.read(reservationId);
    if(!before||!same(before,requested))throw Error('RESERVATION_BINDING_CONFLICT');
    const row=await store.beginCancellation(reservationId);
    if(row.productId!==productId)throw Error('RESERVATION_BINDING_CONFLICT');
    if(row.phase==='CANCELLED')return {status:'CANCELLED',reservationId,cancelledAt:row.cancelledAt};
    const pending={status:'PENDING',reservationId};
    try{
      const result=await cancelEvent({reservation:bookingReservation({productId:row.productId,reservationId:row.reservationId,start:row.start,end:row.end},productId),confirmation:{status:'EVENT_AND_MEET_READY',eventId:row.eventId,meetUrl:row.meetUrl}});
      if(result?.status!=='EVENT_ABSENT')return pending;
      const done=await store.confirmCancellation(reservationId,result,clock());
      return {status:'CANCELLED',reservationId,cancelledAt:done.cancelledAt};
    }catch{return pending;}
  };
}
