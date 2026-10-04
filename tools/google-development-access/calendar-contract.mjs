import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateBinding} from './preflight.mjs';
import {readGoogleJson} from './google-json.mjs';
import {createGoogleCallEvidenceReader} from '../portal-proof/google-calendar-evidence.mjs';

// A CI-only bridge for the existing portal adapter; the workflow supplies a
// short-lived token explicitly. No calendar discovery, event reads or writes.
export function createDevelopmentCalendarClient(binding,token,{request=fetch}={}) {
  const ids=[...validateBinding(binding).calendarIds].sort();
  if(typeof token!=='string'||!token.length||/\s/.test(token))throw Error('CREDENTIAL_REQUIRED');
  return {freebusy:{query:async({requestBody:b},{timeout,retry}={})=>{
    if(!b||Object.keys(b).sort().join(',')!=='items,timeMax,timeMin,timeZone'||b.timeZone!=='UTC'||retry!==false||!Array.isArray(b.items)||b.items.some(x=>!x||Object.keys(x).join(',')!=='id')||b.items.map(x=>x.id).sort().join('\n')!==ids.join('\n')||!Number.isFinite(Date.parse(b.timeMin))||!Number.isFinite(Date.parse(b.timeMax))||Date.parse(b.timeMax)<=Date.parse(b.timeMin)||Date.parse(b.timeMax)-Date.parse(b.timeMin)>3600000)throw Error('INVALID_CALENDAR_QUERY');
    const data=await readGoogleJson('https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',body:JSON.stringify(b)},token,{request,timeoutMs:timeout});
    return {data};
  }}};
}

export async function calendarContractCheck(binding,token,{request=fetch,now=Date.now()}={}) {
  const b=validateBinding(binding),start=new Date(now).toISOString(),end=new Date(now+3600000).toISOString();
  const reader=createGoogleCallEvidenceReader({calendar:createDevelopmentCalendarClient(b,token,{request}),calendarIds:b.calendarIds,clock:()=>start,maxQueryWindowMs:3600000,requestTimeoutMs:15000});
  // Exercise provider adaptation only. This synthetic holiday fixture is never
  // passed to slot screening and cannot establish an actual booking policy.
  const day=start.slice(0,10);
  const evidence=await reader({coveredStart:start,coveredEnd:end,holidayEvidence:{bankHolidayRegion:'england-and-wales',coveredFrom:day,coveredThrough:end.slice(0,10),bankHolidays:[],sourceRef:'synthetic-contract-check-not-booking-policy'}});
  return {check:'portal-calendar-provider-contract',status:evidence.complete?'PASS':'BLOCKED',changesMade:false,bookingReady:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)throw Error('BINDING_PATH_REQUIRED');
    const result=await calendarContractCheck(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN);
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
  }catch{console.error('CALENDAR_CONTRACT_CONFIGURATION_OR_CREDENTIAL_FAILURE');process.exitCode=1;}
}
