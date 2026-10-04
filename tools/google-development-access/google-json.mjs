import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
// Shared transport for bounded read-only development probes. No token lookup,
// refresh, redirects, retries or provider payloads in errors.
export async function readGoogleJson(url, options, token, {request=fetch, timeoutMs=15000}={}) {
  if(typeof token!=='string'||!token.length||/\s/.test(token))throw Error('CREDENTIAL_REQUIRED');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('INVALID_TIMEOUT');
  const response=await request(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error(response.status===401?'CREDENTIAL_REJECTED':response.status===403?'ACCESS_DENIED_OR_API_DISABLED':response.status===404?'TARGET_NOT_FOUND_OR_NOT_SHARED':'PROVIDER_ERROR');
  return readBoundedProviderJson(response,65536);
}
