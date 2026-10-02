import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PortalProof} from '../domain.mjs';
import {createPortalBackup,verifyPortalBackup,rehearsePortalBackup} from '../backup.mjs';
const binding={projectId:'demo-wvd-portal',productId:'wvd-test',databaseId:'(default)',mode:'emulator'};
function fixture(){
 const p=new PortalProof({identities:[{id:'o',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]},()=> '2026-10-02T18:00:00Z');
 const r=p.publishReview({projectId:'p',milestoneId:'m',versionId:'v',title:'Review',body:'Exact reviewed text.'});
 p.submitFeedback({actorId:'o',projectId:'p',milestoneId:'m',versionId:'v',operationId:'f',body:'Saved feedback.'});
 p.approve({actorId:'o',projectId:'p',milestoneId:'m',versionId:'v',operationId:'a',reviewDigest:r.digest});
 const ticket=p.createTicket({actorId:'o',projectId:'p',type:'question',subject:'Question',body:'Saved question.',operationId:'t'});
 p.replyToTicket({actorId:'o',projectId:'p',ticketId:ticket.id,operationId:'reply',body:'Saved reply.'});return p.snapshot();
}
const make=state=>createPortalBackup({state:state??fixture(),sourceRevision:7,binding,exportedAt:'2026-10-02T18:01:00Z'});
test('scoped backup restores exact review, receipts, feedback and conversation to isolated reopened disk',()=>{
 const raw=make(),verified=verifyPortalBackup(raw,binding);assert.deepEqual(verified.state,fixture());
 assert.deepEqual(rehearsePortalBackup(raw,binding),{verified:true,digest:verified.digest,sourceRevision:7,receipts:1,feedback:1,tickets:1,replies:1,operatorEntries:0,liveWrites:false});
 verified.state.receipts.pop();assert.equal(verifyPortalBackup(raw,binding).state.receipts.length,1);
});
test('wrong product, project, database or mode cannot reuse a backup',()=>{
 const raw=make();for(const target of [{...binding,productId:'foreign-product'},{...binding,projectId:'demo-foreign'},{...binding,databaseId:'foreign-db'},{...binding,mode:'live',projectId:'wvd-live'}])assert.throws(()=>rehearsePortalBackup(raw,target),/BACKUP_SCOPE_DENIED/);
});
test('tampering, unsupported schemas, incomplete state and oversized input fail before rehearsal',()=>{
 const raw=make();const envelope=JSON.parse(raw);envelope.stateJson=envelope.stateJson.replace('Exact reviewed text.','Changed text');assert.throws(()=>verifyPortalBackup(JSON.stringify(envelope),binding),/INVALID_BACKUP/);
 // Recomputed checksum is not authority: relational/content validation still applies.
 const {digest,...data}=envelope;envelope.digest=createHash('sha256').update(JSON.stringify(data)).digest('hex');assert.throws(()=>verifyPortalBackup(JSON.stringify(envelope),binding),/INVALID_BACKUP/);
 for(const invalid of ['{bad',JSON.stringify({...JSON.parse(raw),schemaVersion:2}),JSON.stringify({...JSON.parse(raw),secret:'bad'}),'x'.repeat(600000)])assert.throws(()=>verifyPortalBackup(invalid,binding),/INVALID_BACKUP/);
 const state=fixture();state.outbox.pop();assert.throws(()=>make(state),/CORRUPT_PORTAL_STATE/);
});

test('trusted export captures source revision and state from a single read',async()=>{
 const {exportPortalBackup}=await import('../backup.mjs');let reads=0;
 const raw=await exportPortalBackup({backupSnapshot:async()=>{reads++;return{state:fixture(),revision:9,binding};}},binding,()=> '2026-10-02T18:02:00Z');
 assert.equal(reads,1);assert.equal(verifyPortalBackup(raw,binding).sourceRevision,9);
});

test('trusted export cannot relabel another product snapshot',async()=>{
 const {exportPortalBackup}=await import('../backup.mjs');
 await assert.rejects(()=>exportPortalBackup({backupSnapshot:async()=>({state:fixture(),revision:1,binding:{...binding,productId:'foreign-product'}})},binding),/BACKUP_SCOPE_DENIED/);
});
