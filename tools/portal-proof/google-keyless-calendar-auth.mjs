import {isDeepStrictEqual} from 'node:util';
import {readBoundedProviderJson} from './provider-json.mjs';
const TOKEN_URL='https://oauth2.googleapis.com/token';
// IAM signs using Google's managed key. Two fixed OAuth purposes; only event
// access delegates to the configured organiser. No downloaded service-account key.
export function createKeylessCalendarAuthClients({signer,serviceAccount,subject,calendarId,clock,request=fetch}){
 if(typeof signer?.request!=='function'||typeof serviceAccount!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(serviceAccount)||typeof subject!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)||subject.length>254||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||typeof clock!=='function'||typeof request!=='function')throw Error('INVALID_CONFIGURATION');
 const now=()=>{const value=clock();if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('CREDENTIAL_UNAVAILABLE');return Date.parse(value);};
 const createClient=delegated=>{
  let cached=null,refresh=null;
  const token=async()=>{
   const at=now();if(cached&&at>=cached.createdAt&&at<cached.expiresAt-30000)return cached.value;
   if(refresh)return refresh;
   refresh=(async()=>{
    try{
     const issued=Math.floor(at/1000),claims={iss:serviceAccount,scope:'https://www.googleapis.com/auth/calendar.'+(delegated?'events':'freebusy'),aud:TOKEN_URL,iat:issued,exp:issued+300,...(delegated?{sub:subject}:{})};
     const {data}=await signer.request({url:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(serviceAccount)+':signJwt',method:'POST',data:{payload:JSON.stringify(claims)},timeout:10000,signal:AbortSignal.timeout(10000),retry:false,maxRedirects:0,maxContentLength:32768,responseType:'json'});
     if(typeof data?.signedJwt!=='string'||data.signedJwt.length>16384||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.signedJwt))throw Error();
     const [header,payload]=data.signedJwt.split('.');if(JSON.parse(Buffer.from(header,'base64url')).alg!=='RS256'||!isDeepStrictEqual(JSON.parse(Buffer.from(payload,'base64url')),claims))throw Error();
     const response=await request(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:data.signedJwt}).toString(),redirect:'error',signal:AbortSignal.timeout(10000)});
     if(!response.ok){await response.body?.cancel();throw Error();}
     const grant=await readBoundedProviderJson(response,32768);
     if(grant.token_type!=='Bearer'||typeof grant.access_token!=='string'||!grant.access_token.length||grant.access_token.length>8192||/\s/.test(grant.access_token)||!Number.isSafeInteger(grant.expires_in)||grant.expires_in<60||grant.expires_in>3600)throw Error();
     cached={value:grant.access_token,createdAt:at,expiresAt:at+grant.expires_in*1000};if(now()>=cached.expiresAt-30000)throw Error();return cached.value;
    }catch{cached=null;throw Error('CREDENTIAL_UNAVAILABLE');}
   })();
   try{return await refresh;}finally{refresh=null;}
  };
  return {async request(options){
   let url;try{url=new URL(options?.url);}catch{throw Error('INVALID_CONFIGURATION');}
   const eventPath='/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events';
   if(url.origin!=='https://www.googleapis.com'||url.username||url.password||url.search||url.hash||!(delegated?(url.pathname===eventPath||url.pathname.startsWith(eventPath+'/'))&&['GET','POST','PATCH','DELETE'].includes(options.method):url.pathname==='/calendar/v3/freeBusy'&&options.method==='POST')||options.retry!==false||options.maxRedirects!==0||!Number.isSafeInteger(options.timeout)||options.timeout<1||options.timeout>15000||!Number.isSafeInteger(options.maxContentLength)||options.maxContentLength<1||options.maxContentLength>1048576||options.headers&&(Object.keys(options.headers).join(',')!=='If-Match'||typeof options.headers['If-Match']!=='string'||!/^"[\x21\x23-\x7e]{1,256}"$/.test(options.headers['If-Match'])))throw Error('INVALID_CONFIGURATION');
   if(options.params){for(const [name,value]of Object.entries(options.params)){if(!['string','boolean','number'].includes(typeof value))throw Error('INVALID_CONFIGURATION');url.searchParams.set(name,String(value));}}
   const headers={Authorization:'Bearer '+await token(),Accept:'application/json',...(options.data?{'Content-Type':'application/json'}:{}),...(options.headers??{})};
   let response;try{response=await request(url.href,{method:options.method,headers,...(options.data?{body:JSON.stringify(options.data)}:{}),redirect:'error',signal:options.signal??AbortSignal.timeout(options.timeout)});}catch{throw Error('CALENDAR_REQUEST_FAILED');}
   if(!response.ok){if(response.status===401)cached=null;await response.body?.cancel();const error=Error('CALENDAR_REQUEST_FAILED');error.response={status:response.status};throw error;}
   if(response.status===204)return {data:{}};
   try{return {data:await readBoundedProviderJson(response,options.maxContentLength)};}catch{throw Error('CALENDAR_RESPONSE_INVALID');}
  }};
 };
 return {eventAuthClient:createClient(true),freeBusyAuthClient:createClient(false)};
}
