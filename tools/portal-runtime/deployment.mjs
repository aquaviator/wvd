import {appendFileSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {liveServiceConfiguration} from '../portal-proof/live-config.mjs';
import {readBoundedProviderJson} from '../portal-proof/provider-json.mjs';
import {bookingRuntimePreflight} from '../google-development-access/booking-runtime-preflight.mjs';
import {hostingDiscovery} from '../google-development-access/hosting-discovery.mjs';

// A separate service and image; none of these commands can mutate booking.
export const serviceName='projects/wvd-development/locations/europe-west2/services/wvd-service';
export const imagePrefix='europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service';
const serviceAccount='wvd-development@wvd-development.iam.gserviceaccount.com';
const initialOrigin='https://wearvalleydigital.com';
const configAnnotation='wvd.dev/config-sha256';
const imageAnnotation='wvd.dev/image-sha256';
const servicePath=`/v2/${serviceName}`;
const collectionPath='/v2/projects/wvd-development/locations/europe-west2/services?serviceId=wvd-service';
const operationPattern=/^projects\/wvd-development\/locations\/europe-west2\/operations\/[A-Za-z0-9_-]+$/;
const sourcePattern=/^[a-f0-9]{40}$/;
const digestPattern=/^[a-f0-9]{64}$/;
const clone=value=>JSON.parse(JSON.stringify(value));
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const configurationHash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const validImage=value=>typeof value==='string'&&value.startsWith(imagePrefix+'@sha256:')&&digestPattern.test(value.slice((imagePrefix+'@sha256:').length));
const validToken=value=>typeof value==='string'&&value.length>0&&value.length<=16384&&!/\s/.test(value);

export function providerOrigin(value) {
  let url;try{url=new URL(value);}catch{throw Error('INVALID_PROVIDER_ORIGIN');}
  if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port||!(/^wvd-service-[a-z0-9]+-[a-z0-9]+\.a\.run\.app$/.test(url.hostname)||url.hostname==='wvd-service-6616382131.europe-west2.run.app'))throw Error('INVALID_PROVIDER_ORIGIN');
  return value;
}

export function serviceConfiguration(value) {
  const checked=liveServiceConfiguration(value,{}),p=checked.portal,e=checked.enquiries,m=checked.mail;
  if(checked.authentication.serviceAccount!==serviceAccount||p.firebase.projectId!=='wvd-development'||p.firebase.productId!=='wvd'||p.firebase.databaseId!=='(default)'||p.web.appId!=='1:6616382131:web:59b4e6749ce6e6e96b8ec6'||p.maxConcurrentRequests!==8||p.owner!==null&&p.owner.email!=='admin@wearvalleydigital.com'||canonical([...e.allowedPublicOrigins].sort())!==canonical([initialOrigin,'https://www.wearvalleydigital.com'].sort())||e.admission.minuteLimit!==10||e.admission.dailyLimit!==50||e.maxConcurrentRequests!==2||e.retentionDays!==90||m!==null&&(m.subject!=='admin@wearvalleydigital.com'||m.senderEmail!=='admin@wearvalleydigital.com'||m.recipientEmail!=='hello@wearvalleydigital.com'||m.requestTimeoutMs!==10000))throw Error('SERVICE_CONFIGURATION_OUT_OF_SCOPE');
  if(p.origin!==initialOrigin)providerOrigin(p.origin);
  if(p.workspaces&&canonical(p.workspaces)!==canonical({clientOrigin:'https://portal.wearvalleydigital.com',adminOrigin:'https://admin.wearvalleydigital.com',websiteOrigin:initialOrigin}))throw Error('SERVICE_CONFIGURATION_OUT_OF_SCOPE');
  if(Buffer.byteLength(canonical(checked))>16384)throw Error('CONFIGURATION_TOO_LARGE');
  return checked;
}

function forOrigin(config,origin) {
  providerOrigin(origin);
  const checked=serviceConfiguration(config);
  if(checked.portal.origin!==initialOrigin&&checked.portal.origin!==origin)throw Error('SERVICE_ORIGIN_CONFLICT');
  return serviceConfiguration({...checked,portal:{...checked.portal,origin}});
}

function releaseBinding(value,{complete=false}={}) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['schemaVersion','service','sourceRevision','image','configSha256','url'].includes(key))||!sourcePattern.test(value.sourceRevision)||!validImage(value.image)||!digestPattern.test(value.configSha256)||value.schemaVersion!==undefined&&value.schemaVersion!==1||value.service!==undefined&&value.service!==serviceName)throw Error('INVALID_RELEASE_BINDING');
  if(value.url!==undefined)providerOrigin(value.url);
  if(complete&&(!exact(value,['schemaVersion','service','sourceRevision','image','configSha256','url'])||value.schemaVersion!==1||value.service!==serviceName))throw Error('INVALID_RELEASE_BINDING');
  return value;
}

export function desiredService(image,sourceRevision,configuration) {
  if(!validImage(image)||!sourcePattern.test(sourceRevision))throw Error('INVALID_DEPLOYMENT_BINDING');
  const config=serviceConfiguration(configuration);
  return {
    labels:{product:'wvd',environment:'development',component:'service','managed-by':'wvd-controller','source-revision':sourceRevision},
    annotations:{[configAnnotation]:configurationHash(config),[imageAnnotation]:image.slice((imagePrefix+'@sha256:').length)},
    ingress:'INGRESS_TRAFFIC_ALL',invokerIamDisabled:false,
    scaling:{minInstanceCount:0,maxInstanceCount:1},
    template:{serviceAccount,timeout:'60s',maxInstanceRequestConcurrency:4,scaling:{minInstanceCount:0,maxInstanceCount:1},containers:[{
      image,ports:[{containerPort:8080}],env:[{name:'WVD_SERVICE_CONFIG_JSON',value:canonical(config)}],
      resources:{limits:{cpu:'1',memory:'512Mi'},cpuIdle:true,startupCpuBoost:false},
      startupProbe:{httpGet:{path:'/health',port:8080},initialDelaySeconds:0,timeoutSeconds:2,periodSeconds:5,failureThreshold:24}
    }]}
  };
}

export function inspectManagedService(service,{ready=false}={}) {
  const t=service?.template,c=t?.containers?.[0],s=service?.scaling,probe=c?.startupProbe;
  if(service?.name!==serviceName||service.labels?.product!=='wvd'||service.labels?.environment!=='development'||service.labels?.component!=='service'||service.labels?.['managed-by']!=='wvd-controller'||!sourcePattern.test(service.labels?.['source-revision'])||service.ingress!=='INGRESS_TRAFFIC_ALL'||service.invokerIamDisabled!==undefined&&typeof service.invokerIamDisabled!=='boolean'||service.defaultUriDisabled===true||service.iapEnabled===true||s?.maxInstanceCount!==1||(s?.minInstanceCount??0)!==0||t?.serviceAccount!==serviceAccount||t.timeout!=='60s'||t.maxInstanceRequestConcurrency!==4||t.scaling?.maxInstanceCount!==1||(t.scaling?.minInstanceCount??0)!==0||t.containers?.length!==1||t.volumes?.length||t.vpcAccess||t.encryptionKey||t.nodeSelector||t.gpuZonalRedundancyDisabled||t.sessionAffinity===true||!validImage(c?.image)||c.command?.length||c.args?.length||c.volumeMounts?.length||c.dependsOn?.length||c.livenessProbe||c.readinessProbe||c.baseImageUri||c.workingDir||c.ports?.length!==1||c.ports[0]?.containerPort!==8080||c.ports[0]?.name&&c.ports[0].name!=='http1'||c.resources?.limits?.cpu!=='1'||c.resources?.limits?.memory!=='512Mi'||Object.keys(c.resources?.limits??{}).length!==2||c.resources.cpuIdle!==true||c.resources.startupCpuBoost===true||probe?.httpGet?.path!=='/health'||probe.httpGet.port!==8080||probe.httpGet.httpHeaders?.length||probe.tcpSocket||probe.grpc||(probe.initialDelaySeconds??0)!==0||probe.timeoutSeconds!==2||probe.periodSeconds!==5||probe.failureThreshold!==24||c.env?.length!==1||!exact(c.env[0],['name','value'])||c.env[0].name!=='WVD_SERVICE_CONFIG_JSON'||typeof c.env[0].value!=='string'||Buffer.byteLength(c.env[0].value)>16384)throw Error('EXISTING_SERVICE_DRIFT');
  if(service.traffic?.length&&(service.traffic.length!==1||service.traffic[0].type!=='TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST'||service.traffic[0].percent!==100||service.traffic[0].tag||service.traffic[0].revision))throw Error('EXISTING_SERVICE_TRAFFIC_DRIFT');
  if(service.annotations?.[imageAnnotation]!==c.image.slice((imagePrefix+'@sha256:').length))throw Error('EXISTING_SERVICE_IMAGE_DRIFT');
  let config;try{config=serviceConfiguration(JSON.parse(c.env[0].value));}catch{throw Error('EXISTING_SERVICE_CONFIGURATION_DRIFT');}
  const configSha256=configurationHash(config);
  if(service.annotations?.[configAnnotation]!==configSha256)throw Error('EXISTING_SERVICE_CONFIGURATION_DRIFT');
  if(typeof service.etag!=='string'||service.etag.length<1||service.etag.length>256)throw Error('SERVICE_ETAG_REQUIRED');
  const url=providerOrigin(service.uri);
  if(config.portal.origin!==initialOrigin&&config.portal.origin!==url)throw Error('EXISTING_SERVICE_CONFIGURATION_DRIFT');
  if(ready&&(service.reconciling===true||service.terminalCondition?.state!=='CONDITION_SUCCEEDED'))throw Error('SERVICE_NOT_READY');
  return {config,release:{schemaVersion:1,service:serviceName,sourceRevision:service.labels['source-revision'],image:c.image,configSha256,url},public:service.invokerIamDisabled===true};
}

function matchesExpected(actual,expected) {
  releaseBinding(expected);
  if(actual.sourceRevision!==expected.sourceRevision||actual.image!==expected.image||actual.configSha256!==expected.configSha256||expected.url!==undefined&&actual.url!==expected.url)throw Error('EXPECTED_RELEASE_MISMATCH');
}

export function selectDeployment(current,configuration,sourceRevision,expectedRelease) {
  const config=serviceConfiguration(configuration);
  if(!sourcePattern.test(sourceRevision))throw Error('INVALID_DEPLOYMENT_BINDING');
  if(expectedRelease!==undefined)releaseBinding(expectedRelease);
  if(current===null){
    if(expectedRelease!==undefined)throw Error('EXPECTED_SERVICE_MISSING');
    if(config.portal.origin!==initialOrigin||config.portal.owner!==null)throw Error('INITIAL_PRIVATE_CONFIGURATION_REQUIRED');
    return {status:'READY_FOR_PRIVATE_CREATION',build:true,image:'',config};
  }
  const found=inspectManagedService(current),target=forOrigin(config,found.release.url);
  const sameSource=found.release.sourceRevision===sourceRevision;
  const sameConfig=found.release.configSha256===configurationHash(target);
  // An interrupted initial creation may need only its actual provider URI bound.
  const initialResume=sameSource&&found.config.portal.origin===initialOrigin&&found.config.portal.owner===null&&configurationHash(found.config)===configurationHash(config);
  if(!sameSource||!sameConfig&&!initialResume){
    if(expectedRelease===undefined)throw Error('EXPECTED_RELEASE_REQUIRED');
    matchesExpected(found.release,expectedRelease);
  }else if(expectedRelease!==undefined){
    // A completed retry may already have reached the desired release.
    if(!sameConfig&&!initialResume)matchesExpected(found.release,expectedRelease);
  }
  return {status:sameSource&&sameConfig?'EXISTING_SOURCE_AND_CONFIGURATION':initialResume?'READY_FOR_ORIGIN_BINDING':'READY_FOR_BOUND_UPDATE',build:!sameSource,image:sameSource?found.release.image:'',config:target,current:found};
}

export function deploymentClient(token,{request=fetch}={}) {
  if(!validToken(token))throw Error('CREDENTIAL_REQUIRED');
  return async(path,{method='GET',body,allowMissing=false}={})=>{
    const serviceRead=method==='GET'&&(path===servicePath||path===servicePath+':getIamPolicy');
    const serviceWrite=method==='PATCH'&&path===servicePath+'?updateMask=template.containers,labels,annotations';
    const create=method==='POST'&&path===collectionPath;
    const operation=method==='GET'&&path.startsWith('/v2/')&&operationPattern.test(path.slice(4));
    if(!serviceRead&&!serviceWrite&&!create&&!operation)throw Error('FOREIGN_TARGET_OR_OPERATION');
    let response;
    try{response=await request('https://run.googleapis.com'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error(method==='GET'?'CLOUD_RUN_READ_FAILED':'CLOUD_RUN_WRITE_OUTCOME_UNKNOWN');}
    if(response.status===404&&allowMissing&&path===servicePath)return null;
    if(!response.ok)throw Error(`CLOUD_RUN_HTTP_${response.status}`);
    try{return await readBoundedProviderJson(response,65536);}catch{throw Error(method==='GET'?'CLOUD_RUN_INVALID_RESPONSE':'CLOUD_RUN_WRITE_OUTCOME_UNKNOWN');}
  };
}

export async function prepareServiceDeployment(binding,configuration,sourceRevision,token,{request=fetch,expectedRelease}={}) {
  serviceConfiguration(configuration);
  if(!sourcePattern.test(sourceRevision))throw Error('INVALID_DEPLOYMENT_BINDING');
  if((await bookingRuntimePreflight(binding,token,{request})).status!=='ACCESS_PRESENT')throw Error('RUNTIME_ACCESS_REQUIRED');
  const hosting=await hostingDiscovery(binding,token,{request});
  const repo=hosting.results.find(item=>item.check==='booking-image-repository');
  if(repo?.status!=='PASS'||!repo.immutableTags||!repo.scanningDisabled||hosting.results.find(item=>item.check==='booking-image-upload')?.status!=='PASS')throw Error('REPOSITORY_CONFIGURATION_OR_ACCESS_REQUIRED');
  const current=await deploymentClient(token,{request})(servicePath,{allowMissing:true});
  const inventory=hosting.results.find(item=>item.check==='hosting-services');
  if(current===null&&(inventory?.status!=='PASS'||!inventory.complete||inventory.names.includes(serviceName)))throw Error('SERVICE_ABSENCE_NOT_CONFIRMED');
  const selected=selectDeployment(current,configuration,sourceRevision,expectedRelease);
  return {status:selected.status,build:selected.build,image:selected.image};
}

async function completeOperation(api,operation,wait) {
  if(typeof operation?.name!=='string'||!operationPattern.test(operation.name))throw Error('CLOUD_RUN_WRITE_OUTCOME_UNKNOWN');
  let result=operation;
  for(let count=0;!result.done&&count<72;count++){await wait(5000);result=await api('/v2/'+operation.name);}
  if(!result.done)throw Error('DEPLOYMENT_PENDING_CHECK_EXISTING_SERVICE');
  if(result.error)throw Error('DEPLOYMENT_FAILED_CHECK_CLOUD_RUN');
}

function replaceContainer(current,image,config,sourceRevision) {
  return {name:serviceName,etag:current.etag,labels:{...current.labels,'source-revision':sourceRevision},annotations:{...current.annotations,[configAnnotation]:configurationHash(config),[imageAnnotation]:image.slice((imagePrefix+'@sha256:').length)},template:{containers:[{...current.template.containers[0],image,env:[{name:'WVD_SERVICE_CONFIG_JSON',value:canonical(config)}]}]}};
}

async function assertPrivatePolicy(api) {
  const policy=await api(servicePath+':getIamPolicy');
  if(policy.bindings!==undefined&&!Array.isArray(policy.bindings)||policy.bindings?.some(binding=>!Array.isArray(binding.members)||binding.members.some(member=>member==='allUsers'||member==='allAuthenticatedUsers')))throw Error('PUBLIC_IAM_POLICY_DRIFT');
}

export async function deployService(configuration,image,sourceRevision,token,{request=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),expectedRelease}={}) {
  if(!validImage(image))throw Error('INVALID_DEPLOYMENT_BINDING');
  const api=deploymentClient(token,{request});
  let current=await api(servicePath,{allowMissing:true});
  const selected=selectDeployment(current,configuration,sourceRevision,expectedRelease);
  if(selected.image&&selected.image!==image)throw Error('SOURCE_IMAGE_CONFLICT');
  if(current===null){
    const body=desiredService(image,sourceRevision,selected.config);
    await completeOperation(api,await api(collectionPath,{method:'POST',body}),wait);
    current=await api(servicePath);
    const created=inspectManagedService(current,{ready:true});
    if(created.public||created.release.sourceRevision!==sourceRevision||created.release.image!==image||created.release.configSha256!==configurationHash(selected.config))throw Error('CREATED_SERVICE_MISMATCH');
  }else if(selected.status==='READY_FOR_BOUND_UPDATE'){
    await completeOperation(api,await api(servicePath+'?updateMask=template.containers,labels,annotations',{method:'PATCH',body:replaceContainer(current,image,selected.config,sourceRevision)}),wait);
    current=await api(servicePath);
  }
  let found=inspectManagedService(current,{ready:true});
  const bound=forOrigin(configuration,found.release.url);
  if(found.release.sourceRevision!==sourceRevision||found.release.image!==image)throw Error('DEPLOYED_RELEASE_MISMATCH');
  if(found.config.portal.origin===initialOrigin){
    if(found.public)throw Error('INITIAL_SERVICE_ALREADY_PUBLIC');
    await completeOperation(api,await api(servicePath+'?updateMask=template.containers,labels,annotations',{method:'PATCH',body:replaceContainer(current,image,bound,sourceRevision)}),wait);
    current=await api(servicePath);
    found=inspectManagedService(current,{ready:true});
  }
  if(found.release.sourceRevision!==sourceRevision||found.release.image!==image||found.release.configSha256!==configurationHash(bound)||found.config.portal.origin!==found.release.url)throw Error('DEPLOYED_RELEASE_MISMATCH');
  if(!found.public)await assertPrivatePolicy(api);
  return {status:found.public?'PUBLIC_SERVICE_UPDATED':'PRIVATE_SERVICE_PREPARED',release:found.release,providerBusinessFlowVerified:false};
}

async function readText(response,maxBytes) {
  if(!response.body)throw Error('INVALID_HTTP_RESPONSE');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw Error('HTTP_RESPONSE_TOO_LARGE');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
}

export async function verifyServiceDeployment(receipt,token,idToken,{request=fetch}={}) {
  releaseBinding(receipt,{complete:true});
  const api=deploymentClient(token,{request});
  const current=await api(servicePath),found=inspectManagedService(current,{ready:true});
  matchesExpected(found.release,receipt);
  if(found.config.portal.origin!==receipt.url)throw Error('SERVICE_ORIGIN_NOT_BOUND');
  if(!found.public){if(!validToken(idToken))throw Error('RUNTIME_ID_TOKEN_REQUIRED');await assertPrivatePolicy(api);}
  const get=async(path,headers={})=>{
    let response;try{response=await request(receipt.url+path,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('RUNTIME_HTTP_READ_FAILED');}
    return response;
  };
  const anonymous=await get('/health');
  if(!found.public&&![401,403].includes(anonymous.status))throw Error('ANONYMOUS_IAM_DENIAL_REQUIRED');
  const transport=found.public?{}:{'X-Serverless-Authorization':`Bearer ${idToken}`};
  const health=found.public?anonymous:await get('/health',transport);
  if(health.status!==200||canonical(await readBoundedProviderJson(health,4096))!==canonical({status:'ok',mode:'live-portal',providerAccessChecked:false}))throw Error('HEALTH_RESPONSE_MISMATCH');
  const auth=await get('/auth-config.json',transport);
  const expectedAuth={mode:'firebase-live',firebase:found.config.portal.web,ownerConfigured:found.config.portal.owner!==null,enquiriesEnabled:true,invitationsEnabled:true,...(found.config.portal.workspaces?{workspace:{kind:'shared',...found.config.portal.workspaces}}:{})};
  if(auth.status!==200||canonical(await readBoundedProviderJson(auth,16384))!==canonical(expectedAuth))throw Error('AUTH_CONFIGURATION_MISMATCH');
  const login=await get('/',transport);
  if(login.status!==200||!String(login.headers.get('Content-Type')).startsWith('text/html')||!String(login.headers.get('X-Robots-Tag')).includes('noindex'))throw Error('LOGIN_PAGE_MISMATCH');
  const html=await readText(login,65536);
  if(!html.includes('id="login"')||!html.includes('Continue with Google')||!html.includes('/app.js'))throw Error('LOGIN_PAGE_MISMATCH');
  const sdk=await get('/firebase-auth-sdk.js',transport);
  if(sdk.status!==200||!String(sdk.headers.get('Content-Type')).startsWith('text/javascript')||(await readText(sdk,1048576)).length<1000)throw Error('AUTH_SDK_UNAVAILABLE');
  for(const path of ['/api/portal/workspace-access','/api/admin/enquiries']){
    const denied=await get(path,{...transport,Authorization:'Bearer wvd-synthetic-invalid-firebase-token',Origin:receipt.url});
    if(denied.status!==401||canonical(await readBoundedProviderJson(denied,4096))!==canonical({error:'UNAUTHENTICATED'}))throw Error('PRIVATE_API_DENIAL_REQUIRED');
  }
  return {status:found.public?'PUBLIC_SERVICE_HTTP_VERIFIED':'PRIVATE_SERVICE_HTTP_VERIFIED',release:found.release,anonymousIamDenied:!found.public,googleLoginShellAvailable:true,googleIdentityFlowVerified:false,privateApiDenied:true,enquiryInboxDenied:true,ownerConfigured:found.config.portal.owner!==null,providerBusinessFlowVerified:false,messagesSent:false};
}

function fileJson(path,maxBytes) {
  if(!path||statSync(path).size>maxBytes)throw Error('INVALID_INPUT_FILE');
  return JSON.parse(readFileSync(path,'utf8'));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [mode,...args]=process.argv.slice(2),token=process.env.WVD_GOOGLE_ACCESS_TOKEN;let result;
    if(mode==='prepare'&&(args.length===3||args.length===4))result=await prepareServiceDeployment(fileJson(args[0],16384),fileJson(args[1],16384),args[2],token,{expectedRelease:args[3]===undefined?undefined:fileJson(args[3],4096)});
    else if(mode==='deploy'&&(args.length===3||args.length===4))result=await deployService(fileJson(args[0],16384),args[1],args[2],token,{expectedRelease:args[3]===undefined?undefined:fileJson(args[3],4096)});
    else if(mode==='verify'&&args.length===1)result=await verifyServiceDeployment(fileJson(args[0],4096),token,process.env.WVD_RUNTIME_ID_TOKEN);
    else throw Error('INVALID_COMMAND');
    if(result.release&&process.env.WVD_SERVICE_RELEASE_OUTPUT)writeFileSync(process.env.WVD_SERVICE_RELEASE_OUTPUT,JSON.stringify(result.release,null,2)+'\n',{mode:0o600});
    if(process.env.GITHUB_OUTPUT){
      const output=result.release?`image=${result.release.image}\nurl=${result.release.url}\nsource_revision=${result.release.sourceRevision}\nconfig_sha256=${result.release.configSha256}\nrelease_json=${JSON.stringify(result.release)}\n`:`build=${result.build}\nimage=${result.image}\n`;
      appendFileSync(process.env.GITHUB_OUTPUT,output);
    }
    console.log(JSON.stringify(result));
  }catch(error){console.error(/^[A-Z0-9_]+$/.test(error?.message??'')?error.message:'SERVICE_DEPLOYMENT_FAILED');process.exitCode=1;}
}
