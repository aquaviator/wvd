import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalProof} from '../domain.mjs';
import {DurablePortal} from '../durable.mjs';
import {validatePortalState} from '../state.mjs';
import {createBoundary} from '../boundary.mjs';
const state=()=>({identities:[{id:'admin',active:true,wvdAdmin:true},{id:'owner',active:true}],projects:[{id:'p',businessId:'b'}],memberships:[{actorId:'owner',businessId:'b',role:'Owner',active:true,projectIds:['p']}],milestones:[]});
const input={actorId:'admin',businessId:'new-client',projectId:'new-project',stage:'Discovery',nextStep:'Assign account access'};
const clock=()=> '2026-10-03T10:00:00Z';
test('New-client creation reuses project progress, records creator/time and grants no account permissions',()=>{
 const portal=new PortalProof(state(),clock),before=portal.snapshot();const result=portal.createClientAsAdmin(input),saved=portal.snapshot();validatePortalState(saved);
 assert.equal(result.businessId,'new-client');assert.equal(saved.projects.at(-1).createdForNewClient,true);assert.equal(saved.projects.at(-1).createdByActorId,'admin');assert.equal(saved.projects.at(-1).createdAt,clock());assert.equal(saved.projects.at(-1).progressHistory[0].stage,'Discovery');assert.deepEqual(saved.identities,before.identities);assert.deepEqual(saved.memberships,before.memberships);assert.deepEqual(portal.adminAccounts('admin','new-client').accounts,[]);assert.equal(portal.projectsFor('owner').length,1);
});
test('Exact creation retry preserves subsequent progress; changed payload cannot roll it back',()=>{
 const portal=new PortalProof(state(),clock),created=portal.createClientAsAdmin(input);portal.updateProjectProgress({actorId:'admin',projectId:input.projectId,stage:'Build',nextStep:'Review',expectedDigest:created.initialProgress.digest,operationId:'later'});const before=portal.snapshot();assert.deepEqual(portal.createClientAsAdmin(input),created);assert.deepEqual(portal.snapshot(),before);assert.throws(()=>portal.createClientAsAdmin({...input,nextStep:'Changed'}),/OPERATION_CONFLICT/);assert.deepEqual(portal.snapshot(),before);
});
test('Clients, disabled admins, business takeover, reused project IDs and invalid text fail without mutation',()=>{
 const portal=new PortalProof(state(),clock),before=portal.snapshot();for(const [patch,error] of [[{actorId:'owner'},'ACCESS_DENIED'],[{businessId:'b'},'CLIENT_CONFLICT'],[{projectId:'p'},'PROJECT_CONFLICT'],[{businessId:' '},'INVALID_TEXT'],[{nextStep:' '},'INVALID_TEXT']])assert.throws(()=>portal.createClientAsAdmin({...input,...patch}),new RegExp(error));assert.deepEqual(portal.snapshot(),before);
 const disabled=state();disabled.identities[0].active=false;assert.throws(()=>new PortalProof(disabled,clock).createClientAsAdmin(input),/ACCESS_DENIED/);
});
test('New-client marker cannot be adopted from an existing project or duplicated within a business',()=>{
 const portal=new PortalProof(state(),clock);portal.createProjectAsAdmin({...input,businessId:'b'});assert.throws(()=>portal.createClientAsAdmin({...input,businessId:'b'}),/CLIENT_CONFLICT/);
 const fresh=new PortalProof(state(),clock);fresh.createClientAsAdmin(input);fresh.createProjectAsAdmin({...input,projectId:'second'});const bad=fresh.snapshot();bad.projects.at(-1).createdForNewClient=true;assert.throws(()=>validatePortalState(bad),/CORRUPT_PORTAL_STATE/);
 const missing=state();missing.projects[0].createdForNewClient=true;assert.throws(()=>validatePortalState(new PortalProof(missing,clock).snapshot()),/CORRUPT_PORTAL_STATE/);
});
test('New-client capacity is bounded; existing-client project workflow remains usable',()=>{
 const raw=state();for(let i=1;i<200;i++)raw.projects.push({id:`p-${i}`,businessId:`b-${i}`});const portal=new PortalProof(raw,clock),before=portal.snapshot();assert.throws(()=>portal.createClientAsAdmin(input),/CLIENT_CAPACITY/);assert.deepEqual(portal.snapshot(),before);assert.equal(portal.createProjectAsAdmin({...input,businessId:'b'}).projectId,input.projectId);
});
test('Creation boundary enforces verified admin, origin and exact input fields',async()=>{
 const portal=new PortalProof(state(),clock),handle=createBoundary({portal,resolveSession:async token=>token?{actorId:token}:null,allowedOrigin:'https://portal.example'});const {actorId,...body}=input;const request={action:'create-client',method:'POST',origin:'https://portal.example',sessionToken:'admin',rawBody:JSON.stringify(body)};
 for(const [patch,status] of [[{sessionToken:'owner'},403],[{sessionToken:null},401],[{origin:'https://evil.example'},403],[{method:'GET'},405],[{rawBody:JSON.stringify({...body,actorId:'admin'})},400],[{rawBody:JSON.stringify({...body,businessId:'b'})},409]])assert.equal((await handle({...request,...patch})).status,status);assert.equal((await handle(request)).status,200);
});
test('Durable client creation retains isolation and retries after reopen of stored model',()=>{
 const portal=new DurablePortal(':memory:',state(),clock);try{const created=portal.createClientAsAdmin(input),snapshot=portal.snapshot();assert.deepEqual(new PortalProof(snapshot,clock).createClientAsAdmin(input),created);assert.equal(portal.adminAccounts('admin','new-client').accounts.length,0);assert.equal(portal.projectsFor('owner').length,1);validatePortalState(snapshot);}finally{portal.close();}
});
