import test from 'node:test';
import assert from 'node:assert/strict';
import {screenIntroCallCandidates as screen} from '../booking.mjs';
const iso=value=>new Date(value).toISOString();
const fixture=()=>({now:iso('2026-10-01T08:00Z'),starts:[iso('2026-10-02T08:00Z'),iso('2026-10-02T16:30Z')],requiredCalendarIds:['synthetic-main','synthetic-personal'],calendars:['synthetic-main','synthetic-personal'].map(id=>({id,coverageStart:'2026-10-01',coverageEnd:'2026-10-31',busy:[]})),holidays:{division:'england-and-wales',coverageStart:'2026-01-01',coverageEnd:'2026-12-31',dates:[]}});
test('London summer and winter time use the same 09:00–18:00 local boundary',()=>{
 const f=fixture();assert.equal(screen(f).length,2);
 f.starts=[iso('2026-10-02T07:30Z'),iso('2026-10-02T17:00Z'),iso('2026-10-26T08:30Z'),iso('2026-10-26T09:00Z'),iso('2026-10-26T17:30Z'),iso('2026-10-26T18:00Z')];
 assert.deepEqual(screen(f).map(x=>x.start),[iso('2026-10-26T09:00Z'),iso('2026-10-26T17:30Z')]);
});
test('notice, weekends and supplied holiday exclusions apply before offering candidates',()=>{
 const f=fixture();f.starts=[iso('2026-10-01T16:00Z'),iso('2026-10-02T08:00Z'),iso('2026-10-03T08:00Z')];assert.deepEqual(screen(f).map(x=>x.start),[iso('2026-10-02T08:00Z')]);
 f.holidays.dates=['2026-10-02'];assert.deepEqual(screen(f),[]);
});
test('every required calendar contributes conflicts with an exact 15-minute gap',()=>{
 const f=fixture();f.starts=[iso('2026-10-02T08:30Z'),iso('2026-10-02T08:45Z')];f.calendars[1].busy=[{start:iso('2026-10-02T08:00Z'),end:iso('2026-10-02T08:30Z')}];assert.deepEqual(screen(f).map(x=>x.start),[iso('2026-10-02T08:45Z')]);
 f.calendars[0].busy=[{start:iso('2026-10-02T09:30Z'),end:iso('2026-10-02T10:00Z')}];assert.equal(screen(f).length,1);
 f.calendars[0].busy=[{start:iso('2026-10-02T09:29Z'),end:iso('2026-10-02T10:00Z')}];assert.deepEqual(screen(f),[]);
});
test('missing, duplicate or errored calendars and incomplete holiday coverage fail closed',()=>{
 for(const alter of [f=>f.calendars.pop(),f=>f.calendars[1]=f.calendars[0],f=>f.calendars[0].error='forbidden',f=>f.calendars[0].coverageEnd='2026-10-01']){const f=fixture();alter(f);assert.throws(()=>screen(f),/CALENDAR_COVERAGE_REQUIRED/);}
 for(const alter of [f=>f.holidays=undefined,f=>f.holidays.division='scotland',f=>f.holidays.coverageEnd='2026-10-01']){const f=fixture();alter(f);assert.throws(()=>screen(f),/HOLIDAY_COVERAGE_REQUIRED/);}
});
test('invalid dates, reversed intervals and duplicate candidates are rejected without mutating input',()=>{
 const f=fixture(),before=structuredClone(f);screen(f);assert.deepEqual(f,before);
 for(const alter of [f=>f.starts=[f.starts[0],f.starts[0]],f=>f.starts=['2026-02-30T09:00:00.000Z'],f=>f.calendars[0].busy=[{start:f.starts[1],end:f.starts[0]}]]){const bad=fixture();alter(bad);assert.throws(()=>screen(bad),/INVALID_BOOKING_INPUT/);}
});
