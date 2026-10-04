import {bookingReservation} from './booking-reservations.mjs';
// Trusted internal composition. screen must prove complete required-calendar and
// holiday evidence for the target; any self-event exclusion must be exact and
// must not subtract a merged free/busy interval containing another event.
export function createReservedIntroCallRescheduler({store,screen,provider,productId}) {
 if(typeof productId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(productId)||['beginReschedule','claimReschedule','rejectRescheduleBeforeWrite','confirmReschedule'].some(k=>typeof store?.[k]!=='function')||typeof screen!=='function'||typeof provider?.move!=='function'||typeof provider?.read!=='function')throw Error('INVALID_CONFIGURATION');
 const reply=row=>row.phase==='CANCELLED'?{status:'CANCELLED',reservationId:row.reservationId,changeId:row.change.id,revision:row.revision}:row.phase==='CANCELLING'?{status:'PENDING',reservationId:row.reservationId,changeId:row.change.id,revision:row.revision}:({status:row.change.phase==='COMPLETED'?'RESCHEDULED':row.change.phase==='REJECTED'?'UNAVAILABLE':'PENDING',reservationId:row.reservationId,changeId:row.change.id,revision:row.revision,...(['COMPLETED','REJECTED'].includes(row.change.phase)?{start:row.start,end:row.end,meetUrl:row.meetUrl}:{})});
 return async({reservation,change})=>{
  const bound=bookingReservation(reservation,productId);
  let row=await store.beginReschedule(bound,change);
  if(row.phase!=='RESCHEDULING')return reply(row);
  const target=bookingReservation({...bound,start:row.change.start,end:row.change.end},productId);
  const providerInput={reservation:bound,target,changeId:row.change.id,confirmation:{status:'EVENT_AND_MEET_READY',eventId:row.eventId,meetUrl:row.meetUrl}};
  let claimed=false;
  if(row.change.phase==='HELD'){
   let checked;try{checked=await screen({reservation:bound,target,eventId:row.eventId});}catch{return reply(row);}
   if(checked?.provisional!==true||!Array.isArray(checked.slots)||checked.slots.length>1)return reply(row);
   if(checked.slots.length===0)return reply(await store.rejectRescheduleBeforeWrite(bound.reservationId,change.changeId));
   if(checked.slots[0]?.start!==target.start||checked.slots[0]?.end!==target.end)return reply(row);
   const claim=await store.claimReschedule(bound.reservationId,change.changeId);row=claim.reservation;claimed=claim.claimed;
   if(row.phase!=='RESCHEDULING')return reply(row);
  }
  try{
   const result=await (claimed?provider.move(providerInput):provider.read(providerInput));
   if(result?.status!=='EVENT_AND_MEET_READY')return reply(row);
   return reply(await store.confirmReschedule(bound.reservationId,change.changeId,result));
  }catch{return reply(row);}
 };
}
