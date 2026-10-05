import test from 'node:test';
import assert from 'node:assert/strict';
import {privateService,createPrivateDeployment,imagePrefix,serviceName} from '../../booking-runtime/private-deployment.mjs';
const image=imagePrefix+'@sha256:'+'a'.repeat(64),revision='b'.repeat(40);
test('private creation binds exact image and keeps public access and idle compute disabled',()=>{
 const s=privateService(image,revision);assert.equal(s.invokerIamDisabled,false);assert.equal(s.ingress,'INGRESS_TRAFFIC_INTERNAL_ONLY');assert.equal(s.scaling.minInstanceCount,0);assert.equal(s.scaling.maxInstanceCount,1);assert.equal(s.template.containers[0].resources.cpuIdle,true);
 assert.throws(()=>privateService(imagePrefix+':latest',revision));assert.throws(()=>privateService('https://foreign/'+image,revision));
});
test('an existing service is not overwritten or redeployed',async()=>{
 const calls=[];const result=await createPrivateDeployment(image,revision,'synthetic',{request:async(url,options)=>{calls.push(options.method);return Response.json({name:serviceName});}});
 assert.equal(result.status,'EXISTING_SERVICE_NO_CHANGE');assert.deepEqual(calls,['GET']);
});
test('unknown write outcome never retries creation',async()=>{
 const calls=[];await assert.rejects(createPrivateDeployment(image,revision,'synthetic',{request:async(url,options)=>{calls.push(options.method);if(options.method==='GET')return new Response('',{status:404});throw Error('lost response');}}));assert.deepEqual(calls,['GET','POST']);
});
test('creation polls only the bound operation then verifies private readiness',async()=>{
 let n=0;const methods=[];
 const result=await createPrivateDeployment(image,revision,'synthetic',{wait:async()=>{},request:async(url,options)=>{
  methods.push(options.method);n++;
  if(n===1)return new Response('',{status:404});
  if(n===2)return Response.json({name:'projects/wvd-development/locations/europe-west2/operations/one'});
  if(n===3)return Response.json({done:true});
  return Response.json({...privateService(image,revision),name:serviceName,terminalCondition:{state:'CONDITION_SUCCEEDED'}});
 }});assert.equal(result.status,'PRIVATE_RUNTIME_READY');assert.deepEqual(methods,['GET','POST','GET','GET']);
});
