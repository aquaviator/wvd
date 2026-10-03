import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {createFirebaseProvisioner} from '../firebase-provisioning.mjs';
const seed=()=>({identities:[],projects:[{id:'p',businessId:'b'},{id:'other',businessId:'foreign'}],memberships:[],milestones:[]});
const grant={uid:'new',businessId:'b',role:'Member',projectIds:['p']};
const model=()=>new PortalProof(seed(),()=>new Date().toISOString());
test('trusted provisioning grants only named projects and no WVD admin privilege',()=>{
 const portal=model();assert.equal(portal.provisionAccess(grant).created,true);assert.deepEqual(portal.projectsFor('new').map(p=>p.id),['p']);
 assert.throws(()=>portal.authorise('new','p','approve'),/ACCESS_DENIED/);assert.throws(()=>portal.authorise('new','other','view'),/ACCESS_DENIED/);
 assert.deepEqual(portal.snapshot().identities,[{id:'new',active:true}]);const before=portal.snapshot();assert.equal(portal.provisionAccess(grant).created,false);assert.deepEqual(portal.snapshot(),before);
});
test('scope, privilege injection, duplicate projects and implicit role changes fail without mutation',()=>{
 const portal=model();portal.provisionAccess(grant);const before=portal.snapshot();
 for(const invalid of [{...grant,projectIds:['other']},{...grant,wvdAdmin:true},{...grant,projectIds:['p','p']},{...grant,role:'Owner'},{...grant,projectIds:[]}])assert.throws(()=>portal.provisionAccess(invalid));
 assert.deepEqual(portal.snapshot(),before);
 portal.revokeMembership('new','b');assert.throws(()=>portal.provisionAccess(grant),/ACCESS_ALREADY_PROVISIONED/);
});
test('disabled WVD identities cannot be silently reactivated',()=>{
 const state=seed();state.identities.push({id:'new',active:false});const portal=new PortalProof(state,()=>new Date().toISOString());assert.throws(()=>portal.provisionAccess(grant),/IDENTITY_DISABLED/);assert.equal(portal.snapshot().memberships.length,0);
});
test('verified Firebase UID is checked before grant and revision is explicit',async()=>{
 let writes=0;const user={uid:'new',email:'synthetic@example.test',emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]};
 const provision=createFirebaseProvisioner({auth:{getUser:async uid=>{assert.equal(uid,'new');return user;}},portal:{provisionAccess:async(request,revision)=>{assert.deepEqual(request,grant);assert.equal(revision,7);writes++;return {created:true};}}});
 await assert.rejects(()=>provision(grant),/ACCESS_REVISION_REQUIRED/);assert.equal(writes,0);
 assert.deepEqual(await provision(grant,7),{created:true});assert.equal(writes,1);
 for(const mutation of [{disabled:true},{emailVerified:false},{uid:'foreign'},{providerData:[{providerId:'anonymous'}]},{providerData:{}},{providerData:[null]},{email:'missing-at.example.test'},{email:'two@@example.test'},{email:'new\u0000@example.test'}]) {
  const p=createFirebaseProvisioner({auth:{getUser:async()=>({...user,...mutation})},portal:{provisionAccess:()=>assert.fail('must not write')}});await assert.rejects(()=>p(grant,7),/VERIFIED_FIREBASE_USER_REQUIRED/);
 }
});
test('missing users and Auth outages never write or expose provider errors',async()=>{
 for(const code of ['auth/user-not-found','auth/internal-error']) {
 const provision=createFirebaseProvisioner({auth:{getUser:async()=>{throw Object.assign(Error('private data'),{code});}},portal:{provisionAccess:()=>assert.fail('must not write')}});
 await assert.rejects(()=>provision(grant,0),error=>error.message===(code==='auth/user-not-found'?'FIREBASE_USER_REQUIRED':'IDENTITY_SERVICE_UNAVAILABLE'));
 }
});
