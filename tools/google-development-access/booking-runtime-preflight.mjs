import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validateBinding} from './preflight.mjs';
import {readGoogleJson} from './google-json.mjs';
// Read-only discovery using existing CI identity. No IAM, billing, service,
// database, deployment or Workspace configuration is changed by this report.
export async function bookingRuntimePreflight(binding,token,{request=fetch}={}){
 const b=validateBinding(binding),results=[];
 const probe=async(check,url,options,inspect)=>{try{results.push({check,...inspect(await readGoogleJson(url,options,token,{request}))});}catch(error){results.push({check,status:['CREDENTIAL_REJECTED','ACCESS_DENIED_OR_API_DISABLED','TARGET_NOT_FOUND_OR_NOT_SHARED'].includes(error?.message)?error.message:'READ_FAILED'});}};
 await probe('runtime-signing',`https://iam.googleapis.com/v1/projects/${b.projectId}/serviceAccounts/${encodeURIComponent(b.serviceAccount)}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:['iam.serviceAccounts.signJwt']})},value=>({status:Array.isArray(value.permissions)&&value.permissions.includes('iam.serviceAccounts.signJwt')?'PASS':'ADMIN_GRANT_REQUIRED'}));
 await probe('runtime-attachment',`https://iam.googleapis.com/v1/projects/${b.projectId}/serviceAccounts/${encodeURIComponent(b.serviceAccount)}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:['iam.serviceAccounts.actAs']})},value=>({status:Array.isArray(value.permissions)&&value.permissions.includes('iam.serviceAccounts.actAs')?'PASS':'ADMIN_GRANT_REQUIRED'}));
 await probe('booking-database',`https://firestore.googleapis.com/v1/projects/${b.projectId}/databases/(default)`,{method:'GET'},value=>({status:value.name===`projects/${b.projectId}/databases/(default)`&&value.type==='FIRESTORE_NATIVE'?'PASS':'DATABASE_CONFIGURATION_REQUIRED',...(typeof value.locationId==='string'&&/^[a-z0-9-]{1,40}$/.test(value.locationId)?{location:value.locationId}:{})}));
 await probe('runtime-deployment',`https://cloudresourcemanager.googleapis.com/v1/projects/${b.projectId}:testIamPermissions`,{method:'POST',body:JSON.stringify({permissions:['run.services.create','run.services.update','run.services.get']})},value=>({status:['run.services.create','run.services.update','run.services.get'].every(x=>value.permissions?.includes(x))?'PASS':'ADMIN_GRANT_REQUIRED'}));
 return {status:results.every(x=>x.status==='PASS')?'ACCESS_PRESENT':'REQUIRES_ACCESS_OR_CONFIGURATION',changesMade:false,spendAuthorised:false,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(process.argv.length!==3)throw Error();console.log(JSON.stringify(await bookingRuntimePreflight(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN),null,2));}catch{console.error('BOOKING_RUNTIME_DISCOVERY_FAILED');process.exitCode=1;}}
