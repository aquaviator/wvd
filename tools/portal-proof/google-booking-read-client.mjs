import {createGoogleBookingCalendarClient} from './google-booking-event.mjs';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// Separate fixed-purpose credentials: delegated event authority only for the
// owned booking calendar; service-account free/busy for the exact required set.
export function createGoogleBookingRuntimeCalendar({eventAuthClient,freeBusyAuthClient,calendarId,calendarIds,maxQueryWindowMs}){
 const writes=createGoogleBookingCalendarClient({authClient:eventAuthClient,calendarId});
 if(typeof freeBusyAuthClient?.request!=='function'||!Array.isArray(calendarIds)||!calendarIds.length||calendarIds.length>20||!calendarIds.includes(calendarId)||new Set(calendarIds).size!==calendarIds.length||calendarIds.some(x=>typeof x!=='string'||!x.length||x.length>256||/[\s\x00-\x1f\x7f]/.test(x))||!Number.isSafeInteger(maxQueryWindowMs)||maxQueryWindowMs<1||maxQueryWindowMs>2678400000)throw Error('INVALID_CONFIGURATION');
 const ids=[...calendarIds].sort();
 const window=(from,to)=>instant(from)&&instant(to)&&Date.parse(to)>Date.parse(from)&&Date.parse(to)-Date.parse(from)<=maxQueryWindowMs;
 const options=value=>value&&Object.keys(value).sort().join(',')==='retry,timeout'&&value.retry===false&&Number.isSafeInteger(value.timeout)&&value.timeout>0&&value.timeout<=15000;
 const transport=value=>({timeout:value.timeout,signal:AbortSignal.timeout(value.timeout),retry:false,maxRedirects:0,maxContentLength:1048576,responseType:'json'});
 return {events:{...writes.events,list(params,config){
  if(!params||Object.keys(params).sort().join(',')!==(params.pageToken===undefined?'calendarId,maxResults,showDeleted,showHiddenInvitations,singleEvents,timeMax,timeMin,timeZone':'calendarId,maxResults,pageToken,showDeleted,showHiddenInvitations,singleEvents,timeMax,timeMin,timeZone')||params.calendarId!==calendarId||params.maxResults!==250||params.singleEvents!==true||params.showDeleted!==false||params.showHiddenInvitations!==true||params.timeZone!=='UTC'||!window(params.timeMin,params.timeMax)||!options(config)||params.pageToken!==undefined&&(typeof params.pageToken!=='string'||!params.pageToken.length||params.pageToken.length>2048))throw Error('INVALID_CONFIGURATION');
  const {calendarId:ignored,...query}=params;
  return eventAuthClient.request({url:'https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events',method:'GET',params:{...query,fields:'kind,accessRole,nextPageToken,items(id,etag,status,summary,visibility,transparency,start,end,recurrence,attendees,extendedProperties,conferenceData)'},...transport(config)});
 }},freebusy:{query(params,config){
  const b=params?.requestBody;
  if(!params||Object.keys(params).join(',')!=='requestBody'||!b||Object.keys(b).sort().join(',')!=='items,timeMax,timeMin,timeZone'||b.timeZone!=='UTC'||!window(b.timeMin,b.timeMax)||!options(config)||!Array.isArray(b.items)||b.items.length!==ids.length||b.items.some(x=>!x||Object.keys(x).join(',')!=='id')||JSON.stringify(b.items.map(x=>x.id).sort())!==JSON.stringify(ids))throw Error('INVALID_CONFIGURATION');
  return freeBusyAuthClient.request({url:'https://www.googleapis.com/calendar/v3/freeBusy',method:'POST',data:structuredClone(b),...transport(config)});
 }}};
}
