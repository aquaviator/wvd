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

test('stale, future and absent-session evidence cannot silently authorise a task',async()=>{
 const {assessAccessEvidence}=await import('../access.mjs');
 const r=accessInventory(),p=accessPlan(r,{productId:'wvd',capability:'email.read',plane:'controller'});
 const options={now:'2026-10-06T15:04:37.000Z',availableConnectionIds:['controller-gmail']};
 assert.equal(assessAccessEvidence(p,options).candidates[0].state,'STALE_RECHECK_REQUIRED');
 assert.equal(assessAccessEvidence(p,{...options,availableConnectionIds:[]}).candidates[0].state,'SESSION_DISCOVERY_REQUIRED');
 p.candidates[0].evidence.at='2027-01-01T00:00:00.000Z';assert.equal(assessAccessEvidence(p,options).candidates[0].state,'STALE_RECHECK_REQUIRED');
 p.candidates[0].evidence.at=options.now;const result=assessAccessEvidence(p,options);assert.equal(result.candidates[0].state,'RECENT_EVIDENCE_RECHECK_TARGET');assert.equal(result.currentlyVerified,false);
});
