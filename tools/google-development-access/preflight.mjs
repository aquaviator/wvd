import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function validateBinding(b) {
  if (!b || b.projectId !== 'wvd-development' || b.projectNumber !== '6616382131' || b.serviceAccount !== 'wvd-portal-development@wvd-development.iam.gserviceaccount.com' || b.repositoryId !== '1347788556' || b.ownerId !== '78605956' || b.repository !== 'aquaviator/wvd' || b.branch !== 'development/shared-factory-bootstrap' || b.workflow !== '.github/workflows/google-development-access.yml' || b.poolId !== 'wvd-github-development' || b.providerId !== 'wvd-development-workflow') throw Error('INVALID_ACCESS_BINDING');
  for (const [key, pattern] of [['driveFileIds', /^[A-Za-z0-9_-]{1,256}$/], ['calendarIds', /^[A-Za-z0-9_.@-]{1,256}$/]]) {
    if (!Array.isArray(b[key]) || !b[key].length || b[key].length > 20 || new Set(b[key]).size !== b[key].length || b[key].some(id => typeof id !== 'string' || !pattern.test(id))) throw Error('INVALID_ACCESS_BINDING');
  }
  return b;
}

// Read-only API probes; fixed endpoints, bounded time/body, no redirects or retries.
// Results never include tokens, file names, calendar IDs or busy intervals.
export async function accessPreflight(binding, token, {request=fetch, now=Date.now()}={}) {
  const b=validateBinding(binding);
  if(typeof token !== 'string' || !token.length || /\s/.test(token)) throw Error('CREDENTIAL_REQUIRED');
  const results=[];
  const probe=async (label,url,options,check)=>{
    try {
      const response=await request(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
      if(!response.ok){results.push({check:label,status:response.status===401?'CREDENTIAL_REJECTED':response.status===403?'ACCESS_DENIED_OR_API_DISABLED':response.status===404?'TARGET_NOT_FOUND_OR_NOT_SHARED':'PROVIDER_ERROR'});return;}
      if(!response.body) throw Error('INVALID_RESPONSE');
      const reader=response.body.getReader(); const chunks=[];let bytes=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>65536)throw Error('RESPONSE_TOO_LARGE');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
      const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      results.push({check:label,status:check(value)?'PASS':'INVALID_OR_INCOMPLETE_RESPONSE'});
    } catch {results.push({check:label,status:'REQUEST_FAILED'});}
  };
  for(let i=0;i<b.driveFileIds.length;i++){
    const id=b.driveFileIds[i];
    await probe(`drive-${i+1}`,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed&supportsAllDrives=true`,{method:'GET'},v=>v.id===id&&v.trashed===false);
  }
  const start=new Date(now).toISOString(),end=new Date(now+3600000).toISOString();
  await probe('calendar-freebusy','https://www.googleapis.com/calendar/v3/freeBusy',{method:'POST',body:JSON.stringify({timeMin:start,timeMax:end,items:b.calendarIds.map(id=>({id}))})},v=>Date.parse(v.timeMin)===Date.parse(start)&&Date.parse(v.timeMax)===Date.parse(end)&&b.calendarIds.every(id=>v.calendars?.[id]&&(!v.calendars[id].errors||v.calendars[id].errors.length===0)&&Array.isArray(v.calendars[id].busy)&&v.calendars[id].busy.every(x=>Number.isFinite(Date.parse(x.start))&&Number.isFinite(Date.parse(x.end))&&Date.parse(x.start)<Date.parse(x.end))));
  return {status:results.every(x=>x.status==='PASS')?'PASS':'BLOCKED',changesMade:false,results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)throw Error('BINDING_PATH_REQUIRED');
    const result=await accessPreflight(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN);
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
  }catch{console.error('ACCESS_PREFLIGHT_CONFIGURATION_OR_CREDENTIAL_FAILURE');process.exitCode=1;}
}
