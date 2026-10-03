import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {validatePortalState} from '../state.mjs';
import {createBoundary} from '../boundary.mjs';
import {createPortalBackup,rehearsePortalBackup} from '../backup.mjs';
const clock=()=> '2026-10-02T19:40:00.000Z';
const seed=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:true},{id:'disabled',active:false,wvdAdmin:true}],projects:[{id:'p',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'owner',businessId:'b',active:true,role:'Owner',projectIds:['p']},{actorId:'member',businessId:'b',active:true,role:'Member',projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const ticketInput={actorId:'member',projectId:'p',type:'question',subject:'Client question',body:'Please check scope.',operationId:'ticket-op'};
const setup=()=>{const m=new PortalProof(seed(),clock),ticket=m.createTicket(ticketInput);return {m,ticket,input:{actorId:'admin',projectId:'p',ticketId:ticket.id,priority:'Normal',careAssessment:'needs-review',note:'We are checking the agreed scope.',expectedDigest:ticket.triageDigest,operationId:'triage-op'}};};
test('Manual assessment binds scope/actor/time and does not infer Care or add a notification',()=>{
 const {m,ticket,input}=setup();assert.equal(ticket.triage,undefined);const saved=m.triageTicket(input);assert.equal(saved.actorId,'admin');assert.equal(saved.businessId,'b');assert.equal(saved.timestamp,clock());assert.deepEqual(m.triageTicket(input),saved);assert.equal(m.snapshot().outbox.length,1);
 const client=m.readTicket('owner','p',ticket.id).ticket;assert.equal(client.triage.priority,'Normal');assert.equal(client.triage.careAssessment,'needs-review');assert.equal(client.triageHistory.length,1);assert.deepEqual(Object.keys(client.triageHistory[0]).sort(),['careAssessment','note','priority','timestamp']);assert.equal(JSON.stringify(client).includes('admin'),false);
 const retry=m.createTicket(ticketInput);assert.equal(JSON.stringify(retry).includes('admin'),false);assert.equal(retry.triageHistory[0].operationId,undefined);assert.equal(m.ticketsFor('member','p')[0].triageHistory[0].actorId,undefined);
 client.triage.note='injected';saved.priority='injected';assert.equal(m.readTicket('member','p',ticket.id).ticket.triage.note,input.note);validatePortalState(m.snapshot());
});
test('Clients, disabled admins and foreign ticket/project bindings cannot assess support',()=>{
 for(const patch of [{actorId:'owner'},{actorId:'member'},{actorId:'disabled'},{actorId:'missing'},{projectId:'foreign'},{ticketId:'missing'}]){const {m,input}=setup(),before=m.snapshot();assert.throws(()=>m.triageTicket({...input,...patch}),/ACCESS_DENIED/);assert.deepEqual(m.snapshot(),before);}
});
test('Stale assessment cannot overwrite current work; historical exact retry cannot roll it back',()=>{
 const {m,ticket,input}=setup(),first=m.triageTicket(input);assert.throws(()=>m.triageTicket({...input,operationId:'stale',careAssessment:'care-included'}),/TRIAGE_CONFLICT/);
 m.triageTicket({...input,expectedDigest:m.readTicket('admin','p',ticket.id).ticket.triageDigest,operationId:'later',careAssessment:'quote-required',note:'The proposed change needs a separate quote.'});assert.deepEqual(m.triageTicket(input),first);assert.equal(m.readTicket('owner','p',ticket.id).ticket.triage.careAssessment,'quote-required');assert.equal(m.snapshot().outbox.length,1);assert.throws(()=>m.triageTicket({...input,note:'Changed retry'}),/OPERATION_CONFLICT/);validatePortalState(m.snapshot());
});
test('Assessment operation IDs cannot cross into ticket, reply, approval or progress writes',()=>{
 const {m,ticket,input}=setup();m.triageTicket(input);assert.throws(()=>m.createTicket({...ticketInput,operationId:'triage-op'}),/OPERATION_CONFLICT/);assert.throws(()=>m.replyToTicket({actorId:'owner',projectId:'p',ticketId:ticket.id,body:'Reply',operationId:'triage-op'}),/OPERATION_CONFLICT/);assert.throws(()=>m.approve({actorId:'owner',projectId:'p',milestoneId:'m',versionId:'v',operationId:'triage-op'}),/OPERATION_CONFLICT/);assert.throws(()=>m.updateProjectProgress({actorId:'admin',projectId:'p',stage:'Build',nextStep:'Check preview',expectedDigest:m.projectOverview('admin','p').progressDigest,operationId:'triage-op'}),/OPERATION_CONFLICT/);
 const other=setup();assert.throws(()=>other.m.triageTicket({...other.input,operationId:'ticket-op'}),/OPERATION_CONFLICT/);
});
test('Invalid input, failed clock and revoked admin retries leave assessment unchanged',()=>{
 for(const patch of [{priority:' '},{priority:'x'.repeat(101)},{note:'x'.repeat(2001)},{careAssessment:'automatic'},{expectedDigest:'bad'},{operationId:''}]){const {m,input}=setup(),before=m.snapshot();assert.throws(()=>m.triageTicket({...input,...patch}),/INVALID_/);assert.deepEqual(m.snapshot(),before);}
 const {m,input}=setup();m.triageTicket(input);const state=m.snapshot();state.identities.find(x=>x.id==='admin').wvdAdmin=false;const revoked=new PortalProof(state,clock);assert.throws(()=>revoked.triageTicket(input),/ACCESS_DENIED/);validatePortalState(state);
 const {m:original,input:request}=setup(),bad=new PortalProof(original.snapshot(),()=> 'bad'),before=bad.snapshot();assert.throws(()=>bad.triageTicket(request),/INVALID_SERVER_TIME/);assert.deepEqual(bad.snapshot(),before);
});
test('Assessment history corruption fails shared persistence validation',()=>{
 const {m,ticket,input}=setup();m.triageTicket(input);m.triageTicket({...input,operationId:'next',expectedDigest:m.readTicket('admin','p',ticket.id).ticket.triageDigest,priority:'Investigating'});
 for(const mutate of [s=>s.tickets[0].triage.note='tampered',s=>s.tickets[0].triageHistory[0].actorId='missing',s=>s.tickets[0].triageHistory[0].businessId='other',s=>s.tickets[0].triageHistory[0].ticketId='missing',s=>s.tickets[0].triageHistory[0].operationId='ticket-op',s=>s.tickets[0].triageHistory[0].note='tampered',s=>s.tickets[0].triageHistory[1].expectedDigest='0'.repeat(64),s=>s.tickets[0].triageHistory=[]]){const state=m.snapshot();mutate(state);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);}
});
test('Assessment persists across disk reopen and stale second-connection writes fail',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd-triage-')),path=join(dir,'state.sqlite'),a=new DurablePortal(path,seed(),clock),b=new DurablePortal(path,undefined,clock);t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const ticket=a.createTicket(ticketInput),input={actorId:'admin',projectId:'p',ticketId:ticket.id,priority:'Normal',careAssessment:'care-included',note:'Covered by the agreed maintenance scope.',expectedDigest:ticket.triageDigest,operationId:'triage'};const saved=a.triageTicket(input);assert.deepEqual(b.triageTicket(input),saved);assert.equal(b.readTicket('owner','p',ticket.id).ticket.triage.careAssessment,'care-included');assert.throws(()=>b.triageTicket({...input,operationId:'stale'}),/TRIAGE_CONFLICT/);
});
test('Assessment HTTP checks origin, current admin, exact schema and conflict status',async()=>{
 const {m,input}=setup(),handle=createBoundary({portal:m,resolveSession:async token=>({actorId:token}),allowedOrigin:'https://client.wearvalleydigital.com'}),{actorId,...payload}=input;
 const r={action:'triage-ticket',method:'POST',origin:'https://client.wearvalleydigital.com',sessionToken:'admin',rawBody:JSON.stringify(payload)};
 assert.equal((await handle({...r,sessionToken:'owner'})).status,403);assert.equal((await handle({...r,origin:'https://evil.test'})).status,403);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,actorId:'admin'})})).status,400);assert.equal((await handle(r)).status,200);assert.equal((await handle({...r,rawBody:JSON.stringify({...payload,operationId:'stale'})})).status,409);
});

test('Assessment is retained by scoped backup restore rehearsal and bounded history refuses overflow',()=>{
 const {m,ticket,input}=setup();let last;
 for(let n=0;n<200;n++){last={...input,priority:`Priority ${n}`,operationId:`assessment-${n}`,expectedDigest:m.readTicket('admin','p',ticket.id).ticket.triageDigest};m.triageTicket(last);}
 const before=m.snapshot();assert.throws(()=>m.triageTicket({...last,operationId:'overflow',expectedDigest:m.readTicket('admin','p',ticket.id).ticket.triageDigest}),/TRIAGE_CAPACITY/);assert.deepEqual(m.snapshot(),before);assert.equal(m.triageTicket(last).priority,'Priority 199');
 const binding={projectId:'demo-wvd-portal',productId:'triage-test',databaseId:'(default)',mode:'emulator'},backup=createPortalBackup({state:m.snapshot(),sourceRevision:201,binding,exportedAt:clock()});assert.equal(rehearsePortalBackup(backup,binding).verified,true);
});
