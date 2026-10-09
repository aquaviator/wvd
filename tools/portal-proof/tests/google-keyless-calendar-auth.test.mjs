import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeylessCalendarAuthClients} from '../google-keyless-calendar-auth.mjs';
const serviceAccount='wvd-development@wvd-development.iam.gserviceaccount.com',subject='admin@example.test',calendarId='owned@example.test';
function fixture(){
 let now='2026-10-04T12:00:00.000Z',grants=0,apiCalls=0,status=200;const claims=[],requests=[];
 const signer={request:async options=>{assert.equal(options.retry,false);assert.equal(options.maxRedirects,0);assert.equal(options.url,'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(serviceAccount)+':signJwt');const payload=JSON.parse(options.data.payload);claims.push(payload);return {data:{signedJwt:Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature'}};}};
 const request=async(url,options)=>{requests.push({url,options});assert.equal(options.redirect,'error');if(url==='https://oauth2.googleapis.com/token'){grants++;return new Response(JSON.stringify({token_type:'Bearer',access_token:'synthetic-token-'+grants,expires_in:120}));}apiCalls++;return new Response(JSON.stringify({private:'provider body'}),{status});};
 return {clients:createKeylessCalendarAuthClients({signer,serviceAccount,subject,calendarId,clock:()=>now,request}),claims,requests,get grants(){return grants;},get apiCalls(){return apiCalls;},setTime:value=>now=value,setStatus:value=>status=value};
}
const eventOptions={url:'https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events/abcde',method:'GET',timeout:1000,retry:false,maxRedirects:0,maxContentLength:65536,params:{fields:'id'}};
test('keyless clients refresh automatically, share concurrent grants and separate delegated event from freebusy authority',async()=>{
 const f=fixture();await Promise.all([1,2,3].map(()=>f.clients.eventAuthClient.request(eventOptions)));assert.equal(f.grants,1);assert.equal(f.apiCalls,3);assert.equal(f.claims[0].sub,subject);assert.equal(f.claims[0].scope,'https://www.googleapis.com/auth/calendar.events');assert.equal(f.claims[0].exp-f.claims[0].iat,300);
 await f.clients.freeBusyAuthClient.request({...eventOptions,url:'https://www.googleapis.com/calendar/v3/freeBusy',method:'POST',params:undefined,data:{}});assert.equal(f.grants,2);assert.equal(Object.hasOwn(f.claims[1],'sub'),false);assert.equal(f.claims[1].scope,'https://www.googleapis.com/auth/calendar.freebusy');
 f.setTime('2026-10-04T12:02:00.000Z');await f.clients.eventAuthClient.request(eventOptions);assert.equal(f.grants,3);
});
test('credential boundary denies foreign origins, calendars, scope use and injected auth headers before minting',async()=>{
 const f=fixture();for(const patch of [{url:'https://evil.test/calendar/v3/freeBusy'},{url:'https://www.googleapis.com/calendar/v3/calendars/foreign/events'},{url:eventOptions.url+'?access_token=foreign'},{headers:{Authorization:'foreign'}},{retry:true},{maxRedirects:1}])await assert.rejects(f.clients.eventAuthClient.request({...eventOptions,...patch}),/INVALID_CONFIGURATION/);
 await assert.rejects(f.clients.freeBusyAuthClient.request(eventOptions),/INVALID_CONFIGURATION/);assert.equal(f.grants,0);assert.equal(f.apiCalls,0);
});
test('provider failures expose status only and never replay a Calendar request',async()=>{
 const f=fixture();f.setStatus(401);await assert.rejects(f.clients.eventAuthClient.request(eventOptions),error=>error.message==='CALENDAR_REQUEST_FAILED'&&error.response.status===401&&!JSON.stringify(error).includes('provider body'));assert.equal(f.apiCalls,1);f.setStatus(200);await f.clients.eventAuthClient.request(eventOptions);assert.equal(f.grants,2);
});
