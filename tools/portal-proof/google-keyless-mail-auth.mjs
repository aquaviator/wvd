import {createKeylessGoogleToken} from './google-keyless-token.mjs';
import {readBoundedProviderJson} from './provider-json.mjs';
const endpoint='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

// Only the configured Workspace subject; no inbox reads or caller credentials.
export function createKeylessMailAuthClient(options) {
 const {request=fetch}=options;
 const grant=createKeylessGoogleToken({...options,purpose:'mail-send'});
 return {
  async verifyAccess(){await grant.token();return {status:'MAIL_SEND_SCOPE_PRESENT_NO_MESSAGE_SENT'};},
  async request(options){
   if(!options||Object.keys(options).some(key=>!['url','method','data','timeout','signal','retry','maxRedirects','maxContentLength','responseType'].includes(key))||options.url!==endpoint||options.method!=='POST'||options.retry!==false||options.maxRedirects!==0||options.responseType!=='json'||!Number.isSafeInteger(options.timeout)||options.timeout<1||options.timeout>15000||!Number.isSafeInteger(options.maxContentLength)||options.maxContentLength<1||options.maxContentLength>16384||!options.data||Object.keys(options.data).join(',')!=='raw'||typeof options.data.raw!=='string'||options.data.raw.length<1||options.data.raw.length>32768||!/^[A-Za-z0-9_-]+$/.test(options.data.raw))throw Error('INVALID_MAIL_CONFIGURATION');
   const token=await grant.token();
   try{
    const response=await request(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(options.data),redirect:'error',signal:AbortSignal.timeout(options.timeout)});
    if(!response.ok){if(response.status===401)grant.invalidate();await response.body?.cancel();throw Error();}
    return {data:await readBoundedProviderJson(response,options.maxContentLength)};
   }catch{throw Error('MAIL_REQUEST_OUTCOME_UNKNOWN');}
  }
 };
}
