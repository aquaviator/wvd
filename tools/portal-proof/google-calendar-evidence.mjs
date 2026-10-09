import {validBankHolidayEvidence} from './availability.mjs';
// Adapter for an explicitly authorised Google Calendar API client. No credential
// lookup, calendar discovery, event titles, reservations, Meet or writes here.
// Provider RFC3339 offsets are normalised for the existing UTC availability rule.
const instant=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('INVALID_CALENDAR_INSTANT');
  const wall=value.slice(0,19),wallMs=Date.parse(wall+'Z'),ms=Date.parse(value);
  if(!Number.isFinite(wallMs)||new Date(wallMs).toISOString().slice(0,19)!==wall||!Number.isFinite(ms))throw Error('INVALID_CALENDAR_INSTANT');
  return new Date(ms).toISOString();
};
export function createGoogleCallEvidenceReader({calendar,calendarIds,clock,maxQueryWindowMs,requestTimeoutMs}) {
  if(!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>60000||typeof calendar?.freebusy?.query!=='function'||typeof clock!=='function'||!Number.isSafeInteger(maxQueryWindowMs)||maxQueryWindowMs<=0||!Array.isArray(calendarIds)||!calendarIds.length||calendarIds.length>20||calendarIds.some(id=>typeof id!=='string'||!id.trim()||id.length>256||/[\r\n]/.test(id))||new Set(calendarIds).size!==calendarIds.length)throw Error('INVALID_CONFIGURATION');
  const ids=[...calendarIds].sort();
  return async({coveredStart,coveredEnd,holidayEvidence})=>{
    const timeMin=instant(coveredStart),timeMax=instant(coveredEnd);
    if(Date.parse(timeMax)<=Date.parse(timeMin)||Date.parse(timeMax)-Date.parse(timeMin)>maxQueryWindowMs)throw Error('INVALID_CALENDAR_QUERY');
    if(!validBankHolidayEvidence(holidayEvidence)||holidayEvidence.bankHolidays.length>400||typeof holidayEvidence.sourceRef!=='string'||!holidayEvidence.sourceRef.trim()||holidayEvidence.sourceRef.length>256)throw Error('HOLIDAY_EVIDENCE_REQUIRED');
    // Capture before the request: a slow response does not reset its age to zero.
    const observedAt=instant(clock()),base={complete:false,observedAt,requiredCalendarIds:[...ids],bankHolidayRegion:holidayEvidence.bankHolidayRegion,coveredFrom:holidayEvidence.coveredFrom,coveredThrough:holidayEvidence.coveredThrough,bankHolidays:[...holidayEvidence.bankHolidays],bankHolidaySourceRef:holidayEvidence.sourceRef};
    const unavailable=()=>({...base,calendars:ids.map(id=>({id,status:'failed',coveredStart:timeMin,coveredEnd:timeMax,busy:[]}))});
    let data;
    try{({data}=await calendar.freebusy.query({requestBody:{timeMin,timeMax,timeZone:'UTC',items:ids.map(id=>({id}))}},{timeout:requestTimeoutMs,retry:false}));}catch{return unavailable();}
    try{
      if(!data||data.kind!=='calendar#freeBusy'||instant(data.timeMin)!==timeMin||instant(data.timeMax)!==timeMax||!data.calendars||typeof data.calendars!=='object'||Array.isArray(data.calendars)||Object.keys(data.calendars).sort().join('\n')!==ids.join('\n')||(data.groups!==undefined&&(!data.groups||typeof data.groups!=='object'||Array.isArray(data.groups)||Object.keys(data.groups).length)))return unavailable();
      const calendars=ids.map(id=>{const row=data.calendars[id];if(!row||typeof row!=='object'||Array.isArray(row)||!Array.isArray(row.busy)||row.busy.length>2000||(row.errors!==undefined&&(!Array.isArray(row.errors)||row.errors.length)))throw Error();const busy=row.busy.map(range=>{const start=instant(range?.start),end=instant(range?.end);if(Date.parse(end)<=Date.parse(start))throw Error();return {start,end};});return {id,status:'ok',coveredStart:timeMin,coveredEnd:timeMax,busy};});
      return {...base,complete:true,calendars};
    }catch{return unavailable();}
  };
}
