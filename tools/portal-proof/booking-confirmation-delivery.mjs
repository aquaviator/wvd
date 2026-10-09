import {createHash} from 'node:crypto';
import {createBookingConfirmationPreparation} from './booking-confirmation.mjs';
import {bookingDeliveryId,deliveryDigest} from './booking-delivery-state.mjs';
import {inspectGoogleBookingEvent} from './google-booking-event.mjs';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const content=draft=>({recipientEmail:draft.recipientEmail,subject:draft.subject,text:draft.text,bookingVersion:draft.bookingVersion});
// Trusted worker composition, not a public email endpoint. Sender and encryption
// keys are explicit dependencies; this module grants no delivery permissions.
export function createBookingConfirmationDelivery({store,management,productId,calendarId,managementOrigin,clock,cipher,calendar,requestTimeoutMs,sender}){
 if(!ref(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId)||['read','queueConfirmationDelivery','claimConfirmationDelivery','suppressConfirmationDelivery','acceptConfirmationDelivery'].some(k=>typeof store?.[k]!=='function')||typeof cipher?.seal!=='function'||typeof cipher?.open!=='function'||typeof calendar?.events?.get!=='function'||typeof sender?.send!=='function'||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
 const prepare=createBookingConfirmationPreparation({management,managementOrigin,clock});
 const now=()=>{const value=clock();if(!instant(value))throw Error('INVALID_CONFIGURATION');return value;};
 const context=(reservationId,id)=>JSON.stringify([productId,calendarId,reservationId,id]);
 const result=d=>({intentId:d.id,status:d.status==='CLAIMED'?'UNKNOWN':d.status,providerAccepted:d.status==='ACCEPTED',delivered:false});
 const pending=()=>({status:'RETRYABLE',providerAccepted:false,delivered:false});
 return {
  async queue({recipientEmail,managementUrl}){
   const draft=await prepare({recipientEmail,managementUrl});
   const [reservationId,secret]=new URL(managementUrl).hash.slice(1).split('.'),revision=draft.bookingVersion.revision;
   const managementHash=createHash('sha256').update(JSON.stringify([productId,calendarId,managementOrigin,reservationId,secret])).digest('hex');
   const id=bookingDeliveryId(productId,calendarId,reservationId,revision,managementHash);
   const envelope=await cipher.seal(JSON.stringify({recipientEmail,managementUrl,draft:content(draft)}),context(reservationId,id));
   const queued=await store.queueConfirmationDelivery({productId,reservationId,start:draft.bookingVersion.start,end:draft.bookingVersion.end},{revision,managementHash,payloadHash:deliveryDigest(content(draft)),envelope,createdAt:now()});
   return {...result(queued),reservationId};
  },
  async dispatch({reservationId,intentId}){
   if(!ref(reservationId)||!ref(intentId))throw Error('INVALID_BOOKING_DELIVERY');
   const row=await store.read(reservationId),d=row?.deliveries?.find(x=>x.id===intentId);
   if(!d||row.productId!==productId)throw Error('DELIVERY_NOT_FOUND');
   if(d.status!=='QUEUED')return result(d);
   const checkedAt=now();
   if(row.phase!=='CONFIRMED'||(row.revision??0)!==d.revision||row.start!==d.start||row.end!==d.end||row.management?.tokenHash!==d.managementHash||row.management.revokedAt!==undefined||Date.parse(checkedAt)>=Date.parse(row.management.expiresAt))return result(await store.suppressConfirmationDelivery(reservationId,intentId));
   let payload,draft;
   try{
    payload=JSON.parse(await cipher.open(d.envelope,context(reservationId,intentId)));
    if(!payload||Object.keys(payload).sort().join(',')!=='draft,managementUrl,recipientEmail'||deliveryDigest(payload.draft)!==d.payloadHash)throw Error('INVALID_DELIVERY_PAYLOAD');
    draft=await prepare({recipientEmail:payload.recipientEmail,managementUrl:payload.managementUrl});
    if(deliveryDigest(content(draft))!==d.payloadHash)return result(await store.suppressConfirmationDelivery(reservationId,intentId));
   }catch(error){if(['MANAGEMENT_DENIED','CONFIRMATION_NOT_READY'].includes(error?.message))return result(await store.suppressConfirmationDelivery(reservationId,intentId));return pending();}
   // Re-read the owned Calendar event before claiming a send. No provider or
   // cryptographic work happens inside a Firestore transaction.
   try{
    const {data}=await calendar.events.get({calendarId,eventId:row.eventId},{timeout:requestTimeoutMs,retry:false});
    const proof=inspectGoogleBookingEvent({productId,calendarId,reservation:{productId,reservationId,start:d.start,end:d.end}},data);
    if(proof.status!=='EVENT_AND_MEET_READY'||proof.meetUrl!==row.meetUrl)return pending();
   }catch{return pending();}
   const claim=await store.claimConfirmationDelivery(reservationId,intentId,now());
   if(!claim.claimed)return result(claim.intent);
   try{
    const accepted=await sender.send({id:intentId,...content(draft)},{retry:false});
    if(accepted?.status!=='ACCEPTED'||!ref(accepted.receipt))return result(claim.intent);
    return result(await store.acceptConfirmationDelivery(reservationId,intentId,claim.intent.claimId,accepted.receipt,now()));
   }catch{return result(claim.intent);}
  }
 };
}
