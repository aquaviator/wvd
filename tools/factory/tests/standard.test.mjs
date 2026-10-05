import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {developmentStandard,reuseCatalogue,projectPlan,standardHash} from '../standard.mjs';
import {createHash} from 'node:crypto';
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

test('new project plans inherit unattended verification without granting preview or deployment',()=>{
 const plan=projectPlan(fixture());
 assert.equal(plan.developmentVerification.preferredEnvironment,'disposable-container');
 assert.equal(plan.developmentVerification.execution,'unattended-existing-CI');
 assert.equal(plan.developmentVerification.liveCredentialsAllowed,false);
 assert.equal(plan.developmentVerification.productionDeploymentAllowed,false);
 assert.equal(plan.provisioning,false);
 assert.equal(plan.developmentContinuation.afterVerifiedSlice,'continue-next-in-scope-item');
 assert.equal(plan.developmentContinuation.productionApprovalRequired,true);
 plan.developmentContinuation.productionApprovalRequired=false;
 assert.equal(projectPlan(fixture()).developmentContinuation.productionApprovalRequired,true);
 plan.developmentVerification.liveCredentialsAllowed=true;
 assert.equal(projectPlan(fixture()).developmentVerification.liveCredentialsAllowed,false);
});
test('web projects inherit creative bundles and every-page CTA without allowing a project to disable them',()=>{
 const plan=projectPlan(fixture());assert.deepEqual(plan.webContentStandard.articleBundle,['feature-visual','short-context-video','complete-text']);assert.equal(plan.webContentStandard.cta,'relevant-primary-action-on-every-page');assert.equal(plan.webContentStandard.videoAuthoring,'HyperFrames');assert.equal(plan.webContentStandard.privacy,'private-content-excluded-from-public-search');
 plan.webContentStandard.articleBundle.pop();assert.equal(projectPlan(fixture()).webContentStandard.articleBundle.length,3);
 assert.throws(()=>projectPlan({...fixture(),webContentStandard:{cta:false}}),/Invalid product\/flavour/);
});

test('WVD plans inherit the founder authority correction without changing other products or isolated runners',()=>{
 const config=fixture();config.productId='wvd';config.bindings.dataNamespace='wvd';
 const plan=projectPlan(config);
 assert.equal(plan.productionApprovalRequired,false);
 assert.equal(plan.developmentContinuation.productionApprovalRequired,false);
 assert.deepEqual(plan.projectAuthority.specificAuthorisationTriggers,['user-supplied-data','elevated-admin-or-configuration','additional-cost']);
 assert.equal(plan.projectAuthority.grantsNewPermissions,false);
 assert.equal(plan.developmentVerification.productionDeploymentAllowed,false);
 assert.equal(plan.provisioning,false);
 plan.projectAuthority.specificAuthorisationTriggers.length=0;
 assert.equal(projectPlan(config).projectAuthority.specificAuthorisationTriggers.length,3);
 assert.equal(projectPlan(fixture()).productionApprovalRequired,true);
});

test('all product flavours inherit public discovery work without claiming verification or changing audience',()=>{
 const standard=developmentStandard();
 for(const [flavour,profile] of Object.entries(standard.flavours)){
  const config=fixture();config.flavour=flavour;
  config.reuseDecisions=profile.reuseAssetIds.map(assetId=>({assetId,decision:'adapt',reason:'Fictional fit review',evidenceRef:'fixture/review'}));
  const plan=projectPlan(config),discovery=plan.publicDiscovery;
  assert.equal(discovery.status,'NOT_VERIFIED');assert.equal(discovery.audienceChangeAllowed,false);
  assert.equal(discovery.surface,flavour==='android-application'?'public-companion-content':'public-web-content');
  assert.equal(discovery.privateData,'authenticated-and-excluded-from-public-retrieval');
  assert.equal(discovery.crawlerPolicy,'separate-search-retrieval-from-model-training');
  assert.equal(discovery.claims,'no-guaranteed-indexing-ranking-or-ai-citation');
  assert(discovery.checks.length>0);assert(discovery.checks.every(c=>c.status==='NOT_RUN'&&c.evidenceRef===null));
  assert.equal(plan.productionApprovalRequired,true);assert.equal(plan.provisioning,false);
 }
});
test('discovery results are isolated between consumers and cannot be supplied as a readiness override',()=>{
 const plan=projectPlan(fixture());plan.publicDiscovery.checks[0].status='PASS';plan.publicDiscovery.audienceChangeAllowed=true;
 const fresh=projectPlan(fixture());assert.equal(fresh.publicDiscovery.checks[0].status,'NOT_RUN');assert.equal(fresh.publicDiscovery.audienceChangeAllowed,false);
 assert.throws(()=>projectPlan({...fixture(),publicDiscovery:{status:'VERIFIED'}}),/Invalid product\/flavour/);
});
test('discovery requirements participate in the exact standard/cache fingerprint',()=>{
 const standard=developmentStandard(),catalogue=reuseCatalogue();
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 assert.equal(digest({standard,catalogue}),standardHash);
 standard.publicDiscovery.checks.push('changed-requirement');
 assert.notEqual(digest({standard,catalogue}),standardHash);
});
