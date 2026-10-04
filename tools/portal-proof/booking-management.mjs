import {createHash} from 'node:crypto';
import {bookingReservation} from './booking-reservations.mjs';
const key=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// Opaque bearer capability. Raw secrets are supplied by the authorised issuing
// client and never persisted server-side. The caller must retain its issuance
// key before requesting a link so a lost response can retry without rotation.
export function createBookingManagement({store,productId,calendarId,managementOrigin,clock,linkLifetimeMs,cancel,reschedule}) {
 let origin;try{origin=new URL(managementOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
 if(origin.origin!==managementOrigin||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))||!ref(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId)||typeof clock!=='function'||!Number.isSafeInteger(linkLifetimeMs)||linkLifetimeMs<60000||linkLifetimeMs>2592000000||['attachManagement','readManaged'].some(k=>typeof store?.[k]!=='function')||typeof cancel!=='function'||typeof reschedule!=='function')throw Error('INVALID_CONFIGURATION');
 const hash=(id,secret)=>createHash('sha256').update(JSON.stringify([productId,calendarId,managementOrigin,id,secret])).digest('hex');
 const now=()=>{const value=clock();if(!instant(value))throw Error('INVALID_CONFIGURATION');return value;};
 const resolve=async token=>{
  if(typeof token!=='string'||token.length>194)throw Error('MANAGEMENT_DENIED');
  const pieces=token.split('.');if(pieces.length!==2||!ref(pieces[0])||!key(pieces[1]))throw Error('MANAGEMENT_DENIED');
  const row=await store.readManaged(pieces[0],hash(pieces[0],pieces[1]),now());
  if(row.productId!==productId||row.reservationId!==pieces[0])throw Error('MANAGEMENT_DENIED');return row;
 };
 const publicView=row=>({status:row.phase==='CANCELLED'?'CANCELLED':row.phase==='CONFIRMED'?'CONFIRMED':'PENDING',start:row.start,end:row.end,revision:row.revision??0,timeZone:'Europe/London',...(row.phase==='CONFIRMED'?{meetUrl:row.meetUrl}:{}),expiresAt:row.management.expiresAt,...(row.phase==='RESCHEDULING'?{pendingAction:{kind:'reschedule',id:row.change.id}}:row.phase==='CANCELLING'?{pendingAction:{kind:'cancel',id:'cancel'}}:{})});
 const bound=row=>bookingReservation({productId,reservationId:row.reservationId,start:row.start,end:row.end},productId);
 return {
  async issue({reservation,managementKey}){
   const value=bookingReservation(reservation,productId);if(!key(managementKey))throw Error('INVALID_MANAGEMENT_CAPABILITY');
   const checkedAt=now(),expiresAt=new Date(Date.parse(checkedAt)+linkLifetimeMs).toISOString();
   const result=await store.attachManagement(value,{tokenHash:hash(value.reservationId,managementKey),expiresAt});
   if(!instant(result?.expiresAt)||Date.parse(result.expiresAt)<=Date.parse(checkedAt))throw Error('MANAGEMENT_DENIED');
   return {managementUrl:managementOrigin+'/book/manage#'+value.reservationId+'.'+managementKey,expiresAt:result.expiresAt};
  },
  async read(token){return publicView(await resolve(token));},
  async recover({token,revision,actionId}){
   const row=await resolve(token);
   if(row.phase==='CONFIRMED'||row.phase==='CANCELLED')return publicView(row);
   if((row.revision??0)!==revision)throw Error('RESERVATION_BINDING_CONFLICT');
   if(row.phase==='CANCELLING'&&actionId==='cancel')await cancel(bound(row),{revision});
   else if(row.phase==='RESCHEDULING'&&row.change.id===actionId)await reschedule({reservation:bound(row),change:{expectedRevision:row.change.revision,start:row.change.start,changeId:row.change.id}});
   else throw Error('RESERVATION_BINDING_CONFLICT');
   return publicView(await resolve(token));
  },
  async cancel({token,start,revision}){
   const row=await resolve(token);
   if(row.start!==start||(row.revision??0)!==revision)throw Error('RESERVATION_BINDING_CONFLICT');
   const result=await cancel(bound(row),{revision});
   if(result?.reservationId!==row.reservationId||!['PENDING','CANCELLED'].includes(result.status))throw Error('INVALID_BOOKING_RESULT');
   return {status:result.status};
  },
  async reschedule({token,start,revision,targetStart,changeId}){
   const row=await resolve(token);
   // Let the journal validate exact historical retries after a successful move.
   // Construct the original time supplied with this operation, never silently
   // substitute the current time and turn a stale command into a fresh move.
   const original=bookingReservation({...bound(row),start,end:new Date(Date.parse(start)+1800000).toISOString()},productId);
   const result=await reschedule({reservation:original,change:{expectedRevision:revision,start:targetStart,changeId}});
   if(result?.reservationId!==row.reservationId||result.changeId!==changeId||!['PENDING','UNAVAILABLE','RESCHEDULED','CANCELLED'].includes(result.status))throw Error('INVALID_BOOKING_RESULT');
   return {status:result.status,revision:result.revision};
  }
 };
}
