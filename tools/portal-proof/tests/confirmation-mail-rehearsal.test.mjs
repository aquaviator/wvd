import test from 'node:test';
import assert from 'node:assert/strict';
import {sendApprovedConfirmationTest} from '../../google-development-access/confirmation-mail-rehearsal.mjs';
test('approved rehearsal claims once, sends one labelled message and persists provider receipt',async()=>{
 let claimed=false,sends=0;const request=async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(url.includes('?documentId=')){if(claimed)return new Response('',{status:409});claimed=true;return Response.json({});}
  if(url.startsWith('https://gmail.googleapis.com/')){sends++;const mime=Buffer.from(JSON.parse(options.body).raw,'base64url').toString();assert.match(mime,/To: admin@wearvalleydigital.com/);assert.match(mime,/Subject: \[WVD development test\] Booking confirmation/);const body=Buffer.from(mime.split('\r\n\r\n')[1].replace(/\s/g,''),'base64').toString();assert.match(body,/No appointment has been booked/);return Response.json({id:'test-receipt'});}
  assert.equal(options.method,'PATCH');return Response.json({});
 };
 const config={cloudToken:'synthetic-cloud',mailToken:'synthetic-mail',request,clock:()=> '2026-10-05T13:00:04.000Z'};
 assert.equal((await sendApprovedConfirmationTest(config)).status,'PROVIDER_ACCEPTED');assert.equal((await sendApprovedConfirmationTest(config)).status,'ALREADY_CLAIMED_NO_RESEND');assert.equal(sends,1);
});
test('unknown send stays claimed and retry never sends again',async()=>{
 let claimed=false,sends=0;
 const request=async url=>{if(url.includes('?documentId=')){if(claimed)return new Response('',{status:409});claimed=true;return Response.json({});}sends++;throw Error('uncertain transport');};
 const config={cloudToken:'synthetic-cloud',mailToken:'synthetic-mail',request};await assert.rejects(sendApprovedConfirmationTest(config),/MAIL_SEND_OUTCOME_UNKNOWN/);assert.equal((await sendApprovedConfirmationTest(config)).status,'ALREADY_CLAIMED_NO_RESEND');assert.equal(sends,1);
});
