// Trusted explicit-version key reader for the existing envelope cipher.
// No latest-version fallback or key material in returned errors/logs.
export function createGoogleBookingKeyReader({authClient,projectId,secretId,requestTimeoutMs=10000}){
 if(typeof authClient?.request!=='function'||typeof projectId!=='string'||!/^[a-z][a-z0-9-]{4,62}$/.test(projectId)||typeof secretId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(secretId)||!Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>15000)throw Error('INVALID_KEY_CONFIGURATION');
 const prefix=`projects/${projectId}/secrets/${secretId}/versions/`;
 return async keyRef=>{
  if(typeof keyRef!=='string'||!keyRef.startsWith(prefix)||!/^[1-9][0-9]{0,15}$/.test(keyRef.slice(prefix.length)))throw Error('INVALID_KEY_REFERENCE');
  try{
   const {data}=await authClient.request({url:`https://secretmanager.googleapis.com/v1/${keyRef}:access`,method:'GET',timeout:requestTimeoutMs,signal:AbortSignal.timeout(requestTimeoutMs),retry:false,maxRedirects:0,maxContentLength:4096,responseType:'json'});
   // Google may canonicalise the project ID to its number in the returned name;
   // the fixed request target is authoritative. Validate the secret/version suffix.
   if(typeof data?.name!=='string'||!new RegExp('^projects/[a-z0-9-]+/secrets/'+secretId+'/versions/'+keyRef.slice(prefix.length)+'$').test(data.name)||typeof data?.payload?.data!=='string')throw Error();
   const key=Buffer.from(data.payload.data,'base64');if(key.length!==32||key.toString('base64')!==data.payload.data){key.fill(0);throw Error();}return key;
  }catch{throw Error('BOOKING_KEY_UNAVAILABLE');}
 };
}
