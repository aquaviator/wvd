import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBookingCipher} from '../google-booking-cipher.mjs';
import {createBookingDeliveryCipher} from '../booking-delivery-envelope.mjs';
import {verifyConfirmationKey} from '../../google-development-access/confirmation-key-preflight.mjs';

test('Google cipher maps retained aliases to explicit versions and authenticates context',async()=>{
 const calls=[];
 const authClient={request:async options=>{
  calls.push(options.url);const version=options.url.match(/versions\/(\d+):access$/)[1];
  return {data:{name:`projects/6616382131/secrets/booking-key/versions/${version}`,payload:{data:Buffer.alloc(32,Number(version)).toString('base64')}}};
 }};
 const config={authClient,projectId:'wvd-development',secretId:'booking-key',versions:{old:'1',current:'2'}};
 const old=createGoogleBookingCipher({...config,activeKey:'old'}),current=createGoogleBookingCipher({...config,activeKey:'current'});
 const envelope=await old.seal('synthetic confirmation','product/reservation/intent');
 assert.equal(await current.open(envelope,'product/reservation/intent'),'synthetic confirmation');
 await assert.rejects(current.open(envelope,'foreign/reservation/intent'));
 const before=calls.length;await assert.rejects(current.open({...envelope,keyRef:'unknown'},'product/reservation/intent'));assert.equal(calls.length,before);
 assert.equal((await current.seal('new','context')).keyRef,'current');
 assert.deepEqual(await current.verifyAccess(),{status:'CONFIRMATION_KEY_ACCESS_PASS',activeKey:'current',version:'2',writesPerformed:false});
 assert.throws(()=>createGoogleBookingCipher({...config,versions:{current:'latest'},activeKey:'current'}));
});

test('owned key buffers are erased after encryption and shared readers retain their buffers',async()=>{
 const owned=Buffer.alloc(32,7),cipher=createBookingDeliveryCipher({keyRef:'key',readKey:async()=>owned,consumeKey:true});
 await cipher.seal('synthetic','context');assert.ok(owned.every(v=>v===0));
 const shared=Buffer.alloc(32,7);await createBookingDeliveryCipher({keyRef:'key',readKey:async()=>shared}).seal('synthetic','context');assert.ok(shared.every(v=>v===7));
});

test('live preflight permits one fixed read, returns no secret and redacts provider failures',async()=>{
 let calls=0;const encoded=Buffer.alloc(32,11).toString('base64');
 const result=await verifyConfirmationKey('synthetic-token',{request:async(url,options)=>{
  calls++;assert.equal(url,'https://secretmanager.googleapis.com/v1/projects/wvd-development/secrets/wvd-booking-confirmation-key/versions/1:access');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  return Response.json({name:'projects/6616382131/secrets/wvd-booking-confirmation-key/versions/1',payload:{data:encoded}});
 }});
 assert.equal(calls,1);assert.equal(result.status,'CONFIRMATION_KEY_ACCESS_PASS');assert.equal(JSON.stringify(result).includes(encoded),false);
 await assert.rejects(verifyConfirmationKey('synthetic-token',{request:async()=>{throw Error('provider body with secret');}}),/^Error: CONFIRMATION_KEY_ACCESS_FAILED$/);
 await assert.rejects(verifyConfirmationKey('synthetic-token',{request:async()=>new Response('denied',{status:403})}),/^Error: CONFIRMATION_KEY_ACCESS_FAILED$/);
});
