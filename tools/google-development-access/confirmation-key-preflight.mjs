import {pathToFileURL} from 'node:url';
import {createGoogleBookingCipher} from '../portal-proof/google-booking-cipher.mjs';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';

export async function verifyConfirmationKey(token,{request=fetch}={}) {
 if(typeof token!=='string'||!token.length||token.length>8192||/\s/.test(token))throw Error('CONFIRMATION_KEY_ACCESS_FAILED');
 const url='https://secretmanager.googleapis.com/v1/projects/wvd-development/secrets/wvd-booking-confirmation-key/versions/1:access';
 const authClient={async request(options){
  if(options.url!==url||options.method!=='GET')throw Error('CONFIRMATION_KEY_ACCESS_FAILED');
  const response=await request(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok){await response.body?.cancel();throw Error('CONFIRMATION_KEY_ACCESS_FAILED');}
  return {data:await readBoundedProviderJson(response,4096)};
 }};
 try{
  const cipher=createGoogleBookingCipher({authClient,projectId:'wvd-development',secretId:'wvd-booking-confirmation-key',activeKey:'confirmation-v1',versions:{'confirmation-v1':'1'}});
  return await cipher.verifyAccess();
 }catch{throw Error('CONFIRMATION_KEY_ACCESS_FAILED');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await verifyConfirmationKey(process.env.WVD_GOOGLE_ACCESS_TOKEN)));}
 catch{console.error('CONFIRMATION_KEY_ACCESS_FAILED');process.exitCode=1;}
}
