import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeylessMailAuthClient} from '../google-keyless-mail-auth.mjs';
import {composeBookingDeliveryRuntime} from '../booking-delivery-runtime.mjs';
const account='wvd-development@wvd-development.iam.gserviceaccount.com';
function fixture(){
 let at='2026-10-05T10:00:00.000Z',posts=0,grants=0,status=200;const claims=[];
 const signer={request:async options=>{
  if(options.url.startsWith('https://secretmanager.googleapis.com/'))return {data:{name:'projects/6616382131/secrets/booking-key/versions/1',payload:{data:Buffer.alloc(32,7).toString('base64')}}};
  assert.equal(options.retry,false);const body=JSON.parse(options.data.payload);claims.push(body);
  return {data:{signedJwt:Buffer.from('{"alg":"RS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(body)).toString('base64url')+'.signature'}};
 }};
 const request=async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(url==='https://oauth2.googleapis.com/token'){grants++;return Response.json({token_type:'Bearer',access_token:'synthetic-token',expires_in:120});}
  assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');posts++;return Response.json({id:'synthetic-receipt',private:'never log'},{status});
 };
 const options={signer,serviceAccount:account,subject:'admin@example.test',clock:()=>at,request};
 return {options,client:createKeylessMailAuthClient(options),claims,get posts(){return posts;},get grants(){return grants;},setTime:value=>at=value,setStatus:value=>status=value};
}
const send={url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',method:'POST',data:{raw:'c3ludGhldGlj'},timeout:1000,retry:false,maxRedirects:0,maxContentLength:16384,responseType:'json'};
test('mail credentials are send-only, refresh automatically and access proof never sends',async()=>{
 const f=fixture();await Promise.all([f.client.verifyAccess(),f.client.verifyAccess()]);assert.equal(f.grants,1);assert.equal(f.posts,0);assert.equal(f.claims[0].scope,'https://www.googleapis.com/auth/gmail.send');assert.equal(f.claims[0].sub,'admin@example.test');
 await f.client.request(send);assert.equal(f.posts,1);assert.equal(f.grants,1);f.setTime('2026-10-05T10:02:00.000Z');await f.client.verifyAccess();assert.equal(f.grants,2);
});
test('mail client rejects alternate endpoints and credentials before minting and never retries uncertain sends',async()=>{
 const f=fixture();for(const patch of [{url:'https://evil.test/send'},{method:'GET'},{headers:{Authorization:'foreign'}},{retry:true},{maxRedirects:1},{data:{raw:'abc',threadId:'foreign'}}])await assert.rejects(f.client.request({...send,...patch}),/INVALID_MAIL_CONFIGURATION/);
 assert.equal(f.grants,0);assert.equal(f.posts,0);f.setStatus(401);await assert.rejects(f.client.request(send),/^Error: MAIL_REQUEST_OUTCOME_UNKNOWN$/);assert.equal(f.posts,1);
 f.setStatus(200);await f.client.verifyAccess();assert.equal(f.grants,2);assert.equal(f.posts,1);
});
test('composed worker readiness proves key and delegated token without queue, Calendar or Gmail writes',async()=>{
 const f=fixture(),deny=()=>{throw Error('UNEXPECTED_WRITE');};
 const runtime={binding:{firebase:{projectId:'wvd-development',productId:'wvd'},calendarId:'owned@example.test',origin:'https://booking.example.test',requestTimeoutMs:1000},store:Object.fromEntries(['read','queueConfirmationDelivery','claimConfirmationDelivery','suppressConfirmationDelivery','acceptConfirmationDelivery'].map(k=>[k,deny])),management:{read:deny},calendar:{events:{get:deny}}};
 const worker=composeBookingDeliveryRuntime({runtime,config:{serviceAccount:account,senderEmail:'admin@example.test',secretId:'booking-key',activeKey:'v1',versions:{v1:'1'}},signer:f.options.signer,clock:f.options.clock,request:f.options.request});
 const result=await worker.verifyAccess();assert.equal(result.key.status,'CONFIRMATION_KEY_ACCESS_PASS');assert.equal(result.mail.status,'MAIL_SEND_SCOPE_PRESENT_NO_MESSAGE_SENT');assert.equal(result.messageSent,false);assert.equal(result.writesPerformed,false);assert.equal(f.posts,0);
});
