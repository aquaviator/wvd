import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {createOpaqueToken,opaqueTokenDigest} from '../opaque-token.mjs';
import {validatePortalState} from '../state.mjs';
import {createFirebaseInvitations} from '../firebase-invitations.mjs';
const state=()=>({identities:[{id:'o',active:true},{id:'m',active:true}],projects:[{id:'p',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[]});
const policy={ref:'synthetic-one-hour',maxLifetimeMs:3600000},clock=()=> '2026-10-03T10:00:00.000Z';
const body={actorId:'o',businessId:'b',email:'new@example.test',projectIds:['p'],expiresAt:'2026-10-03T11:00:00.000Z',operationId:'invite'};
function issue(portal){const token=createOpaqueToken(),created=portal.createMemberInvitation({...body,tokenHash:opaqueTokenDigest(token)});return {token,created};}
test('Invitation stores only digest and atomically provisions an explicit Member on one-time matching-identity redemption',()=>{
 const portal=new PortalProof(state(),clock,policy),{token,created}=issue(portal);assert.equal(created.created,true);assert.equal(JSON.stringify(portal.snapshot()).includes(token),false);assert.equal(portal.projectsFor('m').length,0);
 assert.deepEqual(portal.redeemMemberInvitation({token,recipientId:'m',email:'NEW@example.test'}),{redeemed:true,alreadyRedeemed:false,invitationId:created.invitation.id});const after=portal.snapshot();validatePortalState(after);assert.equal(after.invitations[0].status,'redeemed');assert.equal(after.memberships.at(-1).role,'Member');assert.deepEqual(after.memberships.at(-1).projectIds,['p']);assert.equal(portal.projectOverview('m','p').canApprove,false);assert.equal(after.identities.find(x=>x.id==='m').wvdAdmin,undefined);
 portal.revokeMembership('m','b');const revoked=portal.snapshot();assert.equal(portal.redeemMemberInvitation({token,recipientId:'m',email:body.email}).alreadyRedeemed,true);assert.deepEqual(portal.snapshot(),revoked);
 assert.throws(()=>portal.redeemMemberInvitation({token,recipientId:'different',email:body.email}),/INVALID_INVITATION/);
});
test('Expired/revoked invitations, wrong recipient and changed Owner scope never grant access',()=>{
 for(const mode of ['expired','revoked','recipient','scope']){let now=clock();const portal=new PortalProof(state(),()=>now,policy),{token,created}=issue(portal);if(mode==='expired')now=body.expiresAt;if(mode==='revoked')portal.revokeMemberInvitation({actorId:'o',invitationId:created.invitation.id});if(mode==='scope')portal.revokeMembership('o','b');const before=portal.snapshot();assert.throws(()=>portal.redeemMemberInvitation({token,recipientId:'m',email:mode==='recipient'?'wrong@example.test':body.email}),/INVALID_INVITATION|INVITATION_RECIPIENT_MISMATCH|ACCESS_DENIED/);assert.deepEqual(portal.snapshot(),before);}
});
test('Creation requires explicit lifetime policy, binds retries and cannot reuse operation IDs or token hashes',()=>{
 assert.throws(()=>issue(new PortalProof(state(),clock)),/INVITATION_POLICY_REQUIRED/);const portal=new PortalProof(state(),clock,policy),{token,created}=issue(portal),before=portal.snapshot();assert.equal(portal.createMemberInvitation({...body,tokenHash:opaqueTokenDigest(createOpaqueToken())}).created,false);assert.deepEqual(portal.snapshot(),before);assert.throws(()=>portal.createMemberInvitation({...body,email:'different@example.test',tokenHash:opaqueTokenDigest(createOpaqueToken())}),/OPERATION_CONFLICT/);assert.throws(()=>portal.createMemberInvitation({...body,operationId:'different',tokenHash:opaqueTokenDigest(token)}),/INVITATION_TOKEN_CONFLICT/);assert.equal(created.invitation.role,'Member');
});
test('Archived invitation integrity rejects raw tokens, scope/digest corruption, duplicate IDs and invalid consumption references',()=>{
 const portal=new PortalProof(state(),clock,policy),{token}=issue(portal);portal.redeemMemberInvitation({token,recipientId:'m',email:body.email});const valid=portal.snapshot();
 for(const mutate of [s=>s.invitations[0].token=token,s=>s.invitations[0].projectIds=['foreign'],s=>s.invitations[0].digest='0'.repeat(64),s=>s.invitations.push(s.invitations[0]),s=>s.invitations[0].recipientId='missing',s=>s.invitations[0].redeemedAt=body.expiresAt,s=>s.invitations[0].role='Owner']){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validatePortalState(bad),/CORRUPT_PORTAL_STATE/);}
});
test('Existing disabled/revoked or differently provisioned accounts are never reactivated or overwritten',()=>{
 for(const mode of ['disabled','revoked','different']){const seed=state();if(mode==='disabled')seed.identities[1].active=false;else seed.memberships.push({actorId:'m',businessId:'b',role:mode==='different'?'Owner':'Member',active:mode!=='revoked',projectIds:['p']});const portal=new PortalProof(seed,clock,policy),{token}=issue(portal),before=portal.snapshot();assert.throws(()=>portal.redeemMemberInvitation({token,recipientId:'m',email:body.email}),/IDENTITY_DISABLED|ACCESS_ALREADY_PROVISIONED/);assert.deepEqual(portal.snapshot(),before);}
});
test('Google envelope verifies issuer/recipient outside transaction and does not return a replacement token on retry',async()=>{
 const portal=new DurablePortal(':memory:',state(),clock,policy);try{let reads=0;const service=createFirebaseInvitations({portal,auth:{getUser:async uid=>{reads++;return {uid,emailVerified:true,email:uid+'@example.test',disabled:false,providerData:[{providerId:'password'}]};}},resolveSession:async raw=>raw==='owner'?{actorId:'o'}:null,resolveInvitationIdentity:async raw=>raw==='recipient'?{actorId:'m',email:body.email}:null});const {actorId,...input}=body;const created=await service.create('owner',input);assert.equal(typeof created.token,'string');const duplicate=await service.create('owner',input);assert.equal(duplicate.token,null);assert.equal(duplicate.created,false);assert.equal((await service.redeem('recipient',created.token)).alreadyRedeemed,false);assert.equal((await service.redeem('recipient',created.token)).alreadyRedeemed,true);assert.equal(reads,3);validatePortalState(portal.snapshot());assert.equal(JSON.stringify(portal.snapshot()).includes(created.token),false);}finally{portal.close();}
});

test('Policy changes invalidate pending invitations; archived records retain their original policy binding',()=>{
 const portal=new PortalProof(state(),clock,policy),{token}=issue(portal),archived=portal.snapshot(),changed=new PortalProof(archived,clock,{...policy,ref:'synthetic-replacement'});assert.throws(()=>changed.redeemMemberInvitation({token,recipientId:'m',email:body.email}),/INVALID_INVITATION/);assert.deepEqual(changed.snapshot(),archived);validatePortalState(archived);
});
