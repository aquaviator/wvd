import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hostingDiscovery} from '../../google-development-access/hosting-discovery.mjs';
const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url),'utf8'));
test('hosting inventory is read-only, scoped, and excludes provider secrets',async()=>{
 const calls=[];
 const report=await hostingDiscovery(binding,'synthetic',{request:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('artifactregistry')?{repositories:[{name:'projects/wvd-development/locations/europe-west2/repositories/existing-images',secret:'hidden'}]}:url.includes('run.googleapis')?{services:[]}:{permissions:['run.services.setIamPolicy']});}});
 assert.equal(report.changesMade,false);assert.equal(report.deploymentReady,false);
 assert.equal(report.results[0].complete,true);assert.equal(report.results[2].permissions[0].present,false);
 assert.ok(calls.every(c=>c.options.method==='GET'||c.url.endsWith(':testIamPermissions')));
 assert.equal(JSON.stringify(report).includes('hidden'),false);
});
test('incomplete and foreign inventory cannot establish absence or a deployable target',async()=>{
 const report=await hostingDiscovery(binding,'synthetic',{request:async url=>Response.json(url.includes('artifactregistry')?{repositories:[],nextPageToken:'more'}:url.includes('run.googleapis')?{services:[{name:'projects/another/locations/europe-west2/services/private'}]}:{})});
 assert.equal(report.results[0].status,'PARTIAL_INVENTORY');assert.equal(report.results[0].complete,false);
 assert.equal(report.results[1].status,'READ_FAILED');assert.equal(report.deploymentReady,false);
});
