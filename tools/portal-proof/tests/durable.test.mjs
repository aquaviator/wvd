import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DurablePortal } from '../durable.mjs';
const clock = () => '2026-10-02T12:00:00Z';
const fixture = () => ({identities:[{id:'o',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'o',businessId:'b',active:true,role:'Owner',projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const approval = {actorId:'o',projectId:'p',milestoneId:'m',versionId:'v',operationId:'approve'};
const ticket = id => ({actorId:'o',projectId:'p',type:'question',subject:'Question',body:'Help',operationId:id});
function setup(t) { const dir=mkdtempSync(join(tmpdir(),'portal-durable-'));const path=join(dir,'state.sqlite');const connections=[];t.after(()=>{for(const db of connections)try{db.close();}catch{}rmSync(dir,{recursive:true,force:true});});return {path,open:(seed,now=clock)=>{const db=new DurablePortal(path,seed,now);connections.push(db);return db;}}; }
function row(path) { const db=new DatabaseSync(path);try{return db.prepare('SELECT * FROM portal_state').get();}finally{db.close();} }
test('approval and pending outbox survive reopen; exact retry does not write',t=>{const s=setup(t);let db=s.open(fixture());const saved=db.approve(approval);db.close();db=s.open();const before=row(s.path);assert.deepEqual(db.approve(approval),saved);assert.deepEqual(row(s.path),before);assert.equal(db.snapshot().milestones[0].status,'approved');assert.equal(db.snapshot().outbox[0].receiptId,saved.id);});
test('two open connections load fresh state and retain both writes',t=>{const s=setup(t);const a=s.open(fixture()),b=s.open();a.createTicket(ticket('a'));b.createTicket(ticket('b'));assert.equal(a.snapshot().tickets.length,2);assert.equal(b.snapshot().outbox.length,2);assert.equal(row(s.path).revision,2);});
test('failed mutation rolls back and releases transaction',t=>{const s=setup(t);const db=s.open(fixture(),()=> 'bad-time');const before=row(s.path);assert.throws(()=>db.createTicket(ticket('a')),/INVALID_SERVER_TIME/);assert.deepEqual(row(s.path),before);s.open().createTicket(ticket('b'));assert.equal(db.snapshot().tickets.length,1);});
test('database failure commits neither domain record nor outbox',t=>{const s=setup(t);const db=s.open(fixture());const raw=new DatabaseSync(s.path);raw.exec("CREATE TRIGGER reject_write BEFORE UPDATE ON portal_state BEGIN SELECT RAISE(ABORT, 'simulated disk rejection'); END");raw.close();const before=row(s.path);assert.throws(()=>db.approve(approval),/simulated disk rejection/);assert.deepEqual(row(s.path),before);assert.equal(db.snapshot().receipts.length,0);assert.equal(db.snapshot().outbox.length,0);});
test('revocation from second connection is checked even on exact retry',t=>{const s=setup(t);const a=s.open(fixture()),b=s.open();a.approve(approval);b.revokeMembership('o','b');assert.throws(()=>a.approve(approval),/ACCESS_DENIED/);assert.throws(()=>a.projectOverview('o','p'),/ACCESS_DENIED/);});
test('new supplied seed cannot overwrite existing state',t=>{const s=setup(t);const db=s.open(fixture());db.createTicket(ticket('a'));const changed=fixture();changed.identities[0].active=false;assert.equal(s.open(changed).snapshot().tickets.length,1);assert.equal(s.open(changed).snapshot().identities[0].active,true);});
test('fresh database requires explicit valid seed',t=>{const s=setup(t);assert.throws(()=>s.open(),/PORTAL_SEED_REQUIRED/);const bad=fixture();bad.memberships[0].projectIds=null;assert.throws(()=>s.open(bad),/CORRUPT_PORTAL_STATE/);assert.equal(s.open(fixture()).snapshot().projects.length,1);});
for(const broken of ['{bad json',JSON.stringify({...fixture(),identities:[{id:'o',active:'yes'}],receipts:[],outbox:[],feedback:[],tickets:[],replies:[]})])test('corrupt persisted state fails closed on reopen and existing connection',t=>{const s=setup(t);const db=s.open(fixture());const raw=new DatabaseSync(s.path);raw.prepare('UPDATE portal_state SET state_json = ?').run(broken);raw.close();assert.throws(()=>s.open(fixture()),/CORRUPT_PORTAL_STATE/);assert.throws(()=>db.createTicket(ticket('a')),/CORRUPT_PORTAL_STATE/);assert.equal(row(s.path).state_json,broken);});
test('feedback, ticket reply and trusted version replacement persist',t=>{const s=setup(t);const db=s.open(fixture());db.submitFeedback({...approval,body:'Looks good',operationId:'feedback'});const saved=db.createTicket(ticket('ticket'));db.replyToTicket({actorId:'o',projectId:'p',ticketId:saved.id,body:'Reply',operationId:'reply'});db.replaceVersion('m','v2');const reopened=s.open();assert.equal(reopened.readTicket('o','p',saved.id).replies.length,1);assert.equal(reopened.snapshot().feedback.length,1);assert.equal(reopened.projectOverview('o','p').awaitingClient[0].currentVersionId,'v2');});
const corruptions = {
  'reply attached to foreign project': state => {state.replies[0].projectId='foreign';state.replies[0].businessId='other';},
  'reply foreign business': state => {state.replies[0].businessId='other';},
  'unknown reply actor': state => {state.replies[0].actorId='missing';},
  'missing reply ticket': state => {state.replies[0].ticketId='missing';},
  'duplicate record identifier': state => {state.replies[0].id=state.tickets[0].id;},
  'duplicate global operation identifier': state => {state.replies[0].operationId=state.tickets[0].operationId;},
  'foreign milestone reference': state => {state.feedback[0].milestoneId='missing';},
  'grant references foreign project': state => {state.memberships[0].projectIds.push('foreign');},
  'membership references unknown actor': state => {state.memberships[0].actorId='missing';},
  'outbox mismatched type': state => {state.outbox[0].type='ticket-replied';},
  'outbox missing record': state => {state.outbox[0].receiptId='missing';},
  'missing atomic outbox intent': state => {state.outbox.pop();},
  'duplicate outbox identifier': state => {state.outbox.push({...state.outbox[0]});},
  'duplicate project identifier': state => {state.projects.push({...state.projects[0]});},
  'milestone missing project': state => {state.milestones[0].projectId='missing';}
};
for(const [description,mutate] of Object.entries(corruptions)) test(`persisted tamper rejected: ${description}`,t=>{
  const s=setup(t),db=s.open(fixture());
  const saved=db.createTicket(ticket('ticket'));
  db.replyToTicket({actorId:'o',projectId:'p',ticketId:saved.id,body:'Reply',operationId:'reply'});
  db.submitFeedback({...approval,body:'Feedback',operationId:'feedback'});
  const state=db.snapshot();state.projects.push({id:'foreign',businessId:'other'});mutate(state);
  const raw=new DatabaseSync(s.path);raw.prepare('UPDATE portal_state SET state_json = ?').run(JSON.stringify(state));raw.close();
  assert.throws(()=>db.readTicket('o','p',saved.id),/CORRUPT_PORTAL_STATE/);
  assert.throws(()=>s.open(),/CORRUPT_PORTAL_STATE/);
});
test('trusted provisioned membership persists without widening existing or revoked access',t=>{
 const s=setup(t),portal=s.open(fixture());
 const grant={uid:'new-user',businessId:'b',role:'Member',projectIds:['p']};
 assert.equal(portal.provisionAccess(grant).created,true);
 const reopened=s.open();assert.deepEqual(reopened.projectsFor('new-user').map(p=>p.id),['p']);
 assert.throws(()=>reopened.approve({...approval,actorId:'new-user'}),/ACCESS_DENIED/);
 const before=row(s.path);assert.equal(reopened.provisionAccess(grant).created,false);assert.deepEqual(row(s.path),before);
 assert.throws(()=>portal.provisionAccess({...grant,role:'Owner'}),/ACCESS_ALREADY_PROVISIONED/);
 reopened.revokeMembership('new-user','b');assert.throws(()=>portal.provisionAccess(grant),/ACCESS_ALREADY_PROVISIONED/);
});

test('review content and exact approval digest survive durable reopen',t=>{
 const s=setup(t),db=s.open(fixture());
 const review=db.publishReview({projectId:'p',milestoneId:'m',versionId:'v',title:'Review',body:'Check the new heading.'});
 const reopened=s.open();assert.equal(reopened.projectOverview('o','p').awaitingClient[0].review.digest,review.digest);
 const saved=reopened.approve({...approval,reviewDigest:review.digest});assert.equal(s.open().snapshot().receipts[0].reviewDigest,saved.reviewDigest);
});

test('client overview histories survive a durable reopen',t=>{
 const s=setup(t),db=s.open(fixture());
 const review=db.publishReview({projectId:'p',milestoneId:'m',versionId:'v',title:'Review',body:'Historical review text.'});
 db.submitFeedback({...approval,body:'Historical feedback.',operationId:'feedback'});db.approve({...approval,reviewDigest:review.digest});db.publishReview({projectId:'p',milestoneId:'m',versionId:'v2',title:'New review',body:'New content.'});
 const view=s.open().projectOverview('o','p');assert.equal(view.approvalHistory[0].review.body,'Historical review text.');assert.equal(view.feedbackHistory[0].body,'Historical feedback.');assert.equal(view.awaitingClient[0].review.body,'New content.');
});

test('Admin overview survives reopen and does not increment durable revision',t=>{
 const s=setup(t),seed=fixture();seed.identities.push({id:'admin',active:true,wvdAdmin:true});const portal=s.open(seed);portal.createTicket(ticket('activity'));
 const before=row(s.path),reopened=s.open();assert.deepEqual(reopened.workspaceAccess('admin'),{admin:true});assert.equal(reopened.adminOverview('admin').businesses[0].projects[0].ticketCount,1);assert.deepEqual(row(s.path),before);
 assert.throws(()=>reopened.adminOverview('o'),/ACCESS_DENIED/);
});
