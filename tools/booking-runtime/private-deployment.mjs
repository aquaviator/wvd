import {appendFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
import {bookingRuntimePreflight} from '../google-development-access/booking-runtime-preflight.mjs';
import {hostingDiscovery} from '../google-development-access/hosting-discovery.mjs';
export const serviceName='projects/wvd-development/locations/europe-west2/services/wvd-booking-development';
export const imagePrefix='europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/booking';
export const updateFrom=imagePrefix+'@sha256:82b3020bdb98e789c72e4be0823a09dd733ecd3c3cca099548d4cce0b94baebe';
export function privateService(image,revision){
 if(typeof image!=='string'||!image.startsWith(imagePrefix+'@sha256:')||!/^[a-f0-9]{64}$/.test(image.slice((imagePrefix+'@sha256:').length))||!/^[a-f0-9]{40}$/.test(revision))throw Error('INVALID_DEPLOYMENT_BINDING');
 return {labels:{product:'wvd',environment:'development','source-revision':revision},ingress:'INGRESS_TRAFFIC_INTERNAL_ONLY',invokerIamDisabled:false,scaling:{minInstanceCount:0,maxInstanceCount:1},template:{serviceAccount:'wvd-development@wvd-development.iam.gserviceaccount.com',timeout:'30s',maxInstanceRequestConcurrency:4,scaling:{minInstanceCount:0,maxInstanceCount:1},containers:[{image,ports:[{containerPort:8080}],resources:{limits:{cpu:'1',memory:'512Mi'},cpuIdle:true,startupCpuBoost:false},startupProbe:{httpGet:{path:'/health',port:8080},initialDelaySeconds:0,timeoutSeconds:2,periodSeconds:5,failureThreshold:24}}]}};
}
export function canUpdatePrivateService(service){
 if(!service)return false;
 const container=service.template?.containers?.[0];
 if(service.name!==serviceName||service.labels?.product!=='wvd'||service.labels?.environment!=='development'||!['INGRESS_TRAFFIC_INTERNAL_ONLY','INGRESS_TRAFFIC_ALL'].includes(service.ingress)||service.invokerIamDisabled===true||service.scaling?.maxInstanceCount!==1||(service.scaling?.minInstanceCount??0)!==0||service.template?.serviceAccount!=='wvd-development@wvd-development.iam.gserviceaccount.com'||service.template?.containers?.length!==1||container?.env?.length||service.template?.volumes?.length)throw Error('EXISTING_SERVICE_DRIFT');
 if(container.image!==updateFrom)return false;
 if(service.ingress!=='INGRESS_TRAFFIC_INTERNAL_ONLY')throw Error('EXISTING_SERVICE_DRIFT');
 if(typeof service.etag!=='string'||!service.etag.length||service.etag.length>256)throw Error('SERVICE_REVISION_REQUIRED');
 return true;
}
export function deploymentClient(token,{request=fetch}={}){
 if(typeof token!=='string'||!token||/\s/.test(token))throw Error('CREDENTIAL_REQUIRED');
 return async(path,{method='GET',body,allowMissing=false}={})=>{
  if(!path.startsWith('/v2/projects/wvd-development/locations/europe-west2/'))throw Error('FOREIGN_TARGET');
  const r=await request('https://run.googleapis.com'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(r.status===404&&allowMissing)return null;
  if(!r.ok)throw Error(`CLOUD_RUN_HTTP_${r.status}`);
  return readBoundedProviderJson(r,65536);
 };
}
export async function preparePrivateDeployment(binding,token,{request=fetch}={}){
 const runtime=await bookingRuntimePreflight(binding,token,{request});
 if(runtime.status!=='ACCESS_PRESENT')throw Error('RUNTIME_ACCESS_REQUIRED');
 const hosting=await hostingDiscovery(binding,token,{request});
 const repo=hosting.results.find(x=>x.check==='booking-image-repository');
 if(repo?.status!=='PASS'||!repo.immutableTags||!repo.scanningDisabled||hosting.results.find(x=>x.check==='booking-image-upload')?.status!=='PASS')throw Error('REPOSITORY_CONFIGURATION_OR_ACCESS_REQUIRED');
 const current=await deploymentClient(token,{request})(`/v2/${serviceName}`,{allowMissing:true});
 const update=canUpdatePrivateService(current);
 return {create:current===null||update,status:current===null?'READY_FOR_PRIVATE_CREATION':update?'READY_FOR_BOUND_PRIVATE_UPDATE':'EXISTING_SERVICE_NO_CHANGE'};
}
export async function createPrivateDeployment(image,revision,token,{request=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const body=privateService(image,revision),api=deploymentClient(token,{request});
 const current=await api(`/v2/${serviceName}`,{allowMissing:true});
 if(current&&!canUpdatePrivateService(current))return {status:'EXISTING_SERVICE_NO_CHANGE'};
 const op=current?await api(`/v2/${serviceName}?updateMask=template,labels`,{method:'PATCH',body:{name:serviceName,etag:current.etag,template:body.template,labels:body.labels}}):await api('/v2/projects/wvd-development/locations/europe-west2/services?serviceId=wvd-booking-development',{method:'POST',body});
 if(typeof op.name!=='string'||!/^projects\/wvd-development\/locations\/europe-west2\/operations\/[A-Za-z0-9_-]+$/.test(op.name))throw Error('CREATION_OUTCOME_UNKNOWN');
 let result=op;
 for(let i=0;!result.done&&i<72;i++){await wait(5000);result=await api('/v2/'+op.name);}
 if(!result.done)throw Error('CREATION_PENDING_CHECK_EXISTING_SERVICE');
 if(result.error)throw Error('CREATION_FAILED_CHECK_CLOUD_RUN');
 const service=await api(`/v2/${serviceName}`);
 if(service.name!==serviceName||service.invokerIamDisabled===true||service.ingress!=='INGRESS_TRAFFIC_INTERNAL_ONLY'||service.template?.containers?.[0]?.image!==image||service.terminalCondition?.state!=='CONDITION_SUCCEEDED'||service.scaling?.maxInstanceCount!==1||(service.scaling?.minInstanceCount??0)!==0)throw Error('SERVICE_CONFIGURATION_OR_READINESS_MISMATCH');
 return {status:'PRIVATE_RUNTIME_READY',service:serviceName,revision,providerBusinessFlowVerified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const token=process.env.WVD_GOOGLE_ACCESS_TOKEN,mode=process.argv[2];let result;
  if(mode==='prepare'&&process.argv.length===4){result=await preparePrivateDeployment(JSON.parse(readFileSync(process.argv[3],'utf8')),token);if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`create=${result.create}\n`);}
  else if(mode==='create'&&process.argv.length===5)result=await createPrivateDeployment(process.argv[3],process.argv[4],token);
  else throw Error('INVALID_COMMAND');
  console.log(JSON.stringify(result));
 }catch(error){console.error(/^[A-Z0-9_]+$/.test(error?.message??'')?error.message:'PRIVATE_DEPLOYMENT_FAILED');process.exitCode=1;}
}
