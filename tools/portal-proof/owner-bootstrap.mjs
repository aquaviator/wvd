import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ownerBinding,livePortalConfiguration} from './live-config.mjs';
import {verifiedFirebaseAccount} from './firebase-user.mjs';
import {operatorContext} from './operator-audit.mjs';

export async function bootstrapPortalOwner({auth,portal,owner,context}) {
  const binding=ownerBinding(owner),operator=operatorContext(context);
  if(!binding)throw Error('OWNER_BINDING_REQUIRED');
  if(typeof auth?.getUser!=='function'||typeof portal?.initialize!=='function'||typeof portal?.workspaceAccess!=='function')throw Error('INVALID_CONFIGURATION');
  let user;
  try {user=await auth.getUser(binding.uid);}catch {throw Error('VERIFIED_OWNER_ACCOUNT_REQUIRED');}
  if(!verifiedFirebaseAccount(user,binding.uid)||user.email!==binding.email||!user.providerData.some(item=>item?.providerId==='google.com'))throw Error('VERIFIED_OWNER_ACCOUNT_REQUIRED');
  const state={identities:[{id:binding.uid,active:true,wvdAdmin:true}],projects:[],memberships:[],milestones:[],receipts:[],outbox:[],feedback:[],tickets:[],replies:[]};
  // initialize uses a create-only Firestore transaction. Existing state is read
  // and validated, never replaced or promoted by this operator command.
  const result=await portal.initialize(state);
  let access;
  try {access=await portal.workspaceAccess(binding.uid);}catch {throw Error('OWNER_BOOTSTRAP_CONFLICT');}
  if(access.admin!==true)throw Error('OWNER_BOOTSTRAP_CONFLICT');
  return {status:result.created?'OWNER_BOOTSTRAP_CREATED':'OWNER_ALREADY_BOUND',created:result.created,ownerUid:binding.uid,...operator};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  let backend;
  try {
    const [configurationPath,contextPath,...extra]=process.argv.slice(2);
    if(!configurationPath||!contextPath||extra.length)throw Error('INVALID_OPERATOR_ARGUMENTS');
    const runtime=JSON.parse(readFileSync(configurationPath,'utf8'));
    const config=livePortalConfiguration(runtime.portal);
    const context=JSON.parse(readFileSync(contextPath,'utf8'));
    if(!config.owner)throw Error('OWNER_BINDING_REQUIRED');
    const {createFirebaseBackend}=await import('./firebase-backend.mjs');
    backend=createFirebaseBackend(config.firebase);
    const receipt=await bootstrapPortalOwner({auth:backend.auth,portal:backend.portal,owner:config.owner,context});
    console.log(JSON.stringify({projectId:config.firebase.projectId,productId:config.firebase.productId,...receipt}));
  }catch(error){
    const safe=new Set(['INVALID_OPERATOR_ARGUMENTS','INVALID_LIVE_CONFIGURATION','INVALID_OWNER_BINDING','OWNER_BINDING_REQUIRED','OPERATOR_CONTEXT_REQUIRED','VERIFIED_OWNER_ACCOUNT_REQUIRED','OWNER_BOOTSTRAP_CONFLICT','EMULATOR_ENVIRONMENT_FORBIDDEN','INVALID_FIREBASE_WEB_CONFIGURATION']);
    console.error(safe.has(error?.message)?error.message:'OWNER_BOOTSTRAP_FAILED');process.exitCode=1;
  }finally {if(backend)await backend.close();}
}
