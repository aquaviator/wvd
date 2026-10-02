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
