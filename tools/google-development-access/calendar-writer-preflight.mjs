import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateBinding} from './preflight.mjs';
import {readGoogleJson} from './google-json.mjs';
const target='c_3ecbc004918864ddf97f56a0dde644e19d7d18d1175a51832e29d2d28a3ff67f@group.calendar.google.com';
// No event reads/writes, ACL changes or invitations. If absent, add only a
// tagged entry in the service account's own CalendarList and remove that entry.
export async function calendarWriterPreflight(binding,token,{request=fetch,marker=randomUUID()}={}) {
  const b=validateBinding(binding);
  if(!b.calendarIds.includes(target)||typeof token!=='string'||!token.length||/\s/.test(token)||typeof marker!=='string'||!/^[A-Za-z0-9-]{1,64}$/.test(marker))throw Error('INVALID_CONFIGURATION');
  const tag=`WVD grant check ${marker}`,base='https://www.googleapis.com/calendar/v3/users/me/calendarList',entry=`${base}/${encodeURIComponent(target)}`,fields='?fields=id,accessRole,summaryOverride';
  let row,attempted=false,cleanup='NOT_NEEDED',grant='UNVERIFIED';
  const get=()=>readGoogleJson(entry+fields,{method:'GET'},token,{request});
  try{
    try{row=await get();}catch(error){if(error.message!=='TARGET_NOT_FOUND_OR_NOT_SHARED')throw error;
      attempted=true;
      row=await readGoogleJson(base+fields,{method:'POST',body:JSON.stringify({id:target,summaryOverride:tag,hidden:true,selected:false,defaultReminders:[],notificationSettings:{notifications:[]}})},token,{request});
    }
    if(row?.id!==target)grant='INVALID_RESPONSE';
    else grant=row.accessRole==='writer'?'WRITER_VERIFIED':row.accessRole==='owner'?'GRANT_BROADER_THAN_REQUIRED':'WRITER_GRANT_MISSING';
  }catch{grant='GRANT_CHECK_FAILED';}
  finally{
    if(attempted){
      try{
        const current=await get();
        if(current?.id!==target||current.summaryOverride!==tag)cleanup='ENTRY_NOT_OWNED_BY_CHECK';
        else{
          const response=await request(entry,{method:'DELETE',headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
          cleanup=response.status===204?'REMOVED':'CLEANUP_FAILED';
          await response.body?.cancel().catch(()=>{});
        }
      }catch(error){cleanup=error.message==='TARGET_NOT_FOUND_OR_NOT_SHARED'?'ABSENT':'CLEANUP_FAILED';}
    }
  }
  return {check:'wvd-calendar-writer-grant',status:grant==='WRITER_VERIFIED'&&['NOT_NEEDED','REMOVED','ABSENT'].includes(cleanup)?'PASS':'BLOCKED',grant,calendarEventsChanged:false,serviceAccountListCleanup:cleanup};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length!==3)throw Error();
    const result=await calendarWriterPreflight(JSON.parse(readFileSync(process.argv[2],'utf8')),process.env.WVD_GOOGLE_ACCESS_TOKEN);
    console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
  }catch{console.error('CALENDAR_WRITER_PREFLIGHT_CONFIGURATION_OR_CREDENTIAL_FAILURE');process.exitCode=1;}
}
