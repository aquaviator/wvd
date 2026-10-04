import {createHash} from 'node:crypto';
import {readJsonBody} from './http-body.mjs';
import {normaliseIntroCallCandidates} from './booking.mjs';

// A random request key is a private retry capability, never a URL or log field.
// Trusted composition owns the product, calendar and admission policy. This
// boundary is not enabled in the public site or a production deployment.
export function createBookingHandler({book,reconcile,admit,productId,calendarId,allowedOrigin,maxConcurrentRequests}) {
  let origin;try{origin=new URL(allowedOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
  if(origin.origin!==allowedOrigin||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))||typeof book!=='function'||typeof reconcile!=='function'||typeof admit!=='function'||! /^[A-Za-z0-9_-]{1,128}$/.test(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId)||!Number.isSafeInteger(maxConcurrentRequests)||maxConcurrentRequests<1||maxConcurrentRequests>100)throw Error('INVALID_CONFIGURATION');
  let active=0;
  return async(request,response)=>{
    const send=(status,data)=>{response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(JSON.stringify(data));};
    try{
      if(typeof request.url!=='string'||request.url.length>4096)return send(400,{error:'INVALID_REQUEST'});
      const url=new URL(request.url,'http://localhost');
      if(url.pathname!=='/api/calls/book')return send(404,{error:'NOT_FOUND'});
      if(request.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});
      if(request.headers.origin!==allowedOrigin)return send(403,{error:'ORIGIN_DENIED'});
      if(url.search)return send(400,{error:'INVALID_REQUEST'});
      if(active>=maxConcurrentRequests)return send(503,{error:'SERVICE_UNAVAILABLE'});
      active++;
      try{
        // An explicitly supplied shared admission control runs before body reads
        // and durable writes. Never trust a forwarded address supplied by callers.
        if(await admit({peer:request.socket.remoteAddress})!==true)return send(429,{error:'RATE_LIMITED'});
        let input;try{input=JSON.parse(await readJsonBody(request,1024));}catch(error){if(error instanceof SyntaxError)return send(400,{error:'INVALID_REQUEST'});throw error;}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='requestKey,start'||typeof input.requestKey!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestKey))return send(400,{error:'INVALID_REQUEST'});
        const [start]=normaliseIntroCallCandidates([input.start]);
        const end=new Date(Date.parse(start)+1800000).toISOString();
        const reservationId=createHash('sha256').update(JSON.stringify([productId,calendarId,input.requestKey])).digest('hex');
        let result=await book({productId,reservationId,start,end});
        if(result?.status==='PENDING')result=await reconcile(reservationId);
        if(result?.reservationId!==reservationId)throw Error('INVALID_BOOKING_RESULT');
        if(result.status==='UNAVAILABLE')return send(409,{status:'UNAVAILABLE'});
        if(result.status==='CANCELLED')return send(409,{status:'CANCELLED'});
        if(result.status==='PENDING'||result.status==='BLOCKED')return send(202,{status:'PENDING'});
        if(result.status!=='CONFIRMED'||result.start!==start||result.end!==end||typeof result.meetUrl!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(result.meetUrl))throw Error('INVALID_BOOKING_RESULT');
        return send(200,{status:'CONFIRMED',start,end,timeZone:'Europe/London',meetUrl:result.meetUrl});
      }finally{active--;}
    }catch(error){
      if(response.headersSent){response.destroy();return;}
      const transport={INVALID_REQUEST:400,REQUEST_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415};
      if(Object.hasOwn(transport,error?.message)&&transport[error.message]===error?.httpStatus)return send(error.httpStatus,{error:error.message});
      if(error?.message==='INVALID_BOOKING_INPUT')return send(400,{error:'INVALID_REQUEST'});
      if(error?.message==='BOOKING_SLOT_RESERVED')return send(409,{status:'UNAVAILABLE'});
      if(error?.message==='RESERVATION_BINDING_CONFLICT')return send(409,{error:'REQUEST_CONFLICT'});
      return send(503,{error:'SERVICE_UNAVAILABLE'});
    }
  };
}
