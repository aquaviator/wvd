import {isDeepStrictEqual} from 'node:util';
import {readBoundedProviderJson} from './provider-json.mjs';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const scopes={'calendar-events':'https://www.googleapis.com/auth/calendar.events','calendar-freebusy':'https://www.googleapis.com/auth/calendar.freebusy','mail-send':'https://www.googleapis.com/auth/gmail.send'};
// Shared IAM signing/token exchange. Fixed purposes; no arbitrary OAuth scope.
export function createKeylessGoogleToken({signer,serviceAccount,subject,purpose,clock,request=fetch}) {
 if(typeof signer?.request!=='function'||typeof serviceAccount!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(serviceAccount)||typeof subject!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)||subject.length>254||!Object.hasOwn(scopes,purpose)||typeof clock!=='function'||typeof request!=='function')throw Error('INVALID_CONFIGURATION');
 const now=()=>{const value=clock();if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)throw Error('CREDENTIAL_UNAVAILABLE');return Date.parse(value);};
  let cached=null,refresh=null;
  const token=async()=>{
   const at=now();if(cached&&at>=cached.createdAt&&at<cached.expiresAt-30000)return cached.value;
   if(refresh)return refresh;
   refresh=(async()=>{
    try{
     const issued=Math.floor(at/1000),claims={iss:serviceAccount,scope:scopes[purpose],aud:TOKEN_URL,iat:issued,exp:issued+300,...(purpose!=='calendar-freebusy'?{sub:subject}:{})};
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
 return {token,invalidate(){cached=null;}};
}
