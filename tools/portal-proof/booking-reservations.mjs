import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {googleBookingEventId,googleBookingReservation,inspectGoogleBookingEvent} from './google-booking-event.mjs';
import {bookingDeliveryId,validBookingDeliveries,validQueuedDelivery} from './booking-delivery-state.mjs';
import {normaliseIntroCallCandidates} from './booking.mjs';
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const meet=v=>typeof v==='string'&&/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(v);
const phases=['RESERVED','WRITING','CONFIRMED','REJECTED','CANCELLING','CANCELLED','RESCHEDULING'];
export function bookingReservation(value,productId) {
  if(!value||Object.keys(value).sort().join(',')!=='end,productId,reservationId,start'||value.productId!==productId||!ref(value.reservationId)||!instant(value.start)||!instant(value.end)||Date.parse(value.end)-Date.parse(value.start)!==1800000)throw Error('INVALID_BOOKING_RESERVATION');
  try{normaliseIntroCallCandidates([value.start]);}catch{throw Error('INVALID_BOOKING_RESERVATION');}
  return googleBookingReservation(value,productId);
}
const overlaps=(a,b)=>Date.parse(a.start)<Date.parse(b.end)+900000&&Date.parse(a.end)+900000>Date.parse(b.start);
const holds=row=>row.phase==='RESCHEDULING'?[row,{start:row.change.start,end:row.change.end}]:['REJECTED','CANCELLED'].includes(row.phase)?[]:[row];
const same=(a,b)=>['productId','reservationId','start','end'].every(k=>a[k]===b[k]);
// Trusted backend only. One calendar has one owner product in this database.
// Calendar-derived path prevents a second product creating an independent lock
// for the same calendar. No client reads, customer details or provider calls.
export class FirestoreBookingReservations {
  #db;#ref;#binding;#backupBinding;
  constructor({db,productId,calendarId,backupBinding}) {
    if(typeof db?.doc!=='function'||typeof db?.runTransaction!=='function'||!ref(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId))throw Error('INVALID_CONFIGURATION');
    this.#db=db;this.#binding={productId,calendarId};
    if(backupBinding!==undefined&&(backupBinding?.productId!==productId||backupBinding?.calendarId!==calendarId))throw Error('INVALID_CONFIGURATION');
    this.#backupBinding=backupBinding===undefined?undefined:structuredClone(backupBinding);
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
      const confirmed=['CONFIRMED','CANCELLING','CANCELLED','RESCHEDULING'].includes(row.phase);
      if(seen.has(row.reservationId)||!phases.includes(row.phase)||Object.keys(row).some(k=>!['productId','reservationId','start','end','phase','claimId','eventId','meetUrl','cancelledAt','change','revision','management','deliveries'].includes(k))||(row.phase==='RESERVED'||row.phase==='REJECTED')&&(row.claimId!==undefined||row.eventId!==undefined||row.meetUrl!==undefined)||(row.phase==='WRITING'||confirmed)&&!ref(row.claimId)||row.phase==='WRITING'&&(row.eventId!==undefined||row.meetUrl!==undefined)||confirmed&&(row.eventId!==googleBookingEventId(row.productId,this.#binding.calendarId,row.reservationId)||!meet(row.meetUrl))||(row.phase==='CANCELLED'?!instant(row.cancelledAt):row.cancelledAt!==undefined))throw Error('CORRUPT_BOOKING_SCHEDULE');
      if(row.change!==undefined){
        const c=row.change;
        try{
          if(!c||Object.keys(c).sort().join(',')!=='end,fromEnd,fromStart,id,phase,revision,start'||!ref(c.id)||!['HELD','WRITING','COMPLETED','REJECTED'].includes(c.phase))throw Error();
          bookingReservation({productId:row.productId,reservationId:row.reservationId,start:c.start,end:c.end},this.#binding.productId);
          bookingReservation({productId:row.productId,reservationId:row.reservationId,start:c.fromStart,end:c.fromEnd},this.#binding.productId);
          if(!Number.isSafeInteger(c.revision)||c.revision<0||!Number.isSafeInteger(row.revision)||row.revision!==c.revision+(['COMPLETED','REJECTED'].includes(c.phase)?1:0)||c.start===c.fromStart||!confirmed||(['HELD','WRITING'].includes(c.phase))!==(row.phase==='RESCHEDULING')||row.start!==(c.phase==='COMPLETED'?c.start:c.fromStart)||row.end!==(c.phase==='COMPLETED'?c.end:c.fromEnd))throw Error();
        }catch{throw Error('CORRUPT_BOOKING_SCHEDULE');}
      }else if(row.phase==='RESCHEDULING'||row.revision!==undefined)throw Error('CORRUPT_BOOKING_SCHEDULE');
      if(row.management!==undefined){
        const m=row.management;
        if(!confirmed||!m||Object.keys(m).some(k=>!['expiresAt','tokenHash','replacement','revokedAt'].includes(k))||typeof m.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(m.tokenHash)||!instant(m.expiresAt)||m.revokedAt!==undefined&&!instant(m.revokedAt))throw Error('CORRUPT_BOOKING_SCHEDULE');
        if(m.replacement!==undefined&&(!m.replacement||Object.keys(m.replacement).sort().join(',')!=='operationId,previousTokenHash'||!ref(m.replacement.operationId)||typeof m.replacement.previousTokenHash!=='string'||!/^[a-f0-9]{64}$/.test(m.replacement.previousTokenHash)||m.replacement.previousTokenHash===m.tokenHash))throw Error('CORRUPT_BOOKING_SCHEDULE');
      }
      if(!validBookingDeliveries(row,this.#binding.calendarId)||row.deliveries!==undefined&&!confirmed)throw Error('CORRUPT_BOOKING_SCHEDULE');
      seen.add(row.reservationId);
    }
    const active=data.reservations.filter(x=>!['REJECTED','CANCELLED'].includes(x.phase));
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(holds(active[i]).some(a=>holds(active[j]).some(b=>overlaps(a,b))))throw Error('CORRUPT_BOOKING_SCHEDULE');
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
      if(state.reservations.some(x=>holds(x).some(h=>overlaps(bound,h))))throw Error('BOOKING_SLOT_RESERVED');
      if(state.reservations.length>=400)throw Error('BOOKING_CAPACITY');
      const row={...bound,phase:'RESERVED'};state.reservations.push(row);return row;
    });
  }
  read(reservationId) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    return this.#transaction(state=>state.reservations.find(x=>x.reservationId===reservationId)??null);
  }
  backupSnapshot() {
    if(this.#backupBinding===undefined)throw Error('BACKUP_BINDING_REQUIRED');
    return this.#transaction(schedule=>({binding:structuredClone(this.#backupBinding),schedule}));
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
  // Internal rescheduling journal: hold both times until the provider outcome is
  // proved. Provider calls and availability screening must remain outside TXs.
  beginReschedule(value,{changeId,start,expectedRevision}) {
    const bound=bookingReservation(value,this.#binding.productId);
    if(!ref(changeId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw Error('INVALID_BOOKING_CHANGE');
    const target=bookingReservation({...bound,start,end:new Date(Date.parse(start)+1800000).toISOString()},this.#binding.productId);
    if(target.start===bound.start)throw Error('INVALID_BOOKING_CHANGE');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===bound.reservationId);
      if(!row)throw Error('RESERVATION_BINDING_CONFLICT');
      // Exact operation replay is checked against its original binding, including
      // after completion has moved the row. Older superseded requests fail closed.
      if(row.change?.id===changeId){
        if(row.change.revision!==expectedRevision||row.change.fromStart!==bound.start||row.change.fromEnd!==bound.end||row.change.start!==target.start||row.change.end!==target.end||row.productId!==bound.productId)throw Error('RESERVATION_BINDING_CONFLICT');
        return row;
      }
      if(!same(row,bound)||(row.revision??0)!==expectedRevision)throw Error('RESERVATION_BINDING_CONFLICT');
      if(row.phase!=='CONFIRMED')throw Error('RESCHEDULE_NOT_READY');
      if(state.reservations.some(x=>x.reservationId!==bound.reservationId&&holds(x).some(h=>overlaps(target,h))))throw Error('BOOKING_SLOT_RESERVED');
      row.phase='RESCHEDULING';row.revision=expectedRevision;row.change={id:changeId,revision:expectedRevision,phase:'HELD',fromStart:bound.start,fromEnd:bound.end,start:target.start,end:target.end};return row;
    });
  }
  claimReschedule(reservationId,changeId) {
    if(!ref(reservationId)||!ref(changeId))throw Error('INVALID_BOOKING_CHANGE');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||row.change?.id!==changeId)throw Error('RESERVATION_CLAIM_CONFLICT');
      if(row.phase!=='RESCHEDULING'||row.change.phase!=='HELD')return {claimed:false,reservation:row};
      row.change.phase='WRITING';return {claimed:true,reservation:row};
    });
  }
  rejectRescheduleBeforeWrite(reservationId,changeId) {
    if(!ref(reservationId)||!ref(changeId))throw Error('INVALID_BOOKING_CHANGE');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||row.change?.id!==changeId)throw Error('RESERVATION_CLAIM_CONFLICT');
      if(row.phase==='RESCHEDULING'&&row.change.phase==='HELD'){row.phase='CONFIRMED';row.change.phase='REJECTED';row.revision++;}
      return row;
    });
  }
  confirmReschedule(reservationId,changeId,result) {
    if(!ref(reservationId)||!ref(changeId)||!result||Object.keys(result).sort().join(',')!=='end,eventId,meetUrl,start,status'||result.status!=='EVENT_AND_MEET_READY'||result.eventId!==googleBookingEventId(this.#binding.productId,this.#binding.calendarId,reservationId)||!meet(result.meetUrl))throw Error('INVALID_EVENT_CONFIRMATION');
    const bound=structuredClone(result);
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),c=row?.change;
      if(!c||c.id!==changeId||!['WRITING','COMPLETED'].includes(c.phase)||!['RESCHEDULING','CONFIRMED'].includes(row.phase))throw Error('RESERVATION_CLAIM_CONFLICT');
      if(c.start!==bound.start||c.end!==bound.end||row.eventId!==bound.eventId||row.meetUrl!==bound.meetUrl)throw Error('RESERVATION_BINDING_CONFLICT');
      row.start=c.start;row.end=c.end;row.phase='CONFIRMED';c.phase='COMPLETED';row.revision=c.revision+1;return row;
    });
  }
  attachManagement(value,{tokenHash,expiresAt}) {
    const bound=bookingReservation(value,this.#binding.productId);
    if(typeof tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(tokenHash)||!instant(expiresAt))throw Error('INVALID_MANAGEMENT_CAPABILITY');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===bound.reservationId);
      if(!row||row.productId!==bound.productId)throw Error('MANAGEMENT_DENIED');
      if(row.management){
        if(row.management.revokedAt!==undefined)throw Error('MANAGEMENT_DENIED');
        if(!timingSafeEqual(Buffer.from(row.management.tokenHash,'hex'),Buffer.from(tokenHash,'hex')))throw Error('MANAGEMENT_ALREADY_ISSUED');
        // Exact retry returns the original expiry; it cannot extend the link.
        return {expiresAt:row.management.expiresAt};
      }
      if(!same(row,bound)||row.phase!=='CONFIRMED')throw Error('MANAGEMENT_DENIED');
      row.management={tokenHash,expiresAt};return {expiresAt};
    });
  }
  readManaged(reservationId,tokenHash,now) {
    if(!ref(reservationId)||typeof tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(tokenHash)||!instant(now))throw Error('MANAGEMENT_DENIED');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),m=row?.management;
      if(!m||m.revokedAt!==undefined||!timingSafeEqual(Buffer.from(m.tokenHash,'hex'),Buffer.from(tokenHash,'hex'))||Date.parse(now)>=Date.parse(m.expiresAt))throw Error('MANAGEMENT_DENIED');
      return row;
    });
  }
  replaceManagement(reservationId,{tokenHash,nextTokenHash,operationId,expiresAt,checkedAt}) {
    if(!ref(reservationId)||![tokenHash,nextTokenHash].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||tokenHash===nextTokenHash||!ref(operationId)||!instant(expiresAt)||!instant(checkedAt)||Date.parse(expiresAt)<=Date.parse(checkedAt)||Date.parse(expiresAt)-Date.parse(checkedAt)>2592000000)throw Error('INVALID_MANAGEMENT_CAPABILITY');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),m=row?.management;
      if(!m||m.revokedAt!==undefined||Date.parse(checkedAt)>=Date.parse(m.expiresAt))throw Error('MANAGEMENT_DENIED');
      // Exact retry of the most recent replacement may use its now-invalid old
      // link, but only with the same new secret and operation. It cannot rotate again.
      if(m.tokenHash===nextTokenHash&&m.replacement?.previousTokenHash===tokenHash&&m.replacement.operationId===operationId)return {expiresAt:m.expiresAt};
      if(!timingSafeEqual(Buffer.from(m.tokenHash,'hex'),Buffer.from(tokenHash,'hex'))||!['CONFIRMED','CANCELLED'].includes(row.phase))throw Error('MANAGEMENT_DENIED');
      row.management={tokenHash:nextTokenHash,expiresAt,replacement:{previousTokenHash:tokenHash,operationId}};
      return {expiresAt};
    });
  }
  revokeManagement(reservationId,tokenHash,checkedAt) {
    if(!ref(reservationId)||typeof tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(tokenHash)||!instant(checkedAt))throw Error('MANAGEMENT_DENIED');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),m=row?.management;
      if(!m||!timingSafeEqual(Buffer.from(m.tokenHash,'hex'),Buffer.from(tokenHash,'hex')))throw Error('MANAGEMENT_DENIED');
      if(m.revokedAt!==undefined)return {status:'REVOKED'};
      if(Date.parse(checkedAt)>=Date.parse(m.expiresAt))throw Error('MANAGEMENT_DENIED');
      m.revokedAt=checkedAt;return {status:'REVOKED'};
    });
  }
  // Confirmation intents share the booking transaction. Ciphertext only; keys,
  // recipient addresses, message text and raw management links stay outside it.
  queueConfirmationDelivery(value,input) {
    const bound=bookingReservation(value,this.#binding.productId);
    if(!validQueuedDelivery(input))throw Error('INVALID_BOOKING_DELIVERY');
    const intent=structuredClone(input),id=bookingDeliveryId(bound.productId,this.#binding.calendarId,bound.reservationId,intent.revision,intent.managementHash);
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===bound.reservationId);
      if(!row)throw Error('RESERVATION_BINDING_CONFLICT');
      const existing=row.deliveries?.find(x=>x.id===id);
      if(existing){if(existing.payloadHash!==intent.payloadHash||existing.managementHash!==intent.managementHash||existing.start!==bound.start||existing.end!==bound.end)throw Error('DELIVERY_BINDING_CONFLICT');return existing;}
      if(!same(row,bound)||row.phase!=='CONFIRMED'||(row.revision??0)!==intent.revision||row.management?.tokenHash!==intent.managementHash||row.management.revokedAt!==undefined||Date.parse(intent.createdAt)>=Date.parse(row.management.expiresAt))throw Error('DELIVERY_NOT_READY');
      if((row.deliveries?.length??0)>=16)throw Error('BOOKING_CAPACITY');
      const delivery={id,...intent,start:bound.start,end:bound.end,status:'QUEUED'};
      (row.deliveries??=[]).push(delivery);return delivery;
    });
  }
  claimConfirmationDelivery(reservationId,intentId,checkedAt) {
    if(!ref(reservationId)||!ref(intentId)||!instant(checkedAt))throw Error('INVALID_BOOKING_DELIVERY');
    const claimId=randomUUID();
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),d=row?.deliveries?.find(x=>x.id===intentId);
      if(!d)throw Error('DELIVERY_NOT_FOUND');
      if(d.status!=='QUEUED')return {claimed:false,intent:d};
      if(Date.parse(checkedAt)<Date.parse(d.createdAt))throw Error('INVALID_BOOKING_DELIVERY');
      if(row.phase!=='CONFIRMED'||(row.revision??0)!==d.revision||row.start!==d.start||row.end!==d.end||row.management?.tokenHash!==d.managementHash||row.management.revokedAt!==undefined||Date.parse(checkedAt)>=Date.parse(row.management.expiresAt)){d.status='SUPERSEDED';return {claimed:false,intent:d};}
      d.status='CLAIMED';d.claimId=claimId;d.claimedAt=checkedAt;return {claimed:true,intent:d};
    });
  }
  suppressConfirmationDelivery(reservationId,intentId) {
    if(!ref(reservationId)||!ref(intentId))throw Error('INVALID_BOOKING_DELIVERY');
    return this.#transaction(state=>{const row=state.reservations.find(x=>x.reservationId===reservationId),d=row?.deliveries?.find(x=>x.id===intentId);if(!d)throw Error('DELIVERY_NOT_FOUND');if(d.status==='QUEUED')d.status='SUPERSEDED';return d;});
  }
  acceptConfirmationDelivery(reservationId,intentId,claimId,receipt,acceptedAt) {
    if(![reservationId,intentId,claimId,receipt].every(ref)||!instant(acceptedAt))throw Error('INVALID_BOOKING_DELIVERY');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId),d=row?.deliveries?.find(x=>x.id===intentId);
      if(!d||!['CLAIMED','ACCEPTED'].includes(d.status)||d.claimId!==claimId||Date.parse(acceptedAt)<Date.parse(d.claimedAt))throw Error('DELIVERY_CLAIM_CONFLICT');
      if(d.status==='ACCEPTED'){if(d.providerReceipt!==receipt)throw Error('DELIVERY_BINDING_CONFLICT');return d;}
      d.status='ACCEPTED';d.providerReceipt=receipt;d.acceptedAt=acceptedAt;return d;
    });
  }
  beginCancellation(reservationId,expected) {
    if(!ref(reservationId))throw Error('INVALID_BOOKING_RESERVATION');
    return this.#transaction(state=>{
      const row=state.reservations.find(x=>x.reservationId===reservationId);
      if(!row||!['CONFIRMED','CANCELLING','CANCELLED'].includes(row.phase))throw Error('CANCELLATION_NOT_READY');
      if(expected&&(row.start!==expected.start||row.end!==expected.end||expected.revision!==undefined&&(row.revision??0)!==expected.revision))throw Error('RESERVATION_BINDING_CONFLICT');
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
  return async(value,precondition)=>{
    if(precondition!==undefined&&(!precondition||Object.keys(precondition).join(',')!=='revision'||!Number.isSafeInteger(precondition.revision)||precondition.revision<0))throw Error('RESERVATION_BINDING_CONFLICT');
    const requested=bookingReservation(value,productId),reservationId=requested.reservationId;
    const before=await store.read(reservationId);
    if(!before||!same(before,requested))throw Error('RESERVATION_BINDING_CONFLICT');
    const row=await store.beginCancellation(reservationId,{start:requested.start,end:requested.end,...precondition});
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
