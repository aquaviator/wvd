import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseBookingRecipientResolver} from '../booking-recipient.mjs';
test('recipient resolver requires verified project-bound identity and revocation check',async()=>{
 let identity={aud:'wvd-test',iss:'https://securetoken.google.com/wvd-test',uid:'person',sub:'person',email:'verified@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}};
 let account={uid:'person',email:'verified@example.test',emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]};
 const auth={getUser:async uid=>{assert.equal(uid,'person');return account;},app:{options:{projectId:'wvd-test'}},verifyIdToken:async(proof,revoked)=>{assert.equal(proof,'proof');assert.equal(revoked,true);return identity;}};
 const resolve=createFirebaseBookingRecipientResolver({auth,projectId:'wvd-test'}),request={proof:'proof',reservationId:'reservation'};
 assert.deepEqual(await resolve(request),{verified:true,email:'verified@example.test'});
 for(const patch of [{aud:'foreign'},{iss:'https://evil.example/wvd-test'},{email_verified:false},{sub:'other'},{firebase:{tenant:'foreign-tenant'}}]){const old=identity;identity={...old,...patch};assert.deepEqual(await resolve(request),{verified:false});identity=old;}
 for(const patch of [{email:'changed@example.test'},{disabled:true},{emailVerified:false},{providerData:[]}]){const old=account;account={...old,...patch};assert.deepEqual(await resolve(request),{verified:false});account=old;}
 auth.getUser=async()=>{throw Error('private provider failure');};await assert.rejects(resolve(request),/^Error: IDENTITY_SERVICE_UNAVAILABLE$/);
 auth.verifyIdToken=async()=>{throw Object.assign(Error('revoked token with private details'),{code:'auth/id-token-revoked'});};assert.deepEqual(await resolve(request),{verified:false});
 assert.throws(()=>createFirebaseBookingRecipientResolver({auth,projectId:'foreign-project'}));
});
