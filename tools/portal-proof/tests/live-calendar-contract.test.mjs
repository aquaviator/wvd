import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calendarContractCheck,createDevelopmentCalendarClient} from '../../google-development-access/calendar-contract.mjs';
const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url)));
const now=Date.parse('2026-10-04T23:30:00Z');
const reply=(body,patch={})=>({kind:'calendar#freeBusy',timeMin:body.timeMin,timeMax:body.timeMax,calendars:Object.fromEntries(body.items.map(x=>[x.id,{busy:[]}])),...patch});
const response=value=>new Response(JSON.stringify(value));
test('live-shaped responses traverse the portal adapter without exposing calendars, busy times or credentials',async()=>{
 let calls=0;
 const result=await calendarContractCheck(binding,'private-token',{now,request:async(url,options)=>{
  calls++;if(url==='https://www.gov.uk/bank-holidays.json'){assert.deepEqual(options.headers,{Accept:'application/json'});return response({'england-and-wales':{division:'england-and-wales',events:[{date:'2026-01-01'},{date:'2026-12-28'}]}});}
  assert.equal(url,'https://www.googleapis.com/calendar/v3/freeBusy');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer private-token');assert.ok(options.signal instanceof AbortSignal);
  const body=JSON.parse(options.body);assert.equal(body.timeZone,'UTC');assert.deepEqual(body.items,[...binding.calendarIds].sort().map(id=>({id})));
  const value=reply(body);value.calendars[binding.calendarIds[0]].busy=[{start:'2026-10-04T23:40:00Z',end:'2026-10-04T23:50:00Z'}];return response(value);
 }});
 assert.equal(calls,2);assert.deepEqual(result,{check:'portal-calendar-provider-contract',status:'PASS',changesMade:false,bookingReady:false});
 for(const secret of ['private-token',...binding.calendarIds,'23:40'])assert.ok(!JSON.stringify(result).includes(secret));
});
test('provider denial, incomplete calendars, wrong coverage and oversized bodies stay blocked',async()=>{
 const requests=[async()=>new Response('private error',{status:403}),async()=>{throw Error('private-token');},async()=>response({padding:'x'.repeat(70000)}),async(_url,options)=>response(reply(JSON.parse(options.body),{calendars:{}})),async(_url,options)=>response(reply(JSON.parse(options.body),{timeMin:'2026-10-04T00:00:00Z'}))];
 for(const request of requests){const result=await calendarContractCheck(binding,'private-token',{now,request});assert.equal(result.status,'BLOCKED');assert.equal(result.bookingReady,false);assert.ok(!JSON.stringify(result).includes('private'));}
});
test('bridge refuses foreign calendars, discovery payloads, retries and unbounded requests before sending credentials',async()=>{
 const client=createDevelopmentCalendarClient(binding,'token',{request:()=>assert.fail('no request')});
 const b={timeMin:'2026-10-04T12:00:00Z',timeMax:'2026-10-04T13:00:00Z',timeZone:'UTC',items:binding.calendarIds.map(id=>({id}))};
 for(const body of [{...b,items:[{id:'foreign'}]},{...b,items:[...b.items,...b.items]},{...b,groupExpansionMax:100},{...b,timeMax:'2026-10-05T12:00:00Z'}])await assert.rejects(()=>client.freebusy.query({requestBody:body},{timeout:15000,retry:false}));
 await assert.rejects(()=>client.freebusy.query({requestBody:b},{timeout:15000,retry:true}));
 await assert.rejects(()=>client.freebusy.query({requestBody:b},{timeout:60000,retry:false}));
 assert.throws(()=>createDevelopmentCalendarClient({...binding,projectId:'foreign'},'token'));
 assert.throws(()=>createDevelopmentCalendarClient(binding,''));
});
