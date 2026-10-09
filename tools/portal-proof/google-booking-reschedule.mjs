import {createHash} from 'node:crypto';
import {googleBookingEventId,googleBookingReservation,inspectGoogleBookingEvent} from './google-booking-event.mjs';
// Trusted backend adapter. A durable change claim and complete target screening
// must precede move(). read() is recovery only and never retries a PATCH.
export function createGoogleBookingRescheduler({calendar,calendarId,productId,requestTimeoutMs}) {
 if(typeof calendar?.events?.get!=='function'||typeof calendar?.events?.patch!=='function'||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
 googleBookingEventId(productId,calendarId,'configuration-check');
 const options=Object.freeze({timeout:requestTimeoutMs,retry:false});
 const bind=({reservation,target,changeId,confirmation})=>{
  const from=googleBookingReservation(reservation,productId),to=googleBookingReservation(target,productId),eventId=googleBookingEventId(productId,calendarId,from.reservationId);
  if(from.reservationId!==to.reservationId||from.start===to.start||typeof changeId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(changeId)||!confirmation||Object.keys(confirmation).sort().join(',')!=='eventId,meetUrl,status'||confirmation.status!=='EVENT_AND_MEET_READY'||confirmation.eventId!==eventId||typeof confirmation.meetUrl!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(confirmation.meetUrl))throw Error('INVALID_BOOKING_CHANGE');
  return {from,to,eventId,changeId,meetUrl:confirmation.meetUrl};
 };
 const pending=b=>({status:'RESCHEDULE_PENDING',eventId:b.eventId});
 const get=async b=>{try{return (await calendar.events.get({calendarId,eventId:b.eventId},options)).data;}catch{return null;}};
 const ready=(b,data)=>{
  try{const proof=inspectGoogleBookingEvent({productId,calendarId,reservation:b.to},data);if(proof.status==='EVENT_AND_MEET_READY'&&proof.meetUrl===b.meetUrl&&data.extendedProperties.private.wvdChange===b.changeId)return {...proof,start:b.to.start,end:b.to.end};}catch{}
  return null;
 };
 return {
  async read(value){const b=bind(value);return ready(b,await get(b))??pending(b);},
  async move(value){
   const b=bind(value),data=await get(b);if(!data)return pending(b);
   const recovered=ready(b,data);if(recovered)return recovered;
   try{const before=inspectGoogleBookingEvent({productId,calendarId,reservation:b.from},data);if(before.status!=='EVENT_AND_MEET_READY'||before.meetUrl!==b.meetUrl)throw Error();}catch{return {status:'RESCHEDULE_BLOCKED',eventId:b.eventId};}
   if(typeof data.etag!=='string'||!/^"[\x21\x23-\x7e]{1,256}"$/.test(data.etag))return {status:'RESCHEDULE_BLOCKED',eventId:b.eventId};
   const requestBody={start:{dateTime:b.to.start,timeZone:'Europe/London'},end:{dateTime:b.to.end,timeZone:'Europe/London'},extendedProperties:{private:{wvdProduct:productId,wvdReservation:b.to.reservationId,wvdBinding:createHash('sha256').update(JSON.stringify(b.to)).digest('hex'),wvdChange:b.changeId}}};
   try{await calendar.events.patch({calendarId,eventId:b.eventId,sendUpdates:'none',conferenceDataVersion:1,requestBody},{...options,headers:{'If-Match':data.etag}});}catch{}
   // Verify after every outcome, including a lost response. An old event, missing
   // event or provider outage is not permission to release either durable hold.
   return ready(b,await get(b))??pending(b);
  }
 };
}
