import test from 'node:test';
import assert from 'node:assert/strict';
import {screenIntroCallCandidates as screen} from '../booking.mjs';
import {assessCallSlot} from '../availability.mjs';
const iso=value=>new Date(value).toISOString();
const fixture=()=>({now:iso('2026-10-01T08:00Z'),starts:[iso('2026-10-02T08:00Z'),iso('2026-10-02T16:30Z')],policy:{bufferBoundary:'between-events',maxEvidenceAgeMs:60000},evidence:{complete:true,observedAt:iso('2026-10-01T08:00Z'),requiredCalendarIds:['synthetic-main','synthetic-personal'],calendars:['synthetic-main','synthetic-personal'].map(id=>({id,status:'ok',coveredStart:iso('2026-10-01T00:00Z'),coveredEnd:iso('2026-11-01T00:00Z'),busy:[]})),bankHolidayRegion:'england-and-wales',coveredFrom:'2026-01-01',coveredThrough:'2026-12-31',bankHolidays:[]}});
test('Batch screening reuses single-slot results for both explicit boundary policies and UK seasons',()=>{
 for(const bufferBoundary of ['between-events','inside-hours']){
  const f=fixture();f.policy.bufferBoundary=bufferBoundary;f.starts=[iso('2026-10-02T08:00Z'),iso('2026-10-02T16:30Z'),iso('2026-10-26T09:00Z'),iso('2026-10-26T09:15Z'),iso('2026-10-26T17:30Z')];
  const expected=f.starts.map(start=>assessCallSlot({...f,start})).filter(x=>x.available).map(({start,end,timeZone})=>({start,end,timeZone}));assert.deepEqual(screen(f),expected);
 }
});
test('Notice, weekends, supplied holidays and both calendar conflict margins remain shared',()=>{
 const f=fixture();f.starts=[iso('2026-10-01T16:00Z'),iso('2026-10-02T08:00Z'),iso('2026-10-03T08:00Z')];assert.deepEqual(screen(f).map(x=>x.start),[iso('2026-10-02T08:00Z')]);f.evidence.bankHolidays=['2026-10-02'];assert.deepEqual(screen(f),[]);
 const g=fixture();g.starts=[iso('2026-10-02T08:30Z'),iso('2026-10-02T08:45Z')];g.evidence.calendars[1].busy=[{start:iso('2026-10-02T08:00Z'),end:iso('2026-10-02T08:30Z')}];assert.deepEqual(screen(g).map(x=>x.start),[iso('2026-10-02T08:45Z')]);g.evidence.calendars[0].busy=[{start:iso('2026-10-02T09:29Z'),end:iso('2026-10-02T10:00Z')}];assert.deepEqual(screen(g),[]);
});
test('Incomplete, errored, stale or future evidence never offers a slot',()=>{
 for(const alter of [f=>f.evidence.calendars.pop(),f=>f.evidence.calendars[1]=f.evidence.calendars[0],f=>f.evidence.calendars[0].status='failed',f=>f.evidence.complete=false,f=>f.evidence.observedAt=iso('2026-10-01T07:58Z'),f=>f.evidence.observedAt=iso('2026-10-01T08:01Z'),f=>f.evidence.coveredThrough='2026-10-01',f=>f.evidence.bankHolidayRegion='scotland']){const f=fixture();alter(f);assert.deepEqual(screen(f),[]);}
});
test('Batch requires explicit policy, bounded unique minute candidates and immutable input',()=>{
 const f=fixture(),before=structuredClone(f);screen(f);assert.deepEqual(f,before);
 for(const alter of [f=>f.starts=[f.starts[0],f.starts[0]],f=>f.starts=['2026-02-30T09:00:00.000Z'],f=>f.starts=[iso('2026-10-02T08:00:01Z')],f=>f.starts=Array(201).fill(f.starts[0]),f=>f.evidence.calendars[0].busy=Array(2001).fill({}),f=>f.evidence.bankHolidays=Array(401).fill('2026-12-25')]){const bad=fixture();alter(bad);assert.throws(()=>screen(bad),/INVALID_BOOKING_INPUT/);}
 const bad=fixture();delete bad.policy;assert.throws(()=>screen(bad),/INVALID_POLICY/);
});

test('Exact queried coverage filters only candidates whose full buffers are covered',()=>{const f=fixture();f.evidence.calendars[0].coveredStart=iso('2026-10-02T07:46Z');assert.deepEqual(screen(f).map(x=>x.start),[iso('2026-10-02T16:30Z')]);});
