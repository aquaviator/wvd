import test from 'node:test';
import assert from 'node:assert/strict';
import {accessInventory,accessPlan,validateAccessInventory} from '../access.mjs';
test('controller email read is discoverable without granting service inbox authority',()=>{
 const r=accessInventory();assert.equal(validateAccessInventory(r).connections,9);
 const p=accessPlan(r,{productId:'wvd',capability:'email.read',plane:'controller'});assert.equal(p.candidates[0].id,'controller-gmail');assert.equal(p.currentlyVerified,false);
 assert.equal(accessPlan(r,{productId:'wvd',capability:'email.read',plane:'service'}).candidates.length,0);
 assert.throws(()=>accessPlan(r,{productId:'foreign',capability:'email.read',plane:'controller'}));
});
test('unknown access is discovery work, not an automatic founder gate; credential fields rejected',()=>{
 const r=accessInventory();assert.equal(accessPlan(r,{productId:'wvd',capability:'unknown',plane:'ci'}).status,'DISCOVER_CURRENT_TOOLS_BEFORE_REQUESTING_ACCESS');r.connections[0].accessToken='forbidden';assert.throws(()=>validateAccessInventory(r));
});
