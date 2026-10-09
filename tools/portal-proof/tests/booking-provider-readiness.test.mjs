import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBookingProviders} from '../booking-provider-readiness.mjs';
const clock=()=> '2026-10-05T09:00:00.000Z';
function fixture(){
 const calls=[],config={calendarId:'owned',calendarIds:['owned','personal'],policy:{holidayMaxEvidenceAgeMs:3600000},maxQueryWindowMs:86400000,requestTimeoutMs:1000};
 const input={config,clock,store:{backupSnapshot:async()=>{calls.push('database');return {private:'never-return-this'};}},readHolidays:async()=>({bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2027-12-31',bankHolidays:[],sourceRef:'https://www.gov.uk/bank-holidays.json#england-and-wales',observedAt:clock()}),calendar:{freebusy:{query:async({requestBody:b})=>{calls.push('freebusy');return {data:{kind:'calendar#freeBusy',timeMin:b.timeMin,timeMax:b.timeMax,calendars:{owned:{busy:[]},personal:{busy:[]}}}};}},events:{list:async()=>{calls.push('list');return {data:{kind:'calendar#events',accessRole:'writer',items:[{summary:'private'}]}};}}}};
 return {input,calls};
}
test('provider startup checks are reads and return only bounded status',async()=>{const f=fixture(),r=await verifyBookingProviders(f.input);assert.equal(r.status,'PASS');assert.equal(r.writesPerformed,false);assert.deepEqual(f.calls,['database','freebusy','list']);assert.equal(JSON.stringify(r).includes('private'),false);});
test('missing personal calendar evidence or delegated list authority prevents readiness',async()=>{
 for(const kind of ['busy','list','database']){const f=fixture();if(kind==='busy')f.input.calendar.freebusy.query=async()=>({data:{}});if(kind==='list')f.input.calendar.events.list=async()=>({data:{kind:'calendar#events',accessRole:'reader'}});if(kind==='database')f.input.store.backupSnapshot=async()=>{throw Error('secret provider error');};await assert.rejects(verifyBookingProviders(f.input),{message:'PROVIDER_READINESS_FAILED'});}
});
