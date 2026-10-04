import {readJsonBody} from './http-body.mjs';
import {createHash} from 'node:crypto';
import {normaliseIntroCallCandidates} from './booking.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
// Separate capability boundary: never allows a caller to select product, store,
// calendar, origin or expiry. No token in the server URL, discovery by email or issuance GET.
export function createBookingManagementHandler({management,productId,calendarId,allowedOrigin,admit,maxConcurrentRequests}) {
 let origin;try{origin=new URL(allowedOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
 if(origin.origin!==allowedOrigin||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))||typeof productId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(productId)||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||/[\s\x00-\x1f\x7f]/.test(calendarId)||typeof admit!=='function'||!Number.isSafeInteger(maxConcurrentRequests)||maxConcurrentRequests<1||maxConcurrentRequests>100||['issue','read','recover','cancel','reschedule'].some(k=>typeof management?.[k]!=='function'))throw Error('INVALID_CONFIGURATION');
 let active=0;
 return async(request,response)=>{
  const send=(status,body)=>{response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(JSON.stringify(body));};
  try{
   if(typeof request.url!=='string'||request.url.length>4096)return send(400,{error:'INVALID_REQUEST'});
   const url=new URL(request.url,'http://localhost'),routes={'/api/calls/manage/issue':'managementKey,requestKey,start','/api/calls/manage/read':'token','/api/calls/manage/recover':'actionId,revision,token','/api/calls/manage/cancel':'revision,start,token','/api/calls/manage/reschedule':'changeKey,revision,start,targetStart,token'};
   if(!Object.hasOwn(routes,url.pathname))return send(404,{error:'NOT_FOUND'});
   if(request.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});
   if(request.headers.origin!==allowedOrigin)return send(403,{error:'ORIGIN_DENIED'});
   if(url.search)return send(400,{error:'INVALID_REQUEST'});
   if(active>=maxConcurrentRequests)return send(503,{error:'SERVICE_UNAVAILABLE'});
   active++;
   try{
    if(await admit({peer:request.socket.remoteAddress})!==true)return send(429,{error:'RATE_LIMITED'});
    let body;try{body=JSON.parse(await readJsonBody(request,1536));}catch(e){if(e instanceof SyntaxError)return send(400,{error:'INVALID_REQUEST'});throw e;}
    if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!==routes[url.pathname])return send(400,{error:'INVALID_REQUEST'});
    if(url.pathname.endsWith('/issue')){
     if(!uuid(body.requestKey)||typeof body.managementKey!=='string'||!/^[a-f0-9]{64}$/.test(body.managementKey))return send(400,{error:'INVALID_REQUEST'});
     const [start]=normaliseIntroCallCandidates([body.start]),reservationId=createHash('sha256').update(JSON.stringify([productId,calendarId,body.requestKey])).digest('hex');
     const result=await management.issue({reservation:{productId,reservationId,start,end:new Date(Date.parse(start)+1800000).toISOString()},managementKey:body.managementKey});
     const expected=allowedOrigin+'/book/manage#'+reservationId+'.'+body.managementKey;
     if(result?.managementUrl!==expected||typeof result.expiresAt!=='string'||new Date(result.expiresAt).toISOString()!==result.expiresAt)throw Error('INVALID_BOOKING_RESULT');
     return send(200,{managementUrl:result.managementUrl,expiresAt:result.expiresAt});
    }
    if(typeof body.token!=='string'||body.token.length>194)return send(403,{error:'MANAGEMENT_DENIED'});
    if(url.pathname.endsWith('/read')||url.pathname.endsWith('/recover')){
     if(url.pathname.endsWith('/recover')&&(!revision(body.revision)||typeof body.actionId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(body.actionId)))return send(400,{error:'INVALID_REQUEST'});
     const result=await (url.pathname.endsWith('/read')?management.read(body.token):management.recover({token:body.token,revision:body.revision,actionId:body.actionId}));
     const [start]=normaliseIntroCallCandidates([result?.start]);
     if(!['CONFIRMED','PENDING','CANCELLED'].includes(result.status)||result.end!==new Date(Date.parse(start)+1800000).toISOString()||!revision(result.revision)||result.timeZone!=='Europe/London'||typeof result.expiresAt!=='string'||new Date(result.expiresAt).toISOString()!==result.expiresAt||result.status==='CONFIRMED'&&(typeof result.meetUrl!=='string'||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(result.meetUrl)))throw Error('INVALID_BOOKING_RESULT');
     if(result.pendingAction!==undefined&&(result.status!=='PENDING'||!result.pendingAction||Object.keys(result.pendingAction).sort().join(',')!=='id,kind'||!['cancel','reschedule'].includes(result.pendingAction.kind)||typeof result.pendingAction.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(result.pendingAction.id)))throw Error('INVALID_BOOKING_RESULT');
     return send(200,{status:result.status,...(result.pendingAction?{pendingAction:{kind:result.pendingAction.kind,id:result.pendingAction.id}}:{}),start,end:result.end,revision:result.revision,timeZone:result.timeZone,expiresAt:result.expiresAt,...(result.status==='CONFIRMED'?{meetUrl:result.meetUrl}:{})});
    }
    const [start]=normaliseIntroCallCandidates([body.start]);if(!revision(body.revision))return send(400,{error:'INVALID_REQUEST'});
    if(url.pathname.endsWith('/cancel')){
     const result=await management.cancel({token:body.token,start,revision:body.revision});if(!['PENDING','CANCELLED'].includes(result?.status))throw Error('INVALID_BOOKING_RESULT');return send(result.status==='PENDING'?202:200,{status:result.status});
    }
    if(!uuid(body.changeKey))return send(400,{error:'INVALID_REQUEST'});
    const [targetStart]=normaliseIntroCallCandidates([body.targetStart]);if(targetStart===start)return send(400,{error:'INVALID_REQUEST'});
    const changeId=createHash('sha256').update(JSON.stringify([productId,calendarId,body.token,body.changeKey])).digest('hex');
    const result=await management.reschedule({token:body.token,start,revision:body.revision,targetStart,changeId});
    if(!['PENDING','CANCELLED','UNAVAILABLE','RESCHEDULED'].includes(result?.status))throw Error('INVALID_BOOKING_RESULT');
    if(['UNAVAILABLE','RESCHEDULED'].includes(result.status)&&result.revision!==body.revision+1)throw Error('INVALID_BOOKING_RESULT');
    return send(result.status==='PENDING'?202:['UNAVAILABLE','CANCELLED'].includes(result.status)?409:200,{status:result.status,...(['UNAVAILABLE','RESCHEDULED'].includes(result.status)?{revision:result.revision}:{})});
   }finally{active--;}
  }catch(error){
   if(response.headersSent){response.destroy();return;}
   const transport={INVALID_REQUEST:400,REQUEST_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415};
   if(Object.hasOwn(transport,error?.message)&&transport[error.message]===error?.httpStatus)return send(error.httpStatus,{error:error.message});
   if(error?.message==='INVALID_BOOKING_INPUT')return send(400,{error:'INVALID_REQUEST'});
   if(['MANAGEMENT_DENIED','INVALID_MANAGEMENT_CAPABILITY','MANAGEMENT_ALREADY_ISSUED'].includes(error?.message))return send(403,{error:'MANAGEMENT_DENIED'});
   if(['RESERVATION_BINDING_CONFLICT','RESCHEDULE_NOT_READY','CANCELLATION_NOT_READY'].includes(error?.message))return send(409,{error:'REQUEST_CONFLICT'});
   if(error?.message==='BOOKING_SLOT_RESERVED')return send(409,{status:'UNAVAILABLE'});
   return send(503,{error:'SERVICE_UNAVAILABLE'});
  }
 };
}
