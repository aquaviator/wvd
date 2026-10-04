import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {validateBinding} from './preflight.mjs';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
import {createGoogleBookingEventWriter,createGoogleBookingCalendarClient,googleBookingEventId} from '../portal-proof/google-booking-event.mjs';
const target='c_3ecbc004918864ddf97f56a0dde644e19d7d18d1175a51832e29d2d28a3ff67f@group.calendar.google.com';
const productId='wvd-development-rehearsal';
// CI-only past synthetic event. No customers, attendees, invitations or public route.
export async function bookingEventRehearsal(binding,token,{request=fetch,marker=randomUUID(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),reportIdentity=()=>{}}={}) {
  const b=validateBinding(binding);
  if(!b.calendarIds.includes(target)||typeof token!=='string'||!token.length||/\s/.test(token)||typeof marker!=='string'||!/^[A-Za-z0-9-]{1,64}$/.test(marker))throw Error('INVALID_CONFIGURATION');
  const reservation={productId,reservationId:'rehearsal-'+marker,start:'2020-01-06T12:00:00.000Z',end:'2020-01-06T12:30:00.000Z'};
  const eventId=googleBookingEventId(productId,target,reservation.reservationId);
  const bindingDigest=createHash('sha256').update(JSON.stringify(reservation)).digest('hex');
  const base='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(target)+'/events';
  const single=base+'/'+eventId;
  let providerFailure=null;
  const authClient={async request(options){
    if(![base,single].includes(options.url)||!['GET','POST'].includes(options.method))throw Error('INVALID_CONFIGURATION');
    const url=new URL(options.url);
    for(const [key,value] of Object.entries(options.params))url.searchParams.set(key,String(value));
    const response=await request(url.toString(),{method:options.method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(options.data?{body:JSON.stringify(options.data)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok){
      if(options.method==='POST'){
        let payload;try{payload=await readBoundedProviderJson(response,65536);}catch{}
        const unsupported=payload?.error?.message==='Invalid conference type value.'||payload?.error?.errors?.some(x=>x.message==='Invalid conference type value.');
        providerFailure={httpStatus:response.status,reason:unsupported?'CONFERENCE_TYPE_NOT_SUPPORTED':'PROVIDER_REJECTED'};
      }else await response.body?.cancel().catch(()=>{});
      const error=Error('PROVIDER_REQUEST_FAILED');error.response={status:response.status};throw error;
    }
    return {data:await readBoundedProviderJson(response,65536)};
  }};
  const calendar=createGoogleBookingCalendarClient({authClient,calendarId:target});
  const write=createGoogleBookingEventWriter({calendar,calendarId:target,productId,requestTimeoutMs:15000});
  const get=async()=>{try{return (await calendar.events.get({calendarId:target,eventId},{timeout:15000,retry:false})).data;}catch(error){if(error.response?.status===404)return null;throw error;}};
  const owns=row=>row?.id===eventId&&row.summary==='WVD introductory call'&&row.visibility==='private'&&(row.transparency===undefined||row.transparency==='opaque')&&!row.recurrence&&(!row.attendees||Array.isArray(row.attendees)&&row.attendees.length===0)&&Date.parse(row.start?.dateTime)===Date.parse(reservation.start)&&Date.parse(row.end?.dateTime)===Date.parse(reservation.end)&&row.extendedProperties?.private?.wvdProduct===productId&&row.extendedProperties.private.wvdReservation===reservation.reservationId&&row.extendedProperties.private.wvdBinding===bindingDigest;
  let attempted=false,provider='UNVERIFIED',cleanup='NOT_NEEDED';
  try{
    if(await get()){provider='SYNTHETIC_ID_ALREADY_EXISTS';}
    else{
      reportIdentity(eventId);attempted=true;
      let result=await write(reservation);
      for(let i=0;i<2&&result.status==='MEET_PENDING';i++){await pause(2000);result=await write(reservation);}
      provider=result.status;
    }
  }catch{provider='EVENT_OR_MEET_UNAVAILABLE';}
  finally{
    if(attempted){
      try{
        const row=await get();
        if(!row)cleanup='ABSENT';
        else if(!owns(row))cleanup='EVENT_NOT_OWNED_BY_REHEARSAL';
        else if(row.status==='cancelled')cleanup='REMOVED';
        else if(row.status!=='confirmed')cleanup='UNEXPECTED_EVENT_STATE';
        else{
          const response=await request(single+'?sendUpdates=none',{method:'DELETE',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(15000)});
          await response.body?.cancel().catch(()=>{});
          if(response.status!==204)cleanup='CLEANUP_FAILED';
          else{const after=await get();cleanup=!after||after.id===eventId&&after.status==='cancelled'?'REMOVED':'CLEANUP_UNVERIFIED';}
        }
      }catch{cleanup='CLEANUP_FAILED';}
    }
  }
  return {check:'wvd-booking-event-rehearsal',status:provider==='EVENT_AND_MEET_READY'&&cleanup==='REMOVED'?'PASS':'BLOCKED',provider,cleanup,providerFailure,attendeesAdded:false,invitationsSent:false,productionBookingReady:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)throw Error();
    const result=await bookingEventRehearsal(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN,{reportIdentity:eventId=>console.log('SYNTHETIC_REHEARSAL_EVENT_ID='+eventId)});
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
  }catch{console.error('BOOKING_REHEARSAL_CONFIGURATION_OR_CREDENTIAL_FAILURE');process.exitCode=1;}
}
