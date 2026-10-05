import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateBinding} from './preflight.mjs';
import {readGoogleJson} from './google-json.mjs';

// London is the proposed development hosting region, not a discovered deployment.
// Inventory is bounded; truncated lists never establish that a resource is absent.
export async function hostingDiscovery(binding,token,{request=fetch}={}) {
 const b=validateBinding(binding),region='europe-west2',results=[];
 const probe=async(check,url,options,inspect)=>{
  try {results.push({check,...inspect(await readGoogleJson(url,options,token,{request}))});}
  catch(error) {results.push({check,status:['CREDENTIAL_REJECTED','ACCESS_DENIED_OR_API_DISABLED','TARGET_NOT_FOUND_OR_NOT_SHARED'].includes(error?.message)?error.message:'READ_FAILED'});}
 };
 const parent=`projects/${b.projectId}/locations/${region}`;
 const inventory=(value,key,kind)=>{
  const rows=value[key]??[];
  if(!Array.isArray(rows)||rows.length>100)throw Error('INVALID_INVENTORY');
  const prefix=`${parent}/${kind}/`;
  const names=rows.map(row=>{
   if(typeof row?.name!=='string'||!row.name.startsWith(prefix)||!/^[a-z][a-z0-9-]{0,62}$/.test(row.name.slice(prefix.length)))throw Error('INVALID_RESOURCE');
   return row.name;
  });
  if(value.nextPageToken!==undefined&&typeof value.nextPageToken!=='string')throw Error('INVALID_PAGE');
  return {status:value.nextPageToken?'PARTIAL_INVENTORY':'PASS',complete:!value.nextPageToken,names};
 };
 await probe('image-repositories',`https://artifactregistry.googleapis.com/v1/${parent}/repositories?pageSize=100`,{method:'GET'},v=>inventory(v,'repositories','repositories'));
 await probe('hosting-services',`https://run.googleapis.com/v2/${parent}/services?pageSize=100`,{method:'GET'},v=>inventory(v,'services','services'));
 const permissions=['artifactregistry.repositories.create','artifactregistry.repositories.uploadArtifacts','run.services.setIamPolicy'];
 await probe('hosting-project-permissions',`https://cloudresourcemanager.googleapis.com/v1/projects/${b.projectId}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions})},v=>{
  if(v.permissions!==undefined&&!Array.isArray(v.permissions))throw Error('INVALID_PERMISSIONS');
  return {status:'REPORTED',permissions:permissions.map(permission=>({permission,present:v.permissions?.includes(permission)??false}))};
 });
 const repository=`${parent}/repositories/wvd-booking-runtime`;
 await probe('booking-image-repository',`https://artifactregistry.googleapis.com/v1/${repository}`,{method:'GET'},v=>{
  if(v.name!==repository||v.format!=='DOCKER')throw Error('INVALID_REPOSITORY');
  return {status:'PASS',name:v.name,immutableTags:v.dockerConfig?.immutableTags===true,scanningDisabled:v.vulnerabilityScanningConfig?.enablementConfig==='DISABLED'};
 });
 await probe('booking-image-upload',`https://artifactregistry.googleapis.com/v1/${repository}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:['artifactregistry.repositories.uploadArtifacts']})},v=>({status:Array.isArray(v.permissions)&&v.permissions.includes('artifactregistry.repositories.uploadArtifacts')?'PASS':'REPOSITORY_GRANT_REQUIRED'}));
 return {region,changesMade:false,deploymentReady:false,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try {if(process.argv.length!==3)throw Error();console.log(JSON.stringify(await hostingDiscovery(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN),null,2));}
 catch {console.error('HOSTING_DISCOVERY_FAILED');process.exitCode=1;}
}
