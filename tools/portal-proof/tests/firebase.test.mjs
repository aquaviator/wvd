import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseSessionResolver} from '../firebase-auth.mjs';
import {firebaseConfiguration} from '../firebase-config.mjs';
const config={projectId:'demo-wvd-portal',productId:'wvd',databaseId:'(default)',mode:'emulator'};
const env={FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9097',FIRESTORE_EMULATOR_HOST:'localhost:8087'};
test('emulator config requires isolated project and loopback for both services',()=>{
 assert.equal(firebaseConfiguration(config,env).productId,'wvd');
 for(const bad of [{...config,projectId:'hv1-platform'},{...config,credential:'secret'},{...config,productId:'../other'}])assert.throws(()=>firebaseConfiguration(bad,env));
 for(const bad of [{},{...env,FIRESTORE_EMULATOR_HOST:'remote:8087'},{...env,FIREBASE_AUTH_EMULATOR_HOST:'localhost:99999'}])assert.throws(()=>firebaseConfiguration(config,bad),/ISOLATED_EMULATORS_REQUIRED/);
});
test('live mode rejects emulator environments and demo targets',()=>{
 const live={...config,projectId:'wvd-explicit',mode:'live'};
 assert.equal(firebaseConfiguration(live,{}).mode,'live');
 assert.throws(()=>firebaseConfiguration(live,env),/EMULATOR_ENVIRONMENT_FORBIDDEN/);
 assert.throws(()=>firebaseConfiguration({...live,projectId:'demo-wvd-portal'},{}));
 assert.throws(()=>firebaseConfiguration(live,{FIREBASE_AUTH_EMULATOR_HOST:''}));
});
test('verified Firebase UID requires fresh trusted WVD identity; token roles ignored',async()=>{
 let active=true,calls=0;
 const resolve=createFirebaseSessionResolver({auth:{verifyIdToken:async(token,revocation)=>{assert.equal(token,'token');assert.equal(revocation,true);return {uid:'owner',email_verified:true,firebase:{sign_in_provider:'google.com'},role:'Owner',actorId:'foreign'};}},portal:{activeIdentity:async uid=>{calls++;assert.equal(uid,'owner');return active;}}});
 assert.deepEqual(await resolve('token'),{actorId:'owner'});active=false;assert.equal(await resolve('token'),null);assert.equal(calls,2);
});
for(const decoded of [{uid:'o',email_verified:false,firebase:{sign_in_provider:'password'}},{uid:'o',email_verified:true,firebase:{sign_in_provider:'anonymous'}},{email_verified:true,firebase:{sign_in_provider:'google.com'}}])test('unverified or unsupported login denied',async()=>{
 const resolve=createFirebaseSessionResolver({auth:{verifyIdToken:async()=>decoded},portal:{activeIdentity:async()=>assert.fail('must not consult identity')}});assert.equal(await resolve('token'),null);
});
test('malformed input never reaches SDK; invalid tokens denied and outages fail closed',async()=>{
 let code='auth/id-token-revoked',calls=0;
 const resolve=createFirebaseSessionResolver({auth:{verifyIdToken:async()=>{calls++;throw Object.assign(Error(),{code});}},portal:{activeIdentity:async()=>true}});
 for(const raw of [undefined,'','two tokens','x'.repeat(8193)])assert.equal(await resolve(raw),null);
 assert.equal(calls,0);assert.equal(await resolve('token'),null);code='auth/internal-error';await assert.rejects(()=>resolve('token'),/IDENTITY_SERVICE_UNAVAILABLE/);
});
