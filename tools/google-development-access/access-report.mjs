import {writeFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const checks={ACCESS_RESOURCE_RESULT:['drive.read','calendar.freebusy'],ACCESS_WRITER_RESULT:['calendar.writer-grant'],ACCESS_CONFIRMATION_RESULT:['confirmation-key.read','email.signing'],ACCESS_RUNTIME_RESULT:['runtime.invoke','booking.availability'],ACCESS_MAIL_RESULT:['email.send-scope']};
export function accessReport(env,observedAt){
 if(!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||!/^\d+$/.test(env.GITHUB_RUN_ID??'')||!/^\d+$/.test(env.GITHUB_RUN_ATTEMPT??'')||typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||new Date(observedAt).toISOString()!==observedAt)throw Error('INVALID_ACCESS_EVIDENCE_BINDING');
 const results=Object.entries(checks).map(([key,capabilities])=>{const value=env[key]??'';if(!['','success','failure','cancelled','skipped'].includes(value))throw Error('INVALID_ACCESS_OUTCOME');return {capabilities:[...capabilities],status:value==='success'?'PASS':value==='failure'?'FAIL':value==='cancelled'?'CANCELLED':'NOT_CHECKED'};});
 return {schemaVersion:1,productId:'wvd',plane:'ci',principal:'wvd-development@wvd-development.iam.gserviceaccount.com',commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,observedAt,source:`https://github.com/aquaviator/wvd/actions/runs/${env.GITHUB_RUN_ID}`,results,allPassed:results.every(r=>r.status==='PASS'),grantsPermission:false,mailSentByTheseChecks:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const report=accessReport(process.env,new Date().toISOString());writeFileSync('access-evidence.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nAccess evidence: '+(report.allPassed?'all recorded read checks passed':'incomplete or failed; inspect access-evidence.json')+'\n');}
 catch{console.error('ACCESS_EVIDENCE_REPORT_FAILED');process.exitCode=1;}
}
