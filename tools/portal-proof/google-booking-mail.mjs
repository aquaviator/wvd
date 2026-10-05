import {validEmailAddress} from './email-address.mjs';
// Trusted outbox adapter only. Caller supplies an approved, send-only delegated
// client. This module neither acquires new scopes nor exposes a public endpoint.
export function createGoogleBookingMailSender({authClient,senderEmail,clock,requestTimeoutMs=10000,developmentTest=false}){
 const address=v=>validEmailAddress(v)&&/^[\x21-\x7e]+$/.test(v)&&!/[<>(),;:"\\]/.test(v);
 if(typeof developmentTest!=='boolean'||typeof authClient?.request!=='function'||!address(senderEmail)||typeof clock!=='function'||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_MAIL_CONFIGURATION');
 const subject=developmentTest?'[WVD development test] Booking confirmation':'Your Wear Valley Digital introductory call';
 return {async send(message,options){
  if(!message||Object.keys(message).sort().join(',')!=='bookingVersion,id,recipientEmail,subject,text'||!address(message.recipientEmail)||! /^[a-f0-9]{64}$/.test(message.id)||message.subject!==subject||typeof message.text!=='string'||message.text.length<1||Buffer.byteLength(message.text)>12288||!options||Object.keys(options).join(',')!=='retry'||options.retry!==false)throw Error('INVALID_BOOKING_MAIL');
  const at=clock();if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)throw Error('INVALID_MAIL_CONFIGURATION');
  const b=message.bookingVersion;if(!b||Object.keys(b).sort().join(',')!=='end,revision,start'||!Number.isSafeInteger(b.revision)||b.revision<0||typeof b.start!=='string'||!Number.isFinite(Date.parse(b.start))||new Date(b.start).toISOString()!==b.start||b.end!==new Date(Date.parse(b.start)+1800000).toISOString())throw Error('INVALID_BOOKING_MAIL');
  const encoded=Buffer.from(message.text,'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const mime=[`From: ${senderEmail}`,`To: ${message.recipientEmail}`,`Date: ${new Date(at).toUTCString()}`,`Message-ID: <${message.id}@${senderEmail.split('@')[1]}>`,`Subject: ${message.subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded,''].join('\r\n');
  // Message-ID supports reconciliation; it is not a Gmail deduplication promise.
  try{
   const {data}=await authClient.request({url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',method:'POST',data:{raw:Buffer.from(mime,'utf8').toString('base64url')},timeout:requestTimeoutMs,signal:AbortSignal.timeout(requestTimeoutMs),retry:false,maxRedirects:0,maxContentLength:16384,responseType:'json'});
   if(typeof data?.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(data.id))throw Error();
   return {status:'ACCEPTED',receipt:data.id};
  }catch {throw Error('MAIL_SEND_OUTCOME_UNKNOWN');}
 }};
}
