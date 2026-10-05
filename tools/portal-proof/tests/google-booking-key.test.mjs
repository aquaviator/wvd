import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleBookingKeyReader} from '../google-booking-key.mjs';
test('key reads bind explicit versions and reject foreign/latest references before requesting',async()=>{
 let calls=0;const read=createGoogleBookingKeyReader({projectId:'wvd-development',secretId:'wvd-booking-confirmation-key',authClient:{request:async r=>{calls++;assert.equal(r.method,'GET');assert.equal(r.retry,false);return {data:{name:'projects/6616382131/secrets/wvd-booking-confirmation-key/versions/1',payload:{data:Buffer.alloc(32,7).toString('base64')}}};}}});
 const prefix='projects/wvd-development/secrets/wvd-booking-confirmation-key/versions/';assert.equal((await read(prefix+'1')).length,32);
 await assert.rejects(read(prefix+'latest'));await assert.rejects(read(prefix.replace('wvd-development','foreign-project')+'1'));assert.equal(calls,1);
});
