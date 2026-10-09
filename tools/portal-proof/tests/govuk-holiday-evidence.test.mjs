import test from 'node:test';
import assert from 'node:assert/strict';
import {createGovukHolidayEvidenceReader,GOVUK_HOLIDAY_SOURCE} from '../govuk-holiday-evidence.mjs';
import {createIntroCallScreening} from '../call-screening.mjs';
const now='2026-10-01T08:00:00.000Z';
const payload=()=>({'england-and-wales':{division:'england-and-wales',events:[{date:'2026-12-28',title:'private-unused-title'},{date:'2026-01-01'},{date:'2026-12-25'}]},scotland:{events:[{date:'2026-10-02'}]}});
function reader(request,patch={}){return createGovukHolidayEvidenceReader({request,clock:()=>now,requestTimeoutMs:15000,...patch});}
const response=value=>new Response(JSON.stringify(value));
test('only official England/Wales dates are projected with conservative publication horizon and pre-request observation',async()=>{
 let time=now;
 const read=reader(async(url,options)=>{assert.equal(url,GOVUK_HOLIDAY_SOURCE);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.deepEqual(options.headers,{Accept:'application/json'});assert.ok(options.signal instanceof AbortSignal);time='2026-10-01T08:10:00.000Z';return response(payload());},{clock:()=>time});
 const result=await read();assert.equal(result.observedAt,now);assert.equal(result.coveredFrom,'2026-01-01');assert.equal(result.coveredThrough,'2026-12-28');assert.deepEqual(result.bankHolidays,['2026-01-01','2026-12-25','2026-12-28']);assert.equal(result.sourceRef,`${GOVUK_HOLIDAY_SOURCE}#england-and-wales`);assert.ok(!JSON.stringify(result).includes('private'));
 result.bankHolidays.length=0;assert.equal((await read()).bankHolidays.length,3);
});
test('outage, redirects, malformed/oversized/truncated data and wrong division never become an empty holiday list',async()=>{
 const malformed=[{}, {'england-and-wales':{division:'scotland',events:payload()['england-and-wales'].events}}, {'england-and-wales':{division:'england-and-wales',events:[]}}];
 for(const alter of [p=>p['england-and-wales'].events.push({date:'2026-02-30'}),p=>p['england-and-wales'].events.push({date:'2026-01-01'}),p=>p['england-and-wales'].events.push({date:'2028-01-01'}),p=>p['england-and-wales'].events[0].date=undefined]){const p=payload();alter(p);malformed.push(p);}
 const requests=[...malformed.map(p=>async()=>response(p)),async()=>new Response('private error',{status:503}),async()=>new Response('{'),async()=>response({padding:'x'.repeat(262145)}),async()=>{throw Error('private provider error');}];
 for(const request of requests)await assert.rejects(()=>reader(request)(),error=>error.message==='HOLIDAY_EVIDENCE_UNAVAILABLE');
 for(const patch of [{requestTimeoutMs:0},{requestTimeoutMs:16000},{clock:undefined}])assert.throws(()=>reader(async()=>response(payload()),patch),/INVALID_CONFIGURATION/);
 await assert.rejects(()=>reader(async()=>assert.fail('no request'),{clock:()=> 'invalid'})(),/HOLIDAY_EVIDENCE_UNAVAILABLE/);
});
const policy={ref:'synthetic-fresh-holidays',bufferBoundary:'between-events',maxEvidenceAgeMs:60000,holidayMaxEvidenceAgeMs:60000};
const evidence=async()=>reader(async()=>response(payload()))();
function screen(clock,readEvidence){return createIntroCallScreening({clock,policy,readEvidence});}
const calendar=async window=>({complete:true,observedAt:now,requiredCalendarIds:['synthetic'],calendars:[{id:'synthetic',status:'ok',busy:[],coveredStart:window.coveredStart,coveredEnd:window.coveredEnd}],...window.holidayEvidence});
test('stale, future or unauthoritative holiday evidence denies screening before any Calendar query',async()=>{
 for(const patch of [{observedAt:'2026-10-01T07:58:00.000Z'},{observedAt:'2026-10-01T08:01:00.000Z'},{observedAt:undefined},{sourceRef:'foreign'}])await assert.rejects(async()=>screen(()=>now,()=>assert.fail('no Calendar read'))({starts:['2026-10-02T08:00:00.000Z'],holidayEvidence:{...await evidence(),...patch}}),/HOLIDAY_EVIDENCE_UNAVAILABLE/);
 for(const age of [undefined,-1,604800001,Infinity])assert.throws(()=>createIntroCallScreening({clock:()=>now,readEvidence:calendar,policy:{...policy,holidayMaxEvidenceAgeMs:age}}),/INVALID_CONFIGURATION/);
});
test('holiday freshness is rechecked after Calendar latency; bank holidays cannot trigger Calendar reads',async()=>{
 let tick=0;await assert.rejects(async()=>screen(()=>tick++===0?now:'2026-10-01T08:01:01.000Z',calendar)({starts:['2026-10-02T16:30:00.000Z'],holidayEvidence:await evidence()}),/HOLIDAY_EVIDENCE_UNAVAILABLE/);
 const fresh=await evidence();const result=await screen(()=>now,()=>assert.fail('holiday must not query Calendar'))({starts:['2026-12-25T10:00:00.000Z'],holidayEvidence:fresh});assert.deepEqual(result,{slots:[],provisional:true});
 assert.equal((await screen(()=>now,calendar)({starts:['2026-10-02T08:00:00.000Z'],holidayEvidence:fresh})).slots.length,1);
});
