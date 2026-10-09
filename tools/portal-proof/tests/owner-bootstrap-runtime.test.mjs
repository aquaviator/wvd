import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PortalProof} from '../domain.mjs';
import {prepareOwnerBootstrap,runOwnerBootstrap,validateBootstrapWif} from '../../portal-runtime/bootstrap-owner.mjs';

const source=JSON.parse(readFileSync(new URL('../../portal-runtime/wvd-development.candidate.json',import.meta.url),'utf8'));
const candidate={...source,portal:{...source.portal,owner:null}};
const context=JSON.parse(readFileSync(new URL('../../portal-runtime/owner-bootstrap.context.json',import.meta.url),'utf8'));
const serviceAccount='wvd-development@wvd-development.iam.gserviceaccount.com';
const provider='projects/6616382131/locations/global/workloadIdentityPools/wvd-github-development/providers/github';
const owner={uid:'explicit-synthetic-google-uid',email:'admin@wearvalleydigital.com'};
const configuration=()=>({...structuredClone(candidate),portal:{...structuredClone(candidate.portal),owner:{...owner}}});
const environment=()=>({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'aquaviator/wvd',GITHUB_REPOSITORY_ID:'1347788556',GITHUB_REPOSITORY_OWNER_ID:'78605956',GITHUB_REF:'refs/heads/development/shared-factory-bootstrap',GITHUB_WORKFLOW_REF:'aquaviator/wvd/.github/workflows/google-development-access.yml@refs/heads/development/shared-factory-bootstrap',GITHUB_EVENT_NAME:'push',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123456',GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKSPACE:'/synthetic/workspace',GOOGLE_APPLICATION_CREDENTIALS:'/synthetic/workspace/gha-creds-synthetic.json',ACTIONS_ID_TOKEN_REQUEST_URL:'https://vstoken.actions.githubusercontent.com/synthetic?api-version=2.0',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'synthetic-request-token'});
const wif=()=>{
  const env=environment(),url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',`https://iam.googleapis.com/${provider}`);
  return {type:'external_account',audience:`//iam.googleapis.com/${provider}`,subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',service_account_impersonation_url:`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`,credential_source:{url:url.href,headers:{Authorization:'Bearer '+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},format:{type:'json',subject_token_field_name:'value'}}};
};
function fixture(){
  const calls=[],env=environment();let state=null;
  const options={env,readCredentials:async(path,maxBytes)=>{calls.push('read-credentials');assert.equal(path,env.GOOGLE_APPLICATION_CREDENTIALS);assert.equal(maxBytes,65536);return wif();},identityFactory:async()=>({getCredentials:async()=>{calls.push('verify-identity');return {client_email:serviceAccount};}}),backendFactory:async config=>{
    calls.push('load-backend');assert.deepEqual(config,configuration().portal.firebase);
    return {auth:{getUser:async uid=>{calls.push('get-user');assert.equal(uid,owner.uid);return {uid,email:owner.email,emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]};}},portal:{initialize:async value=>{calls.push('initialize');if(state)return {created:false};state=new PortalProof(value);return {created:true};},workspaceAccess:async uid=>state.workspaceAccess(uid)},close:async()=>{calls.push('close');}};
  }};
  return {calls,options,state:()=>state};
}

test('owner-null planning and application require no credential, SDK, account or Firestore access',async()=>{
  const fail=()=>assert.fail('owner-null must not access runtime credentials or providers');
  const result=await runOwnerBootstrap(candidate,context,{env:{},readCredentials:fail,identityFactory:fail,backendFactory:fail});
  assert.equal(result.enabled,false);assert.equal(result.status,'OWNER_IDENTITY_NOT_CONFIGURED');assert.equal(result.ownerBindingSha256,null);
  assert.equal(prepareOwnerBootstrap(configuration(),context).enabled,true);
  assert.throws(()=>prepareOwnerBootstrap(configuration(),{}),/OPERATOR_CONTEXT_REQUIRED/);
  assert.throws(()=>prepareOwnerBootstrap({...configuration(),portal:{...configuration().portal,owner:{...owner,email:'foreign@example.test'}}},context),/SERVICE_CONFIGURATION_OUT_OF_SCOPE/);
});

test('only the selected repository, development workflow and source run can bootstrap',async()=>{
  for(const patch of [{GITHUB_ACTIONS:'false'},{GITHUB_REPOSITORY:'other/wvd'},{GITHUB_REPOSITORY_ID:'1'},{GITHUB_REPOSITORY_OWNER_ID:'2'},{GITHUB_REF:'refs/pull/2/merge'},{GITHUB_WORKFLOW_REF:'foreign-workflow'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_SHA:'main'},{GITHUB_RUN_ID:''},{GITHUB_RUN_ATTEMPT:'0'}]){
    const f=fixture();f.options.env={...f.options.env,...patch};await assert.rejects(runOwnerBootstrap(configuration(),context,f.options),/TRUSTED_BOOTSTRAP_WORKFLOW_REQUIRED/);assert.deepEqual(f.calls,[]);
  }
});

test('credential discovery cannot use user ADC, another file, an emulator or a static key',async()=>{
  for(const path of [undefined,'relative.json','/other/gha-creds-synthetic.json','/synthetic/workspace/user.json','/synthetic/workspace/nested/gha-creds-synthetic.json']){
    const f=fixture();f.options.env.GOOGLE_APPLICATION_CREDENTIALS=path;await assert.rejects(runOwnerBootstrap(configuration(),context,f.options),/SCOPED_WIF_ADC_REQUIRED/);assert.deepEqual(f.calls,[]);
  }
  for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_TOKEN']){const f=fixture();f.options.env[key]='';await assert.rejects(runOwnerBootstrap(configuration(),context,f.options),/EMULATOR_ENVIRONMENT_FORBIDDEN/);assert.deepEqual(f.calls,[]);}
  for(const change of [v=>{v.type='service_account';},v=>{v.private_key='synthetic-private-key';},v=>{v.refresh_token='synthetic-refresh-token';},v=>{v.audience='foreign';},v=>{v.token_url='https://foreign.example/token';},v=>{v.service_account_impersonation_url=v.service_account_impersonation_url.replace(serviceAccount,'foreign@example.test');}]){const doc=wif();change(doc);assert.throws(()=>validateBootstrapWif(doc,environment()),/SCOPED_WIF_ADC_REQUIRED/);}
});

test('WIF refresh source must be the current GitHub OIDC request with the pinned audience',()=>{
  assert.equal(validateBootstrapWif(wif(),environment()).runAttempt,1);
  for(const change of [v=>{v.credential_source.url='https://foreign.example/';},v=>{v.credential_source.headers.Authorization='Bearer other-token';},v=>{v.credential_source.file='/tmp/user-token';},v=>{v.credential_source.executable={command:'unexpected'};},v=>{v.credential_source.format.subject_token_field_name='other';}]){const doc=wif();change(doc);assert.throws(()=>validateBootstrapWif(doc,environment()),/GITHUB_OIDC_SOURCE_REQUIRED/);}
  for(const url of ['http://vstoken.actions.githubusercontent.com/source','https://foreign.example/source','https://user@vstoken.actions.githubusercontent.com/source'])assert.throws(()=>validateBootstrapWif(wif(),{...environment(),ACTIONS_ID_TOKEN_REQUEST_URL:url}),/GITHUB_OIDC_SOURCE_REQUIRED/);
});

test('bootstrap verifies the explicit existing Google user then creates only its empty owner state once',async()=>{
  const f=fixture(),first=await runOwnerBootstrap(configuration(),context,f.options);
  assert.deepEqual(f.calls,['read-credentials','verify-identity','load-backend','get-user','initialize','close']);
  assert.equal(first.status,'OWNER_BOOTSTRAP_CREATED');assert.equal(first.created,true);assert.equal(first.sourceRevision,environment().GITHUB_SHA);assert.equal(first.workflowRun,'https://github.com/aquaviator/wvd/actions/runs/123456');
  for(const field of ['messagesSent','accountsCreated','existingStateReplaced'])assert.equal(first[field],false);
  assert.equal(first.ownerBindingSha256.length,64);assert.ok(!JSON.stringify(first).includes(owner.uid));assert.ok(!JSON.stringify(first).includes(environment().ACTIONS_ID_TOKEN_REQUEST_TOKEN));
  assert.deepEqual(f.state().snapshot().identities,[{id:owner.uid,active:true,wvdAdmin:true}]);assert.deepEqual(f.state().snapshot().projects,[]);assert.deepEqual(f.state().snapshot().memberships,[]);
  assert.equal((await runOwnerBootstrap(configuration(),context,f.options)).status,'OWNER_ALREADY_BOUND');
});

test('wrong impersonated identity cannot load Firestore and a missing Google account cannot be created',async()=>{
  for(const credentials of [{client_email:'foreign@example.test'},{client_email:serviceAccount,private_key:'not-allowed'}]){const f=fixture();f.options.identityFactory=async()=>({getCredentials:async()=>credentials});await assert.rejects(runOwnerBootstrap(configuration(),context,f.options),/BOOTSTRAP_IDENTITY_MISMATCH/);assert.deepEqual(f.calls,['read-credentials']);}
  const f=fixture();f.options.backendFactory=async()=>({auth:{getUser:async()=>{throw Error('auth/user-not-found');}},portal:{initialize:()=>assert.fail('must not seed'),workspaceAccess:()=>assert.fail('must not read')},close:async()=>{f.calls.push('close');}});
  await assert.rejects(runOwnerBootstrap(configuration(),context,f.options),/VERIFIED_OWNER_ACCOUNT_REQUIRED/);assert.equal(f.calls.at(-1),'close');assert.equal(f.state(),null);
});

test('prepare CLI exposes only a disabled plan for an owner-null candidate',()=>{
  const directory=mkdtempSync(join(tmpdir(),'wvd-owner-plan-'));
  try {
    const output=join(directory,'github-output'),configPath=join(directory,'candidate.json');writeFileSync(configPath,JSON.stringify(candidate));
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../portal-runtime/bootstrap-owner.mjs',import.meta.url)),'prepare',configPath,fileURLToPath(new URL('../../portal-runtime/owner-bootstrap.context.json',import.meta.url))],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,GITHUB_OUTPUT:output}});
    assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).enabled,false);assert.match(readFileSync(output,'utf8'),/^enabled=false\nconfig_sha256=[a-f0-9]{64}\n$/);
  }finally {rmSync(directory,{recursive:true,force:true});}
});
