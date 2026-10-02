import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,delimiter} from 'node:path';
import {runGcloud,googlePreflight} from '../google-preflight.mjs';
const args=['projects','describe','wvd-development','--format=json','--quiet'];
test('Windows uses fixed command with separately transported arguments',()=>{
 let observed;
 assert.equal(runGcloud(args,{platform:'win32',env:{PATH:'example'},execute:(...call)=>{observed=call;return 'output';}}),'output');
 assert.equal(observed[0],'powershell.exe');
 const script=Buffer.from(observed[1].at(-1),'base64').toString('utf16le');
 assert.ok(!script.includes('wvd-development'));assert.ok(!script.includes('Bypass'));
 assert.deepEqual(JSON.parse(observed[2].env.WVD_GCLOUD_ARGUMENTS),args);
 assert.equal(observed[2].env.PATH,'example');assert.equal(observed[2].timeout,60000);
});
test('shell syntax cannot reach either launcher',()=>{
 for(const platform of ['linux','win32'])for(const unsafe of ['x;whoami','$(whoami)','x&whoami','x\nwhoami','%PATH%'])
 assert.throws(()=>runGcloud([...args,unsafe],{platform,execute:()=>assert.fail('must not execute')}),/INVALID_GCLOUD_ARGUMENT/);
});
test('Unix retains direct executable argument handling',()=>{
 runGcloud(args,{platform:'linux',execute:(command,actual,options)=>{assert.equal(command,'gcloud');assert.deepEqual(actual,args);assert.equal(options.shell,undefined);return '';}});
});
test('actual Windows PowerShell SDK wrapper: path with spaces, exit codes, full preflight',{skip:process.platform!=='win32'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'wvd sdk with spaces '));
 try {
  writeFileSync(join(dir,'gcloud.ps1'),`if ($args[0] -eq 'projects') { '{"projectId":"wvd-development","projectNumber":"6616382131","lifecycleState":"ACTIVE"}' } elseif ($args[0] -eq 'billing') { '{"projectId":"wvd-development","billingEnabled":false}' } else { exit 7 }`);
  const env={...process.env,PATH:dir+delimiter+process.env.PATH};
  const outputs=[];
  const result=googlePreflight({projectId:'wvd-development',productId:'wvd',databaseId:'(default)',mode:'live'},args=>{const output=runGcloud(args,{env});outputs.push(JSON.parse(output));if(args[0]==='billing')assert.deepEqual(outputs.at(-1),{projectId:'wvd-development',billingEnabled:false});return output;});
  assert.equal(result.status,'BILLING_PREREQUISITE_UNMET');assert.equal(result.projectNumber,'6616382131');
  assert.throws(()=>runGcloud(['unsupported'],{env}),error=>error.status===7);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
