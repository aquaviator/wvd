import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveAuthClient} from '../ui/live-auth-client.js';

const config=()=>({mode:'firebase-live',firebase:{projectId:'wvd-development',apiKey:'AIza'+'x'.repeat(35),authDomain:'wvd-development.firebaseapp.com',appId:'1:123456789:web:abcdef123456'},ownerConfigured:true,enquiriesEnabled:true});
function sdkFixture(){
  const calls=[],auth={currentUser:null},user={uid:'known-owner',emailVerified:true,getIdToken:async()=> 'verified-token'};
  const sdk={inMemoryPersistence:{type:'NONE'},browserPopupRedirectResolver:{popup:true},initializeApp:(web,name)=>{calls.push(['app',web,name]);return {web};},initializeAuth:(app,options)=>{calls.push(['auth',options]);return auth;},GoogleAuthProvider:class{setCustomParameters(parameters){calls.push(['parameters',parameters]);}},signInWithPopup:async(received,provider)=>{assert.equal(received,auth);assert.ok(provider);auth.currentUser=user;return {user};},signOut:async received=>{assert.equal(received,auth);calls.push(['signOut']);auth.currentUser=null;}};
  return {sdk,calls,auth,user,client:()=>createLiveAuthClient(config(),{loadSdk:async()=>sdk})};
}
test('live browser Google login uses in-memory persistence and only returns the ID token',async()=>{
  const f=sdkFixture(),client=await f.client();
  assert.deepEqual(f.calls[1],['auth',{persistence:f.sdk.inMemoryPersistence,popupRedirectResolver:f.sdk.browserPopupRedirectResolver}]);assert.deepEqual(f.calls[2],['parameters',{prompt:'select_account'}]);
  assert.deepEqual(await client.login(),{sessionToken:'verified-token'});assert.equal(await client.getSessionToken(),'verified-token');
  f.user.getIdToken=async()=> 'refreshed-token';assert.equal(await client.getSessionToken(),'refreshed-token');
  assert.deepEqual(await client.logout(),{signedOut:true});await assert.rejects(()=>client.getSessionToken(),/sign in again/);
});
test('live browser rejects arbitrary endpoints and extra credentials before loading SDK',async()=>{
  for(const patch of [{mode:'local'},{ownerConfigured:'yes'},{credential:'secret'},{firebase:{...config().firebase,authDomain:'evil.example'}},{firebase:{...config().firebase,projectId:'demo-wvd-portal'}}])await assert.rejects(()=>createLiveAuthClient({...config(),...patch},{loadSdk:()=>assert.fail('SDK must not load')}),/INVALID_AUTH_CONFIGURATION/);
});
test('Google cancellation and malformed user tokens clear authentication without exposing provider details',async()=>{
  for(const code of ['auth/popup-closed-by-user','auth/popup-blocked','auth/unauthorized-domain','auth/internal-error']){
    const f=sdkFixture();f.sdk.signInWithPopup=async()=>{throw Object.assign(Error('private-provider-detail'),{code});};const client=await f.client();await assert.rejects(()=>client.login(),error=>!error.message.includes('private-provider-detail'));assert.ok(f.calls.some(call=>call[0]==='signOut'));
  }
  for(const raw of ['two tokens','x'.repeat(8193),undefined]){const f=sdkFixture();f.user.getIdToken=async()=>raw;const client=await f.client();await assert.rejects(()=>client.login());assert.equal(f.auth.currentUser,null);}
  const f=sdkFixture();f.user.emailVerified=false;await assert.rejects(() => f.client().then(client=>client.login()));assert.equal(f.auth.currentUser,null);
});
test('sign-out invalidates a pending token refresh and prevents restoring an old session',async()=>{
  const f=sdkFixture(),client=await f.client();await client.login();let release;
  f.user.getIdToken=()=>new Promise(resolve=>{release=resolve;});const refresh=client.getSessionToken();await client.logout();release('late-token');await assert.rejects(()=>refresh,/sign in again/);assert.equal(f.auth.currentUser,null);
});
test('an old token request cannot clear a newly signed-in account',async()=>{
  const f=sdkFixture(),client=await f.client();await client.login();let release;
  f.user.getIdToken=()=>new Promise(resolve=>{release=resolve;});const refresh=client.getSessionToken();await client.logout();f.user.getIdToken=async()=> 'new-session-token';await client.login();release('old-session-token');await assert.rejects(()=>refresh,/sign in again/);assert.equal(await client.getSessionToken(),'new-session-token');
});
