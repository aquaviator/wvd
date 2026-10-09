import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accessPreflight} from '../../google-development-access/preflight.mjs';
const b=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url)));
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
function mock(calls=[],calendarError=false){return async(url,options)=>{
 calls.push({url,options});
 if(url.includes('/drive/'))return response({id:b.driveFileIds[0],trashed:false});
 const body=JSON.parse(options.body);return response({timeMin:body.timeMin,timeMax:body.timeMax,calendars:Object.fromEntries(b.calendarIds.map(id=>[id,calendarError?{errors:[{reason:'notFound'}]}:{busy:[]}]))});
};}
test('uses explicit targets and scopes; returns no private data or bearer token',async()=>{
 const calls=[],r=await accessPreflight(b,'private-token',{request:mock(calls)});
 assert.equal(r.status,'PASS');assert.equal(r.changesMade,false);assert.equal(calls.length,2);
 assert.equal(calls[0].options.redirect,'error');assert.equal(calls[1].options.method,'POST');
 assert.deepEqual(JSON.parse(calls[1].options.body).items,b.calendarIds.map(id=>({id})));
 for(const value of ['private-token',...b.driveFileIds,...b.calendarIds])assert.ok(!JSON.stringify(r).includes(value));
});
test('denied/missing Drive access and Calendar item errors block integration',async()=>{
 const r=await accessPreflight(b,'token',{request:async(url,options)=>url.includes('/drive/')?response({},403):mock([],true)(url,options)});
 assert.equal(r.status,'BLOCKED');assert.deepEqual(r.results.map(x=>x.status),['ACCESS_DENIED_OR_API_DISABLED','INVALID_OR_INCOMPLETE_RESPONSE']);
});
test('invalid binding or missing credential makes zero requests',async()=>{
 const request=()=>assert.fail('no provider request');
 await assert.rejects(()=>accessPreflight({...b,projectId:'hv1-platform'},'token',{request}),/INVALID_ACCESS_BINDING/);
 await assert.rejects(()=>accessPreflight({...b,driveFileIds:['bad/id']},'token',{request}),/INVALID_ACCESS_BINDING/);
 await assert.rejects(()=>accessPreflight(b,'',{request}),/CREDENTIAL_REQUIRED/);
});
test('malformed, oversized and failed provider responses cannot pass or leak errors',async()=>{
 for(const request of [async()=>response({padding:'x'.repeat(70000)}),async()=>new Response('invalid-json'),async()=>{throw Error('private-token');}]){
  const r=await accessPreflight(b,'private-token',{request});assert.equal(r.status,'BLOCKED');assert.ok(!JSON.stringify(r).includes('private-token'));
 }
});
test('mismatched Drive identity, trashed files and incomplete coverage fail closed',async()=>{
 for(const value of [{id:'foreign',trashed:false},{id:b.driveFileIds[0],trashed:true}]){
  const r=await accessPreflight(b,'token',{request:async()=>response(value)});assert.equal(r.status,'BLOCKED');
 }
});

test('one missing or denied required calendar blocks the whole conflict set',async()=>{
 for(const failure of ['missing','denied']){
  const r=await accessPreflight(b,'token',{request:async(url,options)=>{
   if(url.includes('/drive/'))return response({id:b.driveFileIds[0],trashed:false});
   const body=JSON.parse(options.body),calendars=Object.fromEntries(b.calendarIds.map(id=>[id,{busy:[]}]));
   if(failure==='missing')delete calendars[b.calendarIds.at(-1)];
   else calendars[b.calendarIds.at(-1)]={errors:[{reason:'forbidden'}]};
   return response({timeMin:body.timeMin,timeMax:body.timeMax,calendars});
  }});assert.equal(r.status,'BLOCKED');assert.equal(r.calendarResults.at(-1).status,failure==='missing'?'INVALID_OR_INCOMPLETE_RESPONSE':'TARGET_NOT_FOUND_OR_NOT_SHARED');
 }
});
