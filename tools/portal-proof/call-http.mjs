import {readJsonBody} from './http-body.mjs';
import {normaliseIntroCallCandidates} from './booking.mjs';
import {validBankHolidayEvidence} from './availability.mjs';
// Optional public read boundary. Trusted composition supplies calendars, policy
// and holiday evidence; callers can select candidates but cannot replace them.
// This does not register an account, reserve a slot or create a Calendar event.
export function createCallAvailabilityHandler({screen,allowedOrigin,holidayEvidence,maxConcurrentRequests}) {
  let origin;try{origin=new URL(allowedOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
  if(origin.origin!==allowedOrigin||!(origin.protocol==='https:'||(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))||typeof screen!=='function'||!validBankHolidayEvidence(holidayEvidence)||!Number.isSafeInteger(maxConcurrentRequests)||maxConcurrentRequests<1||maxConcurrentRequests>100)throw Error('INVALID_CONFIGURATION');
  const holidays=structuredClone(holidayEvidence);let active=0;
  return async(request,response)=>{
    const send=(status,data)=>{response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(JSON.stringify(data));};
    try{
      if(typeof request.url!=='string'||request.url.length>4096)return send(400,{error:'INVALID_REQUEST'});
      const url=new URL(request.url,'http://localhost');
      if(url.pathname!=='/api/calls/availability')return send(404,{error:'NOT_FOUND'});
      if(request.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});
      if(request.headers.origin!==allowedOrigin)return send(403,{error:'ORIGIN_DENIED'});
      if(url.search)return send(400,{error:'INVALID_REQUEST'});
      // Admission happens before body reads, preventing an unbounded queue of
      // public requests around a slow Calendar lookup. Capacity is explicit.
      if(active>=maxConcurrentRequests)return send(503,{error:'SERVICE_UNAVAILABLE'});
      active++;
      try{
        let input;try{input=JSON.parse(await readJsonBody(request,8192));}catch(error){if(error instanceof SyntaxError)return send(400,{error:'INVALID_REQUEST'});throw error;}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='starts')return send(400,{error:'INVALID_REQUEST'});
        const starts=normaliseIntroCallCandidates(input.starts);
        const result=await screen({starts,holidayEvidence:structuredClone(holidays)});
        // Project only the public contract; injected adapters cannot expose
        // calendar IDs, provider errors, titles or internal policy references.
        if(result?.provisional!==true||!Array.isArray(result.slots)||result.slots.length>starts.length)throw Error('INVALID_SCREENING_RESULT');
        const seen=new Set(),slots=result.slots.map(slot=>{
          if(!slot||!starts.includes(slot.start)||seen.has(slot.start)||slot.end!==new Date(Date.parse(slot.start)+1800000).toISOString()||slot.timeZone!=='Europe/London')throw Error('INVALID_SCREENING_RESULT');
          seen.add(slot.start);return {start:slot.start,end:slot.end,timeZone:'Europe/London'};
        });
        return send(200,{slots,provisional:true});
      }finally{active--;}
    }catch(error){
      if(response.headersSent){response.destroy();return;}
      const transportErrors={INVALID_REQUEST:400,REQUEST_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415};
      if(Object.hasOwn(transportErrors,error?.message)&&transportErrors[error.message]===error?.httpStatus)return send(error.httpStatus,{error:error.message});
      if(error?.message==='INVALID_BOOKING_INPUT')return send(400,{error:'INVALID_REQUEST'});
      return send(503,{error:'SERVICE_UNAVAILABLE'});
    }
  };
}
