import {appendFileSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {isAbsolute,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bootstrapPortalOwner} from '../portal-proof/owner-bootstrap.mjs';
import {operatorContext} from '../portal-proof/operator-audit.mjs';
import {configurationHash,serviceConfiguration} from './deployment.mjs';

const repository='aquaviator/wvd';
const branch='refs/heads/development/shared-factory-bootstrap';
const workflow=`${repository}/.github/workflows/google-development-access.yml@${branch}`;
const provider='projects/6616382131/locations/global/workloadIdentityPools/wvd-github-development/providers/github';
const serviceAccount='wvd-development@wvd-development.iam.gserviceaccount.com';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const requireFromPortal=createRequire(new URL('../portal-proof/package.json',import.meta.url));

export function prepareOwnerBootstrap(configuration,context) {
  const config=serviceConfiguration(configuration),operator=operatorContext(context);
  const enabled=config.portal.owner!==null;
  return {status:enabled?'OWNER_BOOTSTRAP_READY':'OWNER_IDENTITY_NOT_CONFIGURED',enabled,configSha256:configurationHash(config),ownerBindingSha256:enabled?configurationHash(config.portal.owner):null,...operator};
}

function workflowBinding(env) {
  if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_REPOSITORY!==repository||env.GITHUB_REPOSITORY_ID!=='1347788556'||env.GITHUB_REPOSITORY_OWNER_ID!=='78605956'||env.GITHUB_REF!==branch||env.GITHUB_WORKFLOW_REF!==workflow||!['push','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||!/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID??'')||!/^[1-9][0-9]{0,5}$/.test(env.GITHUB_RUN_ATTEMPT??''))throw Error('TRUSTED_BOOTSTRAP_WORKFLOW_REQUIRED');
  return {sourceRevision:env.GITHUB_SHA,workflowRun:`https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}`,runAttempt:Number(env.GITHUB_RUN_ATTEMPT)};
}

// This matches the credential document emitted by the pinned Google auth action:
// https://github.com/google-github-actions/auth/blob/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/src/client/workload_identity_federation.ts
// No service-account key, user refresh token, executable or arbitrary URL is
// accepted. The Google WIF policy remains the actual identity authority.
export function validateBootstrapWif(document,env) {
  const binding=workflowBinding(env);
  if(!exact(document,['type','audience','subject_token_type','token_url','credential_source','service_account_impersonation_url'])||document.type!=='external_account'||document.audience!==`//iam.googleapis.com/${provider}`||document.subject_token_type!=='urn:ietf:params:oauth:token-type:jwt'||document.token_url!=='https://sts.googleapis.com/v1/token'||document.service_account_impersonation_url!==`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`)throw Error('SCOPED_WIF_ADC_REQUIRED');
  const source=document.credential_source,token=env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  let expected;
  try {
    expected=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
    if(expected.protocol!=='https:'||expected.username||expected.password||expected.hash||expected.port||!expected.hostname.endsWith('.actions.githubusercontent.com'))throw Error();
    expected.searchParams.set('audience',`https://iam.googleapis.com/${provider}`);
  }catch {throw Error('GITHUB_OIDC_SOURCE_REQUIRED');}
  if(typeof token!=='string'||!token||token.length>16384||/\s/.test(token)||!exact(source,['url','headers','format'])||source.url!==expected.href||!exact(source.headers,['Authorization'])||source.headers.Authorization!==`Bearer ${token}`||!exact(source.format,['type','subject_token_field_name'])||source.format.type!=='json'||source.format.subject_token_field_name!=='value')throw Error('GITHUB_OIDC_SOURCE_REQUIRED');
  return binding;
}

function readJson(path,maxBytes) {
  if(typeof path!=='string'||!path||!statSync(path).isFile()||statSync(path).size>maxBytes)throw Error('INVALID_BOOTSTRAP_INPUT');
  const raw=readFileSync(path,'utf8');
  if(Buffer.byteLength(raw)>maxBytes)throw Error('INVALID_BOOTSTRAP_INPUT');
  try{return JSON.parse(raw);}catch {throw Error('INVALID_BOOTSTRAP_INPUT');}
}

function credentialPath(env) {
  const path=env.GOOGLE_APPLICATION_CREDENTIALS,workspace=env.GITHUB_WORKSPACE;
  if(typeof path!=='string'||!isAbsolute(path)||typeof workspace!=='string'||!isAbsolute(workspace)||!/^gha-creds-[A-Za-z0-9_-]+\.json$/.test(relative(workspace,path)))throw Error('SCOPED_WIF_ADC_REQUIRED');
  return path;
}

const loadIdentity=async()=>{
  const {GoogleAuth}=requireFromPortal('google-auth-library');
  return new GoogleAuth({projectId:'wvd-development',scopes:['https://www.googleapis.com/auth/cloud-platform']});
};
const loadBackend=async config=>{
  const {createFirebaseBackend}=await import('../portal-proof/firebase-backend.mjs');
  return createFirebaseBackend(config);
};

export async function runOwnerBootstrap(configuration,context,{env=process.env,readCredentials=readJson,identityFactory=loadIdentity,backendFactory=loadBackend}={}) {
  const plan=prepareOwnerBootstrap(configuration,context);
  // Current launch setup exits here. It neither loads an SDK nor reads ADC.
  if(!plan.enabled)return plan;
  const config=serviceConfiguration(configuration);
  if(env.FIREBASE_AUTH_EMULATOR_HOST!==undefined||env.FIRESTORE_EMULATOR_HOST!==undefined||env.FIREBASE_TOKEN!==undefined)throw Error('EMULATOR_ENVIRONMENT_FORBIDDEN');
  const trace=workflowBinding(env),path=credentialPath(env);
  validateBootstrapWif(await readCredentials(path,65536),env);
  const identity=await identityFactory();
  let credentials;
  try{credentials=await identity.getCredentials();}catch {throw Error('BOOTSTRAP_IDENTITY_UNAVAILABLE');}
  if(credentials?.client_email!==serviceAccount||credentials.private_key!==undefined)throw Error('BOOTSTRAP_IDENTITY_MISMATCH');
  let backend;
  try {
    backend=await backendFactory(config.portal.firebase);
    if(typeof backend?.close!=='function')throw Error('INVALID_BOOTSTRAP_BACKEND');
    const receipt=await bootstrapPortalOwner({auth:backend.auth,portal:backend.portal,owner:config.portal.owner,context});
    // Bind attribution to this exact run and configuration without publishing
    // the Google UID, the credential document or provider response bodies.
    return {schemaVersion:1,status:receipt.status,created:receipt.created,projectId:config.portal.firebase.projectId,productId:config.portal.firebase.productId,configSha256:plan.configSha256,ownerBindingSha256:plan.ownerBindingSha256,operatorRef:receipt.operatorRef,changeRef:receipt.changeRef,...trace,messagesSent:false,accountsCreated:false,existingStateReplaced:false};
  }finally {if(backend&&typeof backend.close==='function')await backend.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try {
    const [command,configPath,contextPath,...extra]=process.argv.slice(2);
    if(!['prepare','apply'].includes(command)||!configPath||!contextPath||extra.length)throw Error('INVALID_BOOTSTRAP_COMMAND');
    const config=readJson(configPath,16384),context=readJson(contextPath,4096);
    const result=command==='prepare'?prepareOwnerBootstrap(config,context):await runOwnerBootstrap(config,context);
    if(command==='prepare'&&process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`enabled=${result.enabled}\nconfig_sha256=${result.configSha256}\n`);
    if(command==='apply'&&process.env.WVD_OWNER_BOOTSTRAP_OUTPUT)writeFileSync(process.env.WVD_OWNER_BOOTSTRAP_OUTPUT,JSON.stringify(result,null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify(result));
  }catch(error){
    const safe=new Set(['INVALID_BOOTSTRAP_COMMAND','INVALID_BOOTSTRAP_INPUT','INVALID_LIVE_CONFIGURATION','INVALID_OWNER_BINDING','OWNER_BINDING_REQUIRED','OPERATOR_CONTEXT_REQUIRED','VERIFIED_OWNER_ACCOUNT_REQUIRED','OWNER_BOOTSTRAP_CONFLICT','EMULATOR_ENVIRONMENT_FORBIDDEN','SERVICE_CONFIGURATION_OUT_OF_SCOPE','TRUSTED_BOOTSTRAP_WORKFLOW_REQUIRED','SCOPED_WIF_ADC_REQUIRED','GITHUB_OIDC_SOURCE_REQUIRED','BOOTSTRAP_IDENTITY_UNAVAILABLE','BOOTSTRAP_IDENTITY_MISMATCH']);
    console.error(safe.has(error?.message)?error.message:'OWNER_BOOTSTRAP_RUNTIME_FAILED');process.exitCode=1;
  }
}
