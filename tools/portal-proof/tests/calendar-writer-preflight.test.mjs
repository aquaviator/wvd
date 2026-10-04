import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarWriterPreflight} from '../../google-development-access/calendar-writer-preflight.mjs';
const b=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url))),id=b.calendarIds[0],marker='synthetic-marker',tag=`WVD grant check ${marker}`;
const response=(value,status=200)=>status===204?new Response(null,{status}):new Response(JSON.stringify(value),{status});
test('existing writer role is verified with one metadata read and no mutation',async()=>{
 let calls=0;const result=await calendarWriterPreflight(b,'private-token',{marker,request:async(url,options)=>{calls++;assert.ok(url.includes('/users/me/calendarList/'));assert.ok(!url.includes('/events'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');return response({id,accessRole:'writer'});}});
 assert.equal(result.status,'PASS');assert.equal(result.calendarEventsChanged,false);assert.equal(result.serviceAccountListCleanup,'NOT_NEEDED');assert.equal(calls,1);assert.ok(!JSON.stringify(result).includes('private-token'));assert.ok(!JSON.stringify(result).includes(id));
});
test('missing entry is tagged in the service account list and cleaned up after writer inspection',async()=>{
 const methods=[];let row;
 const result=await calendarWriterPreflight(b,'token',{marker,request:async(url,options)=>{methods.push(options.method);assert.ok(!url.includes('/events'));if(options.method==='GET')return row?response(row):response({},404);if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.id,id);assert.equal(body.summaryOverride,tag);assert.equal(body.hidden,true);assert.deepEqual(body.notificationSettings,{notifications:[]});row={id,accessRole:'writer',summaryOverride:tag};return response(row);}return response(null,204);}});
 assert.equal(result.status,'PASS');assert.equal(result.serviceAccountListCleanup,'REMOVED');assert.deepEqual(methods,['GET','POST','GET','DELETE']);
});
test('read-only or owner grants block; no existing subscription is changed',async()=>{
 for(const accessRole of ['freeBusyReader','reader','owner',undefined]){const result=await calendarWriterPreflight(b,'token',{marker,request:async(_url,options)=>{assert.equal(options.method,'GET');return response({id,accessRole});}});assert.equal(result.status,'BLOCKED');assert.equal(result.serviceAccountListCleanup,'NOT_NEEDED');}
});
test('ambiguous insertion cleans up only an entry bearing this check marker',async()=>{
 for(const own of [true,false]){
  let reads=0,deletes=0;
  const result=await calendarWriterPreflight(b,'token',{marker,request:async(_url,options)=>{if(options.method==='GET')return ++reads===1?response({},404):response({id,accessRole:'writer',summaryOverride:own?tag:'another-process'});if(options.method==='POST')throw Error('private provider failure');deletes++;return response(null,204);}});
  assert.equal(result.status,'BLOCKED');assert.equal(deletes,own?1:0);assert.equal(result.serviceAccountListCleanup,own?'REMOVED':'ENTRY_NOT_OWNED_BY_CHECK');assert.ok(!JSON.stringify(result).includes('private'));
 }
});
test('cleanup failure blocks success; denied metadata does not cause a write',async()=>{
 let reads=0;
 const failed=await calendarWriterPreflight(b,'token',{marker,request:async(_url,options)=>{if(options.method==='GET')return ++reads===1?response({},404):response({id,accessRole:'writer',summaryOverride:tag});if(options.method==='POST')return response({id,accessRole:'writer'});return response({},403);}});assert.equal(failed.status,'BLOCKED');assert.equal(failed.serviceAccountListCleanup,'CLEANUP_FAILED');
 const denied=await calendarWriterPreflight(b,'token',{marker,request:async(_url,options)=>{assert.equal(options.method,'GET');return response({},403);}});assert.equal(denied.status,'BLOCKED');
 await assert.rejects(()=>calendarWriterPreflight({...b,calendarIds:[b.calendarIds[1]]},'token',{request:()=>assert.fail()}),/INVALID_CONFIGURATION/);
});
