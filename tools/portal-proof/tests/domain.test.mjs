import test from 'node:test';
import assert from 'node:assert/strict';
import { PortalProof } from '../domain.mjs';

const fixture = () => ({
  identities: [{id:'owner',active:true},{id:'member',active:true},{id:'other',active:true},{id:'admin',active:true,wvdAdmin:true},{id:'disabled',active:false}],
  projects: [{id:'p1',businessId:'b1'},{id:'p2',businessId:'b2'},{id:'p3',businessId:'b1'}],
  memberships: [
    {actorId:'owner',businessId:'b1',active:true,role:'Owner',projectIds:['p1']},
    {actorId:'member',businessId:'b1',active:true,role:'Member',projectIds:['p1']},
    {actorId:'other',businessId:'b2',active:true,role:'Owner',projectIds:['p2']}
  ],
  milestones: [{id:'m1',projectId:'p1',currentVersionId:'v1',status:'awaiting-client'},{id:'m2',projectId:'p2',currentVersionId:'v2',status:'awaiting-client'}]
});
const model = (clock = () => '2026-10-02T11:10:00.000Z') => new PortalProof(fixture(),clock);
const request = (overrides = {}) => ({actorId:'owner',projectId:'p1',milestoneId:'m1',versionId:'v1',operationId:'op1',...overrides});

for (const action of ['view','feedback','ticket']) test(`Member can ${action} their granted project`,()=>assert.equal(model().authorise('member','p1',action).id,'p1'));
for (const action of ['approve','manage-colleagues']) test(`Member cannot ${action}`,()=>assert.throws(()=>model().authorise('member','p1',action),/ACCESS_DENIED/));
for (const actor of ['other','disabled','missing']) test(`${actor} cannot access tenant b1`,()=>assert.throws(()=>model().authorise(actor,'p1','view'),/ACCESS_DENIED/));
test('Owner cannot access ungranted project in same business',()=>assert.throws(()=>model().authorise('owner','p3','view'),/ACCESS_DENIED/));
test('Unknown action fails closed',()=>assert.throws(()=>model().authorise('owner','p1','export'),/ACCESS_DENIED/));
test('Admin view does not confer client approval',()=>{ const m=model(); assert.equal(m.authorise('admin','p1','view').id,'p1'); assert.throws(()=>m.approve(request({actorId:'admin'})),/ACCESS_DENIED/); });
test('Revocation applies on next operation',()=>{ const m=model(); m.authorise('owner','p1','view'); m.revokeMembership('owner','b1'); assert.throws(()=>m.approve(request()),/ACCESS_DENIED/); });
test('Approval binds actor, tenant, exact version and server time with pending outbox',()=>{const m=model(); const r=m.approve(request()); assert.deepEqual(r,{id:'approval-1',operationId:'op1',actorId:'owner',businessId:'b1',projectId:'p1',milestoneId:'m1',versionId:'v1',timestamp:'2026-10-02T11:10:00.000Z'}); assert.equal(m.snapshot().milestones[0].status,'approved'); assert.equal(m.snapshot().outbox[0].status,'pending');});
test('Stale version leaves all state unchanged',()=>{const m=model();m.replaceVersion('m1','v3');const before=m.snapshot();assert.throws(()=>m.approve(request()),/VERSION_CONFLICT/);assert.deepEqual(m.snapshot(),before);});
test('Cross-project milestone is denied without mutation',()=>{const m=model();const before=m.snapshot();assert.throws(()=>m.approve(request({milestoneId:'m2',versionId:'v2'})),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);});
test('Exact retry returns one durable intent',()=>{const m=model();const r=m.approve(request());assert.deepEqual(m.approve(request()),r);assert.equal(m.snapshot().receipts.length,1);assert.equal(m.snapshot().outbox.length,1);});
test('Operation identifier cannot be reused for different payload',()=>{const m=model();m.approve(request());assert.throws(()=>m.approve(request({versionId:'v3'})),/OPERATION_CONFLICT/);});
test('Revoked actor cannot retrieve prior receipt by retry',()=>{const m=model();m.approve(request());m.revokeMembership('owner','b1');assert.throws(()=>m.approve(request()),/ACCESS_DENIED/);});
test('Second operation cannot approve same version twice',()=>{const m=model();m.approve(request());assert.throws(()=>m.approve(request({operationId:'op2'})),/STATE_CONFLICT/);});
test('New version does not inherit prior approval',()=>{const m=model();m.approve(request());m.replaceVersion('m1','v3');assert.equal(m.snapshot().milestones[0].status,'awaiting-client');m.approve(request({versionId:'v3',operationId:'op2'}));assert.deepEqual(m.snapshot().receipts.map(x=>x.versionId),['v1','v3']);});
test('Clock failure leaves state unchanged',()=>{const m=model(()=> 'invalid');const before=m.snapshot();assert.throws(()=>m.approve(request()),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);});
test('External mutations cannot modify internal state or receipts',()=>{const f=fixture();const m=new PortalProof(f,()=> '2026-10-02T11:10:00.000Z');f.memberships[0].active=false;const r=m.approve(request());r.versionId='injected';const s=m.snapshot();s.receipts[0].actorId='injected';assert.equal(m.snapshot().receipts[0].actorId,'owner');assert.equal(m.snapshot().receipts[0].versionId,'v1');});
test('Duplicate identity fails closed',()=>{const f=fixture();f.identities.push({...f.identities[0]});assert.throws(()=>new PortalProof(f,()=>''),/DUPLICATE_ID/);});
test('Ambiguous membership fails closed',()=>{const f=fixture();f.memberships.push({...f.memberships[0],role:'Member'});assert.throws(()=>new PortalProof(f,()=>''),/DUPLICATE_MEMBERSHIP/);});
