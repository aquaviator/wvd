import test from 'node:test';
import assert from 'node:assert/strict';
import {FirestorePortal} from '../firestore.mjs';
import {validatePortalState} from '../state.mjs';
const seed=()=>({identities:[],projects:[{id:'p',businessId:'b'}],memberships:[],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const context={operatorRef:'synthetic-operator',changeRef:'test-change'};
const grant={uid:'o',businessId:'b',role:'Owner',projectIds:['p']};
const review={projectId:'p',milestoneId:'m',versionId:'v',title:'Review',body:'Check the heading.'};
function setup() {
 let stored;
 const doc=()=>({exists:Boolean(stored),data:()=>structuredClone(stored)});
 const db={doc:()=>({get:async()=>doc()}),runTransaction:async callback=>{
   let pending;
   const run=()=>callback({get:async()=>doc(),create:(_,value)=>{pending=structuredClone(value);},update:(_,value)=>{pending={...stored,...structuredClone(value)};}});
   // Discard first attempt to exercise retry-safe callbacks.
   await run();pending=undefined;const result=await run();if(pending)stored=pending;return result;
 }};
 const portal=new FirestorePortal({db,productId:'audit-test',clock:()=> '2026-10-02T16:00:00Z'});
 return {portal,raw:()=>structuredClone(stored),replace:value=>{stored=value;}};
}
test('operator mutations atomically record one audit each despite transaction retries',async()=>{
 const s=setup();await s.portal.initialize(seed());
 await s.portal.provisionAccess(grant,0,context);const saved=await s.portal.publishReview(review,1,context);
 const state=await s.portal.snapshot();assert.equal(state.operatorAudit.length,2);
 assert.deepEqual(state.operatorAudit[0],{id:'operator-1',revision:1,action:'provisionAccess',...context,timestamp:'2026-10-02T16:00:00Z',uid:'o',businessId:'b',role:'Owner',projectIds:['p']});
 assert.equal(state.operatorAudit[1].digest,saved.digest);assert.equal(JSON.stringify(state.operatorAudit).includes(review.body),false);
 const before=s.raw();await s.portal.publishReview(review,2,context);await s.portal.provisionAccess(grant,2,context);assert.deepEqual(s.raw(),before);
});
test('missing context, stale revision and invalid operations leave data and audit unchanged',async()=>{
 const s=setup();await s.portal.initialize(seed());const before=s.raw();
 await assert.rejects(()=>s.portal.provisionAccess(grant,0),/OPERATOR_CONTEXT_REQUIRED/);
 await assert.rejects(()=>s.portal.publishReview(review,0,{...context,secret:'bad'}),/OPERATOR_CONTEXT_REQUIRED/);
 await assert.rejects(()=>s.portal.provisionAccess(grant,1,context),/ACCESS_REVISION_CONFLICT/);
 await assert.rejects(()=>s.portal.provisionAccess({...grant,projectIds:['foreign']},0,context),/PROJECT_SCOPE_DENIED/);assert.deepEqual(s.raw(),before);
});
test('audit corruption fails closed, including revision beyond persisted aggregate',async()=>{
 const s=setup();await s.portal.initialize(seed());await s.portal.provisionAccess(grant,0,context);const valid=s.raw();
 for(const alter of [x=>x.operatorAudit.push(x.operatorAudit[0]),x=>x.operatorAudit[0].projectIds=['foreign'],x=>x.operatorAudit[0].timestamp='invalid',x=>x.operatorAudit[0].body='private',x=>x.operatorAudit[0]=null]){
  const state=JSON.parse(valid.stateJson);alter(state);assert.throws(()=>validatePortalState(state),/CORRUPT_PORTAL_STATE/);
 }
 s.replace({...valid,revision:0});await assert.rejects(()=>s.portal.snapshot(),/CORRUPT_PORTAL_STATE/);
});
test('capacity failure rolls back both grant and audit',async()=>{
 const {MAX_STATE_BYTES}=await import('../firestore.mjs');const {PortalProof}=await import('../domain.mjs');
 const s=setup(),state=new PortalProof(seed(),()=> '2026-10-02T16:00:00Z').snapshot();state.projects[0].padding='';
 state.projects[0].padding='x'.repeat(MAX_STATE_BYTES-Buffer.byteLength(JSON.stringify(state))-100);
 await s.portal.initialize(state);const before=s.raw();await assert.rejects(()=>s.portal.provisionAccess(grant,0,context),/STATE_CAPACITY/);assert.deepEqual(s.raw(),before);
});

test('Project-access updates commit before/after audit atomically and refuse role changes/stale revisions',async()=>{
 const s=setup(),state=seed();state.projects.push({id:'q',businessId:'b'});await s.portal.initialize(state);await s.portal.provisionAccess(grant,0,context);
 const updated=await s.portal.updateAccess({...grant,projectIds:['p','q']},1,context);assert.equal(updated.changed,true);const audit=(await s.portal.snapshot()).operatorAudit.at(-1);assert.equal(audit.action,'updateAccess');assert.deepEqual(audit.previousProjectIds,['p']);assert.deepEqual(audit.projectIds,['p','q']);assert.equal(audit.revision,2);
 const before=s.raw();await assert.rejects(()=>s.portal.updateAccess({...grant,projectIds:[]},1,context),/ACCESS_REVISION_CONFLICT/);await assert.rejects(()=>s.portal.updateAccess({...grant,role:'Member',projectIds:[]},2,context),/ACCESS_ROLE_CONFLICT/);await s.portal.updateAccess({...grant,projectIds:['p','q']},2,context);assert.deepEqual(s.raw(),before);
 await s.portal.updateAccess({...grant,projectIds:[]},2,context);assert.deepEqual((await s.portal.snapshot()).memberships[0].projectIds,[]);assert.deepEqual((await s.portal.snapshot()).operatorAudit.at(-1).previousProjectIds,['p','q']);
 const valid=await s.portal.snapshot();for(const mutation of [x=>x.operatorAudit.at(-1).previousProjectIds=['foreign'],x=>x.operatorAudit.at(-1).role='Admin']){const bad=structuredClone(valid);mutation(bad);assert.throws(()=>validatePortalState(bad),/CORRUPT_PORTAL_STATE/);}
});

test('Access-update capacity failure rolls back both permissions and audit',async()=>{
 const {MAX_STATE_BYTES}=await import('../firestore.mjs'),{PortalProof}=await import('../domain.mjs');const s=setup(),raw=seed();raw.identities=[{id:'o',active:true}];raw.memberships=[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p']}];
 const state=new PortalProof(raw,()=> '2026-10-02T16:00:00Z').snapshot();state.projects[0].padding='';state.projects[0].padding='x'.repeat(MAX_STATE_BYTES-Buffer.byteLength(JSON.stringify(state))-100);await s.portal.initialize(state);const before=s.raw();await assert.rejects(()=>s.portal.updateAccess({...grant,projectIds:[]},0,context),/STATE_CAPACITY/);assert.deepEqual(s.raw(),before);
});

test('Access inspection binds grants to one document revision and returns only selected membership fields',async()=>{
 const s=setup(),state=seed();state.projects.push({id:'other',businessId:'other'});state.identities=[{id:'o',active:true,wvdAdmin:true}];state.memberships=[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'o',businessId:'other',role:'Member',active:true,projectIds:['other']}];await s.portal.initialize(state);
 const before=s.raw(),read=await s.portal.inspectAccess({uid:'o',businessId:'b'});
 assert.deepEqual(read,{uid:'o',businessId:'b',role:'Owner',identityActive:true,membershipActive:true,projectIds:['p'],revision:0});read.projectIds.push('other');assert.deepEqual(s.raw(),before);
 await assert.rejects(()=>s.portal.inspectAccess({uid:'o',businessId:'b',includeAll:true}),/INVALID_ACCESS_GRANT/);await assert.rejects(()=>s.portal.inspectAccess({uid:'o',businessId:'missing'}),/ACCESS_MEMBERSHIP_REQUIRED/);
 await s.portal.updateAccess({...grant,projectIds:[]},0,context);assert.equal((await s.portal.inspectAccess({uid:'o',businessId:'b'})).revision,1);await assert.rejects(()=>s.portal.updateAccess(grant,read.revision,context),/ACCESS_REVISION_CONFLICT/);
});

test('Firestore admin account read checks current capability and leaves aggregate unchanged',async()=>{
 const s=setup(),state=seed();state.identities=[{id:'admin',active:true,wvdAdmin:true}];await s.portal.initialize(state);await s.portal.provisionAccess(grant,0,context);const before=s.raw();assert.equal((await s.portal.adminAccounts('admin','b')).accounts[0].accountId,'o');assert.deepEqual(s.raw(),before);await assert.rejects(()=>s.portal.adminAccounts('o','b'),/ACCESS_DENIED/);
});
