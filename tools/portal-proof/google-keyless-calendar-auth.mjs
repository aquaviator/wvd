import {createKeylessGoogleToken} from './google-keyless-token.mjs';
import {readBoundedProviderJson} from './provider-json.mjs';
// IAM signs using Google's managed key. Two fixed OAuth purposes; only event
// access delegates to the configured organiser. No downloaded service-account key.
export function createKeylessCalendarAuthClients({signer,serviceAccount,subject,calendarId,clock,request=fetch}){
 if(typeof signer?.request!=='function'||typeof serviceAccount!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(serviceAccount)||typeof subject!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)||subject.length>254||typeof calendarId!=='string'||!calendarId.length||calendarId.length>256||typeof clock!=='function'||typeof request!=='function')throw Error('INVALID_CONFIGURATION');
 const createClient=delegated=>{
  const grant=createKeylessGoogleToken({signer,serviceAccount,subject,purpose:delegated?'calendar-events':'calendar-freebusy',clock,request}),token=grant.token;
  return {async request(options){
   let url;try{url=new URL(options?.url);}catch{throw Error('INVALID_CONFIGURATION');}
   const eventPath='/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events';
   if(url.origin!=='https://www.googleapis.com'||url.username||url.password||url.search||url.hash||!(delegated?(url.pathname===eventPath||url.pathname.startsWith(eventPath+'/'))&&['GET','POST','PATCH','DELETE'].includes(options.method):url.pathname==='/calendar/v3/freeBusy'&&options.method==='POST')||options.retry!==false||options.maxRedirects!==0||!Number.isSafeInteger(options.timeout)||options.timeout<1||options.timeout>15000||!Number.isSafeInteger(options.maxContentLength)||options.maxContentLength<1||options.maxContentLength>1048576||options.headers&&(Object.keys(options.headers).join(',')!=='If-Match'||typeof options.headers['If-Match']!=='string'||!/^"[\x21\x23-\x7e]{1,256}"$/.test(options.headers['If-Match'])))throw Error('INVALID_CONFIGURATION');
   if(options.params){for(const [name,value]of Object.entries(options.params)){if(!['string','boolean','number'].includes(typeof value))throw Error('INVALID_CONFIGURATION');url.searchParams.set(name,String(value));}}
   const headers={Authorization:'Bearer '+await token(),Accept:'application/json',...(options.data?{'Content-Type':'application/json'}:{}),...(options.headers??{})};
   let response;try{response=await request(url.href,{method:options.method,headers,...(options.data?{body:JSON.stringify(options.data)}:{}),redirect:'error',signal:options.signal??AbortSignal.timeout(options.timeout)});}catch{throw Error('CALENDAR_REQUEST_FAILED');}
   if(!response.ok){if(response.status===401)grant.invalidate();await response.body?.cancel();const error=Error('CALENDAR_REQUEST_FAILED');error.response={status:response.status};throw error;}
   if(response.status===204)return {data:{}};
   try{return {data:await readBoundedProviderJson(response,options.maxContentLength)};}catch{throw Error('CALENDAR_RESPONSE_INVALID');}
  }};
 };
 return {eventAuthClient:createClient(true),freeBusyAuthClient:createClient(false)};
}
