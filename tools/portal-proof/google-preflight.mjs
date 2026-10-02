import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {firebaseConfiguration} from './firebase-config.mjs';

// PowerShell resolves the SDK's .ps1 wrapper. The command is fixed; arguments
// travel as JSON in an environment variable, never interpolated shell code.
export function runGcloud(args,{platform=process.platform,execute=execFileSync,env=process.env}={}) {
  if(!Array.isArray(args)||args.some(value=>typeof value!=='string'||!/^[a-zA-Z0-9=()_-]+$/.test(value))) throw Error('INVALID_GCLOUD_ARGUMENT');
  const options={encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:1024*1024,windowsHide:true};
  if(platform!=='win32')return execute('gcloud',args,options);
  const script=`$ErrorActionPreference = 'Stop'; $arguments = @(ConvertFrom-Json $env:WVD_GCLOUD_ARGUMENTS); $command = Get-Command gcloud -CommandType ExternalScript,Application -ErrorAction Stop; & $command.Source @arguments; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }`;
  return execute('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{...options,env:{...env,WVD_GCLOUD_ARGUMENTS:JSON.stringify(args)}});
}

// Read-only: no API enable, policy write, credentials export or billing change.
export function googlePreflight(binding, run, env={}) {
  const config=firebaseConfiguration(binding,env);
  if(config.mode!=='live') throw Error('LIVE_BINDING_REQUIRED');
  const query=args=>JSON.parse(run([...args,'--format=json','--quiet']));
  const project=query(['projects','describe',config.projectId]);
  if(project.projectId!==config.projectId||project.lifecycleState!=='ACTIVE'||!/^\d+$/.test(String(project.projectNumber))) throw Error('PROJECT_NOT_VERIFIED');
  const billing=query(['billing','projects','describe',config.projectId]);
  if(billing.projectId!==config.projectId||typeof billing.billingEnabled!=='boolean') throw Error('BILLING_NOT_VERIFIED');
  return {projectId:config.projectId,projectNumber:String(project.projectNumber),
    billingEnabled:billing.billingEnabled,
    status:billing.billingEnabled?'ACCESS_SETUP_STILL_REQUIRED':'BILLING_PREREQUISITE_UNMET',
    changesMade:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    if(process.argv.length!==3) throw Error('USAGE: node google-preflight.mjs <explicit-binding.json>');
    const binding=JSON.parse(readFileSync(process.argv[2],'utf8'));
    const result=googlePreflight(binding,args=>runGcloud(args),process.env);
    console.log(JSON.stringify(result,null,2));
    if(!result.billingEnabled) process.exitCode=2;
  } catch(error) {
    // Do not echo gcloud stderr or credential-bearing process objects.
    console.error(error.code==='ENOENT'?'GCLOUD_NOT_AVAILABLE':error instanceof SyntaxError?'INVALID_JSON':error.status!==undefined?'GOOGLE_PREFLIGHT_FAILED':error.message);
    process.exitCode=1;
  }
}
