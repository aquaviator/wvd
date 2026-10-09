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
test('upstream errors with HTTP metadata cannot disclose private provider messages',async()=>{
  const handler=configure({screen:async()=>{throw Object.assign(Error('Private calendar mailbox'),{httpStatus:400});}});
  const result=await invoke(handler);assert.equal(result.status,503);assert.deepEqual(result.body,{error:'SERVICE_UNAVAILABLE'});
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
test('real development HTTP endpoint is public while portal routes still require authentication',async t=>{
  const saved={auth:process.env.FIREBASE_AUTH_EMULATOR_HOST,firestore:process.env.FIRESTORE_EMULATOR_HOST};
  process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
  const allowedOrigin='http://localhost';let server;
  t.after(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}for(const [key,value]of [['FIREBASE_AUTH_EMULATOR_HOST',saved.auth],['FIRESTORE_EMULATOR_HOST',saved.firestore]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  server=createApplication({portal:{},auth:{resolveSession:async()=>null},allowedOrigin,firebaseEmulator:{projectId:'demo-wvd-call',productId:'wvd-call',databaseId:'(default)',mode:'emulator'},callAvailability:{screen:async()=>({slots:[slot],provisional:true}),holidayEvidence:holidays,maxConcurrentRequests:1}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(base+'/api/calls/availability',{method:'POST',headers:{Origin:allowedOrigin,'Content-Type':'application/json'},body:JSON.stringify({starts:[start]})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{slots:[slot],provisional:true});
  assert.equal((await fetch(base+'/api/portal/projects')).status,401);
  assert.equal((await fetch(base+'/api/calls/availability',{method:'POST',headers:{Origin:'http://foreign.example','Content-Type':'application/json'},body:JSON.stringify({starts:[start]})})).status,403);
});

test('dynamic server holiday reads run inside admission, remain private and cannot be overridden by client fields',async()=>{
 let reads=0,screens=0;const shared=structuredClone(holidays);
 const handler=configure({holidayEvidence:undefined,readHolidayEvidence:async()=>{reads++;return shared;},screen:async({holidayEvidence})=>{screens++;holidayEvidence.bankHolidays.push('2026-10-02');return {slots:[slot],provisional:true};}});
 for(let i=0;i<2;i++)assert.equal((await invoke(handler)).status,200);
 assert.equal(reads,2);assert.equal(screens,2);assert.deepEqual(shared.bankHolidays,[]);
 assert.deepEqual((await invoke(handler,{starts:[]})).body,{slots:[],provisional:true});assert.equal(reads,2);assert.equal(screens,2);
 assert.equal((await invoke(handler,{starts:[start],holidayEvidence:holidays})).status,400);assert.equal(reads,2);
 for(const readHolidayEvidence of [async()=>{throw Error('private-source-data');},async()=>({})]){const result=await invoke(configure({holidayEvidence:undefined,readHolidayEvidence}));assert.equal(result.status,503);assert.deepEqual(result.body,{error:'SERVICE_UNAVAILABLE'});}
 assert.throws(()=>configure({readHolidayEvidence:async()=>holidays}),/INVALID_CONFIGURATION/);
});
