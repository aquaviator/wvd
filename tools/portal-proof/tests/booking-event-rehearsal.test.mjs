import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bookingEventRehearsal} from '../../google-development-access/booking-event-rehearsal.mjs';
const binding=JSON.parse(readFileSync(new URL('../../google-development-access/binding.json',import.meta.url)));
const opts={marker:'fixture',pause:async()=>{}};
function fixture({meet='success',foreign=false,deny=false,ambiguous=false,deleteFails=false,tombstone=false}={}){
  let row=null,posts=0,deletes=0;const calls=[];
  return {calls,get posts(){return posts;},get deletes(){return deletes;},async request(url,options){
    calls.push({url,options});
    if(options.method==='GET')return new Response(JSON.stringify(row||{}),{status:row?200:404});
    if(options.method==='POST'){
      posts++;const body=JSON.parse(options.body);
      assert.equal(body.start.dateTime,'2020-01-06T12:00:00.000Z');assert.equal(body.attendees,undefined);assert.equal(body.reminders.useDefault,false);
      assert.equal(new URL(url).searchParams.get('sendUpdates'),'none');
      if(deny)return new Response('{}',{status:403});
      row={...body,status:'confirmed',conferenceData:{createRequest:{status:{statusCode:meet}},conferenceSolution:{key:{type:'hangoutsMeet'}},entryPoints:[{entryPointType:'video',uri:'https://meet.google.com/abc-defg-hij'}]}};
      if(foreign)row.extendedProperties.private.wvdBinding='foreign';
      if(ambiguous)throw Error('timeout after write');
      return Response.json(row);
    }
    assert.equal(options.method,'DELETE');deletes++;
    if(deleteFails)return new Response('{}',{status:403});
    assert.equal(new URL(url).searchParams.get('sendUpdates'),'none');
    row=tombstone?{id:row.id,status:'cancelled'}:null;return new Response(null,{status:204});
  }};
}
test('past synthetic Meet event is read and removed without invitations',async()=>{
  const f=fixture();const r=await bookingEventRehearsal(binding,'token',{...opts,request:f.request});
  assert.equal(r.status,'PASS');assert.equal(r.cleanup,'REMOVED');assert.equal(f.posts,1);assert.equal(f.deletes,1);assert.equal(r.productionBookingReady,false);
  assert.equal(JSON.stringify(r).includes('meet.google.com'),false);
});
test('ambiguous successful insert is recovered and cleaned without second insert',async()=>{
  const f=fixture({ambiguous:true,tombstone:true});const r=await bookingEventRehearsal(binding,'token',{...opts,request:f.request});
  assert.equal(r.status,'PASS');assert.equal(f.posts,1);assert.equal(f.deletes,1);
});
test('pending and failed Meet results block readiness but clean the synthetic event',async()=>{
  for(const meet of ['pending','failure']){const f=fixture({meet});const r=await bookingEventRehearsal(binding,'token',{...opts,request:f.request});assert.equal(r.status,'BLOCKED');assert.equal(r.cleanup,'REMOVED');assert.equal(f.posts,1);}
});
test('foreign event is never removed and failed cleanup is visible',async()=>{
  const f=fixture({foreign:true});const r=await bookingEventRehearsal(binding,'token',{...opts,request:f.request});assert.equal(r.cleanup,'EVENT_NOT_OWNED_BY_REHEARSAL');assert.equal(f.deletes,0);
  const denied=fixture({deleteFails:true});const other=await bookingEventRehearsal(binding,'token',{...opts,request:denied.request});assert.equal(other.status,'BLOCKED');assert.equal(other.cleanup,'CLEANUP_FAILED');
});
test('provider denies write and invalid configuration never mutates',async()=>{
  const f=fixture({deny:true});const r=await bookingEventRehearsal(binding,'token',{...opts,request:f.request});assert.equal(r.status,'BLOCKED');assert.equal(r.cleanup,'ABSENT');assert.equal(f.deletes,0);
  const untouched=fixture();await assert.rejects(bookingEventRehearsal(binding,'bad token',{...opts,request:untouched.request}),/INVALID_CONFIGURATION/);assert.equal(untouched.calls.length,0);
});
