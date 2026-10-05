import {appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {deploymentClient,serviceName,imagePrefix} from './private-deployment.mjs';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
const approvedImage=imagePrefix+'@sha256:120456cea9b0f4c873ae2c24113ff0f235a0593ca592e2bcaa87c0d50aa9891f';
const validUrl=value=>typeof value==='string'&&/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/.test(value);
export async function preparePrivateHttp(token,{request=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const api=deploymentClient(token,{request}),service=await api('/v2/'+serviceName);
 if(service.name!==serviceName||service.invokerIamDisabled===true||service.template?.containers?.[0]?.image!==approvedImage||service.labels?.product!=='wvd'||service.labels?.environment!=='development'||!['INGRESS_TRAFFIC_INTERNAL_ONLY','INGRESS_TRAFFIC_ALL'].includes(service.ingress)||service.scaling?.maxInstanceCount!==1||(service.scaling?.minInstanceCount??0)!==0||!validUrl(service.uri)||typeof service.etag!=='string')throw Error('PRIVATE_HTTP_TARGET_MISMATCH');
 const permission=await api('/v2/'+serviceName+':testIamPermissions',{method:'POST',body:{permissions:['run.routes.invoke']}});
 if(!permission.permissions?.includes('run.routes.invoke'))throw Error('PRIVATE_INVOCATION_ACCESS_REQUIRED');
 if(service.ingress==='INGRESS_TRAFFIC_INTERNAL_ONLY'){
  const op=await api('/v2/'+serviceName+'?updateMask=ingress',{method:'PATCH',body:{name:serviceName,etag:service.etag,ingress:'INGRESS_TRAFFIC_ALL'}});
  if(!/^projects\/wvd-development\/locations\/europe-west2\/operations\/[A-Za-z0-9_-]+$/.test(op.name??''))throw Error('INGRESS_OUTCOME_UNKNOWN');
  let result=op;for(let i=0;!result.done&&i<36;i++){await wait(5000);result=await api('/v2/'+op.name);}
  if(!result.done||result.error)throw Error('INGRESS_UPDATE_NOT_CONFIRMED');
 }
 const probe=await request(service.uri+'/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(![401,403].includes(probe.status)){
  // Restore internal ingress if denial cannot be established. Do not change IAM.
  const current=await api('/v2/'+serviceName);
  await api('/v2/'+serviceName+'?updateMask=ingress',{method:'PATCH',body:{name:serviceName,etag:current.etag,ingress:'INGRESS_TRAFFIC_INTERNAL_ONLY'}});
  throw Error('ANONYMOUS_DENIAL_NOT_CONFIRMED_INTERNAL_RESTORE_REQUESTED');
 }
 return {status:'AUTHENTICATED_NETWORK_PATH_READY',url:service.uri,anonymousDenied:true};
}
export async function verifyPrivateHttp(url,token,{request=fetch}={}){
 if(!validUrl(url)||typeof token!=='string'||!token||/\s/.test(token))throw Error('INVALID_HTTP_PROBE');
 const response=await request(url+'/health',{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(60000)});
 if(response.status!==200)throw Error('AUTHENTICATED_HTTP_FAILED');
 const data=await readBoundedProviderJson(response,4096);
 if(data.status!=='RUNNING'||data.providerAccessChecked!==true||typeof data.providerCheckedAt!=='string'||!Number.isFinite(Date.parse(data.providerCheckedAt)))throw Error('PROVIDER_STARTUP_NOT_VERIFIED');
 return {status:'PRIVATE_HTTP_PASS',providerCheckedAt:data.providerCheckedAt,bookingMutationPerformed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{
 let result;if(process.argv[2]==='prepare'&&process.argv.length===3){result=await preparePrivateHttp(process.env.WVD_GOOGLE_ACCESS_TOKEN);if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`url=${result.url}\n`);}
 else if(process.argv[2]==='verify'&&process.argv.length===4)result=await verifyPrivateHttp(process.argv[3],process.env.WVD_RUNTIME_ID_TOKEN);
 else throw Error('INVALID_COMMAND');console.log(JSON.stringify(result));
}catch(e){console.error(/^[A-Z0-9_]+$/.test(e?.message??'')?e.message:'PRIVATE_HTTP_FAILED');process.exitCode=1;}}
