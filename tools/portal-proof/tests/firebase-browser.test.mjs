import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthClient} from '../ui/auth-client.js';
import {createApplication} from '../app.mjs';
const authOrigin='http://127.0.0.1:9097';
test('Firebase client sends credentials only to explicit loopback emulator and retains only ID token',async()=>{
 let call;
 const client=createAuthClient({mode:'firebase-emulator',authOrigin},{fetcher:async(...args)=>{call=args;return {ok:true,json:async()=>({idToken:'verified-by-server',refreshToken:'never-retained'})};}});
 assert.deepEqual(await client.login({email:'owner@example.test',password:'synthetic-password'}),{sessionToken:'verified-by-server'});
 assert.ok(call[0].startsWith(authOrigin+'/identitytoolkit.googleapis.com/'));
 assert.deepEqual(JSON.parse(call[1].body),{email:'owner@example.test',password:'synthetic-password',returnSecureToken:true});
 assert.equal(call[1].credentials,'omit');assert.deepEqual(await client.logout(),{signedOut:true});
 await assert.rejects(()=>client.redeem({}),/provision/);
});
test('browser configuration cannot point the development client to a live or foreign host',()=>{
 for(const origin of ['https://identitytoolkit.googleapis.com','http://evil.test:9097','http://localhost:99999','http://localhost:9097/','http://localhost:9097@evil.test'])
 assert.throws(()=>createAuthClient({mode:'firebase-emulator',authOrigin:origin}),/INVALID_AUTH_CONFIGURATION/);
 assert.throws(()=>createAuthClient({mode:'local',credential:'secret'}),/INVALID_AUTH_CONFIGURATION/);
});
test('Firebase failures are sanitized and malformed ID tokens rejected',async()=>{
 for(const reply of [{ok:false,json:async()=>({error:{message:'private-email'}})},{ok:true,json:async()=>({idToken:null})}]) {
  const client=createAuthClient({mode:'firebase-emulator',authOrigin},{fetcher:async()=>reply});
  await assert.rejects(()=>client.login({email:'a',password:'b'}),error=>!error.message.includes('private-email')&&/sign in/.test(error.message));
 }
});
test('server rejects live Firebase configuration before constructing browser app',()=>{
 assert.throws(()=>createApplication({portal:{},auth:{},allowedOrigin:'http://127.0.0.1:4703',firebaseEmulator:{projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'}}),/ISOLATED_EMULATORS_REQUIRED/);
});
