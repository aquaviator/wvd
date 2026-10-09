import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {boundEvidence} from './evidence-budget.mjs';
// The container runner never loads live bindings, ADC, SDK profiles or secrets.
for(const key of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT','FIREBASE_TOKEN'])if(process.env[key])throw Error('LIVE_CREDENTIAL_ENVIRONMENT_FORBIDDEN');
const evidence='/evidence';mkdirSync(evidence,{recursive:true});
writeFileSync(evidence+'/runner-started.json',JSON.stringify({sourceCommit:process.env.WVD_SOURCE_COMMIT??'local',syntheticOnly:true}));
const version=JSON.parse(readFileSync('node_modules/@playwright/test/package.json','utf8')).version;
if(version!=='1.62.1')throw Error('PLAYWRIGHT_IMAGE_VERSION_MISMATCH');
const results=[];
for(const [name,args] of [['portal-unit',['--prefix','tools/portal-proof','test']],['firebase-browser',['--prefix','tools/portal-proof','run','test:firebase']]]) {
 const result=spawnSync('npm',args,{stdio:'inherit',env:{...process.env,WVD_TEST_EVIDENCE_DIR:evidence},timeout:180000});
 results.push({name,passed:result.status===0,error:result.error?.code??null});
 if(result.status!==0)break;
}
const report={schemaVersion:1,sourceCommit:process.env.WVD_SOURCE_COMMIT??'local',node:process.version,playwright:version,projectId:'demo-wvd-portal',liveAccess:false,results};
writeFileSync(evidence+'/results.json',JSON.stringify(report,null,2));
const budget=boundEvidence(evidence);console.log(JSON.stringify({evidenceBudget:budget}));
console.log(JSON.stringify(report,null,2));
if(results.length!==2||results.some(result=>!result.passed))process.exitCode=1;
