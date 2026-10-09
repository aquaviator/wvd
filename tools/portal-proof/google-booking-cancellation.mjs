import {googleBookingEventId,googleBookingReservation,inspectGoogleBookingEvent} from './google-booking-event.mjs';
// Internal cancellation adapter, not a public route or permission decision.
// The host supplies a previously durably confirmed booking. Ambiguous deletion
// never means the hold may be released. No attendee notifications are enabled.
export function createGoogleBookingCancellation({calendar,calendarId,productId,requestTimeoutMs}) {
  if(typeof calendar?.events?.get!=='function'||typeof calendar?.events?.delete!=='function'||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
  googleBookingEventId(productId,calendarId,'configuration-check');
  const options=Object.freeze({timeout:requestTimeoutMs,retry:false});
  return async({reservation,confirmation})=>{
    const bound=googleBookingReservation(reservation,productId),eventId=googleBookingEventId(productId,calendarId,bound.reservationId);
    if(!confirmation||Object.keys(confirmation).sort().join(',')!=='eventId,meetUrl,status'||confirmation.status!=='EVENT_AND_MEET_READY'||confirmation.eventId!==eventId||typeof confirmation.meetUrl!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(confirmation.meetUrl))throw Error('INVALID_EVENT_CONFIRMATION');
    const pending={status:'CANCELLATION_PENDING',eventId},absent={status:'EVENT_ABSENT',eventId};
    const read=async()=>{try{return {data:(await calendar.events.get({calendarId,eventId},options)).data};}catch(error){return [404,410].includes(error?.response?.status)?{absent:true}:{unavailable:true};}};
    const first=await read();if(first.absent)return absent;if(first.unavailable)return pending;
    // A cancelled tombstone has no useful binding fields. Its exact deterministic
    // ID plus prior durable confirmation identify the already removed event.
    if(first.data?.id===eventId&&first.data.status==='cancelled')return absent;
    let inspected;try{inspected=inspectGoogleBookingEvent({productId,calendarId,reservation:bound},first.data);}catch{return {status:'CANCELLATION_BLOCKED',eventId};}
    if(inspected.status!=='EVENT_AND_MEET_READY'||inspected.meetUrl!==confirmation.meetUrl)return {status:'CANCELLATION_BLOCKED',eventId};
    const etag=first.data.etag;
    if(typeof etag!=='string'||!/^"[\x21\x23-\x7e]{1,256}"$/.test(etag))return {status:'CANCELLATION_BLOCKED',eventId};
    // If-Match prevents deleting an event modified after its ownership check.
    // A failed delete is followed by a read, never a blind second delete.
    try{await calendar.events.delete({calendarId,eventId,sendUpdates:'none'},{...options,headers:{'If-Match':etag}});}catch{}
    const after=await read();
    if(after.absent||after.data?.id===eventId&&after.data.status==='cancelled')return absent;
    return pending;
  };
}
