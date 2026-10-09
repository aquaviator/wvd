import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {createBoundary} from '../boundary.mjs';
import {createDeliverableCatalogue} from '../deliverable-catalogue.mjs';
const manifest={label:'Synthetic design',sourceId:'synthetic-file',sourceVersion:'revision-1',contentSha256:'a'.repeat(64),mediaType:'text/plain'};
const entries=()=>[{id:'design-1',projectId:'p',manifest},{id:'other-1',projectId:'other',manifest:{...manifest,label:'Other project design',sourceId:'other-file'}}];
const seed=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true},{id:'member',active:true}],projects:[{id:'p',businessId:'b'},{id:'other',businessId:'different'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']},{actorId:'member',businessId:'b',role:'Member',active:true,projectIds:['p']}],milestones:[{id:'m',projectId:'p',currentVersionId:'v',status:'awaiting-client'}]});
const model=()=>new PortalProof(seed(),()=> '2026-10-03T13:20:00.000Z');
const publish={projectId:'p',milestoneId:'m',versionId:'v2',title:'Review',body:'Check the pinned file.',expectedVersionId:'v',deliverableId:'design-1'};
function boundary(portal,catalogue,actorId='admin'){const handle=createBoundary({portal,deliverableCatalogue:catalogue,allowedOrigin:'http://localhost',resolveSession:async()=>({actorId})});return (action,input,method='POST')=>handle({action,method,origin:'http://localhost',rawBody:JSON.stringify(input),sessionToken:'synthetic'});}

test('catalogue is admin/project scoped, privately copied and omits internal source/digest fields',async()=>{
 const portal=model(),input=entries(),catalogue=createDeliverableCatalogue({portal,entries:input});
 for(const actor of ['owner','member','missing'])await assert.rejects(()=>catalogue.list(actor,'p'),/ACCESS_DENIED/);
 input[0].manifest={...manifest,sourceId:'mutated'};const list=await catalogue.list('admin','p');assert.deepEqual(list,[{id:'design-1',label:manifest.label,sourceVersion:'revision-1',mediaType:'text/plain'}]);
 assert.equal(JSON.stringify(list).includes('other-file'),false);assert.equal(JSON.stringify(list).includes(manifest.contentSha256),false);
 const resolved=await catalogue.resolve('admin','p','design-1');resolved.sourceId='mutated';assert.equal((await catalogue.resolve('admin','p','design-1')).sourceId,manifest.sourceId);
 await assert.rejects(()=>catalogue.resolve('admin','p','other-1'),/INVALID_DELIVERABLE/);
});

test('HTTP publication resolves only server-registered references and rejects arbitrary manifests or foreign IDs without mutation',async()=>{
 const portal=model(),catalogue=createDeliverableCatalogue({portal,entries:entries()}),send=boundary(portal,catalogue),before=portal.snapshot();
 for(const input of [{...publish,deliverable:manifest},{...publish,sourceId:'injected'},{...publish,deliverableId:'other-1'},{...publish,deliverableId:'unknown'}])assert.equal((await send('publish-review',input)).status,400);
 assert.deepEqual(portal.snapshot(),before);
 for(const actor of ['owner','member'])assert.equal((await boundary(portal,catalogue,actor)('deliverable-catalogue',{projectId:'p'},'GET')).status,403);
 const published=await send('publish-review',publish);assert.equal(published.status,200);assert.deepEqual(published.data.deliverable,{contentSha256:manifest.contentSha256,label:manifest.label,mediaType:manifest.mediaType,sourceId:manifest.sourceId,sourceVersion:manifest.sourceVersion});
 assert.deepEqual(await send('publish-review',publish),published);assert.equal(portal.snapshot().milestones[0].reviews.length,1);
});

test('new milestone and its registered deliverable are created atomically; stale publication remains rejected',async()=>{
 const portal=model(),catalogue=createDeliverableCatalogue({portal,entries:entries()}),send=boundary(portal,catalogue),{expectedVersionId,...create}=publish;
 const created=await send('create-milestone',{...create,milestoneId:'new'});assert.equal(created.status,200);assert.equal(created.data.review.deliverable.sourceId,manifest.sourceId);
 const before=portal.snapshot();assert.equal((await send('publish-review',{...publish,milestoneId:'new',versionId:'v3',expectedVersionId:'wrong'})).status,409);assert.deepEqual(portal.snapshot(),before);
});

test('publication rechecks admin authority after catalogue resolution and never writes a partial review',async()=>{
 // Use a proxy whose publication authority can be removed during lookup.
 const real=model();let allowed=true;const proxy={publishReviewAsAdmin:request=>{if(!allowed)throw Error('ACCESS_DENIED');return real.publishReviewAsAdmin(request);}};
 const blocked=boundary(proxy,{list:async()=>[],resolve:async()=>{allowed=false;return manifest;}});
 const before=real.snapshot();assert.equal((await blocked('publish-review',publish)).status,403);assert.deepEqual(real.snapshot(),before);
});

test('invalid catalogue bindings and unavailable references fail closed without source/provider access',async()=>{
 const portal=model();for(const input of [undefined,[{...entries()[0],url:'https://untrusted.test'}],[{...entries()[0],id:'invalid/id'}],[entries()[0],entries()[0]],[{...entries()[0],manifest:{...manifest,contentSha256:'bad'}}],Array.from({length:201},(_,i)=>({...entries()[0],id:'id-'+i}))])assert.throws(()=>createDeliverableCatalogue({portal,entries:input}),/INVALID_CONFIGURATION/);
 assert.deepEqual((await boundary(portal,undefined)('deliverable-catalogue',{projectId:'p'},'GET')).data,[]);
 assert.equal((await boundary(portal,undefined)('publish-review',publish)).status,400);assert.equal(portal.snapshot().milestones[0].reviews,undefined);
});
