import {readJsonBody} from './http-body.mjs';
import {validEmailAddress} from './email-address.mjs';
// Host-owned recipient verification: a booking capability is not email ownership.
export function createBookingConfirmationHandler({delivery,management,allowedOrigin,resolveRecipient,admit,maxConcurrentRequests}) {
 let origin;try{origin=new URL(allowedOrigin);}catch{throw Error('INVALID_CONFIGURATION');}
 if(origin.origin!==allowedOrigin||!(origin.protocol==='https:'||origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname))||typeof delivery?.queue!=='function'||typeof delivery?.dispatch!=='function'||typeof management?.read!=='function'||typeof resolveRecipient!=='function'||typeof admit!=='function'||!Number.isSafeInteger(maxConcurrentRequests)||maxConcurrentRequests<1||maxConcurrentRequests>100)throw Error('INVALID_CONFIGURATION');
 let active=0;
 return async(request,response)=>{
  const send=(status,value)=>{response.writeHead(status,{'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(JSON.stringify(value));};
  try{
   if(typeof request.url!=='string'||request.url.length>4096)return send(400,{error:'INVALID_REQUEST'});
   const url=new URL(request.url,'http://localhost');
   if(url.pathname!=='/api/calls/manage/confirmation')return send(404,{error:'NOT_FOUND'});
   if(request.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});
   if(request.headers.origin!==allowedOrigin)return send(403,{error:'ORIGIN_DENIED'});
   if(url.search)return send(400,{error:'INVALID_REQUEST'});
   if(active>=maxConcurrentRequests)return send(503,{error:'SERVICE_UNAVAILABLE'});
   active++;
   try{
    if(await admit({peer:request.socket.remoteAddress})!==true)return send(429,{error:'RATE_LIMITED'});
    let body;try{body=JSON.parse(await readJsonBody(request,6144));}catch(error){if(error instanceof SyntaxError)return send(400,{error:'INVALID_REQUEST'});throw error;}
    if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='consent,recipientProof,token'||body.consent!==true||typeof body.token!=='string'||!/^([A-Za-z0-9_-]{1,128})\.[a-f0-9]{64}$/.test(body.token)||typeof body.recipientProof!=='string'||!body.recipientProof.length||body.recipientProof.length>4096)return send(400,{error:'INVALID_REQUEST'});
    const booking=await management.read(body.token);
    if(booking?.status!=='CONFIRMED')return send(409,{error:'CONFIRMATION_NOT_READY'});
    const recipient=await resolveRecipient({proof:body.recipientProof,reservationId:body.token.split('.')[0]});
    if(recipient?.verified!==true||!validEmailAddress(recipient.email))return send(403,{error:'RECIPIENT_NOT_VERIFIED'});
    const intent=await delivery.queue({recipientEmail:recipient.email,managementUrl:allowedOrigin+'/book/manage#'+body.token});
    if(intent?.reservationId!==body.token.split('.')[0]||typeof intent.intentId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(intent.intentId))throw Error('INVALID_CONFIRMATION_RESULT');
    const result=await delivery.dispatch({reservationId:intent.reservationId,intentId:intent.intentId});
    if(!['QUEUED','RETRYABLE','UNKNOWN','ACCEPTED','SUPERSEDED'].includes(result?.status)||typeof result.providerAccepted!=='boolean'||result.providerAccepted!==(result.status==='ACCEPTED')||result.delivered!==false)throw Error('INVALID_CONFIRMATION_RESULT');
    return send(result.status==='ACCEPTED'?200:result.status==='SUPERSEDED'?409:202,{status:result.status,providerAccepted:result.providerAccepted,delivered:false});
   }finally{active--;}
  }catch(error){
   if(response.headersSent){response.destroy();return;}
   if(['MANAGEMENT_DENIED','INVALID_MANAGEMENT_CAPABILITY'].includes(error?.message))return send(403,{error:'MANAGEMENT_DENIED'});
   if(['DELIVERY_BINDING_CONFLICT','CONFIRMATION_NOT_READY'].includes(error?.message))return send(409,{error:'REQUEST_CONFLICT'});
   const transport={INVALID_REQUEST:400,REQUEST_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415};
   if(Object.hasOwn(transport,error?.message)&&transport[error.message]===error.httpStatus)return send(error.httpStatus,{error:error.message});
   return send(503,{error:'SERVICE_UNAVAILABLE'});
  }
 };
}
