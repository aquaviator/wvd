import {readBoundedProviderJson} from './provider-json.mjs';
import {validBankHolidayEvidence} from './availability.mjs';
export const GOVUK_HOLIDAY_SOURCE='https://www.gov.uk/bank-holidays.json';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// Public official data only. Fixed endpoint; no credentials, redirects, retries,
// inferred future holidays or fallback to an empty holiday list.
export function createGovukHolidayEvidenceReader({clock,requestTimeoutMs,request=fetch}) {
  if(typeof clock!=='function'||typeof request!=='function'||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_CONFIGURATION');
  return async()=>{
    try{
      const observedAt=clock();if(!instant(observedAt))throw Error();
      const response=await request(GOVUK_HOLIDAY_SOURCE,{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(requestTimeoutMs)});
      if(!response.ok)throw Error();
      const data=await readBoundedProviderJson(response,262144),region=data?.['england-and-wales'];
      if(region?.division!=='england-and-wales'||!Array.isArray(region.events)||region.events.length<2||region.events.length>400)throw Error();
      const dates=region.events.map(event=>event?.date).sort();
      const evidence={bankHolidayRegion:'england-and-wales',coveredFrom:dates[0],coveredThrough:dates.at(-1),bankHolidays:dates,sourceRef:`${GOVUK_HOLIDAY_SOURCE}#england-and-wales`,observedAt};
      if(!validBankHolidayEvidence(evidence))throw Error();
      // Do not extend coverage to full boundary years or beyond the published
      // horizon. An omitted intermediate year makes the evidence unusable.
      const years=new Set(dates.map(date=>Number(date.slice(0,4))));
      for(let year=Number(evidence.coveredFrom.slice(0,4));year<=Number(evidence.coveredThrough.slice(0,4));year++)if(!years.has(year))throw Error();
      return evidence;
    }catch{throw Error('HOLIDAY_EVIDENCE_UNAVAILABLE');}
  };
}
export function freshHolidayEvidence(evidence,now,maxAgeMs) {
  return validBankHolidayEvidence(evidence)&&evidence.sourceRef===`${GOVUK_HOLIDAY_SOURCE}#england-and-wales`&&instant(evidence.observedAt)&&instant(now)&&Date.parse(evidence.observedAt)<=Date.parse(now)&&Date.parse(now)-Date.parse(evidence.observedAt)<=maxAgeMs;
}
