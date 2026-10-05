import {createGoogleCallEvidenceReader} from './google-calendar-evidence.mjs';
import {freshHolidayEvidence} from './govuk-holiday-evidence.mjs';
// Startup-only reads, with no event mutation, admission write or customer data
// returned. A successful sample is not continuing availability or write proof.
export async function verifyBookingProviders({store,calendar,config,clock,readHolidays}) {
 const observedAt=clock(),start=Date.parse(observedAt);
 if(!Number.isFinite(start)||new Date(start).toISOString()!==observedAt)throw Error('PROVIDER_READINESS_FAILED');
 let timer;
 try {
  return await Promise.race([(async()=>{
   await store.backupSnapshot(); // Validates target ownership and existing journal.
   const holidayEvidence=await readHolidays();
   if(!freshHolidayEvidence(holidayEvidence,clock(),config.policy.holidayMaxEvidenceAgeMs))throw Error();
   const timeMax=new Date(start+Math.min(1800000,config.maxQueryWindowMs)).toISOString();
   const evidence=await createGoogleCallEvidenceReader({calendar,calendarIds:config.calendarIds,clock,maxQueryWindowMs:config.maxQueryWindowMs,requestTimeoutMs:config.requestTimeoutMs})({coveredStart:observedAt,coveredEnd:timeMax,holidayEvidence});
   if(evidence.complete!==true)throw Error();
   const {data}=await calendar.events.list({calendarId:config.calendarId,timeMin:observedAt,timeMax,timeZone:'UTC',singleEvents:true,showDeleted:false,showHiddenInvitations:true,maxResults:250},{timeout:config.requestTimeoutMs,retry:false});
   if(data?.kind!=='calendar#events'||!['writer','owner'].includes(data.accessRole)||!Array.isArray(data.items??[]))throw Error();
   return {status:'PASS',observedAt,checks:['firestore-journal-read','holiday-read','required-calendar-freebusy','owned-calendar-list'],writesPerformed:false};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error()),60000);})]);
 }catch {throw Error('PROVIDER_READINESS_FAILED');}finally{clearTimeout(timer);}
}
