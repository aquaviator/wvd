import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFirebaseBackend} from '../firebase-backend.mjs';
import {clientInvitationPolicy} from '../client-onboarding.mjs';
import {createOpaqueToken,opaqueTokenDigest} from '../opaque-token.mjs';

test('Firestore client invitations atomically redeem once and preserve product/project isolation',async t=>{
  const config={projectId:'demo-wvd-portal',productId:'client-test-'+randomUUID(),databaseId:'(default)',mode:'emulator'};
  const backend=createFirebaseBackend(config,{invitationPolicy:clientInvitationPolicy});t.after(()=>backend.close());
  await backend.portal.initialize({identities:[{id:'admin',active:true,wvdAdmin:true}],projects:[{id:'a',businessId:'a'},{id:'b',businessId:'b'}],memberships:[],milestones:[]});
  const token=createOpaqueToken();
  await backend.portal.createClientInvitation({actorId:'admin',businessId:'a',projectIds:['a'],email:'synthetic@example.test',expiresAt:new Date(Date.now()+3600000).toISOString(),operationId:'client-invite',tokenHash:opaqueTokenDigest(token)});
  const results=await Promise.all(Array.from({length:3},()=>backend.portal.redeemMemberInvitation({token,recipientId:'client',email:'synthetic@example.test'})));
  assert.equal(results.filter(x=>!x.alreadyRedeemed).length,1);
  assert.deepEqual((await backend.portal.projectsFor('client')).map(x=>x.id),['a']);
  await assert.rejects(()=>backend.portal.projectOverview('client','b'),/ACCESS_DENIED/);
  assert.equal((await backend.portal.workspaceAccess('client')).admin,false);
  const other=createFirebaseBackend({...config,productId:config.productId+'-other'});t.after(()=>other.close());
  await other.portal.initialize({identities:[],projects:[],memberships:[],milestones:[]});assert.equal(await other.portal.activeIdentity('client'),false);
  const second=createFirebaseBackend(config,{invitationPolicy:clientInvitationPolicy});t.after(()=>second.close());
  assert.equal((await second.portal.projectOverview('client','a')).canApprove,true);
});
