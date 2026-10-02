import test from 'node:test';
import assert from 'node:assert/strict';
import {googlePreflight} from '../google-preflight.mjs';
const binding={projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'};
function runner(project,billing,calls=[]) { return args=>{calls.push(args);return JSON.stringify(calls.length===1?project:billing);}; }
const project={projectId:binding.projectId,projectNumber:'123456789',lifecycleState:'ACTIVE'};
test('Spark prerequisite produces no mutation or credential request',()=>{
 const calls=[];
 const result=googlePreflight(binding,runner(project,{projectId:binding.projectId,billingEnabled:false},calls));
 assert.equal(result.status,'BILLING_PREREQUISITE_UNMET');assert.equal(result.changesMade,false);
 assert.deepEqual(calls.map(x=>x.slice(0,3)),[['projects','describe','wvd-development'],['billing','projects','describe']]);
});
test('verified billing never claims that credentials or access exist',()=>{
 assert.equal(googlePreflight(binding,runner(project,{projectId:binding.projectId,billingEnabled:true})).status,'ACCESS_SETUP_STILL_REQUIRED');
});
test('wrong target or missing billing evidence fails closed',()=>{
 assert.throws(()=>googlePreflight(binding,runner({...project,projectId:'hv1-platform'},{})),/PROJECT_NOT_VERIFIED/);
 assert.throws(()=>googlePreflight(binding,runner(project,{projectId:binding.projectId})),/BILLING_NOT_VERIFIED/);
 assert.throws(()=>googlePreflight(binding,runner(project,{projectId:'hv1-platform',billingEnabled:true})),/BILLING_NOT_VERIFIED/);
});
test('permission failures stop instead of interpreting inaccessible data as absent',()=>{
 let calls=0;assert.throws(()=>googlePreflight(binding,()=>{calls++;throw Error('permission denied');}),/permission denied/);assert.equal(calls,1);
});
test('emulator and raw credential configuration refused before gcloud invocation',()=>{
 const run=()=>assert.fail('must not query Google');
 assert.throws(()=>googlePreflight({...binding,credential:'secret'},run),/INVALID_CONFIGURATION/);
 assert.throws(()=>googlePreflight(binding,run,{FIRESTORE_EMULATOR_HOST:'localhost:8080'}),/EMULATOR_ENVIRONMENT_FORBIDDEN/);
});
