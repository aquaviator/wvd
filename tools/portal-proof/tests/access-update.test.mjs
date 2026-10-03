import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {createFirebaseAccessUpdater} from '../firebase-provisioning.mjs';
import {createBoundary} from '../boundary.mjs';
const seed=()=>({identities:[{id:'m',active:true},{id:'d',active:false}],projects:[{id:'p',businessId:'b'},{id:'q',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'m',businessId:'b',role:'Member',active:true,projectIds:['p']},{actorId:'m',businessId:'other',role:'Owner',active:true,projectIds:['foreign']},{actorId:'d',businessId:'b',role:'Member',active:true,projectIds:['p']}],milestones:[]});
const grant={uid:'m',businessId:'b',role:'Member',projectIds:['p','q']},context={operatorRef:'synthetic-test',changeRef:'access-update'},user={uid:'m',email:'member@example.test',emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]};
const model=()=>new PortalProof(seed(),()=> '2026-10-02T19:50:00Z');
test('Explicit project-list update preserves identity flags, business role and other-business access',()=>{
 const m=model(),before=m.snapshot(),updated=m.updateAccess(grant);assert.equal(updated.changed,true);assert.deepEqual(updated.previousProjectIds,['p']);assert.deepEqual(m.snapshot().identities,before.identities);assert.deepEqual(m.snapshot().memberships[1],before.memberships[1]);assert.equal(m.snapshot().memberships[0].role,'Member');assert.equal(m.projectOverview('m','q').canApprove,false);assert.equal(m.updateAccess(grant).changed,false);
 updated.projectIds.push('foreign');assert.deepEqual(m.snapshot().memberships[0].projectIds,['p','q']);
});
test('Updates cannot create memberships, change roles, grant another business or inject admin flags',()=>{
 for(const patch of [{uid:'missing'},{role:'Owner'},{projectIds:['foreign']},{projectIds:['p','p']},{wvdAdmin:true},{active:true}]){const m=model(),before=m.snapshot();assert.throws(()=>m.updateAccess({...grant,...patch}),/ACCESS_MEMBERSHIP_REQUIRED|ACCESS_ROLE_CONFLICT|PROJECT_SCOPE_DENIED|INVALID_ACCESS_GRANT/);assert.deepEqual(m.snapshot(),before);}
});
test('Removal works for disabled/revoked memberships without reactivation; new grants remain denied',()=>{
 const m=model();assert.throws(()=>m.updateAccess({...grant,uid:'d'}),/IDENTITY_DISABLED/);assert.equal(m.updateAccess({...grant,uid:'d',projectIds:[]}).changed,true);assert.equal(m.snapshot().identities.find(x=>x.id==='d').active,false);
 m.revokeMembership('m','b');assert.throws(()=>m.updateAccess(grant),/ACCESS_REVOKED/);m.updateAccess({...grant,projectIds:[]});assert.equal(m.snapshot().memberships[0].active,false);assert.deepEqual(m.projectsFor('m').map(x=>x.id),['foreign']);
});
test('Google updater checks fresh verified user only for added access and requires explicit revision',async()=>{
 const m=model();let lookups=0,writes=0;
 const update=createFirebaseAccessUpdater({auth:{getUser:async uid=>{lookups++;assert.equal(uid,'m');return user;}},portal:{snapshot:async()=>m.snapshot(),updateAccess:async(request,revision,received)=>{writes++;assert.equal(revision,7);assert.deepEqual(received,context);return m.updateAccess(request);}}});
 await assert.rejects(()=>update(grant,undefined,context),/ACCESS_REVISION_REQUIRED/);assert.equal(lookups,0);assert.equal((await update(grant,7,context)).changed,true);assert.equal(lookups,1);
 await update({...grant,projectIds:['p']},7,context);assert.equal(lookups,1);assert.equal(writes,2);
});
test('Auth outages, disabled/unverified targets and cross-scope changes never write',async()=>{
 for(const result of [{...user,disabled:true},{...user,emailVerified:false},{...user,uid:'foreign'},{...user,providerData:[{providerId:'anonymous'}]}]){const m=model(),update=createFirebaseAccessUpdater({auth:{getUser:async()=>result},portal:{snapshot:async()=>m.snapshot(),updateAccess:()=>assert.fail('must not write')}});await assert.rejects(()=>update(grant,0,context),/VERIFIED_FIREBASE_USER_REQUIRED/);}
 for(const code of ['auth/user-not-found','auth/internal-error']){const m=model(),update=createFirebaseAccessUpdater({auth:{getUser:async()=>{throw Object.assign(Error('private detail'),{code});}},portal:{snapshot:async()=>m.snapshot(),updateAccess:()=>assert.fail('must not write')}});await assert.rejects(()=>update(grant,0,context),error=>error.message===(code==='auth/user-not-found'?'FIREBASE_USER_REQUIRED':'IDENTITY_SERVICE_UNAVAILABLE'));}
 const m=model(),update=createFirebaseAccessUpdater({auth:{getUser:()=>assert.fail('scope must fail before lookup')},portal:{snapshot:async()=>m.snapshot(),updateAccess:()=>assert.fail('must not write')}});await assert.rejects(()=>update({...grant,projectIds:['foreign']},0,context),/PROJECT_SCOPE_DENIED/);
});
test('Removing disabled/deleted Google account access needs no Auth lookup or role change',async()=>{
 const m=model(),update=createFirebaseAccessUpdater({auth:{getUser:()=>assert.fail('removal must not depend on usable Auth')},portal:{snapshot:async()=>m.snapshot(),updateAccess:async request=>m.updateAccess(request)}});
 assert.equal((await update({...grant,uid:'d',projectIds:[]},0,context)).changed,true);assert.equal(m.snapshot().identities.find(x=>x.id==='d').active,false);
});
test('Trusted access-update capability has no client HTTP endpoint',async()=>{
 const handle=createBoundary({portal:model(),resolveSession:async()=>({actorId:'m'}),allowedOrigin:'https://client.wearvalleydigital.com'});assert.equal((await handle({action:'update-access',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'token',rawBody:JSON.stringify(grant)})).status,404);
});
