import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {validatePortalState} from '../state.mjs';
import {createLiveOwnerResolver} from '../live-auth.mjs';
import {createLiveClientAccess,clientInvitationPolicy} from '../client-onboarding.mjs';
import {createBoundary} from '../boundary.mjs';
import {clientProjection} from '../client-projection.mjs';

const owner={uid:'admin',email:'admin@example.test'},origin='https://portal.example.test';
function fixture(){
  let now='2026-10-07T10:00:00.000Z';
  const portal=new PortalProof({identities:[{id:'admin',active:true,wvdAdmin:true}],projects:[{id:'a',businessId:'client-a'},{id:'unassigned',businessId:'client-a'},{id:'b',businessId:'client-b'}],memberships:[],milestones:[]},()=>now,clientInvitationPolicy);
  const users={admin:{email:owner.email},client:{email:'client@example.test'},wrong:{email:'wrong@example.test'}};
  const auth={verifyIdToken:async(uid,revoked)=>{assert.equal(revoked,true);const user=users[uid];if(!user)throw Object.assign(Error(),{code:'auth/invalid-id-token'});return {uid,email:user.email,email_verified:user.verified!==false,firebase:{sign_in_provider:user.provider??'google.com'}};},getUser:async uid=>({uid,email:users[uid].email,emailVerified:users[uid].verified!==false,disabled:users[uid].disabled??false,providerData:[{providerId:users[uid].provider??'google.com'}]})};
  const resolveOwnerSession=createLiveOwnerResolver({auth,portal,owner,maxConcurrentRequests:8});
  const access=createLiveClientAccess({auth,portal,resolveOwnerSession});
  const boundary=createBoundary({portal,resolveSession:access.resolveSession,allowedOrigin:origin});
  const call=(action,input={},sessionToken='client',method='GET')=>boundary({action,method,origin,rawBody:JSON.stringify(input),sessionToken});
  const invite=(patch={})=>access.invitations.create('admin',{businessId:'client-a',projectIds:['a'],email:users.client.email,expiresAt:'2026-10-08T10:00:00.000Z',operationId:'invite-a',...patch});
  return {portal,users,access,resolveOwnerSession,call,invite,setTime:value=>now=value};
}
test('owner invites an exact client/project; Google redemption grants client approval but never WVD administration',async()=>{
  const f=fixture();assert.equal(await f.access.resolveSession('client'),null);
  const invitation=await f.invite();assert.ok(invitation.token);assert.ok(!JSON.stringify(f.portal.snapshot()).includes(invitation.token));
  await f.access.invitations.redeem('client',invitation.token);validatePortalState(f.portal.snapshot());
  assert.deepEqual((await f.call('projects')).data.map(x=>x.id),['a']);
  const overview=await f.call('overview',{projectId:'a'});assert.equal(overview.status,200);assert.equal(overview.data.canApprove,true);assert.equal(overview.data.canManageColleagues,false);
  assert.equal(await f.resolveOwnerSession('client'),null);assert.equal((await f.call('workspace-access')).data.admin,false);
  assert.equal((await f.call('admin-overview',{},'admin')).status,200);
  for(const projectId of ['b','unassigned','unknown'])assert.equal((await f.call('overview',{projectId})).status,403);
  for(const [action,input,method]of [['admin-overview',{},'GET'],['admin-accounts',{businessId:'client-a'},'GET'],['colleagues',{projectId:'a'},'GET'],['create-client',{businessId:'evil',projectId:'evil',stage:'new',nextStep:'new'},'POST']])assert.equal((await f.call(action,input,'client',method)).status,403);
  await assert.rejects(()=>f.access.invitations.create('client',{}),/INVALID_INVITATION|UNAUTHENTICATED/);
  await assert.rejects(()=>f.invite({projectIds:['a','b']}),/PROJECT_SCOPE_DENIED/);
});
test('wrong email, unverified, disabled, password-provider, expired and revoked invitations grant nothing',async()=>{
  for(const mode of ['wrong','unverified','disabled','password','expired','revoked']){
    const f=fixture(),invite=await f.invite();
    if(mode==='unverified')f.users.client.verified=false;
    if(mode==='disabled')f.users.client.disabled=true;
    if(mode==='password')f.users.client.provider='password';
    if(mode==='expired')f.setTime('2026-10-09T10:00:00.000Z');
    if(mode==='revoked')await f.access.invitations.revoke('admin',invite.invitationId);
    const before=f.portal.snapshot();await assert.rejects(()=>f.access.invitations.redeem(mode==='wrong'?'wrong':'client',invite.token));assert.deepEqual(f.portal.snapshot(),before);
  }
});
test('issuer revocation is rechecked, retry is one-time, and revoked membership never returns through replay',async()=>{
  const f=fixture(),invite=await f.invite();f.users.admin.disabled=true;
  await assert.rejects(()=>f.access.invitations.redeem('client',invite.token));f.users.admin.disabled=false;
  await f.access.invitations.redeem('client',invite.token);
  assert.equal((await f.access.invitations.redeem('client',invite.token)).alreadyRedeemed,true);
  f.portal.revokeMembership('client','client-a');
  await f.access.invitations.redeem('client',invite.token);assert.equal((await f.call('overview',{projectId:'a'})).status,403);
  f.users.client.disabled=true;assert.equal(await f.access.resolveSession('client'),null);
});
test('empty product and forged non-owner admin do not bootstrap access',async()=>{
  const f=fixture();assert.equal(await f.access.resolveSession('wrong'),null);
  const state=f.portal.snapshot();state.identities.push({id:'wrong',active:true,wvdAdmin:true});
  const portal=new PortalProof(state,()=> '2026-10-07T10:00:00.000Z');
  const auth={verifyIdToken:async()=>({uid:'wrong',email:'wrong@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}}),getUser:async()=>({uid:'wrong',email:'wrong@example.test',emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]})};
  const access=createLiveClientAccess({auth,portal,resolveOwnerSession:async()=>null});assert.equal(await access.resolveSession('wrong'),null);
});
test('client projections exclude future internal fields and actor/audit metadata',()=>{
  const internal={technicalEvidence:'private',internalResearch:'private',costGovernance:'private',actorId:'private'};
  const result=clientProjection('overview',{projectId:'a',canApprove:true,...internal,progressHistory:[{stage:'Build',nextStep:'Review',timestamp:'now',...internal}],feedbackHistory:[],approvalHistory:[],completedMilestones:[],awaitingClient:[{id:'m',currentVersionId:'v',...internal,review:{title:'Review',body:'Client text',digest:'digest',...internal,deliverable:{label:'File',sourceId:'private',contentSha256:'private',sourceVersion:'v',mediaType:'text/plain'}}}]});
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(clientProjection('tickets',[{id:'t',subject:'Help',...internal,triage:{note:'Client assessment',...internal},triageHistory:[]}])).includes('private'));
});
