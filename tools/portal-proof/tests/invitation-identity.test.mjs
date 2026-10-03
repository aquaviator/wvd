import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseInvitationIdentityResolver,createFirebaseSessionResolver} from '../firebase-auth.mjs';
const decoded=()=>({uid:'new',email:'new@example.test',email_verified:true,firebase:{sign_in_provider:'password'},wvdAdmin:true});
const user=()=>({uid:'new',email:'new@example.test',emailVerified:true,disabled:false,providerData:[{providerId:'password'}]});
test('Verified invitation identity does not confer product access or use token role flags',async()=>{
 const auth={verifyIdToken:async(raw,revocation)=>{assert.equal(raw,'signed-token');assert.equal(revocation,true);return decoded();},getUser:async()=>user()};
 assert.deepEqual(await createFirebaseInvitationIdentityResolver({auth})('signed-token'),{actorId:'new',email:'new@example.test'});assert.equal(await createFirebaseSessionResolver({auth,portal:{activeIdentity:async()=>false}})('signed-token'),null);
});
test('Invitation identity requires current enabled verified matching email and supported account provider',async()=>{
 for(const patch of [{disabled:true},{emailVerified:false},{uid:'different'},{email:'changed@example.test'},{providerData:[{providerId:'anonymous'}]}])assert.equal(await createFirebaseInvitationIdentityResolver({auth:{verifyIdToken:async()=>decoded(),getUser:async()=>({...user(),...patch})}})('signed-token'),null);
 for(const patch of [{email_verified:false},{email:undefined},{firebase:{sign_in_provider:'anonymous'}}])assert.equal(await createFirebaseInvitationIdentityResolver({auth:{verifyIdToken:async()=>({...decoded(),...patch}),getUser:async()=>user()}})('signed-token'),null);
});
test('Invalid or revoked identity fails closed and provider outages expose no provider detail',async()=>{
 let reads=0;const auth={verifyIdToken:async()=>{reads++;return decoded();},getUser:async()=>user()},resolve=createFirebaseInvitationIdentityResolver({auth});for(const raw of [null,'','contains whitespace','x'.repeat(8193)])assert.equal(await resolve(raw),null);assert.equal(reads,0);
 for(const code of ['auth/id-token-revoked','auth/user-disabled','auth/user-not-found'])assert.equal(await createFirebaseInvitationIdentityResolver({auth:{verifyIdToken:async()=>decoded(),getUser:async()=>{throw {code};}}})('signed-token'),null);
 await assert.rejects(()=>createFirebaseInvitationIdentityResolver({auth:{verifyIdToken:async()=>decoded(),getUser:async()=>{throw Error('private SDK detail');}}})('signed-token'),/^Error: IDENTITY_SERVICE_UNAVAILABLE$/);
});
