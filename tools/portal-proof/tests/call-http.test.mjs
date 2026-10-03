import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createCallAvailabilityHandler} from '../call-http.mjs';
import {createIntroCallScreening} from '../call-screening.mjs';
import {createGoogleCallEvidenceReader} from '../google-calendar-evidence.mjs';
import {createApplication} from '../app.mjs';
const origin='https://www.example.test',start='2026-10-02T08:00:00.000Z';
const holidays={bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2026-12-31',bankHolidays:[],sourceRef:'synthetic'};
const slot={start,end:'2026-10-02T08:30:00.000Z',timeZone:'Europe/London'};
const configure=(patch={})=>createCallAvailabilityHandler({screen:async()=>({slots:[slot],provisional:true}),allowedOrigin:origin,holidayEvidence:holidays,maxConcurrentRequests:1,...patch});
async function invoke(handler,body={starts:[start]},patch={}){
  const request=Object.assign(Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]),{url:'/api/calls/availability',method:'POST',headers:{origin,'content-type':'application/json'},...patch});
  const result={},response={headersSent:false,writeHead(status,headers){Object.assign(result,{status,headers});this.headersSent=true;},end(raw){result.body=JSON.parse(raw);},destroy(){result.destroyed=true;}};
  await handler(request,response);return result;
}
test('public candidates compose with Google evidence and shared rules without registration or private calendar output',async()=>{
  let queries=0;const readEvidence=createGoogleCallEvidenceReader({calendarIds:['private-calendar'],clock:()=> '2026-10-01T08:00:00.000Z',maxQueryWindowMs:86400000,requestTimeoutMs:1000,calendar:{freebusy:{query:async({requestBody})=>{queries++;return {data:{kind:'calendar#freeBusy',timeMin:requestBody.timeMin,timeMax:requestBody.timeMax,calendars:{'private-calendar':{busy:[]}}}};}}}});
  const screen=createIntroCallScreening({readEvidence,clock:()=> '2026-10-01T08:00:00.000Z',policy:{ref:'synthetic',bufferBoundary:'between-events',maxEvidenceAgeMs:60000}});
  const result=await invoke(configure({screen}));assert.equal(result.status,200);assert.deepEqual(result.body,{slots:[slot],provisional:true});assert.equal(queries,1);assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(JSON.stringify(result).includes('private-calendar'),false);
});
test('untrusted fields, invalid candidates and transport errors cannot trigger screening',async()=>{
  let calls=0;const handler=configure({screen:async()=>{calls++;assert.fail();}});
  for(const [body,patch,status]of [[{starts:[start],calendarIds:['foreign']},{},400],[{starts:[start],holidayEvidence:holidays},{},400],[{starts:[start,start]},{},400],[{starts:['tomorrow']},{},400],['{',{},400],[' '.repeat(8193),{},413],[{starts:[start]},{url:'/api/calls/availability?calendar=foreign'},400],[{starts:[start]},{method:'GET'},405],[{starts:[start]},{headers:{origin:'https://foreign.example','content-type':'application/json'}},403],[{starts:[start]},{headers:{origin,'content-type':'text/plain'}},415]])assert.equal((await invoke(handler,body,patch)).status,status);
  assert.equal(calls,0);
});
test('bounded admission rejects overlapping lookups and releases capacity after a provider failure',async()=>{
  let release;const waiting=new Promise(resolve=>{release=resolve;});let calls=0;const handler=configure({screen:async()=>{calls++;if(calls===1){await waiting;throw Error('private credential');}return {slots:[slot],provisional:true};}});
  const first=invoke(handler);await new Promise(resolve=>setImmediate(resolve));assert.equal((await invoke(handler)).status,503);assert.equal(calls,1);release();assert.deepEqual((await first).body,{error:'SERVICE_UNAVAILABLE'});assert.equal((await invoke(handler)).status,200);assert.equal(calls,2);
});
test('server holiday binding survives caller and adapter mutation; output projects only valid public slots',async()=>{
  const mutable=structuredClone(holidays);let calls=0;const handler=configure({holidayEvidence:mutable,screen:async input=>{assert.deepEqual(input.holidayEvidence.bankHolidays,[]);input.holidayEvidence.bankHolidays.push('2026-10-02');calls++;return {slots:[{...slot,calendarId:'private',reason:'private'}],provisional:true,private:'secret'};}});mutable.bankHolidays.push('2026-10-02');
  for(let i=0;i<2;i++)assert.deepEqual((await invoke(handler)).body,{slots:[slot],provisional:true});assert.equal(calls,2);
  for(const result of [{slots:[{...slot,start:'2026-10-03T08:00:00.000Z'}],provisional:true},{slots:[{...slot,end:start}],provisional:true},{slots:[slot,slot],provisional:true},{slots:[slot],provisional:false}])assert.equal((await invoke(configure({screen:async()=>result}))).status,503);
});
test('origin, holidays and capacity must be explicitly bound',()=>{
  for(const patch of [{allowedOrigin:'http://public.example'},{allowedOrigin:'https://example.test/path'},{holidayEvidence:{...holidays,bankHolidayRegion:'scotland'}},{maxConcurrentRequests:undefined},{maxConcurrentRequests:0},{screen:undefined}])assert.throws(()=>configure(patch),/INVALID_CONFIGURATION/);
});
test('development application cannot expose the optional call adapter outside isolated emulator mode',()=>assert.throws(()=>createApplication({allowedOrigin:origin,callAvailability:{}}),/ISOLATED_EMULATORS_REQUIRED/));
