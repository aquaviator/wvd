import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export function googleBookingEventId(productId,calendarId,reservationId) {
  if(!reference(productId)||!reference(reservationId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId))throw Error('INVALID_CONFIGURATION');
  return digest([productId,calendarId,reservationId]);
}
export function inspectGoogleBookingEvent({productId,calendarId,reservation},data) {
  const bound=googleBookingReservation(reservation,productId),eventId=googleBookingEventId(productId,calendarId,bound.reservationId),bindingDigest=digest(bound);
  const matches=data=>data?.id===eventId&&data.status==='confirmed'&&data.summary==='WVD introductory call'&&Date.parse(data.start?.dateTime)===Date.parse(bound.start)&&Date.parse(data.end?.dateTime)===Date.parse(bound.end)&&data.extendedProperties?.private?.wvdProduct===productId&&data.extendedProperties.private.wvdReservation===bound.reservationId&&data.extendedProperties.private.wvdBinding===bindingDigest&&data.visibility==='private'&&(data.transparency===undefined||data.transparency==='opaque')&&!data.recurrence&&(data.attendees===undefined||Array.isArray(data.attendees)&&data.attendees.length===0);
  const result=data=>{
      if(!matches(data))throw Error('BOOKING_EVENT_CONFLICT');
      const conference=data.conferenceData,code=conference?.createRequest?.status?.statusCode;
      if(code==='failure')return {eventId,status:'MEET_FAILED'};
      if(code!=='success')return {eventId,status:'MEET_PENDING'};
      const videos=Array.isArray(conference?.entryPoints)?conference.entryPoints.filter(x=>x?.entryPointType==='video'):[];
      if(conference?.conferenceSolution?.key?.type!=='hangoutsMeet'||videos.length!==1||typeof videos[0].uri!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(videos[0].uri))return {eventId,status:'MEET_FAILED'};
      return {eventId,status:'EVENT_AND_MEET_READY',meetUrl:videos[0].uri};
    };
  return result(data);
}
export function googleBookingReservation(reservation,productId) {
  if(!reservation||Object.keys(reservation).sort().join(',')!=='end,productId,reservationId,start'||reservation.productId!==productId||!reference(productId)||!reference(reservation.reservationId)||!instant(reservation.start)||!instant(reservation.end)||Date.parse(reservation.end)-Date.parse(reservation.start)!==1800000)throw Error('INVALID_BOOKING_RESERVATION');
  return {productId,reservationId:reservation.reservationId,start:reservation.start,end:reservation.end};
}
// Trusted server provider adapter only. The caller must already own a durable
// reservation and perform the final conflict recheck; this is not a public
// booking endpoint, slot lock or invitation/delivery implementation.
export function createGoogleBookingEventWriter({calendar,calendarId,productId,requestTimeoutMs}) {
  if(typeof calendar?.events?.get!=='function'||typeof calendar?.events?.insert!=='function'||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId)||!reference(productId)||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
  const options=Object.freeze({timeout:requestTimeoutMs,retry:false});
  return async reservation=>{
    const bound=googleBookingReservation(reservation,productId),eventId=googleBookingEventId(productId,calendarId,bound.reservationId),bindingDigest=digest(bound);
    const requestId=digest([eventId,bindingDigest,'conference']);
    const result=data=>inspectGoogleBookingEvent({productId,calendarId,reservation:bound},data);
    const read=async()=>{
      try{return (await calendar.events.get({calendarId,eventId},options)).data;}catch(error){if(error?.response?.status===404)return null;throw Error('BOOKING_EVENT_UNAVAILABLE');}
    };
    const existing=await read();if(existing)return result(existing);
    const requestBody={id:eventId,summary:'WVD introductory call',visibility:'private',transparency:'opaque',start:{dateTime:bound.start,timeZone:'Europe/London'},end:{dateTime:bound.end,timeZone:'Europe/London'},extendedProperties:{private:{wvdProduct:productId,wvdReservation:bound.reservationId,wvdBinding:bindingDigest}},conferenceData:{createRequest:{requestId,conferenceSolutionKey:{type:'hangoutsMeet'}}},reminders:{useDefault:false},guestsCanInviteOthers:false,guestsCanModify:false,guestsCanSeeOtherGuests:false};
    let data;
    try{({data}=await calendar.events.insert({calendarId,conferenceDataVersion:1,sendUpdates:'none',requestBody},options));}catch{
      // A timeout may follow a successful write. Read the deterministic event
      // once; never blindly retry an insert or overwrite a conflicting event.
      const recovered=await read();if(!recovered)throw Error('BOOKING_EVENT_UNAVAILABLE');return result(recovered);
    }
    return result(data);
  };
}

// Fixed-calendar Google Auth bridge. Credential acquisition and approved event
// scope remain the host's responsibility; no ambient login or token discovery.
export function createGoogleBookingCalendarClient({authClient,calendarId}) {
  if(typeof authClient?.request!=='function'||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId))throw Error('INVALID_CONFIGURATION');
  const fields='id,status,summary,visibility,transparency,start,end,recurrence,attendees,extendedProperties,conferenceData';
  const call=(method,eventId,body,options)=>authClient.request({url:`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${eventId?'/'+eventId:''}`,method,params:method==='GET'?{fields}:{fields,conferenceDataVersion:1,sendUpdates:'none'},...(body?{data:structuredClone(body)}:{}),timeout:options.timeout,signal:AbortSignal.timeout(options.timeout),retry:false,maxRedirects:0,maxContentLength:65536,responseType:'json'});
  const validOptions=options=>options&&Number.isSafeInteger(options.timeout)&&options.timeout>=1&&options.timeout<=15000&&options.retry===false;
  return {events:{
    get(params,options){
      if(!params||Object.keys(params).sort().join(',')!=='calendarId,eventId'||params.calendarId!==calendarId||!/^([a-v0-9]){5,1024}$/.test(params.eventId)||!validOptions(options))throw Error('INVALID_CONFIGURATION');
      return call('GET',params.eventId,undefined,options);
    },
    insert(params,options){
      const b=params?.requestBody;
      if(!params||Object.keys(params).sort().join(',')!=='calendarId,conferenceDataVersion,requestBody,sendUpdates'||params.calendarId!==calendarId||params.conferenceDataVersion!==1||params.sendUpdates!=='none'||!validOptions(options)||!b||Object.keys(b).sort().join(',')!=='conferenceData,end,extendedProperties,guestsCanInviteOthers,guestsCanModify,guestsCanSeeOtherGuests,id,reminders,start,summary,transparency,visibility'||!/^([a-v0-9]){5,1024}$/.test(b.id)||b.summary!=='WVD introductory call'||b.visibility!=='private'||b.transparency!=='opaque'||b.guestsCanInviteOthers!==false||b.guestsCanModify!==false||b.guestsCanSeeOtherGuests!==false||JSON.stringify(b).length>8192)throw Error('INVALID_CONFIGURATION');
      return call('POST',undefined,b,options);
    }
  }};
}
