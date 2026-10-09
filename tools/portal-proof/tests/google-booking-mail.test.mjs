import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBookingMailSender} from '../google-booking-mail.mjs';
const clock=()=> '2026-10-05T10:00:00.000Z';
const message={id:'a'.repeat(64),recipientEmail:'customer@example.test',subject:'Your Wear Valley Digital introductory call',text:'Your call — UK time.\nKeep your link private.',bookingVersion:{start:'2026-10-07T09:00:00.000Z',end:'2026-10-07T09:30:00.000Z',revision:0}};
test('mail adapter emits one-recipient MIME to the fixed Gmail endpoint without retries',async()=>{
 const calls=[];const sender=createGoogleBookingMailSender({senderEmail:'admin@wearvalleydigital.com',clock,authClient:{request:async r=>{calls.push(r);return {data:{id:'receipt_1'}};}}});
 assert.deepEqual(await sender.send(message,{retry:false}),{status:'ACCEPTED',receipt:'receipt_1'});
 const r=calls[0],mime=Buffer.from(r.data.raw,'base64url').toString();assert.equal(calls.length,1);assert.equal(r.retry,false);assert.equal(r.maxRedirects,0);assert.equal(r.url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');assert.match(mime,/To: customer@example.test\r\n/);assert.equal(Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString(),message.text);
 await assert.rejects(sender.send({...message,recipientEmail:'a@example.test\r\nBcc: other@example.test'},{retry:false}));assert.equal(calls.length,1);
});
test('uncertain sends expose no provider message and are never retried',async()=>{
 let calls=0;const sender=createGoogleBookingMailSender({senderEmail:'admin@wearvalleydigital.com',clock,authClient:{request:async()=>{calls++;throw Error('secret recipient and token');}}});await assert.rejects(sender.send(message,{retry:false}),{message:'MAIL_SEND_OUTCOME_UNKNOWN'});assert.equal(calls,1);
});
