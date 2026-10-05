import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createGoogleBookingMailSender} from '../portal-proof/google-booking-mail.mjs';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
const id='confirmation-mail-20261005-approved-130004';
const documents='https://firestore.googleapis.com/v1/projects/wvd-development/databases/(default)/documents';
const gmail='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
// Founder explicitly approved one message to this address at 14:00 BST.
// Creating the fixed document claims the attempt atomically. Never replay it.
export async function sendApprovedConfirmationTest({cloudToken,mailToken,request=fetch,clock=()=>new Date().toISOString()}){
 if([cloudToken,mailToken].some(t=>typeof t!=='string'||!t||t.length>8192||/\s/.test(t)))throw Error('REHEARSAL_CREDENTIAL_REQUIRED');
 const at=clock();if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw Error('INVALID_CLOCK');
 const firestoreHeaders={Authorization:'Bearer '+cloudToken,'Content-Type':'application/json'};
 const claim=await request(documents+'/wvdDevelopmentChecks?documentId='+id,{method:'POST',headers:firestoreHeaders,body:JSON.stringify({fields:{status:{stringValue:'CLAIMED'},claimedAt:{timestampValue:at},purpose:{stringValue:'founder-approved-one-test-email'}}}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(claim.status===409){await claim.body?.cancel();return {status:'ALREADY_CLAIMED_NO_RESEND',messageSent:false};}
 if(!claim.ok){await claim.body?.cancel();throw Error('REHEARSAL_CLAIM_NOT_CONFIRMED_NO_SEND');}
 await claim.body?.cancel();
 const sender=createGoogleBookingMailSender({senderEmail:'admin@wearvalleydigital.com',clock,developmentTest:true,authClient:{async request(options){
  if(options.url!==gmail||options.method!=='POST'||options.retry!==false)throw Error('INVALID_REHEARSAL');
  const response=await request(gmail,{method:'POST',headers:{Authorization:'Bearer '+mailToken,'Content-Type':'application/json'},body:JSON.stringify(options.data),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok){await response.body?.cancel();throw Error('MAIL_SEND_OUTCOME_UNKNOWN');}
  return {data:await readBoundedProviderJson(response,16384)};
 }}});
 const accepted=await sender.send({id:createHash('sha256').update(id).digest('hex'),recipientEmail:'admin@wearvalleydigital.com',subject:'[WVD development test] Booking confirmation',text:'WVD booking confirmation delivery test.\n\nNo appointment has been booked. No action is required.\n\nThis single test message was authorised by Andy on 5 October 2026.\n\nWear Valley Digital',bookingVersion:{start:at,end:new Date(Date.parse(at)+1800000).toISOString(),revision:0}},{retry:false});
 const receipt=await request(documents+'/wvdDevelopmentChecks/'+id+'?updateMask.fieldPaths=status&updateMask.fieldPaths=receipt&currentDocument.exists=true',{method:'PATCH',headers:firestoreHeaders,body:JSON.stringify({fields:{status:{stringValue:'ACCEPTED'},receipt:{stringValue:accepted.receipt}}}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!receipt.ok){await receipt.body?.cancel();return {status:'PROVIDER_ACCEPTED_RECEIPT_NOT_PERSISTED_NO_RESEND',providerAccepted:true,receipt:accepted.receipt,delivered:false};}
 await receipt.body?.cancel();return {status:'PROVIDER_ACCEPTED',providerAccepted:true,receipt:accepted.receipt,delivered:false,appointmentCreated:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await sendApprovedConfirmationTest({cloudToken:process.env.WVD_GOOGLE_ACCESS_TOKEN,mailToken:process.env.WVD_MAIL_ACCESS_TOKEN})));}
 catch{console.error('REHEARSAL_NOT_CONFIRMED_DO_NOT_RESEND');process.exitCode=1;}
}
