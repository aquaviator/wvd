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
test('Approval binds actor, tenant, exact version and server time with pending outbox',()=>{const m=model(); const r=m.approve(request()); assert.deepEqual(r,{id:'approval-1',kind:'approval',operationId:'op1',actorId:'owner',businessId:'b1',projectId:'p1',milestoneId:'m1',versionId:'v1',timestamp:'2026-10-02T11:10:00.000Z'}); assert.equal(m.snapshot().milestones[0].status,'approved'); assert.equal(m.snapshot().outbox[0].status,'pending');});
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

const ticketRequest = (overrides={}) => ({actorId:'member',projectId:'p1',type:'question',subject:'Preview question',body:'Please check the heading.',operationId:'ticket-op',...overrides});
const feedbackRequest = (overrides={}) => ({actorId:'member',projectId:'p1',milestoneId:'m1',versionId:'v1',body:'Please check the heading.',operationId:'feedback-op',...overrides});
test('Overview exposes only authorised project milestones',()=>{const m=model();const view=m.projectOverview('member','p1');assert.deepEqual(view.awaitingClient.map(x=>x.id),['m1']);assert.equal(view.stage,null);assert.throws(()=>m.projectOverview('member','p2'),/ACCESS_DENIED/);});
test('Overview reports new version awaiting approval',()=>{const m=model();m.approve(request());assert.equal(m.projectOverview('member','p1').completedMilestones.length,1);m.replaceVersion('m1','v3');assert.equal(m.projectOverview('member','p1').completedMilestones.length,0);});
test('Member feedback binds exact version with payload-free notification',()=>{const m=model();const f=m.submitFeedback(feedbackRequest());assert.equal(f.versionId,'v1');assert.equal(f.businessId,'b1');assert.deepEqual(m.submitFeedback(feedbackRequest()),f);assert.equal(m.snapshot().outbox.length,1);assert.equal(JSON.stringify(m.snapshot().outbox).includes('heading'),false);});
test('Stale or cross-project feedback denied without mutation',()=>{const m=model();const before=m.snapshot();assert.throws(()=>m.submitFeedback(feedbackRequest({versionId:'old'})),/VERSION_CONFLICT/);assert.throws(()=>m.submitFeedback(feedbackRequest({milestoneId:'m2',versionId:'v2'})),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);});
test('Feedback retry cannot silently change body',()=>{const m=model();m.submitFeedback(feedbackRequest());assert.throws(()=>m.submitFeedback(feedbackRequest({body:'Changed'})),/OPERATION_CONFLICT/);});
test('Ticket survives pending notification and retry creates one intent',()=>{const m=model();const t=m.createTicket(ticketRequest());assert.equal(m.snapshot().outbox[0].status,'pending');assert.deepEqual(m.createTicket(ticketRequest()),t);assert.equal(m.snapshot().tickets.length,1);assert.equal(m.snapshot().outbox.length,1);});
test('Ticket types do not invent triage or entitlement',()=>{for(const type of ['question','fault','change-request']){const m=model();const t=m.createTicket(ticketRequest({type}));assert.equal(t.type,type);assert.equal(t.priority,undefined);assert.equal(t.includedInCare,undefined);}});
test('Ticket input validation rejects empty and oversized content',()=>{const m=model();for(const patch of [{type:'urgent'},{body:'   '},{subject:'x'.repeat(201)},{body:'x'.repeat(10001)}])assert.throws(()=>m.createTicket(ticketRequest(patch)),/INVALID_/);assert.equal(m.snapshot().tickets.length,0);});
test('Ticket reads and replies are tenant/project scoped',()=>{const m=model();const t=m.createTicket(ticketRequest());assert.throws(()=>m.readTicket('other','p2',t.id),/ACCESS_DENIED/);assert.throws(()=>m.replyToTicket({actorId:'other',projectId:'p2',ticketId:t.id,body:'reply',operationId:'r1'}),/ACCESS_DENIED/);assert.equal(m.snapshot().replies.length,0);});
test('Member and admin may reply with exact retry binding',()=>{const m=model();const t=m.createTicket(ticketRequest());const r={actorId:'admin',projectId:'p1',ticketId:t.id,body:'We are checking.',operationId:'r1'};const saved=m.replyToTicket(r);assert.deepEqual(m.replyToTicket(r),saved);assert.equal(m.readTicket('member','p1',t.id).replies.length,1);assert.throws(()=>m.replyToTicket({...r,body:'Changed'}),/OPERATION_CONFLICT/);});
test('Membership revocation prevents ticket read and feedback retry',()=>{const m=model();const t=m.createTicket(ticketRequest());m.submitFeedback(feedbackRequest());m.revokeMembership('member','b1');assert.throws(()=>m.readTicket('member','p1',t.id),/ACCESS_DENIED/);assert.throws(()=>m.submitFeedback(feedbackRequest()),/ACCESS_DENIED/);});
test('Operation IDs cannot cross from feedback to approval',()=>{const m=model();m.submitFeedback(feedbackRequest({actorId:'owner',operationId:'op1'}));assert.throws(()=>m.approve(request()),/OPERATION_CONFLICT/);assert.equal(m.snapshot().receipts.length,0);});
test('Operation IDs cannot cross from approval to feedback',()=>{const m=model();m.approve(request());assert.throws(()=>m.submitFeedback(feedbackRequest({actorId:'owner',operationId:'op1'})),/OPERATION_CONFLICT/);});
test('Clock failure commits neither ticket nor notification',()=>{const m=model(()=> 'invalid');const before=m.snapshot();assert.throws(()=>m.createTicket(ticketRequest()),/INVALID_SERVER_TIME/);assert.deepEqual(m.snapshot(),before);});
test('Returned ticket and replies cannot mutate model',()=>{const m=model();const t=m.createTicket(ticketRequest());t.body='injected';const result=m.readTicket('member','p1',t.id);result.ticket.subject='injected';assert.equal(m.readTicket('member','p1',t.id).ticket.subject,'Preview question');});

test('Admin overview groups clients and counts activity without exposing private record payloads',()=>{
 const m=model();m.createTicket(ticketRequest());m.submitFeedback(feedbackRequest());const before=m.snapshot();
 const view=m.adminOverview('admin');assert.equal(view.businesses.length,2);
 const project=view.businesses.find(x=>x.businessId==='b1').projects.find(x=>x.projectId==='p1');
 assert.deepEqual(project,{projectId:'p1',stage:null,nextStep:null,awaitingReview:1,feedbackCount:1,ticketCount:1});
 assert.equal(JSON.stringify(view).includes('heading'),false);assert.equal(JSON.stringify(view).includes('operationId'),false);
 view.businesses[0].projects[0].stage='injected';assert.deepEqual(m.snapshot(),before);
});
for(const actor of ['owner','member','other','disabled','missing'])test(`Admin overview denied to ${actor}`,()=>assert.throws(()=>model().adminOverview(actor),/ACCESS_DENIED/));
test('Workspace access derives admin capability only from current active server identity',()=>{
 const m=model();assert.deepEqual(m.workspaceAccess('owner'),{admin:false});assert.deepEqual(m.workspaceAccess('admin'),{admin:true});
 assert.throws(()=>m.workspaceAccess('disabled'),/ACCESS_DENIED/);
 const state=fixture();state.identities.find(x=>x.id==='admin').active=false;assert.throws(()=>new PortalProof(state,()=> '').adminOverview('admin'),/ACCESS_DENIED/);
});
