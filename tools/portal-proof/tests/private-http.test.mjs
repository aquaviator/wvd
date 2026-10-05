import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePrivateHttp,verifyPrivateHttp} from '../../booking-runtime/private-http.mjs';
import {privateService,serviceName,imagePrefix} from '../../booking-runtime/private-deployment.mjs';
const url='https://wvd-booking-development-6616382131.europe-west2.run.app';
const image=imagePrefix+'@sha256:120456cea9b0f4c873ae2c24113ff0f235a0593ca592e2bcaa87c0d50aa9891f';
test('authenticated HTTP requires provider-checked health and keeps tokens out of reports',async()=>{
 const r=await verifyPrivateHttp(url,'synthetic',{request:async(u,o)=>{assert.equal(u,url+'/health');assert.equal(o.headers.Authorization,'Bearer synthetic');assert.equal(o.redirect,'error');return Response.json({status:'RUNNING',providerAccessChecked:true,providerCheckedAt:'2026-10-05T10:00:00Z'});}});assert.equal(r.status,'PRIVATE_HTTP_PASS');assert.equal(JSON.stringify(r).includes('synthetic'),false);
 await assert.rejects(verifyPrivateHttp('https://foreign.example','synthetic'));
 await assert.rejects(verifyPrivateHttp(url,'synthetic',{request:async()=>Response.json({status:'RUNNING',providerAccessChecked:false})}));
});
test('network change is etag-bound, preserves IAM, and restores internal ingress on unexpected anonymous access',async()=>{
 const patches=[],service={...privateService(image,'a'.repeat(40)),name:serviceName,uri:url,etag:'current'};
 const request=async(u,o={})=>{
  if(u===url+'/health')return new Response('',{status:200});
  if(u.endsWith(':testIamPermissions'))return Response.json({permissions:['run.routes.invoke']});
  if(o.method==='PATCH'){const body=JSON.parse(o.body);patches.push(body);assert.equal(body.etag,'current');assert.equal(body.invokerIamDisabled,undefined);return Response.json({name:'projects/wvd-development/locations/europe-west2/operations/test',done:true});}
  return Response.json(service);
 };
 await assert.rejects(preparePrivateHttp('synthetic',{request}),/INTERNAL_RESTORE_REQUESTED/);
 assert.deepEqual(patches.map(x=>x.ingress),['INGRESS_TRAFFIC_ALL','INGRESS_TRAFFIC_INTERNAL_ONLY']);
});
