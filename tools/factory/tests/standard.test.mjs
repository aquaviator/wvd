import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {developmentStandard,reuseCatalogue,projectPlan,standardHash} from '../standard.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('../product.example.json',import.meta.url),'utf8'));
test('project plan inherits Google, no new subscriptions and explicit discovery',()=>{const plan=projectPlan(fixture());assert.equal(plan.platform,'google');assert.equal(plan.newServiceSubscriptionsAllowed,false);assert.equal(plan.newExternalSpendGBP,0);assert.equal(plan.provisioning,false);assert.equal(plan.readiness,'NOT_DEPLOYMENT_VERIFIED');assert.equal(plan.discovery.length,3);assert.equal(plan.standardHash,standardHash);});
test('binding existing targets never claims deployment or billing verification',()=>{const config=fixture();config.bindings.googleProjectId='existing-project';config.bindings.hostingTarget='example-site';config.bindings.credentialRef='example-product/deployment';const plan=projectPlan(config);assert.deepEqual(plan.discovery,[]);assert.equal(plan.readiness,'NOT_DEPLOYMENT_VERIFIED');assert.equal(plan.productionApprovalRequired,true);});
for(const [name,change] of [
  ['provider override',x=>x.provider='another-vendor'],
  ['subscription override',x=>x.newServiceSubscriptionsAllowed=true],
  ['raw credential',x=>x.bindings.apiKey='raw-credential'],
  ['foreign data namespace',x=>x.bindings.dataNamespace='another-product'],
  ['foreign credential reference',x=>x.bindings.credentialRef='another-product/deployment'],
  ['unsupported flavour',x=>x.flavour='custom-provider'],
  ['missing reuse assessment',x=>x.reuseDecisions=[]],
  ['incomplete baseline review',x=>x.reuseDecisions.pop()],
  ['missing review evidence',x=>delete x.reuseDecisions[0].evidenceRef],
  ['unregistered candidate',x=>x.reuseDecisions[0].assetId='invented-module'],
  ['duplicate candidate',x=>x.reuseDecisions.push(x.reuseDecisions[0])]
])test(`rejects ${name}`,()=>{const config=fixture();change(config);assert.throws(()=>projectPlan(config));});
test('returned plans and catalogues cannot change future defaults',()=>{const config=fixture(),plan=projectPlan(config);plan.bindings.dataNamespace='tampered';assert.equal(config.bindings.dataNamespace,'example-product');const standard=developmentStandard();standard.platform='tampered';assert.equal(developmentStandard().platform,'google');const catalogue=reuseCatalogue();catalogue.assets.pop();assert.notEqual(catalogue.assets.length,reuseCatalogue().assets.length);});
