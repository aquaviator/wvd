import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateBinding} from './preflight.mjs';
import {readGoogleJson} from './google-json.mjs';

// Read-only discovery for the explicitly selected WVD service launch. A POST is
// permitted only for IAM inspection or the single approved owner account lookup.
// Firebase web configuration is public client configuration, never a credential.
export const serviceName='projects/wvd-development/locations/europe-west2/services/wvd-service';
export const ownerEmail='admin@wearvalleydigital.com';
const appName='WVD Portal Development';
const imagePrefix='europe-west2-docker.pkg.dev/wvd-development/wvd-booking-runtime/service';
const projectPermissions=Object.freeze([
 'run.services.create','run.services.update','run.services.get','run.services.list',
 'run.services.getIamPolicy','run.services.setIamPolicy',
 'firebase.clients.get','firebase.clients.list','firebaseauth.configs.get',
 'firebaseauth.configs.update','firebaseauth.users.get',
 'datastore.databases.get','datastore.entities.get','datastore.entities.list',
 'datastore.entities.create','datastore.entities.update','datastore.entities.delete',
 'datastore.indexes.get','datastore.indexes.list','datastore.indexes.update'
]);
const servicePermissions=['run.services.get','run.services.update','run.services.getIamPolicy','run.services.setIamPolicy','run.routes.invoke'];
const errors=new Set(['CREDENTIAL_REJECTED','ACCESS_DENIED_OR_API_DISABLED','TARGET_NOT_FOUND_OR_NOT_SHARED','PROVIDER_ERROR']);
const invalid=()=>{throw Error('INVALID_OR_INCOMPLETE_RESPONSE');};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const domain=value=>typeof value==='string'&&value.length<=253&&value===value.toLowerCase()&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(value);
const selectedResource=(name,suffix)=>name===`projects/wvd-development/${suffix}`||name===`projects/6616382131/${suffix}`;
function permissionResult(value,requested){
 if(!object(value)||value.permissions!==undefined&&(!Array.isArray(value.permissions)||value.permissions.length>requested.length||new Set(value.permissions).size!==value.permissions.length||value.permissions.some(p=>!requested.includes(p))))invalid();
 return {status:'REPORTED',permissions:requested.map(permission=>({permission,present:value.permissions?.includes(permission)??false}))};
}
function serviceUrl(value){
 if(typeof value!=='string'||value.length>256)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&u.pathname==='/'&&/^wvd-service-[a-z0-9.-]+\.run\.app$/.test(u.hostname);}catch{return false;}
}

export async function serviceDiscovery(binding,token,{request=fetch,now=()=>new Date().toISOString()}={}){
 const b=validateBinding(binding);
 if(typeof token!=='string'||!token.length||/\s/.test(token))throw Error('CREDENTIAL_REQUIRED');
 if(typeof request!=='function'||typeof now!=='function')throw Error('INVALID_CONFIGURATION');
 const observedAt=now();
 if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||new Date(observedAt).toISOString()!==observedAt)throw Error('INVALID_CONFIGURATION');
 const results=[];
 const probe=async(check,url,options,inspect)=>{
  let result;
  try{result={check,...inspect(await readGoogleJson(url,options,token,{request}))};}
  catch(error){result={check,status:errors.has(error?.message)?error.message:error?.message==='INVALID_OR_INCOMPLETE_RESPONSE'?error.message:'READ_FAILED'};}
  results.push(result);return result;
 };
 const project=await probe('service-project-permissions',`https://cloudresourcemanager.googleapis.com/v1/projects/${b.projectId}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:projectPermissions})},v=>permissionResult(v,projectPermissions));
 await probe('service-attached-identity-permissions',`https://iam.googleapis.com/v1/projects/${b.projectId}/serviceAccounts/${encodeURIComponent(b.serviceAccount)}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:['iam.serviceAccounts.actAs','iam.serviceAccounts.signJwt']})},v=>permissionResult(v,['iam.serviceAccounts.actAs','iam.serviceAccounts.signJwt']));

 const service=await probe('selected-service',`https://run.googleapis.com/v2/${serviceName}?fields=name,uri,ingress,invokerIamDisabled,template(serviceAccount,containers(image)),scaling,terminalCondition(state)`,{method:'GET'},v=>{
  if(!object(v)||v.name!==serviceName||!serviceUrl(v.uri)||!['INGRESS_TRAFFIC_ALL','INGRESS_TRAFFIC_INTERNAL_ONLY','INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER'].includes(v.ingress)||v.invokerIamDisabled!==undefined&&typeof v.invokerIamDisabled!=='boolean')invalid();
  const images=v.template?.containers,scaling=v.scaling??{};
  if(!Array.isArray(images)||images.length!==1||!object(images[0])||!object(scaling))invalid();
  const image=images[0].image,ownedImage=typeof image==='string'&&image.startsWith(imagePrefix+'@sha256:')&&/^[a-f0-9]{64}$/.test(image.slice((imagePrefix+'@sha256:').length));
  const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000;
  if(scaling.minInstanceCount!==undefined&&!count(scaling.minInstanceCount)||scaling.maxInstanceCount!==undefined&&!count(scaling.maxInstanceCount))invalid();
  return {status:'PRESENT',name:serviceName,url:v.uri,ingress:v.ingress,invokerIamDisabled:v.invokerIamDisabled??false,identityMatches:v.template?.serviceAccount===b.serviceAccount,imageMatchesSelectedRepository:ownedImage,...(ownedImage?{image}:{}),minInstances:scaling.minInstanceCount??0,maxInstances:scaling.maxInstanceCount??null,ready:v.terminalCondition?.state==='CONDITION_SUCCEEDED'};
 });
 // A bare 404 can conceal inaccessible resources. Confirm absence only from a
 // complete, correctly scoped service inventory; never infer it from a denial.
 if(service.status==='TARGET_NOT_FOUND_OR_NOT_SHARED'){
  const inventory=await probe('selected-service-absence',`https://run.googleapis.com/v2/projects/${b.projectId}/locations/europe-west2/services?pageSize=100&fields=services(name),nextPageToken`,{method:'GET'},v=>{
   if(!object(v)||v.services!==undefined&&!Array.isArray(v.services)||v.nextPageToken!==undefined&&typeof v.nextPageToken!=='string')invalid();
   const rows=v.services??[],prefix=`projects/${b.projectId}/locations/europe-west2/services/`;
   if(rows.length>100||rows.some(row=>!object(row)||typeof row.name!=='string'||!row.name.startsWith(prefix)||!/^[a-z][a-z0-9-]{0,62}$/.test(row.name.slice(prefix.length))))invalid();
   return {status:v.nextPageToken?'PARTIAL_INVENTORY':rows.some(row=>row.name===serviceName)?'PRESENT_BUT_NOT_READABLE':'ABSENCE_CONFIRMED',complete:!v.nextPageToken};
  });
  if(inventory.status==='ABSENCE_CONFIRMED')service.status='ABSENT';
 }
 if(service.status==='PRESENT'){
  await probe('selected-service-permissions',`https://run.googleapis.com/v2/${serviceName}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:servicePermissions})},v=>permissionResult(v,servicePermissions));
  await probe('selected-service-invoker-policy',`https://run.googleapis.com/v2/${serviceName}:getIamPolicy?fields=bindings(role,members,condition)`,{method:'GET'},v=>{
   if(!object(v)||v.bindings!==undefined&&!Array.isArray(v.bindings))invalid();
   const rows=v.bindings??[];
   if(rows.length>100||rows.some(row=>!object(row)||typeof row.role!=='string'||!Array.isArray(row.members)||row.members.length>1000||row.members.some(member=>typeof member!=='string')))invalid();
   const invokers=rows.filter(row=>row.role==='roles/run.invoker');
   return {status:'REPORTED',unconditionalPublicInvoker:invokers.some(row=>!row.condition&&row.members.includes('allUsers')),unconditionalAuthenticatedInvoker:invokers.some(row=>!row.condition&&row.members.includes('allAuthenticatedUsers')),conditionalPublicInvoker:invokers.some(row=>row.condition&&row.members.includes('allUsers'))};
  });
 }

 let selectedApp;
 const apps=await probe('firebase-web-app',`https://firebase.googleapis.com/v1beta1/projects/${b.projectId}/webApps?pageSize=100&fields=apps(name,appId,displayName,projectId,state),nextPageToken`,{method:'GET'},v=>{
  if(!object(v)||v.apps!==undefined&&!Array.isArray(v.apps)||v.nextPageToken!==undefined&&typeof v.nextPageToken!=='string')invalid();
  const rows=v.apps??[],validId=id=>typeof id==='string'&&new RegExp(`^1:${b.projectNumber}:web:[a-f0-9]{6,64}$`).test(id);
  if(rows.length>100||rows.some(row=>!object(row)||!validId(row.appId)||!selectedResource(row.name,`webApps/${row.appId}`)||row.projectId!==b.projectId||typeof row.displayName!=='string'||row.displayName.length>256))invalid();
  if(v.nextPageToken)return {status:'PARTIAL_INVENTORY',complete:false};
  const selected=rows.filter(row=>row.displayName===appName);
  if(selected.length!==1)return {status:selected.length?'AMBIGUOUS_WEB_APP':'WEB_APP_NOT_FOUND',complete:true};
  if(selected[0].state!=='ACTIVE')return {status:'WEB_APP_NOT_ACTIVE',complete:true};
  selectedApp=selected[0].appId;
  return {status:'PRESENT',complete:true,appId:selectedApp};
 });
 if(apps.status==='PRESENT')await probe('firebase-public-web-config',`https://firebase.googleapis.com/v1beta1/projects/${b.projectId}/webApps/${selectedApp}/config?fields=projectId,appId,apiKey,authDomain,messagingSenderId`,{method:'GET'},v=>{
  if(!object(v)||v.projectId!==b.projectId||v.appId!==selectedApp||typeof v.apiKey!=='string'||!/^AIza[A-Za-z0-9_-]{35}$/.test(v.apiKey)||v.authDomain!==`${b.projectId}.firebaseapp.com`||v.messagingSenderId!==undefined&&v.messagingSenderId!==b.projectNumber)invalid();
  return {status:'PASS',publicWebConfig:{projectId:v.projectId,appId:v.appId,apiKey:v.apiKey,authDomain:v.authDomain,...(v.messagingSenderId?{messagingSenderId:v.messagingSenderId}:{})}};
 });
 await probe('firebase-auth-config',`https://identitytoolkit.googleapis.com/admin/v2/projects/${b.projectId}/config?fields=name,authorizedDomains`,{method:'GET'},v=>{
  if(!object(v)||!selectedResource(v.name,'config')||!Array.isArray(v.authorizedDomains)||v.authorizedDomains.length>100||new Set(v.authorizedDomains).size!==v.authorizedDomains.length||v.authorizedDomains.some(d=>!domain(d)))invalid();
  return {status:'PASS',authorizedDomains:[...v.authorizedDomains],...(service.status==='PRESENT'?{selectedServiceDomainAuthorized:v.authorizedDomains.includes(new URL(service.url).hostname)}:{})};
 });
 await probe('firebase-google-provider',`https://identitytoolkit.googleapis.com/admin/v2/projects/${b.projectId}/defaultSupportedIdpConfigs/google.com?fields=name,enabled`,{method:'GET'},v=>{
  if(!object(v)||!selectedResource(v.name,'defaultSupportedIdpConfigs/google.com')||v.enabled!==undefined&&typeof v.enabled!=='boolean')invalid();
  return {status:v.enabled===true?'PASS':'GOOGLE_PROVIDER_DISABLED',enabled:v.enabled===true};
 });
 await probe('firebase-owner-account',`https://identitytoolkit.googleapis.com/v1/projects/${b.projectId}/accounts:lookup?fields=users(localId,email,emailVerified,disabled,providerUserInfo(providerId))`,{method:'POST',body:JSON.stringify({email:[ownerEmail]})},v=>{
  if(!object(v)||v.users!==undefined&&!Array.isArray(v.users))invalid();
  const rows=v.users??[];
  if(rows.length===0)return {status:'OWNER_ACCOUNT_NOT_FOUND'};
  if(rows.length!==1)invalid();
  const u=rows[0];
  if(!object(u)||typeof u.localId!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(u.localId)||u.email!==ownerEmail||u.emailVerified!==undefined&&typeof u.emailVerified!=='boolean'||u.disabled!==undefined&&typeof u.disabled!=='boolean'||u.providerUserInfo!==undefined&&(!Array.isArray(u.providerUserInfo)||u.providerUserInfo.length>10||u.providerUserInfo.some(p=>!object(p)||typeof p.providerId!=='string')))invalid();
  return {status:'PRESENT',owner:{uid:u.localId,email:ownerEmail,emailVerified:u.emailVerified??false,disabled:u.disabled??false,googleProviderLinked:u.providerUserInfo?.some(p=>p.providerId==='google.com')??false}};
 });
 const permission=key=>project.status==='REPORTED'?project.permissions.find(p=>p.permission===key).present:null;
 return {status:'DISCOVERY_REPORTED',observedAt,projectId:b.projectId,principal:b.serviceAccount,service:serviceName,changesMade:false,mailSent:false,deploymentReady:false,ttl:{plannedRetentionDays:90,readPermission:permission('datastore.indexes.get'),updatePermission:permission('datastore.indexes.update'),configurationVerified:false},results};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('BINDING_PATH_REQUIRED');
  console.log(JSON.stringify(await serviceDiscovery(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN),null,2));
 }catch{console.error('SERVICE_DISCOVERY_CONFIGURATION_OR_CREDENTIAL_FAILURE');process.exitCode=1;}
}
