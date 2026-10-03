import {normaliseIntroCallCandidates,introCallQueryWindow,screenIntroCallCandidates} from './booking.mjs';
import {assessCallTiming} from './availability.mjs';
// Read-only orchestration. No default slot grid, calendar set, evidence-age or
// buffer policy; no reservation or event creation follows a provisional result.
export function createIntroCallScreening({readEvidence,clock,policy}) {
  if(typeof readEvidence!=='function'||typeof clock!=='function'||!policy||Object.keys(policy).sort().join(',')!=='bufferBoundary,maxEvidenceAgeMs,ref'||typeof policy.ref!=='string'||!policy.ref.trim()||policy.ref.length>128||!['inside-hours','between-events'].includes(policy.bufferBoundary)||!Number.isFinite(policy.maxEvidenceAgeMs)||policy.maxEvidenceAgeMs<0)throw Error('INVALID_CONFIGURATION');
  const bound=structuredClone(policy);
  return async({starts,holidayEvidence})=>{
    const requested=normaliseIntroCallCandidates(starts);
    if(!requested.length)return {slots:[],provisional:true};
    const holidays=structuredClone(holidayEvidence),before=clock();
    const candidates=requested.filter(start=>assessCallTiming({start,now:before,holidayEvidence:holidays,policy:bound}).eligible),window=introCallQueryWindow(candidates);
    if(!window)return {slots:[],provisional:true};
    let evidence;try{evidence=await readEvidence({...window,holidayEvidence:holidays});}catch{throw Error('CALL_EVIDENCE_UNAVAILABLE');}
    // Check age/notice with the time after the provider read, not before it.
    const now=clock();
    const slots=screenIntroCallCandidates({starts:candidates,now,evidence,policy:bound});
    return {slots,provisional:true};
  };
}
