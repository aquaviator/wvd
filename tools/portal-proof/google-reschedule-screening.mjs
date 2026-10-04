import {createGoogleCallEvidenceReader} from './google-calendar-evidence.mjs';
import {createIntroCallScreening} from './call-screening.mjs';
import {bookingReservation} from './booking-reservations.mjs';
import {googleBookingEventId,inspectGoogleBookingEvent} from './google-booking-event.mjs';
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(Date.parse(value.slice(0,19)+'Z')).toISOString().slice(0,19)===value.slice(0,19);
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
// Read-only, exact-event exclusion for the owned booking calendar. All other
// calendars retain their complete free/busy evidence, including personal work.
export function createGoogleRescheduleScreening({calendar,calendarIds,calendarId,productId,clock,policy,maxQueryWindowMs,requestTimeoutMs,readHolidays}) {
 if(typeof calendar?.events?.get!=='function'||typeof calendar?.events?.list!=='function'||typeof readHolidays!=='function'||!calendarIds?.includes(calendarId))throw Error('INVALID_CONFIGURATION');
 googleBookingEventId(productId,calendarId,'configuration-check');
 const freeBusy=createGoogleCallEvidenceReader({calendar,calendarIds,clock,maxQueryWindowMs,requestTimeoutMs});
 const fixedPolicy=structuredClone(policy),options=Object.freeze({timeout:requestTimeoutMs,retry:false});
 // Validate policy at construction, before any provider request.
 createIntroCallScreening({clock,policy:fixedPolicy,readEvidence:freeBusy});
 return async({reservation,target,eventId})=>{
  const from=bookingReservation(reservation,productId),to=bookingReservation(target,productId);
  if(from.reservationId!==to.reservationId||eventId!==googleBookingEventId(productId,calendarId,from.reservationId))throw Error('RESERVATION_BINDING_CONFLICT');
  const screen=createIntroCallScreening({clock,policy:fixedPolicy,readEvidence:async window=>{
   const evidence=await freeBusy(window);if(!evidence.complete)throw Error('CALL_EVIDENCE_UNAVAILABLE');
   const own=(await calendar.events.get({calendarId,eventId},options)).data;
   if(inspectGoogleBookingEvent({productId,calendarId,reservation:from},own).status!=='EVENT_AND_MEET_READY')throw Error('CALL_EVIDENCE_UNAVAILABLE');
   const busy=[],seen=new Set(),tokens=new Set();let pageToken;
   for(let page=0;page<5;page++){
    const {data}=await calendar.events.list({calendarId,timeMin:window.coveredStart,timeMax:window.coveredEnd,timeZone:'UTC',singleEvents:true,showDeleted:false,showHiddenInvitations:true,maxResults:250,...(pageToken?{pageToken}:{})},options);
    if(data?.kind!=='calendar#events'||!['writer','owner'].includes(data.accessRole)||!Array.isArray(data.items)||data.items.length>250)throw Error('CALL_EVIDENCE_UNAVAILABLE');
    for(const item of data.items){
     if(typeof item?.id!=='string'||!item.id.length||item.id.length>1024||seen.has(item.id))throw Error('CALL_EVIDENCE_UNAVAILABLE');seen.add(item.id);
     if(item.id===eventId){if(inspectGoogleBookingEvent({productId,calendarId,reservation:from},item).status!=='EVENT_AND_MEET_READY')throw Error('CALL_EVIDENCE_UNAVAILABLE');continue;}
     if(item.status==='cancelled')continue;
     if(!['confirmed','tentative'].includes(item.status)||item.recurrence||![undefined,'opaque','transparent'].includes(item.transparency))throw Error('CALL_EVIDENCE_UNAVAILABLE');
     if(item.transparency==='transparent')continue;
     if(instant(item.start?.dateTime)&&instant(item.end?.dateTime)&&Date.parse(item.end.dateTime)>Date.parse(item.start.dateTime))busy.push({start:new Date(item.start.dateTime).toISOString(),end:new Date(item.end.dateTime).toISOString()});
     else if(date(item.start?.date)&&date(item.end?.date)&&item.end.date>item.start.date){
      // A listed opaque all-day event intersects this one-candidate query. Keep
      // the complete window busy, avoiding a guessed calendar timezone.
      busy.push({start:window.coveredStart,end:window.coveredEnd});
     }else throw Error('CALL_EVIDENCE_UNAVAILABLE');
    }
    if(data.nextPageToken===undefined){
     if(Date.parse(from.start)<Date.parse(window.coveredEnd)&&Date.parse(from.end)>Date.parse(window.coveredStart)&&!seen.has(eventId))throw Error('CALL_EVIDENCE_UNAVAILABLE');
     return {...evidence,calendars:evidence.calendars.map(row=>row.id===calendarId?{...row,busy}:row)};
    }
    if(typeof data.nextPageToken!=='string'||!data.nextPageToken.length||data.nextPageToken.length>2048||tokens.has(data.nextPageToken))throw Error('CALL_EVIDENCE_UNAVAILABLE');
    tokens.add(data.nextPageToken);pageToken=data.nextPageToken;
   }
   throw Error('CALL_EVIDENCE_UNAVAILABLE');
  }});
  return screen({starts:[to.start],holidayEvidence:await readHolidays()});
 };
}
