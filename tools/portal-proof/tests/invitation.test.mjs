import test from 'node:test';
import assert from 'node:assert/strict';
import {memberInvitation} from '../invitation.mjs';
const state=()=>({identities:[{id:'o',active:true},{id:'m',active:true},{id:'admin',active:true,wvdAdmin:true}],projects:[{id:'p',businessId:'b'},{id:'q',businessId:'b'},{id:'foreign',businessId:'other'}],memberships:[{actorId:'o',businessId:'b',role:'Owner',active:true,projectIds:['p','q']},{actorId:'m',businessId:'b',role:'Member',active:true,projectIds:['p']}],milestones:[]});
const input={actorId:'o',businessId:'b',email:'colleague@example.test',projectIds:['q','p'],expiresAt:'2026-10-03T11:00:00.000Z'},policy={now:'2026-10-03T10:00:00.000Z',maxLifetimeMs:3600000};
test('Member invitation binds exact recipient, client, expiry and explicitly granted projects without state changes',()=>{
 const raw=state(),before=structuredClone(raw),result=memberInvitation(raw,input,policy);assert.equal(result.role,'Member');assert.deepEqual(result.projectIds,['p','q']);assert.match(result.digest,/^[a-f0-9]{64}$/);assert.equal(memberInvitation(raw,{...input,projectIds:['p','q']},policy).digest,result.digest);assert.notEqual(memberInvitation(raw,{...input,email:'another@example.test'},policy).digest,result.digest);assert.deepEqual(raw,before);
});
test('Members, admin status alone, revoked Owners and ungranted projects cannot delegate access',()=>{
 for(const actorId of ['m','admin','missing'])assert.throws(()=>memberInvitation(state(),{...input,actorId},policy),/ACCESS_DENIED/);
 const revoked=state();revoked.memberships[0].active=false;assert.throws(()=>memberInvitation(revoked,input,policy),/ACCESS_DENIED/);
 const limited=state();limited.memberships[0].projectIds=['p'];assert.throws(()=>memberInvitation(limited,input,policy),/ACCESS_DENIED/);
 assert.throws(()=>memberInvitation(state(),{...input,projectIds:['foreign']},policy),/ACCESS_DENIED/);
 assert.throws(()=>memberInvitation(state(),{...input,businessId:'other'},policy),/PROJECT_SCOPE_DENIED/);
});
test('No implicit recipient, role, projects or expiry policy is supplied',()=>{
 for(const patch of [{role:'Owner'},{email:'invalid'},{email:'colleague@example.test\n'},{projectIds:[]},{projectIds:['p','p']},{expiresAt:'2026-10-03T10:00:00.000Z'},{expiresAt:'2026-10-03T11:00:01.000Z'},{expiresAt:'2026-02-30T10:00:00.000Z'}])assert.throws(()=>memberInvitation(state(),{...input,...patch},policy),/INVALID_INVITATION/);
 for(const patch of [{maxLifetimeMs:undefined},{maxLifetimeMs:0},{now:'invalid'}])assert.throws(()=>memberInvitation(state(),input,{...policy,...patch}),/INVALID_INVITATION_POLICY/);
});
