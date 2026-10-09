import {createHash} from 'node:crypto';
import {validDeliveryEnvelope} from './booking-delivery-envelope.mjs';
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const deliveryDigest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const bookingDeliveryId=(productId,calendarId,reservationId,revision,managementHash)=>deliveryDigest([productId,calendarId,reservationId,revision,managementHash,'booking-confirmation']);
export function validBookingDeliveries(row,calendarId){
 if(row.deliveries===undefined)return true;
 if(!Array.isArray(row.deliveries)||row.deliveries.length>16)return false;
 const ids=new Set();
 for(const d of row.deliveries){
  if(!d||Object.keys(d).some(k=>!['id','revision','start','end','managementHash','payloadHash','envelope','createdAt','status','claimId','claimedAt','acceptedAt','providerReceipt'].includes(k))||!Number.isSafeInteger(d.revision)||d.revision<0||d.revision>(row.revision??0)||d.id!==bookingDeliveryId(row.productId,calendarId,row.reservationId,d.revision,d.managementHash)||ids.has(d.id)||!instant(d.start)||!instant(d.end)||Date.parse(d.end)-Date.parse(d.start)!==1800000||!digest(d.managementHash)||!digest(d.payloadHash)||!validDeliveryEnvelope(d.envelope)||!instant(d.createdAt)||!['QUEUED','CLAIMED','ACCEPTED','SUPERSEDED'].includes(d.status))return false;
  const claimed=['CLAIMED','ACCEPTED'].includes(d.status);
  if(claimed?(!ref(d.claimId)||!instant(d.claimedAt)||Date.parse(d.claimedAt)<Date.parse(d.createdAt)):(d.claimId!==undefined||d.claimedAt!==undefined))return false;
  if(d.status==='ACCEPTED'?(!instant(d.acceptedAt)||Date.parse(d.acceptedAt)<Date.parse(d.claimedAt)||!ref(d.providerReceipt)):(d.acceptedAt!==undefined||d.providerReceipt!==undefined))return false;
  ids.add(d.id);
 }
 return true;
}
export function validQueuedDelivery(value){return Boolean(value&&Object.keys(value).sort().join(',')==='createdAt,envelope,managementHash,payloadHash,revision'&&Number.isSafeInteger(value.revision)&&value.revision>=0&&digest(value.managementHash)&&digest(value.payloadHash)&&validDeliveryEnvelope(value.envelope)&&instant(value.createdAt));}
