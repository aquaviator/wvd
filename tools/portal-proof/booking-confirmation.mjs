import {validEmailAddress} from './email-address.mjs';
// Trusted preparation, not a sender or delivery receipt. Address shape does not
// prove ownership, consent or deliverability. No booking/contact data is stored.
export function createBookingConfirmationPreparation({management,managementOrigin,clock}) {
 let origin;try{origin=new URL(managementOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
 if(origin.origin!==managementOrigin||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))||typeof management?.read!=='function'||typeof clock!=='function')throw Error('INVALID_CONFIGURATION');
 const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return async({recipientEmail,managementUrl})=>{
  if(!validEmailAddress(recipientEmail)||typeof managementUrl!=='string'||managementUrl.length>512)throw Error('INVALID_CONFIRMATION');
  let url;try{url=new URL(managementUrl);if(url.origin!==managementOrigin||url.pathname!=='/book/manage'||url.search||url.username||url.password||!/^#[A-Za-z0-9_-]{1,128}\.[a-f0-9]{64}$/.test(url.hash))throw Error();}catch{throw Error('INVALID_CONFIRMATION');}
  const current=await management.read(url.hash.slice(1));
  if(current?.status!=='CONFIRMED'||typeof current.start!=='string'||!Number.isFinite(Date.parse(current.start))||new Date(current.start).toISOString()!==current.start||current.end!==new Date(Date.parse(current.start)+1800000).toISOString()||!Number.isSafeInteger(current.revision)||current.revision<0||typeof current.meetUrl!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(current.meetUrl)||typeof current.expiresAt!=='string'||!Number.isFinite(Date.parse(current.expiresAt)))throw Error('CONFIRMATION_NOT_READY');
  const preparedAt=clock();if(typeof preparedAt!=='string'||!Number.isFinite(Date.parse(preparedAt))||new Date(preparedAt).toISOString()!==preparedAt||Date.parse(preparedAt)>=Date.parse(current.expiresAt))throw Error('CONFIRMATION_NOT_READY');
  return {schemaVersion:1,recipientEmail,recipientVerified:false,subject:'Your Wear Valley Digital introductory call',text:[
   'Your 30-minute introductory call is confirmed.',
   'When: '+format.format(new Date(current.start))+' (UK time, Europe/London).',
   'Join Google Meet: '+current.meetUrl,
   'Change or cancel your booking: '+url.href,
   'Keep this management link private. Anyone with it can manage your booking.',
   'The link expires '+format.format(new Date(current.expiresAt))+' (UK time).',
   'Wear Valley Digital'
  ].join('\n\n'),bookingVersion:{start:current.start,end:current.end,revision:current.revision},preparedAt,sent:false};
 };
}
