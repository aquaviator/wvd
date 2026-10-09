import {normaliseIntroCallCandidates,introCallQueryWindow,screenIntroCallCandidates} from './booking.mjs';
import {assessCallTiming} from './availability.mjs';
import {freshHolidayEvidence} from './govuk-holiday-evidence.mjs';
// Read-only orchestration. No default slot grid, calendar set, evidence-age or
// buffer policy; no reservation or event creation follows a provisional result.
export function createIntroCallScreening({readEvidence,clock,policy}) {
  if(typeof readEvidence!=='function'||typeof clock!=='function'||!policy||!['bufferBoundary,maxEvidenceAgeMs,ref','bufferBoundary,holidayMaxEvidenceAgeMs,maxEvidenceAgeMs,ref'].includes(Object.keys(policy).sort().join(','))||typeof policy.ref!=='string'||!policy.ref.trim()||policy.ref.length>128||!['inside-hours','between-events'].includes(policy.bufferBoundary)||!Number.isFinite(policy.maxEvidenceAgeMs)||policy.maxEvidenceAgeMs<0)throw Error('INVALID_CONFIGURATION');
  if(Object.hasOwn(policy,'holidayMaxEvidenceAgeMs')&&(!Number.isSafeInteger(policy.holidayMaxEvidenceAgeMs)||policy.holidayMaxEvidenceAgeMs<0||policy.holidayMaxEvidenceAgeMs>604800000))throw Error('INVALID_CONFIGURATION');
  const bound=structuredClone(policy);
  return async({starts,holidayEvidence})=>{
    const requested=normaliseIntroCallCandidates(starts);
    if(!requested.length)return {slots:[],provisional:true};
    const holidays=structuredClone(holidayEvidence),before=clock();
    if(bound.holidayMaxEvidenceAgeMs!==undefined&&!freshHolidayEvidence(holidays,before,bound.holidayMaxEvidenceAgeMs))throw Error('HOLIDAY_EVIDENCE_UNAVAILABLE');
    const candidates=requested.filter(start=>assessCallTiming({start,now:before,holidayEvidence:holidays,policy:bound}).eligible),window=introCallQueryWindow(candidates);
    if(!window)return {slots:[],provisional:true};
    let evidence;try{evidence=await readEvidence({...window,holidayEvidence:holidays});}catch{throw Error('CALL_EVIDENCE_UNAVAILABLE');}
    // Check age/notice with the time after the provider read, not before it.
    const now=clock();
    if(bound.holidayMaxEvidenceAgeMs!==undefined&&!freshHolidayEvidence(holidays,now,bound.holidayMaxEvidenceAgeMs))throw Error('HOLIDAY_EVIDENCE_UNAVAILABLE');
    const slots=screenIntroCallCandidates({starts:candidates,now,evidence,policy:bound});
    return {slots,provisional:true};
  };
}
